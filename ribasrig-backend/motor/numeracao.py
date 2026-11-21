"""Numeração dos planos: AAMM + 3 dígitos pela DATA DE CRIAÇÃO; zera todo mês (espelha numeracao.ts).

Aqui ficam só as regras puras. O bloqueio contra dois planos com o mesmo número é feito no banco
(planos/numeracao.py: select_for_update + número único).
"""
from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import date

MAX_SEQUENCIA = 999


class ErroNumeracao(Exception):
    pass


def partes_numero(numero: str) -> tuple[str, int] | None:
    """'2610001' → ('2610', 1). Formato inválido = None."""
    m = re.fullmatch(r'(\d{2})(\d{2})(\d{3})', str(numero or '').strip())
    if not m:
        return None
    mes, seq = int(m.group(2)), int(m.group(3))
    if not 1 <= mes <= 12 or seq < 1:
        return None
    return m.group(1) + m.group(2), seq


def prefixo_da_data(d: date) -> str:
    return d.strftime('%y%m')


def _montar(prefixo: str, seq: int) -> str:
    return f'{prefixo}{seq:03d}'


def proximo_numero(criacao: date, existentes: Iterable[str]) -> str:
    """proximo_numero(date(2026, 10, 7), ['2607036', '2610001', '2610002']) → '2610003'."""
    prefixo = prefixo_da_data(criacao)
    maior = max((p[1] for n in existentes if (p := partes_numero(n)) and p[0] == prefixo), default=0)
    seq = maior + 1
    if seq > MAX_SEQUENCIA:
        raise ErroNumeracao(f'A numeração de {prefixo[2:]}/20{prefixo[:2]} chegou a {MAX_SEQUENCIA} planos. Fale com o administrador.')
    return _montar(prefixo, seq)


def numeros_em_sequencia(primeiro: str, quantidade: int) -> list[str]:
    """Números seguidos sem invadir o mês seguinte (planos em lote)."""
    p = partes_numero(primeiro)
    if not p:
        raise ErroNumeracao(f'Número inválido: "{primeiro}". Use AAMM + 3 dígitos (ex.: 2610003).')
    if not isinstance(quantidade, int) or isinstance(quantidade, bool) or quantidade < 1:
        raise ErroNumeracao('A quantidade de planos deve ser um número inteiro maior que zero.')
    prefixo, seq = p
    if seq + quantidade - 1 > MAX_SEQUENCIA:
        livres = MAX_SEQUENCIA - seq + 1
        raise ErroNumeracao(f'Só cabem mais {livres} {"plano" if livres == 1 else "planos"} neste mês (até {_montar(prefixo, MAX_SEQUENCIA)}).')
    return [_montar(prefixo, seq + i) for i in range(quantidade)]
