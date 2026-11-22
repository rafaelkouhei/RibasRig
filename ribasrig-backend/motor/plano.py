"""Plano de Rigging inteiro: validação dos campos → resultados, checklist, situação de segurança e se
pode emitir. Espelha `calcularPlano` de src/domain/plano.ts (mesmas regras, mesmas mensagens).

O servidor roda isto antes de emitir; o resultado vira a cópia gravada na revisão
(`resultados_da_revisao`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from .calculos import (
    ATENCAO_PADRAO_PCT, CEM, LIMITE_PCT, MIL, CapacidadeNoGrafico, ResultadoInspecao, ResultadoLaudo, ResultadoSapatas,
    capacidade_de_trabalho, capacidade_no_grafico, div, esforco_sapatas, extensao_que_alcanca, formula_posicao,
    laudo_atual, mul, nivel_taxa, nome_grafico, pior_situacao, situacao_inspecao, situacao_laudo, soma,
    tabela_do_guindaste, taxa_pct, tracoes_por_posicao,
)
from .entidades import Acessorio, Cliente, DadosPlano, Guindaste, Tabela, TipoIcamento
from .formatacao import Num, casas_de, data_br, fmt, fmt_pct
from .regras import erro_montagem_do_tipo
from .validacao import erro_numero_art, validar_campo

POSICOES = ['pernasInferiores', 'pernasSuperiores', 'carga', 'gancho']
NOME_POSICAO = {'pernasInferiores': 'pernas inferiores', 'pernasSuperiores': 'pernas superiores', 'carga': 'carga', 'gancho': 'gancho'}
ROTULO_POSICAO = {'pernasInferiores': 'Pernas inferiores', 'pernasSuperiores': 'Pernas superiores', 'carga': 'Carga', 'gancho': 'Gancho'}
POSICAO_INEXISTENTE = 'posição não existe neste tipo de içamento'
TEXTO_MONTAGEM_NAO_CALCULADA = 'montagem do tipo de içamento (número de pernas) não é calculada pelo sistema; ajuste o tipo em Cálculos'


@dataclass
class CampoPlano:
    valor: Num
    erro: str | None
    rotulo: str
    etapa: int
    ativo: bool


@dataclass
class ItemCalculado:
    indice: int
    acessorio: Acessorio | None
    quantidade: Num
    peso_total_kg: Num
    posicao: str | None
    erro_acessorio: str | None
    erro_posicao: str | None


@dataclass
class ResultadoPosicao:
    posicao: str
    obrigatoria: bool
    formula: str
    tracao: Num
    unidade: str
    quantidade_itens: int
    governante: Acessorio | None
    capacidade_governante: Num
    taxa_pct: Num
    nivel: str
    problema: str | None


@dataclass
class ResultadoAdicional:
    indice: int
    guindaste: Guindaste | None
    tabela: Tabela | None
    raio_m: Num
    pct: Num
    carga_kg: Num
    capacidade: CapacidadeNoGrafico
    capacidade_kg: Num
    taxa_pct: Num
    nivel: str
    repetido: bool
    laudo: ResultadoLaudo


@dataclass
class InspecaoItem:
    acessorio: Acessorio
    na_operacao: ResultadoInspecao
    hoje: ResultadoInspecao


@dataclass
class ItemChecklist:
    id: str
    rotulo: str
    ok: bool
    detalhe: str
    etapa: int


@dataclass
class ReferenciaConservadora:
    alcance_m: Decimal
    capacidade_kg: Decimal
    taxa_pct: Num


@dataclass
class ResultadoPlano:
    campos: dict[str, CampoPlano]
    campos_invalidos: list[dict]
    data_operacao: date | None
    art_numero: str
    art_erro: str | None
    tipo: TipoIcamento | None
    balancim: bool
    itens: list[ItemCalculado]
    carga_kg: Num
    lingada_kg: Num
    dispositivos_kg: Num
    extras_kg: Num
    pb_kg: Num
    p_t: Num
    b_t: Num
    guindaste: Guindaste | None
    tabela: Tabela | None
    raio_m: Num
    capacidade: CapacidadeNoGrafico
    capacidade_kg: Num
    referencia_conservadora: ReferenciaConservadora | None
    pct_principal: Num
    pb_principal_kg: Num
    taxa_guindaste: Num
    nivel_guindaste: str
    adicionais: list[ResultadoAdicional]
    divisao_invalida: bool
    por_posicao: list[ResultadoPosicao]
    sapatas: ResultadoSapatas
    laudo: ResultadoLaudo
    inspecoes: list[InspecaoItem]
    inspecoes_ok: bool
    inspecoes_detalhe: str
    isolamento_ok: bool
    anexos_pendentes: list[str]
    checklist: list[ItemChecklist]
    motivos_bloqueio: list[str]
    maior_taxa_pct: Num
    situacao_seguranca: str
    pode_emitir: bool

    @property
    def rmet(self) -> Num:
        return self.sapatas.rmet


@dataclass
class EntradaCalculo:
    dados: DadosPlano
    numero: str
    acessorios: list[Acessorio]
    guindastes: list[Guindaste]
    tipos: list[TipoIcamento]
    clientes: list[Cliente]
    hoje: date
    aviso_atencao_pct: Decimal = ATENCAO_PADRAO_PCT
    limite_pct: Decimal = LIMITE_PCT
    arts_em_uso: dict[str, str] = field(default_factory=dict)


def _lido(x: Num) -> str:
    return fmt(x, casas_de(x))


def _lido1(x: Num) -> str:
    return '—' if x is None else fmt(x, max(1, casas_de(x)))


def _cap1(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def _plural(n: int, um: str, varios: str) -> str:
    return um if n == 1 else varios


def calcular_plano(e: EntradaCalculo) -> ResultadoPlano:  # noqa: C901 — espelho fiel de calcularPlano
    f = e.dados
    aviso = e.aviso_atencao_pct
    limite = e.limite_pct
    lim_txt = fmt(limite, casas_de(limite))
    tipo = next((t for t in e.tipos if t.id == f.tipo_icamento_id), None)
    balancim = tipo.balancim if tipo else True

    # ---------- campos ----------
    campos: dict[str, CampoPlano] = {}

    def campo(chave: str, nome: str, valor: Num, etapa: int, rotulo: str, ativo: bool = True) -> Num:
        if not ativo:
            campos[chave] = CampoPlano(None, None, rotulo, etapa, False)
            return None
        r = validar_campo(nome, valor)
        campos[chave] = CampoPlano(r.valor, r.erro, rotulo, etapa, True)
        return r.valor

    campo('comprimento', 'dimensao', f.carga_comprimento_m, 2, 'Comprimento da carga')
    campo('largura', 'dimensao', f.carga_largura_m, 2, 'Largura da carga')
    campo('altura', 'dimensao', f.carga_altura_m, 2, 'Altura da carga')
    peso = campo('peso', 'pesoCarga', f.carga_peso_kg, 2, 'Peso da carga')
    ang_inf = campo('anguloInferior', 'angulo', f.angulo_inferior_graus, 3, 'Ângulo das pernas inferiores' if balancim else 'Ângulo das pernas')
    ang_sup = campo('anguloSuperior', 'angulo', f.angulo_superior_graus, 3, 'Ângulo das pernas superiores', balancim)
    disp_qtd = campo('dispositivoQtd', 'quantidade', f.dispositivo_quantidade, 3, 'Quantidade do dispositivo', balancim)
    disp_peso = campo('dispositivoPeso', 'pesoDispositivo', f.dispositivo_peso_unitario_kg, 3, 'Peso unitário do dispositivo', balancim)
    extras = campo('extras', 'cargasExtras', f.cargas_extras_kg, 3, 'Cargas extras')
    campo('lanca', 'comprimentoLanca', f.comprimento_lanca_m, 4, 'Comprimento da lança')
    raio = campo('raio', 'raio', f.raio_m, 4, 'Raio de operação')
    campo('vento', 'vento', f.vento_max_ms, 4, 'Vento máximo')
    isol = campo('isolamento', 'raioIsolamento', f.raio_isolamento_m, 4, 'Raio de isolamento')
    ld = campo('dormenteLargura', 'dormente', f.dormente_largura_cm, 4, 'Largura do dormente')
    cd = campo('dormenteComprimento', 'dormente', f.dormente_comprimento_cm, 4, 'Comprimento do dormente')
    nd = campo('dormenteQtd', 'dormentesPorSapata', f.dormente_quantidade, 4, 'Dormentes por sapata')
    isolamento_curto = isol is not None and raio is not None and isol < raio
    isolamento_digitado = isol
    if isolamento_curto:
        c = campos['isolamento']
        campos['isolamento'] = CampoPlano(None, f'Menor que o raio de operação ({_lido1(raio)} m).', c.rotulo, c.etapa, c.ativo)
        isol = None

    # ---------- lingada ----------
    por_id = {a.id: a for a in e.acessorios}
    itens: list[ItemCalculado] = []
    for i, it in enumerate(f.lingada):
        acessorio = por_id.get(it.acessorio_id)
        quantidade = campo(f'lingada.{i}.quantidade', 'quantidade', it.quantidade, 3, f'Quantidade do item {i + 1}')
        erro_posicao = ('Escolha a posição.' if not it.posicao
                        else 'Este tipo não tem pernas superiores.' if not balancim and it.posicao == 'pernasSuperiores' else None)
        itens.append(ItemCalculado(
            i, acessorio, quantidade, mul(quantidade, acessorio.peso_kg) if acessorio else None,
            it.posicao or None, None if acessorio else 'Escolha o acessório.', erro_posicao,
        ))
    lingada_kg = soma(*[x.peso_total_kg for x in itens]) if itens else Decimal(0)
    dispositivos_kg = mul(disp_qtd, disp_peso) if balancim else Decimal(0)
    pb_kg = soma(peso, lingada_kg, dispositivos_kg, extras)
    p_t = div(soma(peso, extras), MIL)
    b_t = div(dispositivos_kg, MIL)

    tracoes = tracoes_por_posicao(p_t, b_t, ang_inf, ang_sup, balancim)
    ang_txt = lambda a: '—' if a is None else f'{_lido(a)}°'  # noqa: E731
    obrigatorias = POSICOES if balancim else ['pernasInferiores']
    por_posicao: list[ResultadoPosicao] = []
    for p in POSICOES:
        na_pos = [x for x in itens if x.posicao == p]
        obrigatoria = p in obrigatorias
        if not obrigatoria and not na_pos:
            continue
        problema: str | None = None
        governante: Acessorio | None = None
        cap: Num = None
        if not balancim and p == 'pernasSuperiores':
            problema = POSICAO_INEXISTENTE
        elif not na_pos:
            problema = f'sem acessório na posição {NOME_POSICAO[p]}'
        else:
            for x in na_pos:
                c = capacidade_de_trabalho(x.acessorio)
                if not x.acessorio:
                    problema = 'item sem acessório escolhido'
                elif c is None:
                    problema = 'item sem capacidade no cadastro'
                elif governante is None or cap is None or c < cap:
                    governante, cap = x.acessorio, c
        tracao = tracoes[p]
        taxa = None if problema else taxa_pct(tracao, cap)
        unidade = governante.unidade_capacidade if governante else ('tf' if p in ('carga', 'gancho') else 't')
        por_posicao.append(ResultadoPosicao(
            p, obrigatoria, formula_posicao(p, balancim, ang_txt(ang_inf), ang_txt(ang_sup)), tracao, unidade,
            len(na_pos), governante, None if problema else cap, taxa, 'bloqueado' if problema else nivel_taxa(taxa, aviso, limite), problema,
        ))

    problemas_itens = [
        f'item {x.indice + 1}: {m.lower().removesuffix(".")}'
        for x in itens for m in (x.erro_acessorio, x.erro_posicao) if m
    ]
    problemas_lingada = [
        *(['nenhum acessório na lingada'] if not f.lingada else []),
        *([] if tipo else ['tipo de içamento não cadastrado']),
        *([TEXTO_MONTAGEM_NAO_CALCULADA] if tipo and tipo.pernas is not None
          and erro_montagem_do_tipo(tipo.balancim, tipo.pernas, tipo.pernas_superiores) else []),
        *problemas_itens,
        *[f'{NOME_POSICAO[r.posicao]}: {r.problema}' if r.problema == POSICAO_INEXISTENTE else r.problema
          for r in por_posicao if r.problema],
    ]

    # ---------- data da operação ----------
    data_op = f.data_operacao
    data_ok = data_op is not None
    anterior_a_hoje = data_ok and data_op < e.hoje  # type: ignore[operator]

    # ---------- guindastes ----------
    g_por_id = {g.id: g for g in e.guindastes}
    guindaste = g_por_id.get(f.guindaste_id) if f.guindaste_id is not None else None
    tabela = tabela_do_guindaste(guindaste, f.tabela_id)
    capacidade = capacidade_no_grafico(tabela.pontos, raio) if tabela else CapacidadeNoGrafico('sem-grafico')
    cap_kg = capacidade.capacidade_kg if capacidade.com_capacidade else None

    soma_pct: Num = Decimal(0)
    base_adicionais = []
    for k, a in enumerate(f.guindastes_adicionais):
        g = g_por_id.get(a.guindaste_id)
        tab = tabela_do_guindaste(g, a.tabela_id)
        r = campo(f'adicionais.{k}.raio', 'raio', a.raio_m, 4, f'Raio do guindaste adicional {k + 1}')
        pct = campo(f'adicionais.{k}.pct', 'pctAdicional', a.pct, 4, f'% da carga do guindaste adicional {k + 1}')
        soma_pct = soma(soma_pct, pct)
        repetido = a.guindaste_id is not None and (
            a.guindaste_id == f.guindaste_id or any(y.guindaste_id == a.guindaste_id for y in f.guindastes_adicionais[:k]))
        cap_a = capacidade_no_grafico(tab.pontos, r) if tab else CapacidadeNoGrafico('sem-grafico')
        base_adicionais.append((k, g, tab, r, pct, cap_a, repetido, situacao_laudo(g, data_op)))
    divisao_invalida = bool(base_adicionais) and soma_pct is not None and soma_pct >= CEM
    if base_adicionais:
        fracao = None if divisao_invalida else div(soma(CEM, -soma_pct if soma_pct is not None else None), CEM)
    else:
        fracao = Decimal(1)
    pb_principal_kg = mul(pb_kg, fracao)
    taxa_guindaste = taxa_pct(pb_principal_kg, cap_kg)
    nivel_guindaste = nivel_taxa(taxa_guindaste, aviso, limite)
    adicionais: list[ResultadoAdicional] = []
    for k, g, tab, r, pct, cap_a, repetido, laudo_a in base_adicionais:
        cap_a_kg = cap_a.capacidade_kg if cap_a.com_capacidade else None
        carga_kg = div(mul(pb_kg, pct), CEM)
        taxa = taxa_pct(carga_kg, cap_a_kg)
        adicionais.append(ResultadoAdicional(k, g, tab, r, pct, carga_kg, cap_a, cap_a_kg, taxa,
                                             'bloqueado' if repetido else nivel_taxa(taxa, aviso, limite), repetido, laudo_a))
    ext = extensao_que_alcanca(tabela.pontos, raio) if tabela and capacidade.com_capacidade else None
    referencia = ReferenciaConservadora(ext.alcance_m, ext.capacidade_kg, taxa_pct(pb_principal_kg, ext.capacidade_kg)) if ext else None

    sapatas = esforco_sapatas(pb_principal_kg, raio, guindaste.pg_kgf if guindaste else None, guindaste.a_m if guindaste else None,
                              guindaste.b_m if guindaste else None, ld, cd, nd)

    # ---------- laudo e inspeções ----------
    laudo = situacao_laudo(guindaste, data_op)
    laudos_ok = laudo.aprovado and all(a.laudo.aprovado for a in adicionais)

    vistos: set[int] = set()
    para_inspecionar: list[Acessorio] = []
    for x in itens:
        if x.acessorio and x.acessorio.id not in vistos:
            vistos.add(x.acessorio.id)
            para_inspecionar.append(x.acessorio)
    if balancim and f.dispositivo_acessorio_id is not None:
        d = por_id.get(f.dispositivo_acessorio_id)
        if d and d.id not in vistos:
            para_inspecionar.append(d)
    insp_itens = [InspecaoItem(a, situacao_inspecao(a, data_op), situacao_inspecao(a, e.hoje)) for a in para_inspecionar]
    reprovadas = [x for x in insp_itens if not x.na_operacao.aprovado]
    insp_ok = data_ok and not reprovadas
    com_proxima = sorted((x for x in insp_itens if x.na_operacao.proxima), key=lambda x: x.na_operacao.proxima)  # type: ignore[arg-type,return-value]
    prox = com_proxima[0] if com_proxima else None

    def dias_txt(n: int) -> str:
        return 'vence no dia da operação' if n == 0 else f'vence {n} {_plural(n, "dia", "dias")} depois da operação'

    if not data_ok:
        insp_detalhe = 'sem data da operação para conferir'
    elif reprovadas:
        insp_detalhe = 'problema na data da operação: ' + ', '.join(f'{x.acessorio.nome_curto} ({x.na_operacao.texto})' for x in reprovadas)
    else:
        insp_detalhe = f'em dia para {data_br(data_op)}' + (
            f' · {prox.acessorio.nome_curto} vence em {data_br(prox.na_operacao.proxima)} ({dias_txt(prox.na_operacao.dias or 0)})' if prox else '')

    # ---------- etapa 1: contratante, obra, ART ----------
    cliente = next((c for c in e.clientes if c.id == f.cliente_id), None) if f.cliente_id is not None else None
    obra = f.obra
    obra_ok = bool(cliente and cliente.endereco.strip()) if obra.mesmo_endereco_contratante else bool(obra.endereco.strip() and obra.cidade.strip())
    art_num = f.art.strip()
    dono_art = e.arts_em_uso.get(art_num) if art_num else None
    art_repetida = dono_art if dono_art and dono_art != e.numero else None
    art_erro = erro_numero_art(art_num) or (f'Esta ART já pertence ao plano {art_repetida}.' if art_repetida else None)
    art_ok = bool(art_num) and not art_erro

    # ---------- anexos ----------
    anexos_pendentes: list[str] = []
    if not f.anexos.desenhos:
        anexos_pendentes.append('Desenhos de posicionamento (falta)')
    if not f.anexos.art_plano or not f.anexos.arquivo_art:
        anexos_pendentes.append('ART do plano de rigging (falta)')
    elif not art_ok or f.anexos.arquivo_art != f'ART_{art_num}.pdf':
        anexos_pendentes.append('ART do plano de rigging (nome não confere com o nº da ART)')
    for g in [guindaste, *[a.guindaste for a in adicionais]]:
        if not g:
            continue
        la = laudo_atual(g)
        if not (la and la.arquivo):
            anexos_pendentes.append(f'Laudo técnico · {g.modelo} (falta)')
        if not (la and la.art.strip()):
            anexos_pendentes.append(f'ART do laudo · {g.modelo} (falta)')

    # ---------- consolidação ----------
    campos_invalidos = [{'chave': k, 'rotulo': c.rotulo, 'etapa': c.etapa, 'erro': c.erro} for k, c in campos.items() if c.ativo and c.erro]
    resultados_ok = pb_kg is not None and sapatas.esforco_kgf is not None and sapatas.rmet is not None
    raio_ok = guindaste is not None and capacidade.com_capacidade and all(a.capacidade.com_capacidade for a in adicionais)
    guind_ok = (taxa_guindaste is not None and nivel_guindaste != 'bloqueado' and not divisao_invalida
                and all(not a.repetido and a.taxa_pct is not None and a.nivel != 'bloqueado' for a in adicionais))
    acessorios_ok = not problemas_lingada and all(r.nivel != 'bloqueado' for r in por_posicao)
    isolamento_ok = isol is not None

    taxas = [t for t in [taxa_guindaste, *[a.taxa_pct for a in adicionais], *[r.taxa_pct for r in por_posicao]] if t is not None]
    maior_taxa = max(taxas) if taxas else None

    def nivel_txt(taxa: Num) -> str:
        if taxa is None:
            return 'Bloqueado · —'
        n = nivel_taxa(taxa, aviso, limite)
        return f'{"Bloqueado · " if n == "bloqueado" else "Atenção · " if n == "atencao" else ""}{fmt_pct(taxa)}'

    def raio_det(nome: str, c: CapacidadeNoGrafico, r: Num) -> str:
        if c.tipo == 'sem-grafico':
            s = 'sem gráfico cadastrado'
        elif r is None or c.tipo == 'raio-invalido':
            s = 'raio inválido'
        elif c.tipo == 'fora-do-grafico':
            s = f'raio {_lido1(r)} m fora do gráfico ({fmt(c.alcance_min_m)} a {fmt(c.alcance_max_m)} m)'
        else:
            s = f'raio {_lido1(r)} m dentro do gráfico'
        return f'{nome}: {s}'

    def nome_g(g: Guindaste | None) -> str:
        return g.modelo if g else 'guindaste não escolhido'

    validas = sorted((r for r in por_posicao if not r.problema and r.taxa_pct is not None), key=lambda r: r.taxa_pct, reverse=True)  # type: ignore[arg-type,return-value]
    maior_pos = validas[0] if validas else None
    sem_res = [NOME_POSICAO[r.posicao] for r in por_posicao if not r.problema and r.taxa_pct is None]

    n_inv = len(campos_invalidos)
    txt_inv = f'{n_inv} {"campos vazios ou fora da faixa" if n_inv > 1 else "campo vazio ou fora da faixa"}'
    if n_inv:
        detalhe_campos = f'{txt_inv}: ' + ', '.join(x['rotulo'].lower() for x in campos_invalidos[:3]) + ('…' if n_inv > 3 else '')
    else:
        detalhe_campos = 'nenhum campo vazio, inválido ou fora da faixa' if resultados_ok else 'esforço nas sapatas ou RMET sem resultado (faltam dados do guindaste)'
    if obra_ok:
        destino = 'endereço do contratante' if obra.mesmo_endereco_contratante else ' · '.join(
            x for x in [obra.nome, obra.endereco, f'{obra.cidade}{"/" + obra.uf.upper() if obra.uf else ""}'] if x.strip())
    else:
        destino = 'falta endereço/cidade'
    if problemas_lingada:
        detalhe_acess = '; '.join(problemas_lingada)
    elif sem_res:
        detalhe_acess = f'sem resultado por valor inválido: {", ".join(sem_res)}'
    elif maior_pos and maior_pos.governante:
        detalhe_acess = f'maior taxa: {maior_pos.governante.nome_curto} ({NOME_POSICAO[maior_pos.posicao]}) {nivel_txt(maior_pos.taxa_pct)}'
    else:
        detalhe_acess = '—'
    if isolamento_curto:
        detalhe_isol = f'{_lido1(isolamento_digitado)} m · menor que o raio de operação ({_lido1(raio)} m)'
    else:
        detalhe_isol = f'{_lido1(isol)} m' if isol is not None else 'valor inválido'

    checklist = [
        ItemChecklist('campos', 'Todos os campos com valores válidos', n_inv == 0 and resultados_ok, detalhe_campos,
                      campos_invalidos[0]['etapa'] if campos_invalidos else 4),
        ItemChecklist('contratante', 'Contratante e local da obra', cliente is not None and obra_ok,
                      f'{cliente.razao_social if cliente else "sem contratante"} → obra: {destino}', 1),
        ItemChecklist('data', 'Data da operação informada', data_ok,
                      f'{data_br(data_op)}{f" · aviso: anterior a hoje ({data_br(e.hoje)})" if anterior_a_hoje else ""}' if data_ok
                      else 'campo obrigatório: laudo e inspeções são conferidos contra ela', 1),
        ItemChecklist('laudo', 'Laudo do guindaste válido na data da operação', laudos_ok,
                      ' · '.join([f'{nome_g(guindaste)}: {laudo.texto}', *[f'{nome_g(a.guindaste)}: {a.laudo.texto}' for a in adicionais]])
                      + (f' · operação em {data_br(data_op)}' if data_ok else ''), 4),
        ItemChecklist('raio', 'Raio dentro do gráfico de carga', raio_ok,
                      ' · '.join([raio_det(nome_g(guindaste), capacidade, raio), *[raio_det(nome_g(a.guindaste), a.capacidade, a.raio_m) for a in adicionais]]), 4),
        ItemChecklist('guindaste', f'Guindastes até {lim_txt}%' if adicionais else f'Guindaste até {lim_txt}%', guind_ok,
                      f'{nome_g(guindaste)} {nivel_txt(taxa_guindaste)}'
                      + ''.join(f' · {nome_g(a.guindaste)}{" repetido" if a.repetido else " " + nivel_txt(a.taxa_pct)}' for a in adicionais)
                      + (' · divisão da carga passa de 100%' if divisao_invalida else ''), 4),
        ItemChecklist('acessorios', f'Acessórios até {lim_txt}%', acessorios_ok, detalhe_acess, 3),
        ItemChecklist('inspecoes', 'Acessórios com inspeção em dia', insp_ok, insp_detalhe, 3),
        ItemChecklist('isolamento', 'Raio de isolamento cobre o raio de operação', isolamento_ok, detalhe_isol, 4),
        ItemChecklist('anexos', 'Anexos obrigatórios', not anexos_pendentes,
                      ', '.join(anexos_pendentes) if anexos_pendentes else 'desenhos, ART do plano, laudo e ART do guindaste', 5),
        ItemChecklist('art', 'Nº da ART do plano', art_ok,
                      (art_erro or f'nº {art_num}') if art_num else 'falta informar · vai no cabeçalho, no procedimento e nos desenhos', 1),
    ]

    # ---------- situação de segurança ----------
    motivos: list[str] = []
    pos_sem_taxa = any(not r.problema and r.taxa_pct is None for r in por_posicao)
    if (pb_kg is None or taxa_guindaste is None or pos_sem_taxa or not resultados_ok
            or any(not a.repetido and a.taxa_pct is None for a in adicionais)):
        motivos.append('faltam valores válidos para calcular')
    if ((taxa_guindaste is not None and nivel_guindaste == 'bloqueado')
            or any(a.taxa_pct is not None and nivel_taxa(a.taxa_pct, aviso, limite) == 'bloqueado' for a in adicionais)
            or any(r.taxa_pct is not None and r.nivel == 'bloqueado' for r in por_posicao)):
        motivos.append(f'taxa acima de {lim_txt}%')
    if problemas_lingada:
        motivos.append(f'lingada incompleta ({problemas_lingada[0]})')
    if not guindaste:
        motivos.append('guindaste não escolhido')
    elif capacidade.tipo == 'sem-grafico':
        motivos.append(f'sem gráfico de carga cadastrado para o {guindaste.modelo}')
    elif capacidade.tipo == 'fora-do-grafico':
        motivos.append(f'raio fora do gráfico de carga do {guindaste.modelo}')
    for a in adicionais:
        if a.repetido:
            motivos.append(f'guindaste adicional {a.indice + 1} repetido')
        elif a.capacidade.tipo == 'sem-grafico':
            motivos.append(f'sem gráfico de carga para o {nome_g(a.guindaste)}')
        elif a.capacidade.tipo == 'fora-do-grafico':
            motivos.append(f'raio fora do gráfico do {nome_g(a.guindaste)}')
    if divisao_invalida:
        motivos.append('divisão da carga entre guindastes passa de 100%')
    if not laudos_ok:
        pares = [(laudo, guindaste), *[(a.laudo, a.guindaste) for a in adicionais]]
        for l, g in pares:
            if l.aprovado:
                continue
            if l.situacao == 'vencido':
                motivos.append(f'laudo do {nome_g(g)} vencido em {data_br(l.fim)}')
            elif l.situacao == 'sem-data':
                motivos.append('laudo do guindaste sem data da operação para conferir')
            else:
                motivos.append(f'{nome_g(g)} sem laudo cadastrado' if g else 'guindaste não escolhido')
    if data_ok and reprovadas:
        motivos.append(f'acessório com inspeção vencida ou indisponível ({reprovadas[0].acessorio.nome_curto})')
    if isolamento_curto:
        motivos.append('raio de isolamento menor que o raio de operação')
    if n_inv:
        motivos.append(txt_inv)
    motivos_bloqueio = list(dict.fromkeys(motivos))

    situacao = 'bloqueado' if motivos_bloqueio else pior_situacao([nivel_guindaste, *[a.nivel for a in adicionais], *[r.nivel for r in por_posicao]])

    return ResultadoPlano(
        campos=campos, campos_invalidos=campos_invalidos, data_operacao=data_op, art_numero=art_num, art_erro=art_erro,
        tipo=tipo, balancim=balancim, itens=itens, carga_kg=peso, lingada_kg=lingada_kg, dispositivos_kg=dispositivos_kg,
        extras_kg=extras, pb_kg=pb_kg, p_t=p_t, b_t=b_t, guindaste=guindaste, tabela=tabela, raio_m=raio,
        capacidade=capacidade, capacidade_kg=cap_kg, referencia_conservadora=referencia,
        pct_principal=mul(fracao, CEM), pb_principal_kg=pb_principal_kg, taxa_guindaste=taxa_guindaste,
        nivel_guindaste=nivel_guindaste, adicionais=adicionais, divisao_invalida=divisao_invalida, por_posicao=por_posicao,
        sapatas=sapatas, laudo=laudo, inspecoes=insp_itens, inspecoes_ok=insp_ok, inspecoes_detalhe=insp_detalhe,
        isolamento_ok=isolamento_ok, anexos_pendentes=anexos_pendentes, checklist=checklist,
        motivos_bloqueio=motivos_bloqueio, maior_taxa_pct=maior_taxa, situacao_seguranca=situacao,
        pode_emitir=situacao != 'bloqueado' and all(c.ok for c in checklist),
    )


def texto_bloqueio(r: ResultadoPlano) -> str:
    """Mensagem do 422 quando não dá para emitir (mesma do mock do front)."""
    pendentes = [c.rotulo.lower() for c in r.checklist if not c.ok]
    return f'Não dá para emitir: {"; ".join([*r.motivos_bloqueio, *pendentes])}.'


def texto_situacao(r: ResultadoPlano) -> str:
    return _cap1('; '.join(r.motivos_bloqueio)) + '.' if r.motivos_bloqueio else ''


# =============================================================================================
# Cópia gravada na revisão (ResultadosRevisao do front, em snake_case; números como float)
# =============================================================================================

def _num(v: Num) -> float | None:
    return float(v) if v is not None else None


def _iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def resultados_da_revisao(r: ResultadoPlano) -> dict:
    """Converte o resultado no formato gravado em Revisao.resultados. O cálculo é em Decimal; a cópia
    guarda float (15–17 dígitos significativos), que é o que o JSON e o front usam."""
    principal = []
    if r.guindaste:
        principal = [{
            'guindaste_id': r.guindaste.id, 'modelo': r.guindaste.modelo, 'tabela_nome': nome_grafico(r.tabela) if r.tabela else None,
            'raio_m': _num(r.raio_m), 'pct_carga': _num(r.pct_principal), 'carga_kg': _num(r.pb_principal_kg),
            'capacidade_kg': _num(r.capacidade_kg), 'taxa_pct': _num(r.taxa_guindaste),
            'laudo_fim': _iso(r.laudo.fim), 'laudo_art': r.laudo.laudo.art if r.laudo.laudo else None,
        }]
    adicionais = [{
        'guindaste_id': a.guindaste.id, 'modelo': a.guindaste.modelo, 'tabela_nome': nome_grafico(a.tabela) if a.tabela else None,
        'raio_m': _num(a.raio_m), 'pct_carga': _num(a.pct), 'carga_kg': _num(a.carga_kg), 'capacidade_kg': _num(a.capacidade_kg),
        'taxa_pct': _num(a.taxa_pct), 'laudo_fim': _iso(a.laudo.fim), 'laudo_art': a.laudo.laudo.art if a.laudo.laudo else None,
    } for a in r.adicionais if a.guindaste]
    ref = r.referencia_conservadora
    return {
        'data_operacao': _iso(r.data_operacao),
        'carga_kg': _num(r.carga_kg), 'lingada_kg': _num(r.lingada_kg), 'dispositivos_kg': _num(r.dispositivos_kg),
        'extras_kg': _num(r.extras_kg), 'pb_kg': _num(r.pb_kg),
        'guindastes': principal + adicionais,
        'capacidade_kg': _num(r.capacidade_kg), 'taxa_guindaste_pct': _num(r.taxa_guindaste),
        'referencia_conservadora_kg': _num(ref.capacidade_kg) if ref else None,
        'taxa_referencia_pct': _num(ref.taxa_pct) if ref else None,
        'posicoes': [{
            'posicao': p.posicao, 'acessorio_id': p.governante.id if p.governante else None,
            'descricao': p.governante.descricao if p.governante else ROTULO_POSICAO[p.posicao],
            'angulo_graus': _num(r.campos['anguloSuperior'].valor if p.posicao == 'pernasSuperiores' else r.campos['anguloInferior'].valor),
            'tracao': _num(p.tracao), 'unidade': p.unidade, 'capacidade': _num(p.capacidade_governante), 'taxa_pct': _num(p.taxa_pct),
        } for p in r.por_posicao],
        'sapatas': {
            'momento_kgfm': _num(r.sapatas.momento_kgfm), 'forca_kgf': _num(r.sapatas.forca_kgf), 'esforco_kgf': _num(r.sapatas.esforco_kgf),
            'area_cm2': _num(r.sapatas.area_cm2), 'rmet': _num(r.sapatas.rmet),
        },
        'raio_isolamento_m': _num(r.campos['isolamento'].valor), 'vento_max_ms': _num(r.campos['vento'].valor),
        'situacao_seguranca': r.situacao_seguranca, 'como_no_documento': None,
    }
