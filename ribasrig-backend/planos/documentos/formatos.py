"""Números e datas como o front mostra (vistas.ts e formatacao.ts): só a apresentação arredonda."""
from datetime import date
from decimal import Decimal

from motor.formatacao import casas_de, dec, fmt

Valor = float | int | str | Decimal | None


def f(v: Valor, casas: int = 2) -> str:
    return fmt(dec(v), casas)


def pct(v: Valor) -> str:
    d = dec(v)
    return '—' if d is None else f'{fmt(d, 2)}%'


def kg(v: Valor) -> str:
    """Inteiro sem casas, senão 2 casas (9.260 kg; 3.746,62 kg)."""
    d = dec(v)
    if d is None:
        return '—'
    return fmt(d, 0 if abs(d - d.to_integral_value()) < Decimal('1e-6') else 2)


def como_digitado(v: Valor) -> str:
    """Como digitado (3.450; 4,87; 1,7). Totais sem ruído de ponto flutuante: 6 × 1,7 = 10,2."""
    d = dec(v)
    if d is None:
        return '—'
    d = round(d, 4)
    return fmt(d, casas_de(d))


def data_br(v: str | date | None) -> str:
    if not v:
        return '—'
    s = v.isoformat() if isinstance(v, date) else str(v)[:10]
    a, m, d = s.split('-')
    return f'{d}/{m}/{a}'
