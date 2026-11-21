"""Fontes dos PDFs. Usa uma TrueType com acentos e símbolos (≤, ÷, α, →…): DejaVu no Docker, Arial Unicode no
macOS ou a que estiver em RIBASRIG_FONTE; na falta, a Vera que vem com o ReportLab. Símbolo que a fonte não tem
é trocado por texto ("≤" → "<="), para nunca sair um quadradinho no documento."""
import os
from functools import cache
from pathlib import Path

import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_VERA = Path(reportlab.__file__).parent / 'fonts'
REGULAR = [
    os.environ.get('RIBASRIG_FONTE', ''),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    str(_VERA / 'Vera.ttf'),
]
NEGRITO = [
    os.environ.get('RIBASRIG_FONTE_NEGRITO', ''),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    str(_VERA / 'VeraBd.ttf'),
]
TROCAS = {'≤': '<=', '≥': '>=', '→': '->', '✓': 'OK', '−': '-', 'α': 'a', '–': '-', '—': '-', '·': '-', '²': '2',
          '°': 'o', '×': 'x', '÷': '/', '“': '"', '”': '"', '’': "'"}


def _primeira(caminhos: list[str]) -> str:
    return next(c for c in caminhos if c and Path(c).is_file())


@cache
def registrar() -> tuple[str, str]:
    """Registra as fontes uma vez e devolve os nomes (normal, negrito)."""
    pdfmetrics.registerFont(TTFont('RibasRig', _primeira(REGULAR)))
    pdfmetrics.registerFont(TTFont('RibasRig-Negrito', _primeira(NEGRITO)))
    pdfmetrics.registerFontFamily('RibasRig', normal='RibasRig', bold='RibasRig-Negrito', italic='RibasRig', boldItalic='RibasRig-Negrito')
    return 'RibasRig', 'RibasRig-Negrito'


@cache
def _glifos() -> frozenset[int]:
    registrar()
    normal = pdfmetrics.getFont('RibasRig').face.charToGlyph
    negrito = pdfmetrics.getFont('RibasRig-Negrito').face.charToGlyph
    return frozenset(set(normal) & set(negrito))


def seguro(texto: str) -> str:
    """Troca os símbolos que a fonte não desenha."""
    glifos = _glifos()
    return ''.join(c if ord(c) in glifos or c in '\n\t' else TROCAS.get(c, '?') for c in str(texto))
