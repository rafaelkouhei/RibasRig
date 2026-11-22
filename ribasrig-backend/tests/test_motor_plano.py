"""Casos de aceitação do motor: os mesmos de ribasrig-frontend/src/domain/plano.test.ts.

Valores do plano 2607036 (Rev. 2, recalculada) conferidos com o responsável técnico. Se algum destes
testes falhar, o servidor está calculando diferente do front.
"""
import copy
import math
from datetime import date
from decimal import Decimal

import pytest

from cenario import exemplo as X
from motor import conversao as C
from motor.plano import EntradaCalculo, calcular_plano, resultados_da_revisao, texto_bloqueio

HOJE = date.fromisoformat(X.HOJE)
PLANOS = {p['numero']: p for p in X.PLANOS}


def calcular(dados: dict, numero: str = 'teste', acessorios=None, aviso: str = '75'):
    arts = {p['art']: p['numero'] for p in X.PLANOS if p['art'] and p['numero'] != numero}
    return calcular_plano(EntradaCalculo(
        dados=C.dados_plano(dados), numero=numero,
        acessorios=[C.acessorio(a) for a in (acessorios or X.ACESSORIOS)], guindastes=[C.guindaste(g) for g in X.GUINDASTES],
        tipos=[C.tipo(t) for t in X.TIPOS_ICAMENTO], clientes=[C.cliente(c) for c in X.CLIENTES],
        hoje=HOJE, aviso_atencao_pct=Decimal(aviso), arts_em_uso=arts,
    ))


def d2607036(**mudancas) -> dict:
    d = copy.deepcopy(PLANOS['2607036'])
    for k, v in mudancas.items():
        if '.' in k:
            a, b = k.split('.')
            d[a][b] = v
        else:
            d[k] = v
    return d


def pos(r, p):
    return next(x for x in r.por_posicao if x.posicao == p)


def item(r, i):
    return next(c for c in r.checklist if c.id == i)


def perto(v, esperado, casas):
    assert v is not None
    assert abs(float(v) - esperado) < 0.5 * 10 ** -casas, f'{v} != {esperado} ({casas} casas)'


class TestPlano2607036:
    r = calcular(d2607036(), '2607036')

    def test_carga_bruta(self):
        assert self.r.lingada_kg == Decimal('46.62')
        assert self.r.dispositivos_kg == Decimal('250')
        assert self.r.pb_kg == Decimal('3746.62')

    def test_capacidade_e_taxa_do_guindaste(self):
        assert self.r.capacidade.tipo == 'interpolado'
        assert self.r.capacidade_kg == Decimal('9260')
        perto(self.r.taxa_guindaste, 40.46, 2)
        assert self.r.nivel_guindaste == 'ok'

    def test_referencia_conservadora(self):
        ref = self.r.referencia_conservadora
        assert (ref.alcance_m, ref.capacidade_kg) == (Decimal('5.98'), Decimal('7300'))
        perto(ref.taxa_pct, 51.32, 2)

    def test_acessorios_por_posicao(self):
        perto(pos(self.r, 'pernasInferiores').tracao, 1.95, 2)
        perto(pos(self.r, 'pernasInferiores').taxa_pct, 46.52, 2)
        perto(pos(self.r, 'pernasSuperiores').tracao, 2.45, 2)
        perto(pos(self.r, 'pernasSuperiores').taxa_pct, 58.36, 2)
        perto(pos(self.r, 'carga').tracao, 0.98, 2)
        perto(pos(self.r, 'carga').taxa_pct, 17.76, 2)
        assert pos(self.r, 'carga').unidade == 'tf'
        perto(pos(self.r, 'gancho').tracao, 4.9, 2)
        perto(pos(self.r, 'gancho').taxa_pct, 68.09, 2)
        assert pos(self.r, 'gancho').governante.id == 4

    def test_sapatas(self):
        perto(self.r.sapatas.esforco_kgf, 7940.68, 2)
        assert self.r.sapatas.area_cm2 == Decimal('2500')
        perto(self.r.rmet, 3.1763, 4)

    def test_dentro_do_limite_e_checklist_completo(self):
        assert self.r.laudo.situacao == 'em-dia'
        assert self.r.situacao_seguranca == 'ok'
        assert self.r.motivos_bloqueio == []
        assert [c.id for c in self.r.checklist if not c.ok] == []
        assert self.r.pode_emitir

    def test_copia_da_revisao(self):
        res = resultados_da_revisao(self.r)
        assert res['pb_kg'] == pytest.approx(3746.62, abs=1e-9)
        assert res['capacidade_kg'] == 9260
        assert len(res['posicoes']) == 4
        assert res['guindastes'][0]['laudo_fim'] == '2026-10-06'
        assert res['sapatas']['rmet'] == pytest.approx(3.17627, abs=1e-5)
        assert res['situacao_seguranca'] == 'ok'


class TestPlano2610001:
    r = calcular(copy.deepcopy(PLANOS['2610001']), '2610001')

    def test_mesmos_numeros(self):
        assert self.r.pb_kg == Decimal('3746.62')
        assert self.r.capacidade_kg == Decimal('9260')
        perto(self.r.sapatas.esforco_kgf, 7940.68, 2)

    def test_bloqueado_pelo_laudo_vencido(self):
        assert self.r.laudo.situacao == 'vencido'
        assert self.r.situacao_seguranca == 'bloqueado'
        assert 'laudo do Palfinger MD 45.007 vencido em 06/10/2026' in self.r.motivos_bloqueio
        assert not item(self.r, 'laudo').ok
        assert not self.r.pode_emitir

    def test_sem_art_sem_anexos_inspecoes_em_dia(self):
        assert not item(self.r, 'art').ok
        assert not item(self.r, 'anexos').ok
        assert item(self.r, 'inspecoes').ok
        cinta = next(x for x in self.r.inspecoes if x.acessorio.id == 1)
        assert (cinta.hoje.situacao, cinta.hoje.dias) == ('vence-em-breve', 13)
        assert 5 in [x.acessorio.id for x in self.r.inspecoes]  # balancim

    def test_art_do_2607036_nao_pode_ser_reaproveitada(self):
        d = copy.deepcopy(PLANOS['2610001'])
        d['art'] = '1720264496217'
        assert calcular(d, '2610001').art_erro == 'Esta ART já pertence ao plano 2607036.'

    def test_mensagem_do_422(self):
        assert texto_bloqueio(self.r).startswith('Não dá para emitir: laudo do Palfinger MD 45.007 vencido em 06/10/2026')


def test_2610002_taxa_acima_de_85_bloqueia():
    r = calcular(copy.deepcopy(PLANOS['2610002']), '2610002')
    assert r.capacidade_kg == Decimal('5200')
    assert r.taxa_guindaste > 85
    assert r.nivel_guindaste == 'bloqueado'
    assert 'taxa acima de 85%' in r.motivos_bloqueio


class TestBloqueiosELimites:
    def test_angulo_95_bloqueia(self):
        r = calcular(d2607036(angulo_inferior_graus='95'))
        assert 'Fora da faixa' in r.campos['anguloInferior'].erro
        assert pos(r, 'pernasInferiores').taxa_pct is None
        assert r.situacao_seguranca == 'bloqueado'

    def test_angulo_vazio_bloqueia(self):
        r = calcular(d2607036(angulo_superior_graus=None))
        assert 'Vazio não vale como 0°' in r.campos['anguloSuperior'].erro
        assert r.situacao_seguranca == 'bloqueado'
        assert not item(r, 'campos').ok

    def test_acessorio_sem_capacidade_bloqueia_a_posicao(self):
        acessorios = [dict(a, capacidade_t=None, capacidade_trabalho_t=None) if a['id'] == 3 else a for a in X.ACESSORIOS]
        r = calcular(d2607036(), acessorios=acessorios)
        assert pos(r, 'carga').problema == 'item sem capacidade no cadastro'
        assert r.situacao_seguranca == 'bloqueado'

    def test_guindaste_sem_grafico_bloqueia(self):
        r = calcular(d2607036(guindaste_id=2, tabela_id=None))
        assert r.capacidade.tipo == 'sem-grafico'
        assert r.capacidade_kg is None
        assert r.situacao_seguranca == 'bloqueado'

    @pytest.mark.parametrize('raio', ['3', '18'])
    def test_raio_fora_do_grafico_bloqueia(self, raio):
        r = calcular(d2607036(raio_m=raio, raio_isolamento_m='20'))
        assert r.capacidade.tipo == 'fora-do-grafico'
        assert not item(r, 'raio').ok
        assert r.situacao_seguranca == 'bloqueado'

    def test_raio_5_26_sem_arredondar(self):
        assert calcular(d2607036(raio_m='5.26')).capacidade_kg == Decimal('8740')

    def test_85_00_passa_e_85_06_bloqueia(self):
        r85 = calcular(d2607036(**{'carga.peso_kg': '7574.38'}))
        assert r85.taxa_guindaste == Decimal('85')
        assert r85.nivel_guindaste == 'atencao'
        assert item(r85, 'guindaste').ok
        r8506 = calcular(d2607036(**{'carga.peso_kg': '7579.936'}))
        perto(r8506.taxa_guindaste, 85.06, 9)
        assert r8506.nivel_guindaste == 'bloqueado'
        assert not item(r8506, 'guindaste').ok

    def test_75_e_atencao_e_aviso_configuravel(self):
        r = calcular(d2607036(**{'carga.peso_kg': '6648.38'}))
        assert r.taxa_guindaste == Decimal('75')
        assert r.nivel_guindaste == 'atencao'
        assert calcular(d2607036(**{'carga.peso_kg': '6648.38'}), aviso='80').nivel_guindaste == 'ok'

    def test_situacao_atencao_entre_75_e_85(self):
        r = calcular(d2607036(raio_m='8.5', raio_isolamento_m='10'), '2607036')
        perto(r.taxa_guindaste, 79.22, 2)
        assert r.situacao_seguranca == 'atencao'
        assert r.pode_emitir

    def test_isolamento_menor_que_o_raio(self):
        r = calcular(d2607036(raio_isolamento_m='4'), '2607036')
        assert 'Menor que o raio' in r.campos['isolamento'].erro
        assert r.situacao_seguranca == 'bloqueado'

    def test_sem_data_da_operacao(self):
        r = calcular(d2607036(data_operacao=None), '2607036')
        assert r.laudo.situacao == 'sem-data'
        assert not item(r, 'data').ok
        assert r.situacao_seguranca == 'bloqueado'

    def test_negativo_vale_como_vazio(self):
        r = calcular(d2607036(**{'carga.peso_kg': '-1'}))
        assert r.campos['peso'].erro.startswith('Campo obrigatório')


class TestSemBalancim:
    @staticmethod
    def base():
        return d2607036(tipo_icamento_id='t2', angulo_superior_graus=None, dispositivo={'acessorio_id': None, 'descricao': '', 'quantidade': None, 'peso_unitario_kg': None},
                        lingada=[{'acessorio_id': 1, 'quantidade': '2', 'posicao': 'pernasInferiores'},
                                 {'acessorio_id': 3, 'quantidade': '2', 'posicao': 'carga'},
                                 {'acessorio_id': 4, 'quantidade': '1', 'posicao': 'gancho'}])

    def test_angulo_unico_sem_balancim(self):
        r = calcular(self.base(), '2607036')
        assert not r.balancim
        assert r.dispositivos_kg == 0
        assert not r.campos['anguloSuperior'].ativo
        assert r.pb_kg == Decimal('3450') + 2 * Decimal('4.87') + 2 * Decimal('1.7') + Decimal('2.5')
        te = 3.45 / (2 * math.cos(math.radians(28)))
        perto(pos(r, 'pernasInferiores').tracao, te, 12)
        perto(pos(r, 'gancho').tracao, 2 * te, 12)
        assert all(p.posicao != 'pernasSuperiores' for p in r.por_posicao)

    def test_item_em_pernas_superiores_bloqueia(self):
        d = self.base()
        d['lingada'].append({'acessorio_id': 2, 'quantidade': '2', 'posicao': 'pernasSuperiores'})
        r = calcular(d, '2607036')
        assert r.itens[3].erro_posicao == 'Este tipo não tem pernas superiores.'
        assert r.situacao_seguranca == 'bloqueado'


class TestExtrasEAdicionais:
    def test_extras_entram_em_p_e_na_pb(self):
        r = calcular(d2607036(cargas_extras_kg='100'), '2607036')
        assert r.p_t == Decimal('3.55')
        assert r.pb_kg == Decimal('3846.62')

    def test_adicional_divide_a_carga(self):
        d = d2607036(guindastes_adicionais=[{'guindaste_id': 2, 'tabela_id': None, 'raio_m': '5.0', 'pct': '40'}])
        r = calcular(d, '2607036')
        assert r.pct_principal == Decimal('60')
        assert r.pb_principal_kg == Decimal('3746.62') * Decimal('0.6')
        assert r.adicionais[0].carga_kg == Decimal('3746.62') * Decimal('0.4')
        assert r.adicionais[0].capacidade.tipo == 'sem-grafico'
        assert r.adicionais[0].laudo.situacao == 'nao-cadastrado'
        assert r.situacao_seguranca == 'bloqueado'
        rep = calcular(dict(d, guindastes_adicionais=[{'guindaste_id': 1, 'tabela_id': None, 'raio_m': '5.0', 'pct': '40'}]), '2607036')
        assert rep.adicionais[0].repetido
        div = calcular(dict(d, guindastes_adicionais=[{'guindaste_id': 2, 'tabela_id': None, 'raio_m': '5.0', 'pct': '60'},
                                                      {'guindaste_id': 3, 'tabela_id': None, 'raio_m': '5.0', 'pct': '40'}]), '2607036')
        assert div.divisao_invalida


def test_tipo_com_montagem_nao_calculada_bloqueia():
    from motor.plano import TEXTO_MONTAGEM_NAO_CALCULADA
    d = d2607036()
    tipos = [C.tipo({**t, 'pernas_superiores': 1} if t['id'] == d['tipo_icamento_id'] else t) for t in X.TIPOS_ICAMENTO]
    r = calcular_plano(EntradaCalculo(
        dados=C.dados_plano(d), numero='2607036', acessorios=[C.acessorio(a) for a in X.ACESSORIOS],
        guindastes=[C.guindaste(g) for g in X.GUINDASTES], tipos=tipos, clientes=[C.cliente(c) for c in X.CLIENTES],
        hoje=HOJE, aviso_atencao_pct=Decimal('75'), arts_em_uso={p['art']: p['numero'] for p in X.PLANOS if p['art'] and p['numero'] != '2607036'},
    ))
    assert not r.pode_emitir
    assert f'lingada incompleta ({TEXTO_MONTAGEM_NAO_CALCULADA})' in r.motivos_bloqueio
