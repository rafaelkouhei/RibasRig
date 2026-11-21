import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

SENHA_TESTE = 'Teste1234'


@pytest.fixture(autouse=True)
def _ambiente(settings, tmp_path, monkeypatch):
    settings.RIBASRIG_HOJE = '2026-10-07'
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # só nos testes, por velocidade
    settings.MEDIA_ROOT = tmp_path / 'arquivos'
    # Limite de tentativas: o DRF lê as taxas na importação, então a troca é na classe (TestLimiteDeTentativas baixa
    # de novo). Cache em memória e limpo a cada teste: um teste não gasta as tentativas do outro.
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'login': '1000/min'})
    settings.CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
    cache.clear()
    monkeypatch.setenv('RIBASRIG_SENHA_TESTE', SENHA_TESTE)


@pytest.fixture
def cenario(db):
    call_command('carregar_exemplo', stdout=open('/dev/null', 'w'))


def cliente_de(usuario) -> APIClient:
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(usuario).access_token}')
    return c


@pytest.fixture
def admin(cenario) -> APIClient:
    return cliente_de(get_user_model().objects.get(username='giuliano.breda'))


@pytest.fixture
def operacao(cenario) -> APIClient:
    return cliente_de(get_user_model().objects.get(username='rigger.campo'))


@pytest.fixture
def engenheiro(cenario) -> APIClient:
    u = get_user_model().objects.create(username='eng.teste', nome='Engenheiro de teste', perfil='engenheiro')
    return cliente_de(u)


@pytest.fixture
def anonimo() -> APIClient:
    return APIClient()
