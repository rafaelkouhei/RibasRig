"""PDF do plano, memorial interno, planilha do carimbo, a data do sistema e o formato dos erros."""
import io
import json

import pytest
from openpyxl import load_workbook
from pypdf import PdfReader, PdfWriter

from cadastros.models import Cliente
from planos.models import DocumentoRevisao, PlanoRigging
from tests.test_api_planos import plano_pronto

pytestmark = pytest.mark.django_db


def pdf_de(resposta) -> PdfReader:
    assert resposta.status_code == 200, getattr(resposta, 'data', resposta)
    assert resposta['Content-Type'] == 'application/pdf'
    return PdfReader(io.BytesIO(b''.join(resposta.streaming_content)))


def texto(leitor: PdfReader) -> str:
    return '\n'.join(p.extract_text() for p in leitor.pages)


def pdf_com_paginas(n: int) -> bytes:
    w = PdfWriter()
    for _ in range(n):
        w.add_blank_page(595, 842)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


class TestPdfDoPlano:
    def test_emissao_gera_pdf_na_ordem_com_os_anexos(self, admin, monkeypatch):
        # Anexos com 3 páginas cada: ficha (1) + desenhos (3) + ART (3) + procedimento (1) + laudo (3)
        import tests.test_api_planos as T
        monkeypatch.setattr(T, 'PDF', pdf_com_paginas(3))
        numero = plano_pronto(admin)
        admin.post(f'/api/planos/{numero}/emitir/')
        assert set(DocumentoRevisao.objects.filter(revisao__plano__numero=numero).values_list('tipo', flat=True)) == {'plano', 'memorial'}
        r = admin.get(f'/api/planos/{numero}/revisoes/1/pdf/')
        assert r['X-Paginas'] == '11' and r['Content-Disposition'].startswith('inline')
        leitor = pdf_de(r)
        assert len(leitor.pages) == 11
        t = [p.extract_text() for p in leitor.pages]
        assert f'PLANO DE RIGGING nº {numero}' in t[0]
        for valor in ('3.746,62 kg', '9,26 t', '40,46 %', '58,36 %', '68,09 %', '7.940,68 kgf', '3,18 kgf/cm²', 'Kaefer Rip', 'ART 1720269999999'):
            assert valor in t[0], valor
        assert 'Procedimento' in t[7] and 'raio de 7,0 m' in t[7]
        # O laudo entra com o PDF guardado, nunca como página de aviso numa emissão nova
        assert not any('não está guardado no sistema' in x for x in t)
        assert leitor.metadata.title == f'Plano de Rigging nº {numero} · Rev. 1'

    def test_baixar_como_anexo(self, admin):
        r = admin.get('/api/planos/2607036/revisoes/2/pdf/?baixar=1')
        assert r['Content-Disposition'].startswith('attachment') and 'Plano_de_Rigging_2607036_Rev2.pdf' in r['Content-Disposition']

    def test_revisao_do_cenario_gera_no_primeiro_pedido_e_reaproveita(self, admin, operacao):
        assert not DocumentoRevisao.objects.exists()
        leitor = pdf_de(operacao.get('/api/planos/2607036/revisoes/2/pdf/'))
        assert len(leitor.pages) == 5  # ficha, desenhos, ART, procedimento e laudo (estes três sem arquivo no cenário)
        assert 'Desenhos_2607036.pdf' in leitor.pages[1].extract_text()
        pdf_de(admin.get('/api/planos/2607036/revisoes/2/pdf/'))
        assert DocumentoRevisao.objects.filter(tipo='plano').count() == 1

    def test_revisao_antiga_com_anexo_ilegivel_ganha_pagina_de_aviso(self, admin):
        # Emitida antes do PDF existir, com um anexo que não é PDF: a revisão não muda mais, então o PDF sai com aviso
        from nucleo.models import Arquivo
        numero = plano_pronto(admin)
        admin.post(f'/api/planos/{numero}/emitir/')
        DocumentoRevisao.objects.filter(revisao__plano__numero=numero, tipo='plano').delete()
        desenhos = Arquivo.objects.get(finalidade='desenhos')
        with open(desenhos.arquivo.path, 'wb') as fh:
            fh.write(b'%PDF-1.4 falso')
        leitor = pdf_de(admin.get(f'/api/planos/{numero}/revisoes/1/pdf/'))
        assert 'não pôde ser lido' in leitor.pages[1].extract_text()

    def test_emissao_recusa_anexo_ilegivel(self, admin, monkeypatch):
        import tests.test_api_planos as T
        monkeypatch.setattr(T, 'PDF', b'%PDF-1.4 falso')
        numero = plano_pronto(admin)
        r = admin.post(f'/api/planos/{numero}/emitir/')
        assert r.status_code == 422 and 'desenhos' in r.json()['detail']
        assert admin.get(f'/api/planos/{numero}/').json()['situacao_documento'] == 'rascunho'

    def test_revisao_do_excel_nao_tem_pdf(self, admin):
        r = admin.get('/api/planos/2607036/revisoes/1/pdf/')
        assert r.status_code == 409 and 'Excel' in r.json()['detail']

    def test_revisao_inexistente(self, admin):
        assert admin.get('/api/planos/2607036/revisoes/9/pdf/').status_code == 404


class TestMemorial:
    def test_conteudo_do_2607036(self, admin):
        t = texto(pdf_de(admin.get('/api/planos/2607036/revisoes/2/memorial/')))
        for trecho in ('MEMORIAL DE CÁLCULO', 'C = 10.900 + (5,00 − 4,18) × (7.300 − 10.900) ÷ (5,98 − 4,18) = 10.900 − 1.640,00 = 9.260 kg',
                       'TU = 40,46%', 'Te = 2,45 t', 'F = M ÷ (a + b) = 18.733,10 ÷ (2,95 + 5,70) = 2.165,68 kgf', 'RMET = 3,18 kgf/cm² (3,1763)'):
            assert trecho in t, trecho

    def test_so_admin_e_engenheiro(self, operacao, engenheiro):
        assert operacao.get('/api/planos/2607036/revisoes/2/memorial/').status_code == 403
        assert engenheiro.get('/api/planos/2607036/revisoes/2/memorial/').status_code == 200


class TestCarimbo:
    def test_rascunho_com_calculo_atual(self, admin):
        r = admin.get('/api/planos/2610001/carimbo/')
        assert r.status_code == 200 and 'Carimbo_2610001.xlsx' in r['Content-Disposition']
        wb = load_workbook(io.BytesIO(r.content))
        ws = wb['Carimbo']
        valor = lambda nome: ws[wb.defined_names[nome].attr_text.split('!')[1].replace('$', '')].value  # noqa: E731
        assert valor('NUMERO_PLANO') == '2610001'
        assert valor('REVISAO') == 'Rascunho da Rev. 1'
        assert valor('ESFORCO_SAPATAS_KGF') == '7.940,68'
        assert valor('RMET_KGF_CM2') == '3,18'
        assert valor('DATA_OPERACAO') == '15/10/2026'

    def test_emitido_usa_a_ultima_revisao_e_operacao_nao_baixa(self, admin, operacao):
        wb = load_workbook(io.BytesIO(admin.get('/api/planos/2607036/carimbo/').content))
        assert wb['Carimbo']['C3'].value == 'Rev. 2'
        assert operacao.get('/api/planos/2607036/carimbo/').status_code == 403

    def test_emitido_usa_a_copia_da_emissao(self, admin):
        # Como o PDF: renomear o contratante depois de emitir não muda o carimbo
        numero = plano_pronto(admin)
        assert admin.post(f'/api/planos/{numero}/emitir/').status_code == 200
        Cliente.objects.filter(id=PlanoRigging.objects.get(numero=numero).cliente_id).update(razao_social='Outro Nome Ltda.')
        wb = load_workbook(io.BytesIO(admin.get(f'/api/planos/{numero}/carimbo/').content))
        ws = wb['Carimbo']
        valor = lambda nome: ws[wb.defined_names[nome].attr_text.split('!')[1].replace('$', '')].value  # noqa: E731
        assert valor('REVISAO') == 'Rev. 1'
        assert valor('CONTRATANTE') == 'Kaefer Rip Serviços Industriais Ltda.'


def test_erros_fora_das_views_tambem_em_json(anonimo):
    r = anonimo.get('/api/nao-existe/')
    assert (r.status_code, r.json()) == (404, {'detail': 'Endereço não encontrado.'})
    from django.test import RequestFactory

    from nucleo.excecoes import erro_interno
    r = erro_interno(RequestFactory().get('/api/planos/'))
    assert r.status_code == 500 and json.loads(r.content)['detail'].startswith('Erro interno do servidor.')


def test_data_do_sistema_sem_login(anonimo):
    r = anonimo.get('/api/sistema/')
    assert r.status_code == 200 and r.json()['hoje'] == '2026-10-07'
