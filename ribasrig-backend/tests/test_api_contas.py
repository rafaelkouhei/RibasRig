"""Login, senha provisória, tokens e matriz de permissões (igual a src/auth/permissoes.ts)."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle

from tests.conftest import SENHA_TESTE, cliente_de

pytestmark = pytest.mark.django_db


def entrar(c, usuario, senha):
    return c.post('/api/auth/token/', {'usuario': usuario, 'senha': senha}, format='json')


class TestLogin:
    def test_login_ok(self, cenario, anonimo):
        r = entrar(anonimo, 'Giuliano.Breda', SENHA_TESTE)
        assert r.status_code == 200
        assert {'access', 'refresh'} <= r.json().keys()
        assert r.json()['usuario'] == {**r.json()['usuario'], 'usuario': 'giuliano.breda', 'perfil': 'admin', 'principal': True, 'trocar_senha': False}

    def test_senha_errada(self, cenario, anonimo):
        r = entrar(anonimo, 'giuliano.breda', 'errada')
        assert (r.status_code, r.json()) == (401, {'detail': 'Usuário ou senha incorretos.'})

    def test_campos_vazios(self, cenario, anonimo):
        assert entrar(anonimo, '', '').json()['detail'] == 'Informe usuário e senha.'

    def test_usuario_inativo_nao_entra(self, cenario, anonimo):
        get_user_model().objects.filter(username='rigger.campo').update(is_active=False)
        assert entrar(anonimo, 'rigger.campo', SENHA_TESTE).status_code == 401

    def test_rota_protegida_sem_token(self, cenario, anonimo):
        assert anonimo.get('/api/planos/').status_code == 401

    def test_me(self, admin):
        assert admin.get('/api/auth/me/').json()['usuario'] == 'giuliano.breda'

    def test_logout_invalida_o_refresh(self, cenario, anonimo):
        refresh = entrar(anonimo, 'giuliano.breda', SENHA_TESTE).json()['refresh']
        assert anonimo.post('/api/auth/token/refresh/', {'refresh': refresh}, format='json').status_code == 200
        novo = entrar(anonimo, 'giuliano.breda', SENHA_TESTE).json()['refresh']
        assert anonimo.post('/api/auth/logout/', {'refresh': novo}, format='json').status_code == 204
        assert anonimo.post('/api/auth/token/refresh/', {'refresh': novo}, format='json').status_code == 401


class TestLimiteDeTentativas:
    def test_login_bloqueia_depois_do_limite(self, cenario, anonimo, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'login': '3/min'})
        for _ in range(3):
            assert entrar(anonimo, 'giuliano.breda', 'errada').status_code == 401
        # Enquanto o limite vale, nem a senha certa entra
        r = entrar(anonimo, 'giuliano.breda', SENHA_TESTE)
        assert r.status_code == 429
        assert r.json()['detail'].startswith('Muitas tentativas seguidas. Aguarde ')

    def test_x_forwarded_for_inventado_nao_escapa(self, cenario, anonimo, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'login': '2/min'})
        dados = {'usuario': 'giuliano.breda', 'senha': 'errada'}
        for i in range(2):
            anonimo.post('/api/auth/token/', dados, format='json', HTTP_X_FORWARDED_FOR=f'10.0.0.{i}')
        assert anonimo.post('/api/auth/token/', dados, format='json', HTTP_X_FORWARDED_FOR='10.0.0.99').status_code == 429

    def test_troca_de_senha_tambem_tem_limite(self, cenario, anonimo, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'login': '2/min'})
        troca = {'usuario': 'rigger.campo', 'senha_atual': 'errada', 'senha_nova': 'NovaSenha2026'}
        for _ in range(2):
            assert anonimo.post('/api/auth/trocar-senha/', troca, format='json').status_code == 401
        assert anonimo.post('/api/auth/trocar-senha/', troca, format='json').status_code == 429


class TestSenhaProvisoria:
    def test_fluxo_do_primeiro_acesso(self, admin, anonimo):
        r = admin.post('/api/usuarios/', {'nome': 'Novo Engenheiro', 'usuario': 'novo.eng', 'perfil': 'engenheiro'}, format='json')
        assert r.status_code == 201
        provisoria = r.json()['senha_provisoria']
        assert r.json()['usuario']['trocar_senha'] is True
        # Login com a provisória não entrega token
        r = entrar(anonimo, 'novo.eng', provisoria)
        assert r.status_code == 200 and r.json()['trocar_senha'] is True and 'access' not in r.json()
        troca = lambda nova: anonimo.post('/api/auth/trocar-senha/', {'usuario': 'novo.eng', 'senha_atual': provisoria, 'senha_nova': nova}, format='json')  # noqa: E731
        assert troca('curta1').json()['detail'] == 'A nova senha precisa de 8 caracteres, com letras e números.'
        assert troca(provisoria).status_code == 400
        assert troca('NovaSenha2026').status_code == 204
        r = entrar(anonimo, 'novo.eng', 'NovaSenha2026')
        assert r.status_code == 200 and 'access' in r.json()
        # A provisória é de uso único
        assert entrar(anonimo, 'novo.eng', provisoria).status_code == 401

    def test_provisoria_vencida(self, admin, anonimo):
        r = admin.post('/api/usuarios/', {'nome': 'X', 'usuario': 'x.vencido', 'perfil': 'operacao'}, format='json')
        get_user_model().objects.filter(username='x.vencido').update(senha_provisoria_expira_em=timezone.now() - timedelta(minutes=1))
        r = entrar(anonimo, 'x.vencido', r.json()['senha_provisoria'])
        assert r.status_code == 401 and 'vencida' in r.json()['detail']

    def test_nova_provisoria_derruba_os_tokens(self, admin):
        rigger = get_user_model().objects.get(username='rigger.campo')
        c = cliente_de(rigger)
        assert c.get('/api/planos/').status_code == 200
        assert admin.post(f'/api/usuarios/{rigger.id}/senha-provisoria/').status_code == 200
        assert c.get('/api/planos/').status_code == 401


class TestUsuarios:
    def test_admin_principal_travado(self, admin):
        principal = get_user_model().objects.get(principal=True)
        assert admin.patch(f'/api/usuarios/{principal.id}/', {'ativo': False}, format='json').status_code == 409
        assert admin.patch(f'/api/usuarios/{principal.id}/', {'perfil': 'engenheiro'}, format='json').status_code == 409
        assert admin.post(f'/api/usuarios/{principal.id}/senha-provisoria/').status_code == 409

    def test_login_repetido_e_invalido(self, admin):
        assert admin.post('/api/usuarios/', {'nome': 'A', 'usuario': 'rigger.campo', 'perfil': 'operacao'}, format='json').status_code == 409
        assert admin.post('/api/usuarios/', {'nome': 'A', 'usuario': 'Com Espaço', 'perfil': 'operacao'}, format='json').status_code == 400


MATRIZ = [
    # (método, rota, admin, engenheiro, operação)
    ('get', '/api/planos/', 200, 200, 200),
    ('post', '/api/planos/', 201, 201, 403),
    ('get', '/api/planos/2607036/historico/', 200, 200, 403),
    ('get', '/api/guindastes/', 200, 200, 200),
    ('post', '/api/clientes/', 201, 201, 403),
    ('get', '/api/usuarios/', 200, 403, 403),
    ('get', '/api/configuracoes/', 200, 200, 200),
    ('put', '/api/configuracoes/', 400, 403, 403),
    ('post', '/api/planos/2610001/emitir/', 422, 422, 403),
]


@pytest.mark.parametrize('metodo,rota,esperado_admin,esperado_eng,esperado_oper', MATRIZ)
def test_matriz_de_permissoes(admin, engenheiro, operacao, metodo, rota, esperado_admin, esperado_eng, esperado_oper):
    corpo = {'razao_social': 'Cliente teste'} if 'clientes' in rota else {}
    for c, esperado in ((admin, esperado_admin), (engenheiro, esperado_eng), (operacao, esperado_oper)):
        assert getattr(c, metodo)(rota, corpo, format='json').status_code == esperado, (metodo, rota)
