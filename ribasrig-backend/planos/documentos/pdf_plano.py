"""PDF único do plano, na ordem adotada pela empresa (SECOES_DOCUMENTO em vistas.ts):
ficha de dados → desenhos → ART do plano → procedimento operacional → laudo do guindaste.

Ficha e procedimento são gerados (mesmo conteúdo de Documento.tsx); desenhos, ART e laudo entram sem alteração.
"""
import io
from contextvars import ContextVar
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import DependencyError, PdfReadError, PyPdfError
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

from nucleo.excecoes import RegraNegocio
from nucleo.models import Arquivo

from .contexto import Contexto, endereco_obra
from .fontes import registrar, seguro
from .formatos import como_digitado, data_br, f, kg

LOGO = Path(__file__).with_name('logo-ribas.png')
PRETO = colors.HexColor('#111827')
CINZA = colors.HexColor('#4B5563')


def _estilos():
    normal, negrito = registrar()
    base = ParagraphStyle('base', fontName=normal, fontSize=8.5, leading=10.5, textColor=PRETO)
    return {
        'base': base,
        'neg': ParagraphStyle('neg', parent=base, fontName=negrito),
        'bloco': ParagraphStyle('bloco', parent=base, fontName=negrito, fontSize=9.5, spaceBefore=5, spaceAfter=2),
        'titulo': ParagraphStyle('titulo', parent=base, fontName=negrito, fontSize=14, leading=17, alignment=TA_CENTER),
        'centro': ParagraphStyle('centro', parent=base, alignment=TA_CENTER),
        'sec': ParagraphStyle('sec', parent=base, fontName=negrito, fontSize=10.5, leading=13, spaceBefore=7, spaceAfter=2),
        'ref': ParagraphStyle('ref', parent=base, textColor=CINZA, fontSize=8),
        'rodape': ParagraphStyle('rodape', parent=base, textColor=CINZA, fontSize=7.5, alignment=TA_CENTER),
        'aviso': ParagraphStyle('aviso', parent=base, fontSize=13, leading=17, alignment=TA_CENTER),
    }


def P(texto, estilo) -> Paragraph:
    return Paragraph(escape(seguro(texto)).replace('\n', '<br/>'), estilo)


def B(rotulo: str, valor: str, estilo) -> Paragraph:
    """"Rótulo: <b>valor</b>" (valores preenchidos pelo sistema em negrito)."""
    return Paragraph(f'{escape(seguro(rotulo))} <b>{escape(seguro(valor))}</b>', estilo)


GRADE = TableStyle([('GRID', (0, 0), (-1, -1), 0.6, PRETO), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)])


_LOGO_ENVIADA: ContextVar[bytes | None] = ContextVar('logo_enviada', default=None)


def usar_logo(arquivo_id: str | None) -> None:
    """Logo enviada em Configurações (guardada na revisão); sem ela, a logo da Guindastes Ribas."""
    arq = Arquivo.objects.filter(id=arquivo_id).first() if arquivo_id else None
    if arq is None:
        _LOGO_ENVIADA.set(None)
        return
    with arq.arquivo.open('rb') as fh:
        _LOGO_ENVIADA.set(fh.read())


def _logo(largura: float) -> Image:
    enviada = _LOGO_ENVIADA.get()
    if enviada:
        w, h = ImageReader(io.BytesIO(enviada)).getSize()
        return Image(io.BytesIO(enviada), width=largura, height=largura * h / w)
    return Image(str(LOGO), width=largura, height=largura * 122 / 216)


def _doc(buf: io.BytesIO, titulo: str, rodape: str) -> SimpleDocTemplate:
    def pagina(canvas, doc):
        normal, _ = registrar()
        canvas.saveState()
        canvas.setFont(normal, 7)
        canvas.setFillColor(CINZA)
        canvas.drawCentredString(A4[0] / 2, 9 * mm, seguro(rodape))
        canvas.restoreState()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=12 * mm, bottomMargin=16 * mm,
                            title=titulo, author='Sistema RibasRig', creator='Sistema RibasRig')
    doc._pagina = pagina  # type: ignore[attr-defined]
    return doc


def _construir(doc: SimpleDocTemplate, historia: list) -> None:
    doc.build(historia, onFirstPage=doc._pagina, onLaterPages=doc._pagina)  # type: ignore[attr-defined]


# =============================================================================================
# Ficha de dados (pág. 1)
# =============================================================================================

def _taxa_do_tipo(c: Contexto, tipo: str) -> str:
    """Maior taxa entre as posições cujo acessório é do tipo. Sem posição desse tipo = '–'."""
    doTipo = [p for p in c.resultados['posicoes'] if c.acessorios.get(p['acessorio_id'], {}).get('tipo') == tipo]
    if not doTipo:
        return '–'
    taxas = [p['taxa_pct'] for p in doTipo if p['taxa_pct'] is not None]
    return f(max(taxas)) if taxas else '—'


def ficha(c: Contexto) -> bytes:
    e = _estilos()
    r, d = c.resultados, c.dados
    g = c.guindaste or {}
    resp = c.config['responsavel']
    principal = (r.get('guindastes') or [{}])[0]
    cap = r.get('capacidade_kg')
    disp = d.get('dispositivo') or {}
    carga = d.get('carga') or {}
    buf = io.BytesIO()
    doc = _doc(buf, f'Plano de Rigging nº {c.numero} · Rev. {c.revisao.numero}',
               f'Plano de Rigging nº {c.numero} · Rev. {c.revisao.numero} · ficha de dados gerada pelo Sistema RibasRig')
    W = doc.width
    cliente = (c.cliente or {}).get('razao_social', '—')
    local = endereco_obra(d.get('obra') or {}, c.cliente) or '—'
    cabecalho = Table([
        [_logo(34 * mm), B('CLIENTE:', cliente, e['base']), ''],
        ['', B('LOCAL:', local, e['base']), B('DATA:', data_br(r.get('data_operacao') or d.get('data_operacao')), e['base'])],
        ['', P(f'PLANO DE RIGGING nº {c.numero}', e['titulo']), ''],
    ], colWidths=[42 * mm, W - 42 * mm - 32 * mm, 32 * mm])
    cabecalho.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.1, PRETO), ('SPAN', (0, 0), (0, 2)), ('SPAN', (1, 0), (2, 0)), ('SPAN', (1, 2), (2, 2)),
        ('LINEAFTER', (0, 0), (0, 2), 1.1, PRETO), ('LINEBELOW', (1, 0), (2, 1), 0.6, PRETO),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (0, 2), 'CENTER'), ('TOPPADDING', (1, 2), (2, 2), 6), ('BOTTOMPADDING', (1, 2), (2, 2), 6),
    ]))

    dados_carga = Table([
        [P('Descrição da carga', e['neg']), P('Comp. (m)', e['neg']), P('Largura (m)', e['neg']), P('Altura (m)', e['neg']), P('Peso (kg)', e['neg'])],
        [P(carga.get('descricao') or '—', e['base']), P(como_digitado(carga.get('comprimento_m')), e['centro']),
         P(como_digitado(carga.get('largura_m')), e['centro']), P(como_digitado(carga.get('altura_m')), e['centro']),
         P(como_digitado(r.get('carga_kg')), e['centro'])],
    ], colWidths=[W * 0.5, W * 0.125, W * 0.125, W * 0.125, W * 0.125])
    dados_carga.setStyle(GRADE)

    itens = [[P('Item', e['neg']), P('Descrição', e['neg']), P('Qtd.', e['neg']), P('Unit. (kg)', e['neg']), P('Total (kg)', e['neg'])]]
    for i, l in enumerate(d.get('lingada', [])):
        a = c.acessorios.get(l['acessorio_id'])
        desc = f"{a['descricao']}{' - ' + a['norma'] if a.get('norma') else ''}" if a else 'Acessório não encontrado no cadastro'
        total = float(l['quantidade']) * float(a['peso_kg']) if a and l.get('quantidade') is not None else None
        itens.append([P(str(i + 1), e['centro']), P(desc, e['base']), P(como_digitado(l.get('quantidade')), e['centro']),
                      P(como_digitado(a['peso_kg'] if a else None), e['centro']), P(como_digitado(total), e['centro'])])
    if len(itens) == 1:
        itens.append(['', P('Sem itens de lingada', e['centro']), '', '', ''])
    lingada_total = r.get('lingada_kg')
    if lingada_total is None:
        lingada_total = sum(float(l['quantidade'] or 0) * float(c.acessorios.get(l['acessorio_id'], {}).get('peso_kg') or 0) for l in d.get('lingada', []))
    itens.append(['', P('PESO TOTAL DA LINGADA / AMARRAÇÃO:', e['neg']), '', '', P(f(lingada_total), e['neg'])])
    lingada = Table(itens, colWidths=[W * 0.07, W * 0.57, W * 0.1, W * 0.13, W * 0.13])
    lingada.setStyle(TableStyle([*GRADE.getCommands(), ('SPAN', (1, -1), (3, -1)), ('ALIGN', (1, -1), (3, -1), 'RIGHT'),
                                 ('ALIGN', (0, 0), (-1, 0), 'CENTER')]))

    disp_total = (float(disp['quantidade']) * float(disp['peso_unitario_kg'])
                  if disp.get('quantidade') is not None and disp.get('peso_unitario_kg') is not None else None)
    dispositivos = Table([[P(str(len(d.get('lingada', [])) + 1), e['centro']), P(disp.get('descricao') or '—', e['base']),
                           P(como_digitado(disp.get('quantidade')), e['centro']), P(como_digitado(disp.get('peso_unitario_kg')), e['centro']),
                           P(como_digitado(disp_total), e['neg'])]], colWidths=[W * 0.07, W * 0.57, W * 0.1, W * 0.13, W * 0.13])
    dispositivos.setStyle(GRADE)

    meia = (W - 6 * mm) / 2
    info_g = Table([
        [B('Modelo', g.get('modelo') or '—', e['base']), B('Placas', g.get('placa') or '—', e['base'])],
        [B('Caminhão', g.get('veiculo') or '—', e['base']), B('Ano de fabricação', str(g.get('ano') or '—'), e['base'])],
        [B('Chassi', g.get('chassi') or '—', e['base']), ''],
    ], colWidths=[meia + 3 * mm, meia + 3 * mm])
    info_g.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))

    def linhas(pares):
        t = Table([[P(k, e['base']), P(v, e['neg'])] for k, v in pares], colWidths=[meia * 0.5, meia * 0.5])
        t.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                               ('TOPPADDING', (0, 0), (-1, -1), 0.8), ('BOTTOMPADDING', (0, 0), (-1, -1), 0.8)]))
        return t

    pb = r.get('pb_kg')
    tubular, laco = _taxa_do_tipo(c, 'tubular'), _taxa_do_tipo(c, 'laco')
    extras = r.get('extras_kg')
    esquerda = [
        P('CONFIGURAÇÃO DO GUINDASTE', ParagraphStyle('c', parent=e['neg'], alignment=TA_CENTER)),
        linhas([('Capacidade nominal', f"{f(g.get('capacidade_nominal_t'), 1)} t"),
                ('Comprimento da lança', f"{f(d.get('comprimento_lanca_m') or g.get('comprimento_lanca_m'), 1)} m"),
                ('Raio de operação', f"{f(principal.get('raio_m') or d.get('raio_m'), 1)} m"),
                ('Capacidade de carga', f"{f(None if cap is None else cap / 1000)} t"),
                ('Quadrante operacional', f"Inicial {(d.get('quadrante_inicial') or '—').upper()} · Final {(d.get('quadrante_final') or '—').upper()}")]),
        Spacer(1, 4),
        P('RESUMO DOS CÁLCULOS', ParagraphStyle('c2', parent=e['neg'], alignment=TA_CENTER)),
        linhas([('Total da carga bruta', f"{f(None if pb is None else pb / 1000)} t"),
                ('Capacidade do guindaste', f"{f(None if cap is None else cap / 1000)} t"),
                ('Taxa de utilização do guindaste', f"{f(r.get('taxa_guindaste_pct'))} %"),
                ('Taxa de utilização da cinta plana', f"{_taxa_do_tipo(c, 'cinta')} %"),
                ('Taxa de utilização da cinta tubular', f'{tubular} %'),
                ('Taxa de utiliz. laço de cabo de aço', f'{laco} %'),
                ('Taxa de utilização da manilha', f"{_taxa_do_tipo(c, 'manilha')} %"),
                ('Esforço nas sapatas', f"{f(r['sapatas'].get('esforco_kgf'))} kgf"),
                ('Resistência mínima do terreno', f"{f(r['sapatas'].get('rmet'))} kgf/cm²"),
                ('Raio de isolamento', f"{f(r.get('raio_isolamento_m'), 1)} m"),
                ('Velocidade máxima do vento', f"{f(r.get('vento_max_ms'), 1)} m/s")]),
    ]
    obs = Table([[P('Observações / Anexos:', e['ref'])], [P(f"ART {d.get('art') or 'ainda não informada'}", ParagraphStyle('art', parent=e['neg'], fontSize=11, alignment=TA_CENTER))]],
                colWidths=[meia], rowHeights=[None, 22 * mm])
    obs.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.1, PRETO), ('VALIGN', (0, 1), (0, 1), 'MIDDLE')]))
    direita = [
        P('COMPOSIÇÃO DA CARGA BRUTA', ParagraphStyle('c3', parent=e['neg'], alignment=TA_CENTER)),
        linhas([('Carga líquida', f"{como_digitado(r.get('carga_kg'))} kg"), ('Lingada / Amarração', f'{f(lingada_total)} kg'),
                ('Dispositivos / Balancim', f"{como_digitado(r.get('dispositivos_kg') if r.get('dispositivos_kg') is not None else disp_total)} kg"),
                ('Cargas extras', f"{'–' if not extras else como_digitado(extras)} kg"), ('Carga bruta', f'{f(pb)} kg')]),
        Spacer(1, 6), obs,
    ]
    colunas = Table([[esquerda, direita]], colWidths=[meia + 3 * mm, meia + 3 * mm])
    colunas.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('LINEABOVE', (0, 0), (-1, 0), 1.1, PRETO)]))

    assinaturas = Table([[P(f"Rigger {resp['nome_assinatura']} · {resp['rpp']}", e['centro']), '',
                          P(f"Supervisor responsável {resp['nome_assinatura']} · {resp['crea']}", e['centro'])]],
                        colWidths=[W * 0.45, W * 0.1, W * 0.45])
    assinaturas.setStyle(TableStyle([('LINEABOVE', (0, 0), (0, 0), 0.6, PRETO), ('LINEABOVE', (2, 0), (2, 0), 0.6, PRETO)]))

    historia = [
        cabecalho, P('DADOS DA CARGA:', e['bloco']), dados_carga, P('LINGADA / AMARRAS', e['bloco']), lingada,
        P('DISPOSITIVOS / BALANCIM', e['bloco']), dispositivos, Spacer(1, 4),
        Table([[P('INFORMAÇÕES DO GUINDASTE', e['bloco'])]], colWidths=[W], style=[('LINEABOVE', (0, 0), (-1, 0), 1.1, PRETO), ('LEFTPADDING', (0, 0), (-1, -1), 0)]),
        info_g, Spacer(1, 4), colunas, Spacer(1, 22 * mm), KeepTogether([assinaturas]),
    ]
    _construir(doc, historia)
    return buf.getvalue()


# =============================================================================================
# Procedimento operacional
# =============================================================================================

def procedimento(c: Contexto) -> bytes:
    e = _estilos()
    d = c.dados
    emp = c.config['empresa']
    g = c.guindaste or {}
    buf = io.BytesIO()
    doc = _doc(buf, f'Procedimento · Plano {c.numero}',
               f"{emp['razao_social']} · {emp['endereco']} · CEP {emp['cep']} · CNPJ {emp['cnpj']} · IE {emp['ie']}")
    W = doc.width
    isolamento = f(c.resultados.get('raio_isolamento_m'), 1)
    cab = Table([[
        _logo(30 * mm),
        [P('Procedimento', ParagraphStyle('t', parent=e['titulo'], fontSize=16)), P(f"Içamento {(d.get('carga') or {}).get('descricao') or '—'}", ParagraphStyle('t2', parent=e['neg'], alignment=TA_CENTER))],
        [P('ART', e['centro']), P(d.get('art') or '—', ParagraphStyle('a', parent=e['neg'], alignment=TA_CENTER)), P('RIGGING', e['centro']),
         P(c.numero, ParagraphStyle('n', parent=e['neg'], alignment=TA_CENTER))],
    ]], colWidths=[36 * mm, W - 36 * mm - 36 * mm, 36 * mm])
    cab.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LINEBELOW', (0, 0), (-1, 0), 0.8, PRETO)]))
    partes = Table([[P('Contratante:', e['neg']), P((c.cliente or {}).get('razao_social', '—'), e['base'])],
                    [P('Local da obra:', e['neg']), P(endereco_obra(d.get('obra') or {}, c.cliente) or '—', e['base'])]],
                   colWidths=[30 * mm, W - 30 * mm])
    partes.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('LINEBELOW', (0, -1), (-1, -1), 0.4, colors.HexColor('#D1D5DB'))]))

    def itens(*linhas):
        return P('\n'.join(f'• {l}' for l in linhas), e['base'])

    historia = [
        cab, Spacer(1, 4), partes,
        P('1. ISOLAMENTO DA ÁREA', e['sec']),
        B('Objetivo:', 'Garantir segurança de pessoas e equipamentos durante a operação.', e['base']),
        itens(f'Delimitar e sinalizar a área de risco num raio de {isolamento} m a partir do centro de giro do guindaste.',
              'Impedir circulação de pessoas não autorizadas.', 'Verificar ausência de interferências: rede elétrica, estruturas, veículos.',
              'Liberar área somente após checagem.'),
        P('Referências: NR-18.5.3 / NR-18.4.2(a) · NR-11.7.1 / NR-11.7.2 · NR-18.15.47', e['ref']),
        P(f"2. PATOLAMENTO DO GUINDASTE {g.get('codigo') or '—'}", e['sec']),
        B('Objetivo:', 'Garantir estabilidade e segurança do equipamento de içamento.', e['base']),
        itens('Posicionar o guindaste conforme plano.', 'Avaliar capacidade do solo (RMET) e posicionar os dormentes.',
              'Estender e nivelar estabilizadores a 100%.'),
        P('Referências: NR-18.14.22 / NR-18.14.24 · NR-11.5.1 · NR-18.14.4', e['ref']),
        P('3. POSICIONAMENTO DO VEÍCULO DE CARGA', e['sec']),
        itens('Aproximar carreta ou veículo guiado pelo sinaleiro.', 'Acionar freio, calçar rodas e desligar motor.',
              'Garantir espaço para manobra do gancho e acesso à carga.'),
        P('4. IÇAMENTO DA CARGA', e['sec']),
        itens('Verificar cintas, manilhas e pontos de ancoragem.', 'Montar amarração conforme plano de rigging.',
              'Realizar elevação de teste (10–20 cm).', 'Elevar carga lentamente, mantendo comunicação com sinaleiro.'),
        P('5. DESCARGA DA CARGA', e['sec']),
        itens('Aproximar lentamente da posição de apoio.', 'Baixar carga de forma controlada.', 'Garantir apoio estável antes de soltar amarrações.'),
    ]
    _construir(doc, historia)
    return buf.getvalue()


def pagina_aviso(titulo: str, linhas: list[str], rodape: str) -> bytes:
    """Página no lugar de um anexo que não está guardado no sistema (ex.: revisão cadastrada antes do envio de arquivos)."""
    e = _estilos()
    buf = io.BytesIO()
    doc = _doc(buf, titulo, rodape)
    caixa = Table([[[P(titulo, ParagraphStyle('t', parent=e['titulo'], fontSize=15)), Spacer(1, 8), *[P(l, e['aviso']) for l in linhas]]]],
                  colWidths=[doc.width], rowHeights=[120 * mm])
    caixa.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#B9C2D2')), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    _construir(doc, [Spacer(1, 40 * mm), caixa])
    return buf.getvalue()


# =============================================================================================
# Montagem
# =============================================================================================

def _anexo(arquivo_id: str | None, nome: str | None, secao: str, c: Contexto) -> bytes:
    arq = Arquivo.objects.filter(id=arquivo_id).first() if arquivo_id else None
    rodape = f'Plano de Rigging nº {c.numero} · Rev. {c.revisao.numero}'
    if arq is None:
        nome_txt = nome or 'não anexado'
        return pagina_aviso(secao, [nome_txt, 'O arquivo não está guardado no sistema.', 'Insira a versão impressa ou anexe o PDF e emita uma nova revisão.'], rodape)
    with arq.arquivo.open('rb') as fh:
        return fh.read()


def _leitor(conteudo: bytes, secao: str) -> PdfReader:
    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        if leitor.is_encrypted and not leitor.decrypt(''):
            raise PdfReadError('protegido por senha')
        len(leitor.pages)
        return leitor
    # PyPdfError cobre PdfReadError, ParseError e LimitReachedError; DependencyError = PDF cifrado (AES) sem biblioteca
    except (PyPdfError, DependencyError, ValueError, KeyError, TypeError) as e:
        raise RegraNegocio(f'Não foi possível incluir {secao} no PDF ({e}). Anexe o arquivo de novo e emita.') from None


def montar_pdf_plano(c: Contexto, estrito: bool = True) -> tuple[bytes, int]:
    """`estrito` (emissão): anexo ilegível impede o PDF. Fora da emissão (revisão antiga, que não muda mais),
    o anexo ilegível vira uma página de aviso."""
    a = c.arquivos
    rodape = f'Plano de Rigging nº {c.numero} · Rev. {c.revisao.numero}'
    laudo = f"Laudo técnico · {(c.guindaste or {}).get('modelo', 'guindaste')}"
    partes = [
        (ficha(c), 'a ficha de dados', None),
        (_anexo(a.get('desenhos'), c.dados.get('anexos', {}).get('desenhos'), 'Desenhos de posicionamento', c), 'os desenhos', 'Desenhos de posicionamento'),
        (_anexo(a.get('art_plano'), c.dados.get('anexos', {}).get('arquivo_art'), 'ART do plano de rigging', c), 'a ART do plano', 'ART do plano de rigging'),
        (procedimento(c), 'o procedimento operacional', None),
        (_anexo(a.get('laudo'), a.get('laudo_nome'), laudo, c), 'o laudo do guindaste', laudo),
    ]
    saida = PdfWriter()
    for conteudo, secao, titulo in partes:
        try:
            saida.append(_leitor(conteudo, secao))
        except RegraNegocio:
            if estrito or titulo is None:
                raise
            aviso = pagina_aviso(titulo, ['O arquivo guardado não pôde ser lido como PDF.', 'Insira a versão impressa ou anexe o PDF e emita uma nova revisão.'], rodape)
            saida.append(_leitor(aviso, secao))
    saida.add_metadata({'/Title': f'Plano de Rigging nº {c.numero} · Rev. {c.revisao.numero}', '/Author': c.config['responsavel']['nome_completo'],
                        '/Creator': 'Sistema RibasRig'})
    buf = io.BytesIO()
    saida.write(buf)
    return buf.getvalue(), len(saida.pages)
