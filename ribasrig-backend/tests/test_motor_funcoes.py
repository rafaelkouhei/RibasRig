"""Funções do motor (calculos, validacao, numeracao, regras): mesmos casos dos testes do front."""
from datetime import date
from decimal import Decimal as D

import pytest

from cenario import exemplo as X
from motor import conversao as C
from motor.calculos import (
    capacidade_no_grafico, cos_graus, esforco_sapatas, nivel_taxa, situacao_inspecao, situacao_laudo, tracoes_por_posicao,
)
from motor.formatacao import cnpj_valido, fmt
from motor.numeracao import ErroNumeracao, numeros_em_sequencia, proximo_numero
from motor.regras import avaliar_bruto, avaliar_expressao, erro_regra, erro_regras_do_tipo, ler_num
from motor.validacao import erro_login, erro_nome_arquivo, erro_numero_art, validar_campo

MD45007 = C.guindaste(X.GUINDASTES[0])
PONTOS = MD45007.tabelas[0].pontos


class TestCalculos:
    @pytest.mark.parametrize('taxa,nivel', [('85', 'atencao'), ('85.06', 'bloqueado'), ('75', 'atencao'), ('74.99', 'ok'), ('-1', 'bloqueado'), (None, 'bloqueado')])
    def test_nivel_taxa(self, taxa, nivel):
        assert nivel_taxa(D(taxa) if taxa else None) == nivel

    def test_interpolacao(self):
        assert capacidade_no_grafico(PONTOS, D('5.0')).capacidade_kg == D('9260')
        assert capacidade_no_grafico(PONTOS, D('5.98')).tipo == 'exato'
        assert capacidade_no_grafico(PONTOS, D('3')).lado == 'abaixo'
        assert capacidade_no_grafico(PONTOS, D('18')).lado == 'acima'
        assert capacidade_no_grafico([], D('5')).tipo == 'sem-grafico'
        assert capacidade_no_grafico(PONTOS, None).tipo == 'raio-invalido'

    def test_cosseno_decimal(self):
        assert abs(cos_graus(D(60)) - D('0.5')) < D('1e-25')
        assert abs(cos_graus(D(90))) < D('1e-25')

    def test_tracoes_cos_zero_e_invalido(self):
        t = tracoes_por_posicao(D('3.45'), D('0.25'), D(90), D(41), True)
        assert t['pernasInferiores'] is None and t['carga'] is None
        assert t['pernasSuperiores'] is not None

    def test_sapatas_2607036(self):
        s = esforco_sapatas(D('3746.62'), D(5), D(11550), D('2.95'), D('5.7'), D(50), D(50), D(1))
        assert round(s.esforco_kgf, 2) == D('7940.68')
        assert round(s.rmet, 4) == D('3.1763')

    def test_laudo(self):
        assert situacao_laudo(MD45007, date(2026, 7, 24)).situacao == 'em-dia'
        assert situacao_laudo(MD45007, date(2026, 10, 15)).situacao == 'vencido'
        assert situacao_laudo(MD45007, None).situacao == 'sem-data'
        assert situacao_laudo(C.guindaste(X.GUINDASTES[1]), date(2026, 10, 7)).situacao == 'nao-cadastrado'

    def test_inspecao_e_validade(self):
        cinta = C.acessorio(X.ACESSORIOS[0])
        r = situacao_inspecao(cinta, date(2026, 10, 7))
        assert (r.situacao, r.dias, r.texto) == ('vence-em-breve', 13, 'vence em 13 dias (20/10/2026)')
        tubular = C.acessorio(X.ACESSORIOS[6])
        r = situacao_inspecao(tubular, date(2026, 10, 7))
        assert (r.motivo, r.dias, r.texto) == ('validade', 23, 'validade vence em 23 dias (30/10/2026)')
        assert situacao_inspecao(tubular, date(2026, 11, 1)).situacao == 'vencida'
        assert situacao_inspecao(C.acessorio(X.ACESSORIOS[5]), date(2026, 10, 7)).texto == 'descartado'


class TestValidacao:
    def test_faixas(self):
        assert validar_campo('angulo', D(95)).erro == 'Fora da faixa: 0° a 60° (a partir da vertical).'
        assert validar_campo('pesoCarga', D(3450)).valor == D(3450)
        assert validar_campo('pesoCarga', None).erro == 'Campo obrigatório: 1 kg a 100.000 kg.'
        assert validar_campo('quantidade', D('2.5')).erro == 'Use um número inteiro (1 pç a 50 pç).'
        assert validar_campo('dimensao', D('0.05')).erro == 'Fora da faixa: 0,1 m a 50 m.'
        assert validar_campo('cargasExtras', None).erro == 'Informe 0 se não houver cargas extras.'

    def test_art_login_nome_arquivo(self):
        assert erro_numero_art('1720264496217') is None
        assert erro_numero_art('123') == 'O nº da ART tem 13 dígitos, só números (você digitou 3).'
        assert erro_login('giuliano.breda') is None
        assert erro_login('Gi') is not None
        assert erro_nome_arquivo('Plano_{nº}.pdf') == 'O nome precisa ter {rev} (número da revisão).'

    def test_cnpj(self):
        assert cnpj_valido('07.522.191/0048-64')
        assert cnpj_valido('12.ABC.345/01DE-35')
        assert not cnpj_valido('07.522.191/0048-65')

    def test_fmt(self):
        assert fmt(D('3746.62')) == '3.746,62'
        assert fmt(D('40.46055')) == '40,46'
        assert fmt(None) == '—'


class TestNumeracao:
    def test_proximo(self):
        assert proximo_numero(date(2026, 10, 7), ['2607036', '2610001', '2610002']) == '2610003'
        assert proximo_numero(date(2027, 1, 2), ['2612015']) == '2701001'
        with pytest.raises(ErroNumeracao):
            proximo_numero(date(2026, 10, 7), ['2610999'])

    def test_sequencia(self):
        assert numeros_em_sequencia('2610003', 3) == ['2610003', '2610004', '2610005']
        with pytest.raises(ErroNumeracao, match='Só cabem mais 2 planos'):
            numeros_em_sequencia('2610998', 3)


class TestRegras:
    def test_avaliador(self):
        assert avaliar_expressao('min(3;45)') == (D(3), None)
        assert avaliar_bruto('-2^2') == D(-4)
        assert avaliar_bruto('2^-1') == D('0.5')
        assert avaliar_expressao('1 / cos(90)')[1] == 'Divisão por zero.'
        assert avaliar_expressao('-2^2')[1].startswith('Resultado inválido: o valor saiu negativo')
        # "3,45" é o número 3,45 (vírgula decimal), como no front; a vírgula solta é que é recusada
        assert avaliar_expressao('min(3,45)')[1].startswith('A função min() precisa de 2 ou mais valores')
        assert avaliar_expressao('min(3 ,45)')[1] == 'Na função min(), separe os valores com ";" (a vírgula é decimal).'
        assert avaliar_expressao('0.5')[1] == 'Use vírgula como separador decimal (ex.: 0,5).'
        assert avaliar_expressao('__import__("os")')[1] is not None
        assert avaliar_expressao('2^1000')[1].startswith('Resultado inválido: a conta não dá um número')
        # Estouros do Decimal fora de pot() também viram "inválido" (antes: erro 500 ao salvar a regra)
        for estouro in ('cos(10^31)', '((9^100)^100)^100 * ((9^100)^100)^100', '1 / ((0,1^100)^100)^100'):
            assert avaliar_expressao(estouro) == (None, 'Resultado inválido: a conta não dá um número (infinito ou indefinido).')
        assert avaliar_expressao('(' * 400 + '1' + ')' * 400)[1] is not None

    def test_ler_num(self):
        assert ler_num('3.450') == D(3450)
        assert ler_num('3.450,5') == D('3450.5')
        assert ler_num('4.2') == D('4.2')
        assert ler_num('-1') is None

    def test_catalogo_do_sistema_valido(self):
        catalogo = {r['id']: r for r in X.REGRAS}
        assert all(erro_regra(r, catalogo) is None for r in X.REGRAS)
        r = dict(catalogo['r3'], formula='P / (2 * cos(x))')
        assert erro_regra(r, catalogo) == 'A variável "x" não está definida na tabela.'

    def test_regras_do_tipo(self):
        catalogo = {r['id']: r for r in X.REGRAS}
        assert erro_regras_do_tipo(['r1', 'r3', 'r9'], catalogo) is None
        assert 'Taxa de utilização do guindaste' in erro_regras_do_tipo(['r3'], catalogo)


def test_montagem_do_tipo_igual_ao_front():
    from motor.regras import MSG_MONTAGEM_BALANCIM, MSG_MONTAGEM_SEM_BALANCIM, erro_montagem_do_tipo
    assert erro_montagem_do_tipo(True, 4, 2) is None
    assert erro_montagem_do_tipo(True, 4, 1) == MSG_MONTAGEM_BALANCIM
    assert erro_montagem_do_tipo(True, 2, 2) == MSG_MONTAGEM_BALANCIM
    assert erro_montagem_do_tipo(False, 2, 0) is None
    assert erro_montagem_do_tipo(False, 4, 0) is None
    assert erro_montagem_do_tipo(False, 1, 0) == MSG_MONTAGEM_SEM_BALANCIM
