"""Planos: numeração, rascunho, emissão (recálculo no servidor), revisões imutáveis, lote, anexos."""
import copy
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection

from cadastros.models import Acessorio
from planos.models import PlanoRigging, Revisao, SequenciaMensal

pytestmark = pytest.mark.django_db



def _pdf_real() -> bytes:
    """PDF de uma página em branco (válido: a emissão monta o PDF final com os anexos)."""
    from pypdf import PdfWriter
    w = PdfWriter()
    w.add_blank_page(595, 842)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


PDF = _pdf_real()
ART_NOVA = '1720269999999'


def pdf(nome: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(nome, PDF, content_type='application/pdf')


def dados_de(c, numero: str) -> dict:
    p = c.get(f'/api/planos/{numero}/').json()
    for k in ('id', 'numero', 'situacao_documento', 'revisoes', 'criado_em', 'criado_por', 'atualizado_em'):
        p.pop(k)
    return p


def plano_pronto(c) -> str:
    """Rascunho igual ao 2607036, com operação dentro da validade do laudo, ART nova, anexos enviados e o PDF do laudo
    do guindaste guardado (o checklist não aceita só o nome do arquivo)."""
    d = dados_de(c, '2607036')
    r = c.post(f'/api/guindastes/{d["guindaste_id"]}/laudo/arquivo/', {'arquivo': pdf('Laudo_MD45007.pdf')}, format='multipart')
    assert r.status_code == 200, r.json()
    d.update(data_operacao='2026-10-01', art=ART_NOVA, art_registrada_em=None)
    r = c.post('/api/planos/', d, format='json')
    assert r.status_code == 201, r.json()
    numero = r.json()['numero']
    assert c.post(f'/api/planos/{numero}/anexos/desenhos/', {'arquivo': pdf(f'Desenhos_{numero}.pdf')}, format='multipart').status_code == 200
    assert c.post(f'/api/planos/{numero}/anexos/art/', {'arquivo': pdf(f'ART_{ART_NOVA}.pdf')}, format='multipart').status_code == 200
    return numero


class TestConsulta:
    def test_lista_e_detalhe(self, admin):
        planos = admin.get('/api/planos/').json()
        assert {p['numero'] for p in planos} == {'2607036', '2610001', '2610002'}
        p = admin.get('/api/planos/2607036/').json()
        assert p['situacao_documento'] == 'emitido'
        assert [r['numero'] for r in p['revisoes']] == [1, 2]
        assert p['revisoes'][0]['emitida_em'] == '2026-07-24'  # Rev. 1 do Excel: só a data
        assert p['revisoes'][1]['resultados']['capacidade_kg'] == 9260

    def test_nao_encontrado(self, admin):
        r = admin.get('/api/planos/2610999/')
        assert (r.status_code, r.json()['detail']) == (404, 'Plano 2610999 não encontrado.')


class TestRascunho:
    def test_criar_gera_numero_do_mes(self, admin):
        r = admin.post('/api/planos/', {'carga': {'descricao': 'Teste', 'peso_kg': 1000}}, format='json')
        assert r.status_code == 201
        assert r.json()['numero'] == '2610003'
        assert r.json()['situacao_documento'] == 'rascunho'
        assert r.json()['criado_por'] == 'Giuliano Breda'
        assert admin.post('/api/planos/', {}, format='json').json()['numero'] == '2610004'
        historico = admin.get('/api/planos/2610003/historico/').json()
        assert historico[0]['titulo'] == 'Criou o rascunho'

    def test_salvar_rascunho_mantem_numero_e_ignora_anexos(self, admin):
        d = dados_de(admin, '2610001')
        d['carga']['peso_kg'] = 3500.5
        d['anexos'] = {'desenhos': 'Falso.pdf', 'art_plano': True, 'arquivo_art': 'ART_x.pdf'}
        r = admin.patch('/api/planos/2610001/', d, format='json')
        assert r.status_code == 200
        assert r.json()['carga']['peso_kg'] == 3500.5
        assert r.json()['anexos'] == {'desenhos': None, 'art_plano': False, 'arquivo_art': None}

    def test_emitido_recusa_alteracao(self, admin):
        r = admin.patch('/api/planos/2607036/', dados_de(admin, '2607036'), format='json')
        assert r.status_code == 409
        assert 'Crie uma nova revisão' in r.json()['detail']

    def test_referencias_conferidas(self, admin):
        d = dados_de(admin, '2610001')
        d['lingada'][0]['acessorio_id'] = 999
        assert admin.patch('/api/planos/2610001/', d, format='json').json()['detail'] == 'Acessório não encontrado: 999.'

    def test_entrada_estranha_responde_400_e_nao_cria_plano(self, admin):
        # Antes respondiam 500: data que não existe e número com dígitos demais para o Decimal
        antes = PlanoRigging.objects.count()
        r = admin.post('/api/planos/', {'art_registrada_em': 'abc'}, format='json')
        assert (r.status_code, r.json()['detail']) == (400, 'Data de registro da ART inválida: use aaaa-mm-ddThh:mm.')
        r = admin.post('/api/planos/', {'carga': {'peso_kg': '123456789012345678901234567890.123456789'}}, format='json')
        assert (r.status_code, r.json()['detail']) == (400, 'carga.peso_kg: Número grande demais.')
        assert PlanoRigging.objects.count() == antes

    def test_duplicar(self, admin):
        r = admin.post('/api/planos/2607036/duplicar/')
        assert r.status_code == 201
        assert r.json()['copia_de'] == '2607036'
        assert r.json()['art'] == '' and r.json()['anexos']['desenhos'] is None
        assert r.json()['carga']['peso_kg'] == 3450


class TestEmissao:
    def test_bloqueado_pelo_laudo_vencido(self, admin):
        r = admin.post('/api/planos/2610001/emitir/')
        assert r.status_code == 422
        assert r.json()['detail'].startswith('Não dá para emitir: laudo do Palfinger MD 45.007 vencido em 06/10/2026')

    def test_taxa_acima_de_85(self, admin):
        assert 'taxa acima de 85%' in admin.post('/api/planos/2610002/emitir/').json()['detail']

    def test_limite_das_configuracoes_vale_na_emissao_e_fica_na_revisao(self, admin):
        # Manilha do gancho em 68,09%: com limite de 60% o servidor bloqueia; com 70%, emite e grava o limite usado
        numero = plano_pronto(admin)
        cfg = admin.get('/api/configuracoes/').json()
        admin.put('/api/configuracoes/', {**cfg, 'limite_pct': 60, 'aviso_atencao_pct': 55}, format='json')
        r = admin.post(f'/api/planos/{numero}/emitir/')
        assert r.status_code == 422 and 'taxa acima de 60%' in r.json()['detail']
        admin.put('/api/configuracoes/', {**cfg, 'limite_pct': 70, 'aviso_atencao_pct': 55}, format='json')
        assert admin.post(f'/api/planos/{numero}/emitir/').status_code == 200
        assert Revisao.objects.get(plano__numero=numero, numero=1).entradas['limite_pct'] == '70.00'
        # A API devolve o limite e o aviso da emissão, para a tela julgar a revisão com eles
        admin.put('/api/configuracoes/', cfg, format='json')
        rev = admin.get(f'/api/planos/{numero}/').json()['revisoes'][0]
        assert (rev['limite_pct'], rev['aviso_atencao_pct']) == (70.0, 55.0)

    def test_laudo_so_com_nome_nao_conta_como_anexado(self, admin):
        # O PDF do laudo some (ou o upload falhou) e o cadastro manda só o nome: o checklist não aprova
        numero = plano_pronto(admin)
        from cadastros.models import Laudo
        Laudo.objects.filter(guindaste_id=1).update(arquivo_ref=None)
        g = next(x for x in admin.get('/api/guindastes/').json() if x['id'] == 1)
        assert all(l['arquivo'] is None for l in g['laudos'])
        g['laudos'] = [{**l, 'arquivo': 'Laudo_inventado.pdf'} for l in g['laudos']]
        assert all(l['arquivo'] is None for l in admin.put('/api/guindastes/1/', g, format='json').json()['laudos'])
        r = admin.post(f'/api/planos/{numero}/emitir/')
        assert (r.status_code, r.json()['detail']) == (422, 'Não dá para emitir: anexos obrigatórios.')

    def test_guindaste_inativo_nao_emite(self, admin):
        from cadastros.models import Guindaste
        numero = plano_pronto(admin)
        Guindaste.objects.filter(id=PlanoRigging.objects.get(numero=numero).guindaste_id).update(ativo=False)
        r = admin.post(f'/api/planos/{numero}/emitir/')
        assert r.status_code == 422 and r.json()['detail'].startswith('Guindaste inativo no cadastro')

    def test_emite_revisao_1_e_trava(self, admin):
        numero = plano_pronto(admin)
        r = admin.post(f'/api/planos/{numero}/emitir/', {'observacao': 'Primeira emissão'}, format='json')
        assert r.status_code == 200, r.json()
        p = r.json()
        assert p['situacao_documento'] == 'emitido'
        rev = p['revisoes'][0]
        assert (rev['numero'], rev['origem'], rev['emitida_por'], rev['observacao']) == (1, 'sistema', 'Giuliano Breda', 'Primeira emissão')
        assert rev['arquivo_pdf'] == f'Plano_de_Rigging_{numero}_Rev1.pdf'
        res = rev['resultados']
        assert res['pb_kg'] == pytest.approx(3746.62)
        assert res['capacidade_kg'] == 9260
        assert round(res['taxa_guindaste_pct'], 2) == 40.46
        assert [round(x['taxa_pct'], 2) for x in res['posicoes']] == [46.52, 58.36, 17.76, 68.09]
        assert round(res['sapatas']['esforco_kgf'], 2) == 7940.68
        # Entradas guardadas e uso registrado nos cadastros
        entradas = Revisao.objects.get(plano__numero=numero).entradas
        assert entradas['graficos'][0]['pontos'][0] == {'alcance_m': '4.18000000', 'capacidade_kg': '10900.00000000'}
        assert numero in admin.get('/api/acessorios/').json()[0]['planos']
        assert numero in next(t for t in admin.get('/api/tipos-icamento/').json() if t['id'] == 't1')['planos']
        assert Acessorio.objects.get(id=1).historico.first().descricao == f'Usado no plano {numero} Rev. 1, emitido no sistema'
        # Emitido: não muda mais
        assert admin.patch(f'/api/planos/{numero}/', dados_de(admin, numero), format='json').status_code == 409
        assert admin.post(f'/api/planos/{numero}/emitir/').status_code == 409

    def test_nova_revisao_mantem_numero_e_a_anterior(self, admin):
        numero = plano_pronto(admin)
        admin.post(f'/api/planos/{numero}/emitir/')
        r = admin.post(f'/api/planos/{numero}/nova-revisao/')
        assert r.json()['situacao_documento'] == 'rascunho'
        d = dados_de(admin, numero)
        d['raio_m'] = 5.26
        admin.patch(f'/api/planos/{numero}/', d, format='json')
        p = admin.post(f'/api/planos/{numero}/emitir/').json()
        assert [r['numero'] for r in p['revisoes']] == [1, 2]
        assert p['revisoes'][0]['resultados']['capacidade_kg'] == 9260
        assert p['revisoes'][1]['resultados']['capacidade_kg'] == 8740
        assert admin.post(f'/api/planos/{numero}/nova-revisao/').status_code == 200
        assert admin.post(f'/api/planos/{numero}/nova-revisao/').status_code == 409

    def test_art_de_outro_plano_bloqueia(self, admin):
        numero = plano_pronto(admin)
        d = dados_de(admin, numero)
        d['art'] = '1720264496217'  # ART do 2607036
        admin.patch(f'/api/planos/{numero}/', d, format='json')
        r = admin.post(f'/api/planos/{numero}/emitir/')
        assert r.status_code == 422
        assert 'nº da art do plano' in r.json()['detail']

    def test_sem_anexos_nao_emite(self, admin):
        d = dados_de(admin, '2607036')
        d.update(data_operacao='2026-10-01', art=ART_NOVA)
        numero = admin.post('/api/planos/', d, format='json').json()['numero']
        assert 'anexos obrigatórios' in admin.post(f'/api/planos/{numero}/emitir/').json()['detail']


class TestRevisaoImutavel:
    def test_banco_recusa_update_e_delete(self, cenario):
        from django.db import DatabaseError, transaction
        for sql in ("UPDATE planos_revisao SET observacao = 'x'", 'DELETE FROM planos_revisao'):
            with pytest.raises(DatabaseError, match='imutável'), transaction.atomic(), connection.cursor() as c:
                c.execute(sql)

    def test_model_recusa_salvar_de_novo(self, cenario):
        with pytest.raises(ValueError):
            Revisao.objects.first().save()


class TestLote:
    def test_numeros_em_sequencia(self, admin):
        r = admin.post('/api/planos/lote/', {'dados': {'carga': {'descricao': 'Injetora', 'peso_kg': 2000}}, 'quantidade': 3}, format='json')
        assert r.status_code == 201
        assert [p['numero'] for p in r.json()] == ['2610003', '2610004', '2610005']

    def test_nao_invade_o_mes_seguinte(self, admin):
        SequenciaMensal.objects.update_or_create(prefixo='2610', defaults={'ultimo': 997})
        r = admin.post('/api/planos/lote/', {'dados': {}, 'quantidade': 3}, format='json')
        assert (r.status_code, r.json()['detail']) == (400, 'Só cabem mais 2 planos neste mês (até 2610999).')
        assert PlanoRigging.objects.count() == 3


class TestAnexos:
    def test_so_pdf_de_verdade(self, admin):
        falso = SimpleUploadedFile('Desenhos.pdf', b'MZ\x90\x00 nao sou pdf', content_type='application/pdf')
        r = admin.post('/api/planos/2610001/anexos/desenhos/', {'arquivo': falso}, format='multipart')
        assert (r.status_code, r.json()['detail']) == (400, 'O arquivo não é um PDF válido.')

    def test_enviar_baixar_remover(self, admin):
        r = admin.post('/api/planos/2610001/anexos/desenhos/', {'arquivo': pdf('../../etc/Desenhos 2610001.pdf')}, format='multipart')
        assert r.json()['anexos']['desenhos'] == 'Desenhos 2610001.pdf'
        baixado = admin.get('/api/planos/2610001/anexos/desenhos/')
        assert baixado.status_code == 200 and b''.join(baixado.streaming_content) == PDF
        assert admin.delete('/api/planos/2610001/anexos/desenhos/').json()['anexos']['desenhos'] is None

    def test_plano_emitido_nao_recebe_anexo(self, admin):
        assert admin.post('/api/planos/2607036/anexos/desenhos/', {'arquivo': pdf('D.pdf')}, format='multipart').status_code == 409

    def test_operacao_baixa_mas_nao_envia(self, admin, operacao):
        admin.post('/api/planos/2610001/anexos/art/', {'arquivo': pdf('ART_1.pdf')}, format='multipart')
        assert operacao.get('/api/planos/2610001/anexos/art/').status_code == 200
        assert operacao.post('/api/planos/2610001/anexos/art/', {'arquivo': pdf('ART_1.pdf')}, format='multipart').status_code == 403


def test_dados_salvos_voltam_iguais(admin):
    """O que o front grava volta igual (round-trip de todos os campos do DadosPlano)."""
    d = dados_de(admin, '2610001')
    alterado = copy.deepcopy(d)
    alterado['guindastes_adicionais'] = [{'guindaste_id': 2, 'tabela_id': None, 'raio_m': 5.0, 'pct': 40}]
    alterado['obra']['uf'] = 'pr'
    r = admin.patch('/api/planos/2610001/', alterado, format='json').json()
    assert r['guindastes_adicionais'] == [{'guindaste_id': 2, 'tabela_id': None, 'raio_m': 5, 'pct': 40}]
    assert r['obra']['uf'] == 'PR'
    assert r['lingada'] == d['lingada']
