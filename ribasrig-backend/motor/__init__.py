"""Motor de cálculo do Plano de Rigging, em Python puro (sem Django) e em Decimal.

Espelha `ribasrig-frontend/src/domain` (calculos.ts, plano.ts, validacao.ts, numeracao.ts,
regras.ts). Regra de ouro: nada é arredondado antes do cálculo; só `fmt` arredonda, na
apresentação. Valor inválido é `None` (no front, NaN) e deixa o plano Bloqueado.
"""
