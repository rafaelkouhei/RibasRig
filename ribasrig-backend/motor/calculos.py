"""Funções puras do motor, em Decimal e SEM ARREDONDAR (espelha src/domain/calculos.ts).

Valor inválido = None (no front, NaN). Toda conta com None dá None.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, localcontext

from .entidades import Acessorio, Guindaste, Laudo, Ponto, Tabela
from .formatacao import Num, data_br, dias_entre

LIMITE_PCT = Decimal(85)
ATENCAO_PADRAO_PCT = Decimal(75)
AVISO_VENCIMENTO_DIAS = 30
# Mantida igual ao front; com Decimal 85,00% já é exato, a tolerância quase nunca atua.
TOLERANCIA_PCT = Decimal('1e-9')
CEM = Decimal(100)
MIL = Decimal(1000)


def nao_negativo(v: Num) -> Num:
    return v if v is not None and v >= 0 else None


def soma(*vs: Num) -> Num:
    return None if any(v is None for v in vs) else sum(vs, Decimal(0))  # type: ignore[arg-type]


def mul(*vs: Num) -> Num:
    if any(v is None for v in vs):
        return None
    r = Decimal(1)
    for v in vs:
        r *= v  # type: ignore[operator]
    return r


def div(a: Num, b: Num) -> Num:
    return None if a is None or b is None or b == 0 else a / b


def nivel_taxa(taxa: Num, aviso: Decimal = ATENCAO_PADRAO_PCT, limite: Decimal = LIMITE_PCT) -> str:
    """nivel_taxa(85) → 'atencao' · 85.06 → 'bloqueado' · 75 → 'atencao' · 74.99 → 'ok'. None/negativo = 'bloqueado'.
    `limite` vem das Configurações (85% por padrão; o valor exato do limite é permitido)."""
    if taxa is None or taxa < 0:
        return 'bloqueado'
    if taxa > limite + TOLERANCIA_PCT:
        return 'bloqueado'
    if taxa >= aviso - TOLERANCIA_PCT:
        return 'atencao'
    return 'ok'


def pior_situacao(lista: list[str]) -> str:
    if 'bloqueado' in lista:
        return 'bloqueado'
    if 'atencao' in lista:
        return 'atencao'
    return 'ok'


def taxa_pct(carga: Num, capacidade: Num) -> Num:
    """carga ÷ capacidade × 100. Inválido, negativo ou capacidade ≤ 0 = None."""
    if carga is None or carga < 0 or capacidade is None or capacidade <= 0:
        return None
    return carga / capacidade * CEM


# =============================================================================================
# Trigonometria em Decimal (receitas da documentação do módulo decimal)
# =============================================================================================

def _pi() -> Decimal:
    with localcontext() as ctx:
        ctx.prec += 2
        three = Decimal(3)
        lasts, t, s, n, na, d, da = Decimal(0), three, three, 1, 0, 0, 24
        while s != lasts:
            lasts = s
            n, na = n + na, na + 8
            d, da = d + da, da + 32
            t = (t * n) / d
            s += t
    return +s


def _serie(x: Decimal, cosseno: bool) -> Decimal:
    with localcontext() as ctx:
        ctx.prec += 2
        if cosseno:
            i, lasts, s, fact, num, sign = 0, Decimal(0), Decimal(1), 1, Decimal(1), 1
        else:
            i, lasts, s, fact, num, sign = 1, Decimal(0), x, 1, x, 1
        while s != lasts:
            lasts = s
            i += 2
            fact *= i * (i - 1)
            num *= x * x
            sign *= -1
            s += num / fact * sign
    return +s


def radianos(graus: Decimal) -> Decimal:
    reduzido = graus % 360  # mantém a série curta e exata para ângulos grandes
    return reduzido * _pi() / 180


def cos_graus(graus: Decimal) -> Decimal:
    return _serie(radianos(graus), True)


def sen_graus(graus: Decimal) -> Decimal:
    return _serie(radianos(graus), False)


_QUASE_ZERO = Decimal('1e-12')


def cos_positivo(graus: Num) -> Num:
    """cos em graus; ≤ 0 (90° ou mais) ou entrada inválida/negativa = None."""
    if graus is None or graus < 0:
        return None
    c = cos_graus(graus)
    return c if c > _QUASE_ZERO else None


# =============================================================================================
# Gráfico de carga
# =============================================================================================

@dataclass
class CapacidadeNoGrafico:
    """tipo: 'sem-grafico' | 'raio-invalido' | 'fora-do-grafico' | 'exato' | 'interpolado'"""
    tipo: str
    capacidade_kg: Num = None
    lado: str | None = None
    alcance_min_m: Num = None
    alcance_max_m: Num = None
    p1: Ponto | None = None
    p2: Ponto | None = None

    @property
    def com_capacidade(self) -> bool:
        return self.tipo in ('exato', 'interpolado')


def pontos_ordenados(pontos: list[Ponto]) -> list[Ponto] | None:
    """Pontos válidos e ordenados; None se vazio, com ponto inválido ou alcance repetido."""
    if not pontos:
        return None
    if any(p.alcance_m is None or p.capacidade_kg is None or p.alcance_m <= 0 or p.capacidade_kg <= 0 for p in pontos):
        return None
    pts = sorted(pontos, key=lambda p: p.alcance_m)
    if any(pts[i].alcance_m == pts[i - 1].alcance_m for i in range(1, len(pts))):
        return None
    return pts


def capacidade_no_grafico(pontos: list[Ponto], raio_m: Num) -> CapacidadeNoGrafico:
    """Interpolação linear: C = C1 + (r − r1)(C2 − C1)/(r2 − r1). Fora do gráfico BLOQUEIA (não extrapola).
    MD 45.007, raio 5,0 → 9.260 kg (interpolado) · 5,98 → 7.300 (exato) · 3 ou 18 → fora-do-grafico."""
    pts = pontos_ordenados(pontos)
    if not pts:
        return CapacidadeNoGrafico('sem-grafico')
    if raio_m is None or raio_m <= 0:
        return CapacidadeNoGrafico('raio-invalido')
    amin, amax = pts[0].alcance_m, pts[-1].alcance_m
    if raio_m < amin:
        return CapacidadeNoGrafico('fora-do-grafico', lado='abaixo', alcance_min_m=amin, alcance_max_m=amax)
    if raio_m > amax:
        return CapacidadeNoGrafico('fora-do-grafico', lado='acima', alcance_min_m=amin, alcance_max_m=amax)
    for p in pts:
        if p.alcance_m == raio_m:
            return CapacidadeNoGrafico('exato', p.capacidade_kg, alcance_min_m=amin, alcance_max_m=amax, p1=p)
    for p1, p2 in zip(pts, pts[1:]):
        if p1.alcance_m < raio_m < p2.alcance_m:
            c = p1.capacidade_kg + (raio_m - p1.alcance_m) * (p2.capacidade_kg - p1.capacidade_kg) / (p2.alcance_m - p1.alcance_m)
            return CapacidadeNoGrafico('interpolado', c, alcance_min_m=amin, alcance_max_m=amax, p1=p1, p2=p2)
    return CapacidadeNoGrafico('sem-grafico')  # inalcançável com pontos válidos


def extensao_que_alcanca(pontos: list[Ponto], raio_m: Num) -> Ponto | None:
    """Referência conservadora: primeiro ponto com alcance ≥ raio (5,0 m → 5,98 m / 7.300 kg)."""
    pts = pontos_ordenados(pontos)
    if not pts or raio_m is None or raio_m <= 0 or raio_m < pts[0].alcance_m:
        return None
    return next((p for p in pts if p.alcance_m >= raio_m), None)


def tabela_do_guindaste(g: Guindaste | None, tabela_id: str | None) -> Tabela | None:
    """Gráfico escolhido; sem escolha, o primeiro. Escolha que não existe mais (gráfico apagado ou renomeado) = None:
    bloqueia como 'sem gráfico' em vez de calcular com outra configuração de lança sem avisar."""
    if not g or not g.tabelas:
        return None
    if not tabela_id:
        return g.tabelas[0]
    return next((t for t in g.tabelas if t.id == tabela_id), None)


def nome_grafico(t: Tabela | None) -> str:
    if not t:
        return 'sem gráfico cadastrado'
    n = len(t.pontos)
    return f'Gráfico de carga · {t.nome} ({n} {"extensão" if n == 1 else "extensões"})'


# =============================================================================================
# Lingada: tração por posição
# =============================================================================================

def tracoes_por_posicao(p_t: Num, balancim_t: Num, angulo_inferior: Num, angulo_superior: Num, balancim: bool) -> dict[str, Num]:
    """Com balancim: inf = P/(2 cos αi) · sup = (P+B)/(2 cos αs) · carga = P/(4 cos αi) · gancho = 2·sup.
    Sem balancim: pernas = carga = P/(2 cos α) · gancho = 2·pernas · sup não existe."""
    P = nao_negativo(p_t)
    B = nao_negativo(balancim_t) if balancim else Decimal(0)
    ci = cos_positivo(angulo_inferior)
    dois, quatro = Decimal(2), Decimal(4)
    if balancim:
        cs = cos_positivo(angulo_superior)
        sup = div(soma(P, B), mul(dois, cs))
        return {'pernasInferiores': div(P, mul(dois, ci)), 'pernasSuperiores': sup, 'carga': div(P, mul(quatro, ci)), 'gancho': mul(dois, sup)}
    pernas = div(P, mul(dois, ci))
    return {'pernasInferiores': pernas, 'pernasSuperiores': None, 'carga': div(P, mul(dois, ci)), 'gancho': mul(dois, pernas)}


def formula_posicao(posicao: str, balancim: bool, ang_inf: str, ang_sup: str) -> str:
    if balancim:
        return {'pernasInferiores': f'P ÷ (2 · cos {ang_inf})', 'pernasSuperiores': f'(P + balancim) ÷ (2 · cos {ang_sup})',
                'carga': f'P ÷ (4 · cos {ang_inf})', 'gancho': '2 · Te superior'}[posicao]
    return {'pernasInferiores': f'P ÷ (2 · cos {ang_inf})', 'pernasSuperiores': 'não existe neste tipo',
            'carga': f'P ÷ (2 · cos {ang_inf})', 'gancho': '2 · Te das pernas'}[posicao]


def capacidade_de_trabalho(a: Acessorio | None) -> Num:
    if not a:
        return None
    c = a.capacidade_trabalho_t if a.capacidade_trabalho_t is not None else a.capacidade_t
    return c if c is not None and c > 0 else None


# =============================================================================================
# Sapatas e terreno
# =============================================================================================

@dataclass
class ResultadoSapatas:
    momento_kgfm: Num
    forca_kgf: Num
    esforco_kgf: Num
    area_cm2: Num
    rmet: Num


def esforco_sapatas(pb_kg: Num, raio_m: Num, pg_kgf: Num, a_m: Num, b_m: Num, largura_cm: Num, comprimento_cm: Num, quantidade: Num) -> ResultadoSapatas:
    """M = Pb × R · F = M ÷ (a + b) · ES = Pg ÷ 2 + F · área = LD × CD × ND · RMET = ES ÷ área.
    2607036 → ES 7.940,68 kgf, RMET 3,1763."""
    ok = nao_negativo
    momento = mul(ok(pb_kg), ok(raio_m))
    vao = soma(ok(a_m), ok(b_m))
    forca = div(momento, vao) if vao is not None and vao > 0 else None
    esforco = soma(div(ok(pg_kgf), Decimal(2)), forca)
    area = mul(ok(largura_cm), ok(comprimento_cm), ok(quantidade))
    rmet = div(esforco, area) if area is not None and area > 0 else None
    return ResultadoSapatas(momento, forca, esforco, area, rmet)


# =============================================================================================
# Laudo do guindaste e inspeção dos acessórios
# =============================================================================================

@dataclass
class ResultadoLaudo:
    situacao: str  # 'vencido' | 'vence-em-breve' | 'em-dia' | 'nao-cadastrado' | 'sem-data'
    aprovado: bool
    dias: int | None
    fim: date | None
    laudo: Laudo | None
    texto: str


def laudo_atual(g: Guindaste | None) -> Laudo | None:
    """Laudo vigente: o marcado como atual; senão, o de fim mais recente."""
    if not g or not g.laudos:
        return None
    atual = next((l for l in g.laudos if l.atual), None)
    return atual or sorted(g.laudos, key=lambda l: l.fim.isoformat() if l.fim else '', reverse=True)[0]


def _vence_em(dias: int, fim: date, prefixo: str = '') -> str:
    if dias == 0:
        return f'{prefixo}vence no dia ({data_br(fim)})'
    return f'{prefixo}vence em {dias} {"dia" if dias == 1 else "dias"} ({data_br(fim)})'


def situacao_laudo(g: Guindaste | None, referencia: date | None) -> ResultadoLaudo:
    """No plano a referência é a DATA DA OPERAÇÃO; no cadastro, hoje."""
    laudo = laudo_atual(g)
    fim = laudo.fim if laudo else None
    if not laudo or not fim:
        return ResultadoLaudo('nao-cadastrado', False, None, None, laudo, 'sem laudo cadastrado')
    if not referencia:
        return ResultadoLaudo('sem-data', False, None, fim, laudo, 'sem data da operação para conferir')
    dias = dias_entre(referencia, fim)
    if dias < 0:
        return ResultadoLaudo('vencido', False, dias, fim, laudo, f'vencido em {data_br(fim)}')
    if dias <= AVISO_VENCIMENTO_DIAS:
        return ResultadoLaudo('vence-em-breve', True, dias, fim, laudo, _vence_em(dias, fim))
    return ResultadoLaudo('em-dia', True, dias, fim, laudo, f'válido até {data_br(fim)}')


@dataclass
class ResultadoInspecao:
    situacao: str  # 'em-dia' | 'vence-em-breve' | 'vencida' | 'sem-inspecao' | 'indisponivel' | 'sem-data'
    aprovado: bool
    dias: int | None
    proxima: date | None
    motivo: str  # 'inspecao' | 'validade'
    texto: str


def _so_inspecao(a: Acessorio | None, referencia: date | None) -> ResultadoInspecao:
    m = 'inspecao'
    if not a:
        return ResultadoInspecao('indisponivel', False, None, None, m, 'acessório não cadastrado')
    proxima = a.proxima_inspecao
    if a.situacao != 'uso':
        texto = {'inspecao': 'em inspeção', 'descartado': 'descartado', 'inativo': 'inativo'}.get(a.situacao, a.situacao)
        return ResultadoInspecao('indisponivel', False, None, proxima, m, texto)
    if not proxima:
        return ResultadoInspecao('sem-inspecao', False, None, None, m, 'próxima inspeção não informada')
    if not referencia:
        return ResultadoInspecao('sem-data', False, None, proxima, m, 'sem data da operação para conferir')
    dias = dias_entre(referencia, proxima)
    if dias < 0:
        return ResultadoInspecao('vencida', False, dias, proxima, m, f'inspeção vencida em {data_br(proxima)}')
    if dias <= AVISO_VENCIMENTO_DIAS:
        texto = f'inspeção vence no dia ({data_br(proxima)})' if dias == 0 else _vence_em(dias, proxima)
        return ResultadoInspecao('vence-em-breve', True, dias, proxima, m, texto)
    return ResultadoInspecao('em-dia', True, dias, proxima, m, f'inspeção em dia até {data_br(proxima)}')


def situacao_inspecao(a: Acessorio | None, referencia: date | None) -> ResultadoInspecao:
    """Inspeção periódica e validade do item; vale o que vence primeiro."""
    insp = _so_inspecao(a, referencia)
    venc = a.vencimento if a else None
    if not a or a.situacao != 'uso' or not venc or not referencia:
        return insp
    dias = dias_entre(referencia, venc)
    if dias < 0:
        return ResultadoInspecao('vencida', False, dias, venc, 'validade', f'validade vencida em {data_br(venc)}')
    if not insp.aprovado:
        return insp
    if dias <= AVISO_VENCIMENTO_DIAS and (insp.dias is None or dias <= insp.dias):
        return ResultadoInspecao('vence-em-breve', True, dias, venc, 'validade', _vence_em(dias, venc, 'validade '))
    return insp
