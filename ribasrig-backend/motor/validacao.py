"""Faixas válidas dos campos numéricos e validação (espelha src/domain/validacao.ts).

O front valida o TEXTO digitado; aqui chega o número já lido. Vazio (None) e negativo valem como
campo vazio, igual ao front (formDoPlano transforma negativo em texto vazio).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from .formatacao import Num, casas_de, fmt

INF = None  # sem limite superior


@dataclass(frozen=True)
class Faixa:
    min: Decimal
    max: Decimal | None
    unidade: str
    rotulo: str
    exemplo: str
    inteiro: bool = False
    vazio: str | None = None


def _f(mn: str, mx: str | None, unidade: str, rotulo: str, exemplo: str, inteiro: bool = False, vazio: str | None = None) -> Faixa:
    return Faixa(Decimal(mn), Decimal(mx) if mx is not None else None, unidade, rotulo, exemplo, inteiro, vazio)


ANGULO_VAZIO = 'Informe o ângulo: 0° a 60° (a partir da vertical). Vazio não vale como 0°.'

FAIXAS: dict[str, Faixa] = {
    # carga
    'pesoCarga': _f('1', '100000', 'kg', 'Peso da carga', '3.450'),
    'dimensao': _f('0.1', '50', 'm', 'Dimensão da carga', '4,7'),
    'cargasExtras': _f('0', INF, 'kg', 'Cargas extras', '0', vazio='Informe 0 se não houver cargas extras.'),
    # lingada
    'quantidade': _f('1', '50', 'pç', 'Quantidade', '4', inteiro=True),
    'angulo': _f('0', '60', '°', 'Ângulo (a partir da vertical)', '28', vazio=ANGULO_VAZIO),
    'pesoDispositivo': _f('0', '100000', 'kg', 'Peso unitário do dispositivo', '250'),
    # acessório (cadastro)
    'capacidadeAcessorio': _f('0.1', '100', 't', 'Capacidade do acessório', '4,2'),
    'pesoAcessorio': _f('0.01', '5000', 'kg', 'Peso unitário do acessório', '4,87'),
    # guindaste e operação
    'raio': _f('0.5', '30', 'm', 'Raio de operação', '5,0'),
    'comprimentoLanca': _f('0.5', '50', 'm', 'Comprimento da lança', '5,1'),
    'raioIsolamento': _f('0.5', '50', 'm', 'Raio de isolamento', '7,0'),
    'vento': _f('0', '20', 'm/s', 'Vento máximo', '7,0'),
    'pctAdicional': _f('1', '99', '%', '% da carga do guindaste adicional', '50'),
    'distanciaA': _f('0.5', '15', 'm', 'Eixo da coluna até a sapata (a)', '2,95'),
    'aberturaB': _f('0.5', '15', 'm', 'Abertura entre sapatas (b)', '5,70'),
    'pesoGuindaste': _f('500', '100000', 'kgf', 'Peso guindaste + caminhão (Pg)', '11.550'),
    'alcanceGrafico': _f('0.5', '30', 'm', 'Alcance do gráfico de carga', '4,18'),
    'capacidadeGrafico': _f('1', '100000', 'kg', 'Capacidade do gráfico de carga', '10.900'),
    'anoGuindaste': _f('1950', '2027', '', 'Ano', '2013', inteiro=True),
    'capacidadeNominal': _f('0.1', '500', 't', 'Capacidade nominal', '45,0'),
    # sapatas
    'dormente': _f('10', '200', 'cm', 'Dimensão do dormente', '50'),
    'dormentesPorSapata': _f('1', '50', 'pç', 'Dormentes por sapata', '1', inteiro=True),
    # configurações
    'avisoAtencaoPct': _f('50', '100', '%', 'Aviso de atenção', '75'),  # e menor que o limite (nucleo/views.py)
    'ventoPadrao': _f('0', '20', 'm/s', 'Vento padrão', '7,0'),
}


@dataclass
class CampoValidado:
    valor: Num
    erro: str | None


def _un(u: str) -> str:
    return '' if not u else u if u in ('°', '%') else f' {u}'


def faixa_texto(f: Faixa) -> str:
    """'1 kg a 100.000 kg' · '0° a 60° (a partir da vertical)' · 'a partir de 0 kg'"""
    v = lambda x: fmt(x, casas_de(x))  # noqa: E731
    base = (f'a partir de {v(f.min)}{_un(f.unidade)}' if f.max is None
            else f'{v(f.min)}{_un(f.unidade)} a {v(f.max)}{_un(f.unidade)}')
    return f'{base} (a partir da vertical)' if f.unidade == '°' else base


def validar_faixa(f: Faixa, valor: Num) -> CampoValidado:
    if valor is None or valor < 0:
        return CampoValidado(None, f.vazio or f'Campo obrigatório: {faixa_texto(f)}.')
    if f.inteiro and valor != valor.to_integral_value():
        return CampoValidado(None, f'Use um número inteiro ({faixa_texto(f)}).')
    if valor < f.min or (f.max is not None and valor > f.max):
        return CampoValidado(None, f'Fora da faixa: {faixa_texto(f)}.')
    return CampoValidado(valor, None)


def validar_campo(nome: str, valor: Num) -> CampoValidado:
    return validar_faixa(FAIXAS[nome], valor)


def erro_numero_art(art: str) -> str | None:
    """Nº da ART: 13 dígitos, só números. Vazio = None (a falta é tratada no checklist)."""
    a = str(art or '').strip()
    if not a:
        return None
    return None if re.fullmatch(r'\d{13}', a) else f'O nº da ART tem 13 dígitos, só números (você digitou {len(re.sub(r"[^0-9]", "", a))}).'


def erro_login(login: str) -> str | None:
    """Usuário (login): minúsculas, números, ponto, hífen e sublinhado; 3 a 30 caracteres."""
    s = str(login or '').strip()
    if not s:
        return 'Informe o usuário.'
    return None if re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,29}', s) else 'Use de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.'


def erro_nome_arquivo(nome: str) -> str | None:
    """Nome do arquivo do plano precisa ter {nº} e {rev}."""
    n = str(nome or '')
    tem_num, tem_rev = '{nº}' in n, '{rev}' in n
    if not tem_num and not tem_rev:
        return 'O nome precisa ter {nº} e {rev}.'
    if not tem_num:
        return 'O nome precisa ter {nº} (número do plano).'
    if not tem_rev:
        return 'O nome precisa ter {rev} (número da revisão).'
    return None
