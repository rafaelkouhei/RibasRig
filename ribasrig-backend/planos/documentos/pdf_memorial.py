"""Memorial de cálculo interno (não vai no PDF do cliente). Mesmas seções e textos de visualizacao/memorial.ts:
os resultados vêm da revisão; os passos intermediários (cos α, P ÷ 2…) são recalculados só para mostrar."""
import io
import math
from dataclasses import dataclass

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Spacer, Table, TableStyle

from motor.calculos import LIMITE_PCT, capacidade_no_grafico, extensao_que_alcanca, nivel_taxa
from motor.entidades import Ponto
from motor.formatacao import casas_de, dec
from motor.plano import NOME_POSICAO, POSICOES

from .contexto import Contexto
from .formatos import f, kg, pct
from .pdf_plano import PRETO, P, _construir, _doc, _estilos, _logo


@dataclass
class Secao:
    titulo: str
    linhas: list[tuple[str, bool]]
    resultado: str


def _ok(v) -> bool:
    return isinstance(v, (int, float)) and math.isfinite(v)


def _n(v) -> float:
    """Número para os passos intermediários (float, Decimal ou texto da cópia gravada); ausente = NaN ("—")."""
    try:
        return float(v) if v is not None and not isinstance(v, bool) else math.nan
    except (TypeError, ValueError):
        return math.nan


def f4(v) -> str:
    return f(v if _ok(v) else None, 4)


def f2(v) -> str:
    return f(v if _ok(v) else None, 2)


def graus(v) -> str:
    return f'{f(v, casas_de(dec(v)))}°' if _ok(v) else '—'


def veredito(taxa, aviso, limite=LIMITE_PCT) -> str:
    if not _ok(taxa):
        return '· sem resultado · Bloqueado'
    nivel = nivel_taxa(dec(taxa), aviso, limite)
    lim = f(limite, casas_de(limite))
    if nivel == 'bloqueado':
        return f'> {lim}% · Bloqueado'
    if nivel == 'atencao':
        return f'≤ {lim}% · Atenção (a partir de {f(aviso, casas_de(aviso))}%)'
    return f'≤ {lim}% ✓'


def _carga_bruta(r: dict) -> Secao:
    return Secao('Composição da carga bruta', [
        ('Pb = carga líquida + lingada/amarração + dispositivos + cargas extras', False),
        (f"Pb = {f2(r['carga_kg'])} + {f2(r['lingada_kg'])} + {f2(r['dispositivos_kg'])} + {f2(r['extras_kg'] or 0)}", False),
    ], f"Pb = {f2(r['pb_kg'])} kg ({f2(_n(r['pb_kg']) / 1000)} t)")


def _interpolacao(tabela: dict | None, raio: float, cap_kg: float) -> list[tuple[str, bool]]:
    if not tabela:
        return [('Guindaste sem gráfico de carga cadastrado: sem capacidade, o plano fica bloqueado.', False)]
    pontos = [Ponto(dec(p['alcance_m']), dec(p['capacidade_kg'])) for p in tabela['pontos']]  # type: ignore[arg-type]
    n = len(pontos)
    nome = f"Gráfico de carga · {tabela['nome']} ({n} {'extensão' if n == 1 else 'extensões'})"
    c = capacidade_no_grafico(pontos, dec(raio))
    if c.tipo == 'interpolado':
        p1, p2 = c.p1, c.p2
        delta = (dec(raio) - p1.alcance_m) * (p2.capacidade_kg - p1.capacidade_kg) / (p2.alcance_m - p1.alcance_m)
        return [
            (f'{nome}. O raio de operação {f(raio, 1)} m fica entre dois pontos do gráfico: interpolação linear entre '
             f'{f2(float(p1.alcance_m))} m ({kg(p1.capacidade_kg)} kg) e {f2(float(p2.alcance_m))} m ({kg(p2.capacidade_kg)} kg)', False),
            ('C = C1 + (r − r1) × (C2 − C1) ÷ (r2 − r1)', False),
            (f'C = {kg(p1.capacidade_kg)} + ({f2(raio)} − {f2(float(p1.alcance_m))}) × ({kg(p2.capacidade_kg)} − {kg(p1.capacidade_kg)}) ÷ '
             f"({f2(float(p2.alcance_m))} − {f2(float(p1.alcance_m))}) = {kg(p1.capacidade_kg)} {'−' if delta < 0 else '+'} {f2(float(abs(delta)))} = {kg(cap_kg)} kg", False),
        ]
    if c.tipo == 'exato':
        return [(f'{nome}. O raio de operação {f(raio, 1)} m coincide com um ponto do gráfico: C = {kg(c.capacidade_kg)} kg', False)]
    if c.tipo == 'fora-do-grafico':
        return [(f'{nome}. O raio de operação {f(raio, 1)} m está fora do gráfico ({f2(float(c.alcance_min_m))} m a {f2(float(c.alcance_max_m))} m): '
                 'sem capacidade, o plano fica bloqueado.', False)]
    if c.tipo == 'raio-invalido':
        return [(f'{nome}. Raio de operação inválido: sem capacidade, o plano fica bloqueado.', False)]
    return [(f'{nome}: sem pontos válidos, o plano fica bloqueado.', False)]


def _guindastes(c: Contexto) -> list[Secao]:
    r = c.resultados
    principal, *adicionais = r['guindastes'] or [{}]
    raio = _n(principal.get('raio_m'))
    cap = _n(r['capacidade_kg'])
    pb_g = _n(principal.get('carga_kg') if principal.get('carga_kg') is not None else r['pb_kg'])
    pct_g = _n(principal.get('pct_carga') if principal.get('pct_carga') is not None else 100)
    linhas = _interpolacao(c.tabela, raio, cap)
    if _ok(r.get('referencia_conservadora_kg')):
        ext = extensao_que_alcanca([Ponto(dec(p['alcance_m']), dec(p['capacidade_kg'])) for p in c.tabela['pontos']], dec(raio)) if c.tabela else None  # type: ignore[arg-type]
        linhas.append((f"Referência conservadora: extensão que alcança {f(raio, 1)} m{f' ({f2(float(ext.alcance_m))} m)' if ext else ''} = "
                       f"{kg(r['referencia_conservadora_kg'])} kg (taxa {pct(r['taxa_referencia_pct'])})", True))
    if _ok(pct_g) and pct_g < 100:
        linhas.append((f'Parte da carga neste guindaste = Pb × {f(pct_g, casas_de(dec(pct_g)))}% = {f2(pb_g)} kg', False))
    linhas.append((f'Taxa de utilização = Pb ÷ C = {f2(pb_g)} ÷ {kg(cap)} × 100', False))
    modelo = principal.get('modelo') or (c.guindaste or {}).get('modelo') or 'guindaste'
    secoes = [Secao(f'Capacidade de carga no raio · {modelo}', linhas,
                    f"C = {kg(cap)} kg ({f2(cap / 1000)} t) · TU = {pct(r['taxa_guindaste_pct'])} {veredito(r['taxa_guindaste_pct'], c.aviso, c.limite)}")]
    for a in adicionais:
        secoes.append(Secao(f"Guindaste adicional · {a['modelo']}", [
            (f"{a.get('tabela_nome') or 'Sem gráfico cadastrado'} · raio {f(a['raio_m'], 1)} m", False),
            (f"Parte da carga = Pb × {f(a['pct_carga'], casas_de(dec(a['pct_carga'])))}% = {f(a['carga_kg'], 2)} kg", False),
            (f"Taxa de utilização = {f(a['carga_kg'], 2)} ÷ {kg(a['capacidade_kg'])} × 100", False),
        ], f"C = {kg(a['capacidade_kg'])} kg · TU = {pct(a['taxa_pct'])} {veredito(a['taxa_pct'], c.aviso, c.limite)}"))
    return secoes


def _geometria(pos: str, balancim: bool) -> str:
    if not balancim:
        return 'carga × gancho'
    return 'carga × balancim' if pos in ('pernasInferiores', 'carga') else 'balancim × gancho'


def _posicao(p: dict, c: Contexto, ang_inf: float) -> Secao:
    r = c.resultados
    a = c.acessorios.get(p['acessorio_id'])
    P_t = (_n(r['carga_kg']) + (r['extras_kg'] or 0)) / 1000
    B_t = (r['dispositivos_kg'] or 0) / 1000
    alfa = _n(p['angulo_graus'])
    cos = math.cos(math.radians(alfa)) if _ok(alfa) else math.nan
    t, cap, u = _n(p['tracao']), _n(p['capacidade']), p['unidade']
    tu = (f'TU = {f4(t)} ÷ {f2(cap)} × 100', False)
    ver = f"{pct(p['taxa_pct'])} {veredito(p['taxa_pct'], c.aviso, c.limite)}"
    pernas = p['posicao'] in ('pernasInferiores', 'pernasSuperiores')
    titulo = (f"{p['descricao']} · {NOME_POSICAO[p['posicao']]} ({_geometria(p['posicao'], c.balancim)})" if pernas
              else f"{p['descricao']} ({_geometria(p['posicao'], c.balancim)}) · {f(cap if _ok(cap) else None, 1)} {u}")
    vertical = '(medido a partir da vertical)'
    if p['posicao'] == 'pernasInferiores':
        return Secao(titulo, [(f'Te = (1 ÷ cos α) × (P ÷ 2), com α = {graus(alfa)} {vertical} e P = {f2(P_t)} t', False),
                              (f'Te = {f4(1 / cos if cos else math.nan)} × {f4(P_t / 2)} = {f4(t)} {u}', False),
                              (f'TU = Te ÷ capacidade de trabalho = {f4(t)} ÷ {f2(cap)} × 100', False)], f'Te = {f2(t)} {u} · TU = {ver}')
    if p['posicao'] == 'pernasSuperiores':
        return Secao(titulo, [(f'Te = (1 ÷ cos α) × ((P + balancim) ÷ 2), com α = {graus(alfa)} {vertical} e P + balancim = {f2(P_t + B_t)} t', False),
                              (f'Te = {f4(1 / cos if cos else math.nan)} × {f4((P_t + B_t) / 2)} = {f4(t)} {u}', False), tu],
                     f'Te = {f2(t)} {u} · TU = {ver}')
    if p['posicao'] == 'carga':
        k = 4 if c.balancim else 2
        cos_carga = math.cos(math.radians(ang_inf)) if _ok(ang_inf) else math.nan
        return Secao(titulo, [(f'Esforço por manilha = P ÷ ({k} × cos {graus(ang_inf)}) = {f2(P_t)} ÷ {f4(k * cos_carga)} = {f4(t)} {u}', False), tu],
                     f'Manilha na carga = {f2(t)} {u} · TU = {ver}')
    de_que = 'Te superior' if c.balancim else 'Te das pernas'
    nome = a['nome_curto'] if a else p['descricao']
    return Secao(titulo, [(f'Esforço = 2 × {de_que} = 2 × {f4(t / 2)} = {f4(t)} {u}', False), tu],
                 f"Manilha no gancho = 2 · {de_que} = {f2(t)} {u} → {pct(p['taxa_pct'])} ({nome}, {f(cap if _ok(cap) else None, 1)} {u}) {veredito(p['taxa_pct'], c.aviso, c.limite)}")


def _sapatas(c: Contexto) -> list[Secao]:
    r = c.resultados
    s = r['sapatas']
    principal = (r['guindastes'] or [{}])[0]
    raio = _n(principal.get('raio_m'))
    pb_g = _n(principal.get('carga_kg') if principal.get('carga_kg') is not None else r['pb_kg'])
    g = c.guindaste or {}
    a, b, pg = _n(g.get('a_m')), _n(g.get('b_m')), _n(g.get('pg_kgf'))
    dorm = c.dados.get('dormente') or {}
    return [
        Secao('Esforço nas sapatas', [
            (f"M = Pb × Ro = {f2(pb_g)} × {f2(raio)} = {f2(s['momento_kgfm'])} kgf·m", False),
            (f"F = M ÷ (a + b) = {f2(s['momento_kgfm'])} ÷ ({f2(a)} + {f2(b)}) = {f2(s['forca_kgf'])} kgf", False),
            (f"ES = Pg ÷ 2 + F = {kg(pg if _ok(pg) else None)} ÷ 2 + {f2(s['forca_kgf'])} = {f2(pg / 2)} + {f2(s['forca_kgf'])}", False),
        ], f"ES = {f2(s['esforco_kgf'])} kgf"),
        Secao('Resistência mínima exigida do terreno (RMET)', [
            (f"AP = LD × CD × ND = {kg(dorm.get('largura_cm'))} × {kg(dorm.get('comprimento_cm'))} × {kg(dorm.get('quantidade'))} = {kg(s['area_cm2'])} cm²", False),
            (f"RMET = ES ÷ AP = {f2(s['esforco_kgf'])} ÷ {kg(s['area_cm2'])} = {f4(s['rmet'])}", False),
        ], f"RMET = {f2(s['rmet'])} kgf/cm² ({f4(s['rmet'])})"),
    ]


def secoes_memorial(c: Contexto) -> list[Secao]:
    r = c.resultados
    ang_inf = _n(next((p['angulo_graus'] for p in r['posicoes'] if p['posicao'] == 'pernasInferiores'), None))
    usadas = [pos for pos in POSICOES if c.balancim or pos != 'pernasSuperiores']
    posicoes = [p for pos in usadas for p in r['posicoes'] if p['posicao'] == pos]
    secoes = [_carga_bruta(r), *_guindastes(c), *[_posicao(p, c, ang_inf) for p in posicoes], *_sapatas(c)]
    for i, s in enumerate(secoes):
        s.titulo = f'{i + 1}. {s.titulo}'
    return secoes


def montar_memorial(c: Contexto) -> tuple[bytes, int]:
    e = _estilos()
    resp, emp = c.config['responsavel'], c.config['empresa']
    buf = io.BytesIO()
    doc = _doc(buf, f'Memorial de cálculo · Plano {c.numero} · Rev. {c.revisao.numero}',
               f"Uso interno da {emp['razao_social'].replace(' Ltda.', '')} · não anexar ao plano enviado ao cliente · "
               f"{resp['nome_assinatura']} · {resp['crea']}")
    W = doc.width
    carga = (c.dados.get('carga') or {}).get('descricao', '').lower() or '—'
    centro = ParagraphStyle('c', parent=e['base'], alignment=TA_CENTER)
    cab = Table([[
        _logo(28 * mm),
        [P('MEMORIAL DE CÁLCULO', ParagraphStyle('t', parent=e['titulo'], fontSize=15)),
         P(f"Lingada {(c.guindaste or {}).get('codigo') or '—'} · Içamento de {carga} · Rev. {c.revisao.numero}", ParagraphStyle('s', parent=e['neg'], alignment=TA_CENTER))],
        [P('ART', centro), P(c.dados.get('art') or '—', ParagraphStyle('a', parent=e['neg'], alignment=TA_CENTER)), P('RIGGING', centro),
         P(c.numero, ParagraphStyle('n', parent=e['neg'], alignment=TA_CENTER)), P('REV.', centro),
         P(str(c.revisao.numero), ParagraphStyle('r', parent=e['neg'], alignment=TA_CENTER))],
    ]], colWidths=[34 * mm, W - 34 * mm - 36 * mm, 36 * mm])
    cab.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LINEBELOW', (0, 0), (-1, 0), 1.1, PRETO)]))
    historia = [cab, Spacer(1, 4), P(f'Considerando, no máximo, {f(c.limite, casas_de(c.limite))}% de taxa de utilização (TU) em todos os itens. Ângulos das pernas medidos a partir '
                                     'da vertical. Valores intermediários com 4 casas; nada é arredondado antes do cálculo, só o resultado é '
                                     'apresentado com 2 casas.', e['ref'])]
    for s in secoes_memorial(c):
        resultado = Table([[P(s.resultado, e['neg'])]])
        resultado.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.8, PRETO)]))
        bloco = [P(s.titulo, e['sec']), *[P(texto, e['ref'] if nota else e['base']) for texto, nota in s.linhas], Spacer(1, 2), resultado]
        historia += [Table([['']], colWidths=[W], rowHeights=[4], style=[('LINEABOVE', (0, 0), (-1, 0), 0.4, colors.HexColor('#D1D5DB'))]),
                     KeepTogether(bloco)]
    _construir(doc, historia)
    from pypdf import PdfReader
    conteudo = buf.getvalue()
    return conteudo, len(PdfReader(io.BytesIO(conteudo)).pages)
