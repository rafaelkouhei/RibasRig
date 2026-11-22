"""Regras do servidor para planos: numeração com trava, cálculo pelo motor e emissão imutável."""
from datetime import date

from django.db import IntegrityError, transaction

from cadastros.models import Acessorio, Cliente, EventoAcessorio, Guindaste, TipoIcamento
from motor import conversao as C
from motor.numeracao import numeros_em_sequencia, partes_numero, prefixo_da_data, proximo_numero
from motor.plano import EntradaCalculo, ResultadoPlano, calcular_plano, resultados_da_revisao, texto_bloqueio
from nucleo.excecoes import Conflito, RegraNegocio
from nucleo.models import Configuracoes
from nucleo.tempo import agora, hoje

from .json import dados_json
from .models import EventoHistorico, PlanoRigging, Revisao, SequenciaMensal, UsoCadastro


def registrar_evento(p: PlanoRigging, tipo: str, titulo: str, detalhe: str, usuario: str) -> None:
    EventoHistorico.objects.create(plano=p, tipo=tipo, titulo=titulo, detalhe=detalhe, usuario=usuario, quando=agora())


# =============================================================================================
# Numeração (AAMM + 3 dígitos, zera todo mês) com trava no banco
# =============================================================================================

def reservar_numeros(criacao: date, quantidade: int = 1) -> list[str]:
    """Reserva `quantidade` números seguidos no mês da criação. Precisa rodar dentro de transaction.atomic:
    a linha do mês fica travada (SELECT ... FOR UPDATE) até o fim da transação."""
    prefixo = prefixo_da_data(criacao)
    try:
        with transaction.atomic():
            SequenciaMensal.objects.get_or_create(prefixo=prefixo)
    except IntegrityError:
        pass  # outra transação criou a linha ao mesmo tempo
    seq = SequenciaMensal.objects.select_for_update().get(prefixo=prefixo)
    existentes = list(PlanoRigging.objects.filter(numero__startswith=prefixo).values_list('numero', flat=True))
    if seq.ultimo:
        existentes.append(f'{prefixo}{seq.ultimo:03d}')
    primeiro = proximo_numero(criacao, existentes)
    numeros = numeros_em_sequencia(primeiro, quantidade)
    seq.ultimo = partes_numero(numeros[-1])[1]  # type: ignore[index]
    seq.save(update_fields=['ultimo'])
    return numeros


# =============================================================================================
# Cálculo no servidor (mesmo motor e mesmas regras do front, em Decimal)
# =============================================================================================

def calcular(p: PlanoRigging) -> ResultadoPlano:
    acessorios = Acessorio.objects.all()
    guindastes = Guindaste.objects.prefetch_related('laudos', 'tabelas__pontos')
    outros_com_art = PlanoRigging.objects.exclude(id=p.id).exclude(art='').values_list('art', 'numero')
    return calcular_plano(EntradaCalculo(
        dados=C.dados_plano(dados_json(p)), numero=p.numero,
        acessorios=[C.acessorio(_acessorio_dict(a)) for a in acessorios],
        guindastes=[C.guindaste(_guindaste_dict(g)) for g in guindastes],
        tipos=[C.tipo({'id': t.id, 'balancim': t.balancim, 'pernas': t.pernas, 'pernas_superiores': t.pernas_superiores})
               for t in TipoIcamento.objects.all()],
        clientes=[C.cliente({'id': c.id, 'razao_social': c.razao_social, 'endereco': c.endereco}) for c in Cliente.objects.all()],
        hoje=hoje(), aviso_atencao_pct=Configuracoes.atual().aviso_atencao_pct, limite_pct=Configuracoes.atual().limite_pct,
        arts_em_uso={art.strip(): numero for art, numero in outros_com_art},
    ))


def _guindaste_dict(g: Guindaste) -> dict:
    # Direto dos campos Decimal (sem passar pelo JSON)
    return {
        'id': g.id, 'modelo': g.modelo, 'a_m': g.a_m, 'b_m': g.b_m, 'pg_kgf': g.pg_kgf,
        'laudos': [{'inicio': l.inicio, 'fim': l.fim, 'art': l.art, 'arquivo': l.arquivo, 'atual': l.atual} for l in g.laudos.all()],
        'tabelas': [{'id': t.chave, 'nome': t.nome, 'pontos': [{'alcance_m': pt.alcance_m, 'capacidade_kg': pt.capacidade_kg} for pt in t.pontos.all()]}
                    for t in g.tabelas.all()],
    }


def _acessorio_dict(a: Acessorio) -> dict:
    # Direto dos campos Decimal (sem passar pelo JSON)
    return {'id': a.id, 'descricao': a.descricao, 'nome_curto': a.nome_curto, 'capacidade_t': a.capacidade_t,
            'capacidade_trabalho_t': a.capacidade_trabalho_t, 'unidade_capacidade': a.unidade_capacidade, 'peso_kg': a.peso_kg,
            'situacao': a.situacao, 'proxima_inspecao': a.proxima_inspecao, 'vencimento': a.vencimento}


def nome_arquivo_plano(modelo: str, numero: str, rev: int) -> str:
    return modelo.replace('{nº}', numero).replace('{rev}', str(rev))


def _texto(v):
    return str(v) if v is not None and not isinstance(v, (str, int, bool)) else v


def entradas_da_revisao(p: PlanoRigging, r: ResultadoPlano) -> dict:
    """Cópia das entradas usadas: dados do plano, contratante, guindaste, acessórios (com capacidade e peso), gráfico
    de carga, versões das regras do tipo, empresa e responsável técnico e os arquivos anexados. Junto com
    `resultados`, permite reconstituir o cálculo e gerar de novo o mesmo documento."""
    ids = {i.acessorio.id for i in r.itens if i.acessorio} | ({p.dispositivo_acessorio_id} if p.dispositivo_acessorio_id else set())
    tipo = TipoIcamento.objects.filter(id=p.tipo_icamento_id).prefetch_related('regradotipo_set__regra').first()
    graficos = []
    for g, tab in [(r.guindaste, r.tabela), *[(a.guindaste, a.tabela) for a in r.adicionais]]:
        if g and tab:
            graficos.append({'guindaste_id': g.id, 'modelo': g.modelo, 'tabela_id': tab.id, 'nome': tab.nome,
                             'pontos': [{'alcance_m': str(pt.alcance_m), 'capacidade_kg': str(pt.capacidade_kg)} for pt in tab.pontos]})
    cfg = Configuracoes.atual()
    cliente = p.cliente
    g = p.guindaste
    laudo = g.laudos.filter(atual=True).first() if g else None
    return {
        'dados': dados_json(p),
        'cliente': {k: getattr(cliente, k) for k in ('id', 'razao_social', 'nome_pasta', 'cnpj', 'endereco', 'cidade', 'uf', 'cep')} if cliente else None,
        'guindaste': {k: _texto(getattr(g, k)) for k in ('id', 'modelo', 'codigo', 'veiculo', 'placa', 'chassi', 'ano', 'capacidade_nominal_t',
                                                          'comprimento_lanca_m', 'a_m', 'b_m', 'pg_kgf')} if g else None,
        'acessorios': [{k: _texto(v) for k, v in {**_acessorio_dict(a), 'tipo': a.tipo, 'norma': a.norma}.items()}
                       for a in Acessorio.objects.filter(id__in=ids)],
        'graficos': graficos,
        'tipo_icamento': {'id': tipo.id, 'nome': tipo.nome, 'versao': tipo.versao, 'balancim': tipo.balancim,
                          'regras': [{'id': rt.regra_id, 'versao': rt.regra.versao, 'formula': rt.regra.formula} for rt in tipo.regradotipo_set.all()]}
        if tipo else None,
        # Arquivos dos anexos nesta revisão (o plano pode trocá-los numa revisão seguinte)
        'arquivos': {'desenhos': str(p.anexo_desenhos_ref_id) if p.anexo_desenhos_ref_id else None,
                     'art_plano': str(p.anexo_art_ref_id) if p.anexo_art_ref_id else None,
                     'laudo': str(laudo.arquivo_ref_id) if laudo and laudo.arquivo_ref_id else None,
                     'laudo_nome': laudo.arquivo if laudo else None, 'laudo_art': laudo.art if laudo else None,
                     'logo': str(cfg.logo_id) if cfg.logo_id else None},
        'configuracoes': {'nome_arquivo': cfg.nome_arquivo,
                          'empresa': {k: getattr(cfg, f'empresa_{k}') for k in ('razao_social', 'cnpj', 'ie', 'endereco', 'cep')},
                          'responsavel': {k: getattr(cfg, f'responsavel_{k}') for k in ('nome_completo', 'nome_assinatura', 'titulo', 'crea', 'rnp', 'rpp')}},
        'aviso_atencao_pct': str(cfg.aviso_atencao_pct),
        'limite_pct': str(cfg.limite_pct),
        'hoje': hoje().isoformat(),
    }


@transaction.atomic
def emitir(numero: str, usuario, observacao: str = '') -> PlanoRigging:
    p = PlanoRigging.objects.select_for_update().filter(numero=numero).first()
    if p is None:
        from rest_framework.exceptions import NotFound
        raise NotFound(f'Plano {numero} não encontrado.')
    if p.situacao_documento == 'emitido':
        raise Conflito('Plano já emitido. Para mudar algo, crie uma nova revisão.')
    if p.art:
        # Trava os planos com a mesma ART: duas emissões ao mesmo tempo não usam a mesma ART
        list(PlanoRigging.objects.select_for_update().filter(art=p.art).order_by('id').values_list('id', flat=True))
    # A tela só oferece guindastes ativos; o servidor garante o mesmo (o rascunho pode ter sido salvo antes da desativação)
    ids_guindastes = {p.guindaste_id, *p.guindastes_adicionais.values_list('guindaste_id', flat=True)} - {None}
    inativos = list(Guindaste.objects.filter(id__in=ids_guindastes, ativo=False).values_list('modelo', flat=True))
    if inativos:
        raise RegraNegocio(f'Guindaste inativo no cadastro: {", ".join(sorted(inativos))}. Escolha um guindaste ativo.')
    r = calcular(p)
    if not r.pode_emitir:
        raise RegraNegocio(texto_bloqueio(r))

    quem = getattr(usuario, 'nome', '') or usuario.get_username()
    ultima = p.revisoes.order_by('-numero').first()
    rev = (ultima.numero if ultima else 0) + 1
    quando = agora()
    arquivo = nome_arquivo_plano(Configuracoes.atual().nome_arquivo, numero, rev)
    revisao = Revisao.objects.create(
        plano=p, numero=rev, emitida_em=quando, emitida_por=quem, origem='sistema', resultados=resultados_da_revisao(r),
        entradas=entradas_da_revisao(p, r), arquivo_pdf=arquivo, observacao=observacao,
    )
    # PDF do cliente e memorial interno gerados na mesma transação: se um falhar, a emissão não acontece
    from .documentos import gerar_documentos
    gerar_documentos(revisao, usuario)
    p.situacao_documento = 'emitido'
    p.etapa_atual = 6
    p.atualizado_em = quando
    p.save(update_fields=['situacao_documento', 'etapa_atual', 'atualizado_em'])

    ids_acessorios = {l.acessorio_id for l in p.lingada.all()} | ({p.dispositivo_acessorio_id} if p.dispositivo_acessorio_id else set())
    usos = [UsoCadastro(plano=p, tipo='acessorio', ref=str(i)) for i in ids_acessorios]
    tipo = TipoIcamento.objects.filter(id=p.tipo_icamento_id).first()
    if tipo:
        usos.append(UsoCadastro(plano=p, tipo='tipo', ref=tipo.id))
        usos += [UsoCadastro(plano=p, tipo='regra', ref=rid) for rid in tipo.regras.values_list('id', flat=True)]
    UsoCadastro.objects.bulk_create(usos, ignore_conflicts=True)
    EventoAcessorio.objects.bulk_create([
        EventoAcessorio(acessorio_id=i, data=hoje(), descricao=f'Usado no plano {numero} Rev. {rev}, emitido no sistema') for i in sorted(ids_acessorios)
    ])
    registrar_evento(p, 'emissao', f'Emitiu a Rev. {rev}', arquivo, quem)
    return p
