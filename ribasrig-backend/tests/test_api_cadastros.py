"""Cadastros, regras, tipos e configurações."""
import pytest

pytestmark = pytest.mark.django_db


def um(c, rota, id_):
    return next(x for x in c.get(rota).json() if x['id'] == id_)


class TestGuindastes:
    def test_grafico_invalido(self, admin):
        g = um(admin, '/api/guindastes/', 1)
        g['tabelas'][0]['pontos'].append({'alcance_m': 4.18, 'capacidade_kg': 100})
        r = admin.put('/api/guindastes/1/', g, format='json')
        assert (r.status_code, r.json()['detail']) == (400, 'Gráfico de carga "lança principal": ponto inválido ou alcance repetido.')

    def test_ordena_pontos_e_um_laudo_atual(self, admin):
        g = um(admin, '/api/guindastes/', 1)
        g['tabelas'][0]['pontos'].reverse()
        g['laudos'] = [{**g['laudos'][0], 'atual': False}, {'inicio': '2026-10-06', 'fim': '2027-04-06', 'art': '1720262222222', 'arquivo': None, 'atual': False}]
        r = admin.put('/api/guindastes/1/', g, format='json').json()
        assert [p['alcance_m'] for p in r['tabelas'][0]['pontos']][:2] == [4.18, 5.98]
        assert [l['atual'] for l in r['laudos']] == [False, True]
        # Com o laudo renovado, o 2610001 (operação 15/10) deixa de ser bloqueado pelo laudo
        assert 'laudo' not in admin.post('/api/planos/2610001/emitir/').json()['detail'].split(':')[1].split(';')[0]

    def test_novo_guindaste(self, admin):
        r = admin.post('/api/guindastes/', {'modelo': 'MD 99 (teste)'}, format='json')
        assert r.status_code == 201
        assert r.json()['codigo'] == 'MD99teste'
        assert admin.post('/api/guindastes/', {'modelo': ' '}, format='json').json()['detail'] == 'Informe o nome / modelo do guindaste.'


class TestAcessorios:
    def test_descartado_exige_motivo(self, admin):
        a = um(admin, '/api/acessorios/', 1)
        r = admin.put('/api/acessorios/1/', {**a, 'situacao': 'descartado', 'motivo_descarte': ''}, format='json')
        assert r.json()['detail'] == 'Informe o motivo do descarte.'

    def test_capacidade_de_trabalho_nao_passa_da_nominal(self, admin):
        a = um(admin, '/api/acessorios/', 1)
        assert admin.put('/api/acessorios/1/', {**a, 'capacidade_trabalho_t': 7}, format='json').status_code == 400

    def test_historico_so_ganha_os_novos(self, admin):
        a = um(admin, '/api/acessorios/', 1)
        antes = a['historico']
        novo = {'data': '2026-10-07', 'descricao': 'Certificado nº 123 registrado'}
        r = admin.put('/api/acessorios/1/', {**a, 'certificado': '123', 'historico': [novo, *antes]}, format='json').json()
        assert r['historico'] == [novo, *antes]
        # Histórico adulterado não é aceito: fica o gravado
        r = admin.put('/api/acessorios/1/', {**r, 'historico': [{'data': '2020-01-01', 'descricao': 'falso'}]}, format='json').json()
        assert r['historico'] == [novo, *antes]

    def test_inspecao_aprovada_e_reprovada(self, admin):
        itens = [{'texto': t, 'conforme': True} for t in admin.get('/api/padroes-inspecao/').json()[0]['itens']]
        r = admin.post('/api/acessorios/1/inspecoes/', {'data': '2026-10-07', 'responsavel': 'Giuliano', 'resultado': 'aprovado', 'itens': itens,
                                                         'observacao': '', 'proxima': '2027-04-07'}, format='json').json()
        assert (r['situacao'], r['ultima_inspecao'], r['proxima_inspecao']) == ('uso', '2026-10-07', '2027-04-07')
        assert r['inspecoes'][0]['itens'] == itens
        itens[1]['conforme'] = False
        corpo = {'data': '2026-10-07', 'responsavel': '', 'resultado': 'aprovado', 'itens': itens, 'proxima': '2027-04-07'}
        assert admin.post('/api/acessorios/1/inspecoes/', corpo, format='json').status_code == 400  # resultado não confere
        r = admin.post('/api/acessorios/1/inspecoes/', {**corpo, 'resultado': 'reprovado', 'destino': 'descartado', 'motivo': ''}, format='json').json()
        assert r['situacao'] == 'descartado'
        assert r['motivo_descarte'].startswith('Reprovado na inspeção: Fita sem cortes')
        assert admin.post('/api/acessorios/1/inspecoes/', corpo, format='json').status_code == 409

    def test_inspecao_futura(self, admin):
        corpo = {'data': '2026-10-08', 'resultado': 'aprovado', 'itens': [{'texto': 'a', 'conforme': True}], 'proxima': '2027-01-01'}
        assert admin.post('/api/acessorios/1/inspecoes/', corpo, format='json').json()['detail'] == 'A inspeção não pode ter data futura.'

    def test_edicao_nao_contorna_descarte_desativacao_nem_inspecao(self, admin):
        from cadastros.models import Acessorio
        a = um(admin, '/api/acessorios/', 1)
        # Adiar a próxima inspeção sem nova inspeção: recusado; antecipar: livre; com nova inspeção: aceito
        r = admin.put('/api/acessorios/1/', {**a, 'proxima_inspecao': '2027-12-31'}, format='json')
        assert (r.status_code, r.json()['detail']) == (400, 'Para adiar a próxima inspeção, informe a data da nova inspeção (ou registre a inspeção).')
        assert admin.put('/api/acessorios/1/', {**a, 'proxima_inspecao': a['ultima_inspecao']}, format='json').status_code == 200
        a = um(admin, '/api/acessorios/', 1)
        r = admin.put('/api/acessorios/1/', {**a, 'ultima_inspecao': '2026-10-08', 'proxima_inspecao': '2027-04-08'}, format='json')
        assert r.json()['detail'] == 'A última inspeção não pode ter data futura.'
        r = admin.put('/api/acessorios/1/', {**a, 'ultima_inspecao': '2026-10-07', 'proxima_inspecao': '2027-04-07'}, format='json')
        assert r.status_code == 200
        # Descartado não volta; inativo só volta por /reativar/
        Acessorio.objects.filter(id=1).update(situacao='descartado', motivo_descarte='Costura rompida')
        a = um(admin, '/api/acessorios/', 1)
        assert admin.put('/api/acessorios/1/', {**a, 'situacao': 'uso'}, format='json').status_code == 409
        assert admin.put('/api/acessorios/1/', {**a, 'situacao': 'descartado'}, format='json').status_code == 200
        admin.post('/api/acessorios/2/desativar/')
        b = um(admin, '/api/acessorios/', 2)
        assert admin.put('/api/acessorios/2/', {**b, 'situacao': 'uso'}, format='json').status_code == 409

    def test_desativar_e_reativar(self, admin):
        assert admin.post('/api/acessorios/2/desativar/').json()['situacao'] == 'inativo'
        assert admin.post('/api/acessorios/2/reativar/').json()['situacao'] == 'uso'
        assert admin.post('/api/acessorios/2/reativar/').status_code == 409


class TestRegrasETipos:
    NOVA = {'nome': 'Regra teste', 'categoria': 'Carga', 'descricao': '', 'formula': 'Pb * f', 'resultado_nome': 'Pd', 'resultado_unidade': 'kg',
            'variaveis': [{'simbolo': 'Pb', 'nome': 'Carga bruta', 'unidade': 'kg', 'origem': 'Resultado: carga bruta (kg)', 'teste': ''},
                          {'simbolo': 'f', 'nome': 'Fator', 'unidade': '', 'origem': 'Valor fixo', 'teste': '1,2'}],
            'limite': False, 'origem_capacidade': None, 'capacidade_teste': ''}

    def test_regra_do_sistema_e_somente_leitura(self, admin):
        r1 = um(admin, '/api/regras/', 'r1')
        assert admin.put('/api/regras/r1/', r1, format='json').status_code == 409
        assert admin.delete('/api/regras/r1/').status_code == 409

    def test_criar_versionar_excluir(self, admin):
        r = admin.post('/api/regras/', self.NOVA, format='json')
        assert r.status_code == 201
        regra = r.json()
        assert (regra['id'], regra['origem'], regra['versao'], regra['autor']) == ('u11', 'criado', 1, 'Giuliano Breda')
        regra = admin.put('/api/regras/u11/', {**regra, 'formula': 'Pb * f * 1,1'}, format='json').json()
        assert regra['versao'] == 2 and [v['formula'] for v in regra['versoes']] == ['Pb * f', 'Pb * f * 1,1']
        assert admin.delete('/api/regras/u11/').status_code == 204

    def test_formula_invalida_e_nome_repetido(self, admin):
        assert admin.post('/api/regras/', {**self.NOVA, 'formula': 'Pb * x'}, format='json').json()['detail'] == 'A variável "x" não está definida na tabela.'
        assert admin.post('/api/regras/', {**self.NOVA, 'formula': 'eval(1)'}, format='json').json()['detail'] == 'Função "eval" não existe.'
        assert admin.post('/api/regras/', {**self.NOVA, 'nome': 'carga bruta'}, format='json').status_code == 409

    def test_regra_usada_por_tipo_nao_sai(self, admin):
        assert admin.delete('/api/regras/u1/').status_code == 409

    def test_tipo_precisa_de_tracao_e_taxa(self, admin):
        t2 = um(admin, '/api/tipos-icamento/', 't2')
        r = admin.post('/api/tipos-icamento/', {**t2, 'nome': 'Novo tipo', 'regras': ['r1', 'u1']}, format='json')
        assert 'Taxa de utilização do guindaste' in r.json()['detail']
        r = admin.post('/api/tipos-icamento/', {**t2, 'nome': 'Novo tipo'}, format='json')
        assert (r.status_code, r.json()['id'], r.json()['origem']) == (201, 't11', 'criado')
        assert admin.delete('/api/tipos-icamento/t11/').status_code == 204
        assert admin.delete('/api/tipos-icamento/t1/').status_code == 409


class TestClientesEConfiguracoes:
    def test_cliente_com_locais(self, admin):
        r = admin.post('/api/clientes/', {'razao_social': 'Nova Indústria S.A.', 'cnpj': '12.ABC.345/01DE-35',
                                          'locais_obra': [{'nome': 'Fábrica 2', 'cidade': 'Araucária', 'uf': 'pr'}]}, format='json')
        assert r.status_code == 201
        assert r.json()['nome_pasta'] == 'Nova Indústria S.A'
        assert r.json()['locais_obra'][0]['uf'] == 'PR'
        assert admin.post('/api/clientes/', {'razao_social': 'X', 'cnpj': '11.111.111/1111-11'}, format='json').status_code == 400

    def test_configuracoes(self, admin):
        cfg = admin.get('/api/configuracoes/').json()
        assert cfg['aviso_atencao_pct'] == 75 and cfg['vento_padrao_ms'] == 7
        assert admin.put('/api/configuracoes/', {**cfg, 'nome_arquivo': 'Plano.pdf'}, format='json').json()['detail'] == 'O nome precisa ter {nº} e {rev}.'
        assert admin.put('/api/configuracoes/', {**cfg, 'pasta_raiz': 'C:\\Planos\\..\\Windows'}, format='json').status_code == 400
        assert admin.put('/api/configuracoes/', {**cfg, 'aviso_atencao_pct': 90}, format='json').status_code == 400
        r = admin.put('/api/configuracoes/', {**cfg, 'aviso_atencao_pct': 80}, format='json')
        assert r.status_code == 200 and r.json()['aviso_atencao_pct'] == 80

    def test_limite_da_taxa_configuravel(self, admin, engenheiro, anonimo):
        cfg = admin.get('/api/configuracoes/').json()
        assert cfg['limite_pct'] == 85 and anonimo.get('/api/sistema/').json()['limite_pct'] == 85
        # Fora da faixa, ou com o aviso de atenção igual ou acima do limite: recusado
        assert admin.put('/api/configuracoes/', {**cfg, 'limite_pct': 49}, format='json').status_code == 400
        assert admin.put('/api/configuracoes/', {**cfg, 'limite_pct': 101}, format='json').status_code == 400
        r = admin.put('/api/configuracoes/', {**cfg, 'limite_pct': 70, 'aviso_atencao_pct': 75}, format='json')
        assert r.status_code == 400 and 'menor que o limite' in r.json()['detail']
        # Só o Administrador muda
        assert engenheiro.put('/api/configuracoes/', {**cfg, 'limite_pct': 90}, format='json').status_code == 403
        r = admin.put('/api/configuracoes/', {**cfg, 'limite_pct': 90}, format='json')
        assert r.status_code == 200 and r.json()['limite_pct'] == 90
        assert anonimo.get('/api/sistema/').json()['limite_pct'] == 90
        # Sem limite no corpo (cliente antigo), o limite gravado continua
        sem = {k: v for k, v in cfg.items() if k != 'limite_pct'}
        assert admin.put('/api/configuracoes/', sem, format='json').json()['limite_pct'] == 90
