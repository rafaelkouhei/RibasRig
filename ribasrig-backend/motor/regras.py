"""Avaliador de fórmulas SEGURO (sem eval/sympify) e validação das regras do engenheiro.

Espelha src/domain/regras.ts: + − * / ^ (também × ÷ ·), menos unário (−2^2 = −4), cos/sen/tg em
graus, raiz, min, max, abs; argumentos separados SÓ por ';'; vírgula decimal. Contas em Decimal.
"""
from __future__ import annotations

import re
from decimal import Decimal, DecimalException, InvalidOperation, Overflow

from .calculos import cos_graus, sen_graus

MAX_FORMULA = 500
MAX_EXPOENTE = Decimal(100)
LIMITE_ESCALA = Decimal('1e9')
_QUASE_ZERO = Decimal('1e-12')
_ID = re.compile(r'[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ_0-9]*')
_NUM = re.compile(r'\d+(,\d+)?')


class ErroExpressao(Exception):
    pass


class _ForaDeEscala(Exception):
    pass


Ambiente = dict[str, Decimal | None]


def _lim0(x: Decimal) -> Decimal:
    return Decimal(0) if abs(x) < _QUASE_ZERO else x


def avaliar_bruto(expr: str, env: Ambiente | None = None) -> Decimal | None:
    """Número cru (pode ser negativo); None = fora de escala (|x| > 1e9, tratado como inválido)."""
    env = env or {}
    s = str(expr or '')
    pos = 0

    def erro(m: str):
        raise ErroExpressao(m)

    def ws() -> None:
        nonlocal pos
        while pos < len(s) and s[pos].isspace():
            pos += 1

    def um(n: str, a: list[Decimal]) -> None:
        if len(a) != 1:
            erro(f'A função {n}() recebe 1 valor.')

    def varios(n: str, a: list[Decimal]) -> None:
        if len(a) < 2:
            erro(f'A função {n}() precisa de 2 ou mais valores separados por ";". Ex.: {n}(3; 45).')

    def raiz(n: str, a: list[Decimal]) -> Decimal:
        um(n, a)
        if a[0] < 0:
            erro('Raiz de número negativo.')
        return a[0].sqrt()

    def tg(n: str, a: list[Decimal]) -> Decimal:
        um(n, a)
        c = _lim0(cos_graus(a[0]))
        if c == 0:
            raise _ForaDeEscala
        return _lim0(sen_graus(a[0]) / c)

    fn = {
        'cos': lambda a: (um('cos', a), _lim0(cos_graus(a[0])))[1],
        'sen': lambda a: (um('sen', a), _lim0(sen_graus(a[0])))[1],
        'sin': lambda a: (um('sin', a), _lim0(sen_graus(a[0])))[1],
        'tg': lambda a: tg('tg', a),
        'tan': lambda a: tg('tan', a),
        'raiz': lambda a: raiz('raiz', a),
        'sqrt': lambda a: raiz('sqrt', a),
        'min': lambda a: (varios('min', a), min(a))[1],
        'max': lambda a: (varios('max', a), max(a))[1],
        'abs': lambda a: (um('abs', a), abs(a[0]))[1],
    }

    def soma_() -> Decimal:
        nonlocal pos
        v = prod()
        while True:
            ws()
            c = s[pos] if pos < len(s) else ''
            if c == '+':
                pos += 1
                v += prod()
            elif c in ('-', '−'):
                pos += 1
                v -= prod()
            else:
                return v

    def prod() -> Decimal:
        nonlocal pos
        v = un()
        while True:
            ws()
            c = s[pos] if pos < len(s) else ''
            if c in ('*', '×', '·'):
                pos += 1
                v *= un()
            elif c in ('/', '÷'):
                pos += 1
                d = un()
                if d == 0:
                    erro('Divisão por zero.')
                v /= d
            else:
                return v

    def un() -> Decimal:
        nonlocal pos
        ws()
        c = s[pos] if pos < len(s) else ''
        if c in ('-', '−'):
            pos += 1
            return -un()
        if c == '+':
            pos += 1
            return un()
        return pot()

    def pot() -> Decimal:
        nonlocal pos
        b = prim()
        ws()
        if pos < len(s) and s[pos] == '^':
            pos += 1
            ex = un()
            if abs(ex) > MAX_EXPOENTE:
                raise _ForaDeEscala
            if b == 0 and ex < 0:
                erro('Divisão por zero.')
            try:
                return b ** ex
            except (InvalidOperation, Overflow):
                raise _ForaDeEscala from None
        return b

    def prim() -> Decimal:
        nonlocal pos
        ws()
        if pos >= len(s):
            erro('A fórmula terminou antes do esperado.')
        if s[pos] == '(':
            pos += 1
            v = soma_()
            ws()
            if pos >= len(s) or s[pos] != ')':
                erro('Falta fechar um parêntese.')
            pos += 1
            return v
        m = _NUM.match(s, pos)
        if m:
            pos = m.end()
            if pos + 1 < len(s) and s[pos] == '.' and s[pos + 1].isdigit():
                erro('Use vírgula como separador decimal (ex.: 0,5).')
            return Decimal(m.group(0).replace(',', '.'))
        m = _ID.match(s, pos)
        if not m:
            erro(f'Caractere inesperado: "{s[pos]}".')
        ident = m.group(0)
        pos = m.end()
        ws()
        if pos < len(s) and s[pos] == '(':
            f = fn.get(ident.lower())
            if not f:
                erro(f'Função "{ident}" não existe.')
            pos += 1
            args: list[Decimal] = []
            ws()
            if pos < len(s) and s[pos] != ')':
                args.append(soma_())
                ws()
                while pos < len(s) and s[pos] == ';':
                    pos += 1
                    args.append(soma_())
                    ws()
            if pos < len(s) and s[pos] == ',':
                erro(f'Na função {ident}(), separe os valores com ";" (a vírgula é decimal).')
            if pos >= len(s) or s[pos] != ')':
                erro(f'Falta fechar o parêntese da função {ident}.')
            pos += 1
            return f(args)
        if ident not in env:
            erro(f'A variável "{ident}" não está definida na tabela.')
        v = env[ident]
        if v is None:
            erro(f'Corrija o valor de teste de "{ident}".')
        return v

    if not s.strip():
        erro('Escreva a fórmula.')
    if len(s) > MAX_FORMULA:
        erro(f'Fórmula longa demais: use até {MAX_FORMULA} caracteres.')
    try:
        r = soma_()
    except _ForaDeEscala:
        return None
    ws()
    if pos < len(s):
        erro(f'Caractere inesperado: "{s[pos]}".')
    return None if abs(r) > LIMITE_ESCALA else r


def avaliar_expressao(expr: str, env: Ambiente | None = None) -> tuple[Decimal | None, str | None]:
    """(valor, None) quando válido; (valor_ou_None, mensagem) quando inválido, negativo ou fora de escala."""
    try:
        v = avaliar_bruto(expr, env)
    except RecursionError:
        return None, 'Fórmula com parênteses ou sinais aninhados demais.'
    except ErroExpressao as e:
        return None, str(e)
    except DecimalException:  # Overflow/InvalidOperation fora de pot() (ex.: produto enorme, cos(10^31))
        return None, 'Resultado inválido: a conta não dá um número (infinito ou indefinido).'
    if v is None:
        return None, 'Resultado inválido: a conta não dá um número (infinito ou indefinido).'
    if v < 0:
        return v, 'Resultado inválido: o valor saiu negativo. Confira a fórmula e os valores.'
    return v, None


# =============================================================================================
# Valores de teste e faixas (plano 2607036)
# =============================================================================================

def _o(teste: str | None, mn: str, mx: str | None, msg: str, inteiro: bool = False):
    return (teste, Decimal(mn), Decimal(mx) if mx else None, msg, inteiro)


ORIGENS_VARIAVEL = {
    'Valor fixo': _o(None, '0', None, 'Use um número maior ou igual a zero.'),
    'Peso da carga (kg)': _o('3450', '1', '100000', 'Peso da carga: de 1 a 100.000 kg.'),
    'Peso da carga (t)': _o('3,45', '0.001', '100', 'Peso da carga: de 0,001 a 100 t.'),
    'Lingada (kg)': _o('46,62', '0', None, 'Lingada: zero ou mais.'),
    'Dispositivos/balancim (kg)': _o('250', '0', None, 'Dispositivos: zero ou mais.'),
    'Dispositivos/balancim (t)': _o('0,25', '0', None, 'Dispositivos: zero ou mais.'),
    'Cargas extras (kg)': _o('0', '0', None, 'Cargas extras: zero ou mais.'),
    'Raio de operação (m)': _o('5', '0.5', '30', 'Raio: de 0,5 a 30 m.'),
    'Ângulo pernas inferiores (°)': _o('28', '0', '60', 'Ângulo a partir da vertical: de 0° a 60°.'),
    'Ângulo pernas superiores (°)': _o('41', '0', '60', 'Ângulo a partir da vertical: de 0° a 60°.'),
    'Ângulo das pernas (°)': _o('28', '0', '60', 'Ângulo a partir da vertical: de 0° a 60°.'),
    'Peso do guindaste Pg (kgf)': _o('11550', '500', '100000', 'Pg: de 500 a 100.000 kgf.'),
    'Distância a (m)': _o('2,95', '0.5', '15', 'Distância a: de 0,5 a 15 m.'),
    'Abertura b (m)': _o('5,7', '0.5', '15', 'Abertura b: de 0,5 a 15 m.'),
    'Largura do dormente (cm)': _o('50', '10', '200', 'Dormente: de 10 a 200 cm.'),
    'Comprimento do dormente (cm)': _o('50', '10', '200', 'Dormente: de 10 a 200 cm.'),
    'Dormentes por sapata': _o('1', '1', '50', 'Número inteiro de 1 a 50.', True),
    'Tabela: raio anterior (m)': _o('4,18', '0.5', '30', 'Raio: de 0,5 a 30 m.'),
    'Tabela: raio posterior (m)': _o('5,98', '0.5', '30', 'Raio: de 0,5 a 30 m.'),
    'Tabela: capacidade anterior (kg)': _o('10900', '1', '100000', 'Capacidade: de 1 a 100.000 kg.'),
    'Tabela: capacidade posterior (kg)': _o('7300', '1', '100000', 'Capacidade: de 1 a 100.000 kg.'),
}
RESULTADOS_REGRA = {
    'Resultado: carga bruta (kg)': 'r1',
    'Resultado: tração nas pernas superiores (t)': 'r4',
    'Resultado: esforço nas sapatas (kgf)': 'r6',
}
ORIGENS_CAPACIDADE = {
    'Capacidade de trabalho da cinta · pernas inferiores (t)': _o('4,2', '0.1', '100', 'Capacidade: de 0,1 a 100 t.'),
    'Capacidade de trabalho da cinta · pernas superiores (t)': _o('4,2', '0.1', '100', 'Capacidade: de 0,1 a 100 t.'),
    'Capacidade de trabalho da manilha da carga (tf)': _o('5,5', '0.1', '100', 'Capacidade: de 0,1 a 100 tf.'),
    'Capacidade de trabalho da manilha do gancho (tf)': _o('7,2', '0.1', '100', 'Capacidade: de 0,1 a 100 tf.'),
    'Capacidade de trabalho do acessório escolhido (t)': _o('4,2', '0.1', '100', 'Capacidade: de 0,1 a 100 t.'),
    'Capacidade do guindaste no raio (kg)': _o('9.260', '1', '100000', 'Capacidade: de 1 a 100.000 kg.'),
}
_ANGULO = _o(None, '0', '60', 'Ângulo a partir da vertical: de 0° a 60°.')
_CAP_PADRAO = _o(None, '0.1', '100000', 'Capacidade maior que zero.')


def ler_num(texto: str) -> Decimal | None:
    """lerNum do front: '3450', '3.450', '3.450,5', '5,0', '4.2'. Vazio, negativo ou inválido = None."""
    s = re.sub(r'\s', '', str(texto or ''))
    if not s:
        return None
    if re.fullmatch(r'\d{1,3}(\.\d{3})+(,\d+)?', s):
        return Decimal(s.replace('.', '').replace(',', '.'))
    if re.fullmatch(r'\d+(,\d+)?', s):
        return Decimal(s.replace(',', '.'))
    if re.fullmatch(r'\d+\.\d+', s):
        return Decimal(s)
    return None


def conferir_valor(texto: str, faixa) -> tuple[Decimal | None, str | None]:
    t = str(texto or '').strip()
    if not t:
        return None, 'Informe o valor.'
    n = ler_num(t)
    if n is None:
        return None, 'Valor inválido. Use número positivo, ex.: 4,2.'
    if faixa:
        _, mn, mx, msg, inteiro = faixa
        if inteiro and n != n.to_integral_value():
            return None, msg
        if n < mn or (mx is not None and n > mx):
            return None, msg
    return n, None


def faixa_da_variavel(v: dict):
    if str(v.get('unidade') or '').strip() == '°':
        return _ANGULO
    return ORIGENS_VARIAVEL.get(v.get('origem', ''), ORIGENS_VARIAVEL['Valor fixo'])


def valor_de_teste(catalogo: dict[str, dict], regra_id: str, profundidade: int = 0) -> Decimal | None:
    regra = catalogo.get(regra_id)
    if not regra or profundidade > 4:
        return None
    env: Ambiente = {}
    for v in regra['variaveis']:
        k = str(v.get('simbolo', '')).strip()
        if not k:
            continue
        rid = RESULTADOS_REGRA.get(v.get('origem', ''))
        env[k] = valor_de_teste(catalogo, rid, profundidade + 1) if rid else conferir_valor(v.get('teste', ''), faixa_da_variavel(v))[0]
    valor, err = avaliar_expressao(regra['formula'], env)
    return None if err else valor


def erro_regra(regra: dict, catalogo: dict[str, dict]) -> str | None:
    """Mesma conferência que o front faz antes de salvar (erroSalvarRegra), menos a de nome repetido,
    que é feita na view. `regra` e `catalogo` em snake_case (dicts)."""
    simbolos = [str(v.get('simbolo', '')).strip() for v in regra['variaveis']]
    if any(not s for s in simbolos):
        return 'Cada variável precisa de um símbolo.'
    if len(set(simbolos)) != len(simbolos):
        return 'Cada variável precisa de um símbolo único.'
    if any(not re.fullmatch(r'[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_0-9]*', s) for s in simbolos):
        return 'Símbolo inválido: use letras, números e _ (começando por letra).'
    env: Ambiente = {}
    for v, simbolo in zip(regra['variaveis'], simbolos):
        rid = RESULTADOS_REGRA.get(v.get('origem', ''))
        if rid:
            n = valor_de_teste(catalogo, rid)
            if n is None:
                return f'Variável {simbolo}: não foi possível calcular pela regra do sistema.'
        else:
            n, err = conferir_valor(v.get('teste', ''), faixa_da_variavel(v))
            if err:
                return f'Variável {simbolo}: {err}'
        env[simbolo] = n
    _, err = avaliar_expressao(regra['formula'], env)
    if err:
        return err
    if regra.get('limite'):
        origem = regra.get('origem_capacidade')
        if not origem:
            return 'Escolha de onde vem a capacidade de comparação.'
        _, err = conferir_valor(regra.get('capacidade_teste', ''), ORIGENS_CAPACIDADE.get(origem, _CAP_PADRAO))
        if err:
            return f'Capacidade de teste: {err}'
    return None


ID_REGRA_TAXA_GUINDASTE = 'r9'


def erro_regras_do_tipo(regras_do_tipo: list[str], catalogo: dict[str, dict]) -> str | None:
    nomes = [catalogo.get(i, {}).get('nome', '') for i in regras_do_tipo]
    tem_tracao = any(n.startswith('Tração') for n in nomes)
    tem_taxa = ID_REGRA_TAXA_GUINDASTE in regras_do_tipo
    taxa = 'Taxa de utilização do guindaste'
    if not tem_tracao and not tem_taxa:
        return f'Inclua pelo menos uma regra de tração (nome começando com "Tração") e a regra "{taxa}".'
    if not tem_tracao:
        return 'Inclua pelo menos uma regra de tração (nome começando com "Tração"): sem ela o formulário não confere as cintas.'
    if not tem_taxa:
        return f'Inclua a regra "{taxa}": sem ela o plano não confere o guindaste no raio.'
    return None
