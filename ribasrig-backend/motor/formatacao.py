"""Números, datas e CNPJ em pt-BR (espelha src/domain/formatacao.ts)."""
from __future__ import annotations

import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

Num = Decimal | None


def dec(v: object) -> Num:
    """Converte para Decimal sem passar por float binário. None, NaN, infinito ou ilegível = None."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, Decimal):
        d = v
    else:
        try:
            d = Decimal(str(v))
        except (InvalidOperation, ValueError):
            return None
    return d if d.is_finite() else None


def casas_de(v: Num) -> int:
    """Casas decimais do próprio valor (até 4), para mostrar um valor digitado sem arredondar."""
    if v is None:
        return 0
    expoente = v.normalize().as_tuple().exponent
    return min(4, max(0, -expoente)) if isinstance(expoente, int) else 0


def fmt(v: Num, casas: int = 2) -> str:
    """fmt(Decimal('3746.62')) → '3.746,62' · fmt(None) → '—'."""
    if v is None:
        return '—'
    q = v.quantize(Decimal(1).scaleb(-casas), rounding=ROUND_HALF_UP)
    sinal = '-' if q < 0 else ''
    inteiro, _, frac = f'{abs(q):f}'.partition('.')
    grupos = f'{int(inteiro):,}'.replace(',', '.')
    return f'{sinal}{grupos},{frac}' if casas > 0 else f'{sinal}{grupos}'


def fmt_pct(v: Num, casas: int = 2) -> str:
    return '—' if v is None else f'{fmt(v, casas)}%'


def data_br(d: date | None) -> str:
    """date(2026, 10, 6) → '06/10/2026'; None = '—'."""
    return d.strftime('%d/%m/%Y') if d else '—'


def dias_entre(de: date, ate: date) -> int:
    return (ate - de).days


def cnpj_valido(v: str) -> bool:
    """CNPJ numérico ou alfanumérico (12 posições 0–9/A–Z, 2 DV numéricos; valor = ASCII − 48)."""
    c = re.sub(r'[^0-9A-Z]', '', str(v or '').upper())
    if not re.fullmatch(r'[0-9A-Z]{12}\d{2}', c) or re.fullmatch(r'(.)\1+', c):
        return False

    def digito(base: str) -> int:
        peso, soma = 2, 0
        for ch in reversed(base):
            soma += (ord(ch) - 48) * peso
            peso = 2 if peso == 9 else peso + 1
        resto = soma % 11
        return 0 if resto < 2 else 11 - resto

    d1 = digito(c[:12])
    d2 = digito(c[:12] + str(d1))
    return d1 == int(c[12]) and d2 == int(c[13])
