"""Configuração do back-end RibasRig (Django REST + PostgreSQL).

Tudo que muda entre máquinas vem de variáveis de ambiente (ver .env.example).
"""
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _carregar_env(arquivo: Path) -> None:
    """Lê o .env (o mesmo do docker-compose) sem sobrescrever o que já está no ambiente.
    Fora do Docker, monta DATABASE_URL para o PostgreSQL em localhost."""
    if arquivo.exists():
        for linha in arquivo.read_text(encoding='utf-8').splitlines():
            linha = linha.strip()
            if linha and not linha.startswith('#') and '=' in linha:
                chave, valor = linha.split('=', 1)
                os.environ.setdefault(chave.strip(), valor.strip())
    if 'DATABASE_URL' not in os.environ and os.environ.get('POSTGRES_PASSWORD'):
        os.environ['DATABASE_URL'] = (
            f"postgres://{os.environ.get('POSTGRES_USER', 'ribasrig')}:{os.environ['POSTGRES_PASSWORD']}"
            f"@localhost:5432/{os.environ.get('POSTGRES_DB', 'ribasrig')}"
        )


_carregar_env(BASE_DIR / '.env')


def env_bool(nome: str, padrao: bool = False) -> bool:
    return os.environ.get(nome, str(padrao)).strip().lower() in ('1', 'true', 'sim', 'yes')


DEBUG = env_bool('DJANGO_DEBUG', False)
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('Defina DJANGO_SECRET_KEY (ou DJANGO_DEBUG=1 em desenvolvimento).')
    SECRET_KEY = 'dev-inseguro-nao-use-em-producao'

ALLOWED_HOSTS = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'nucleo',
    'contas',
    'cadastros',
    'planos',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'APP_DIRS': True, 'OPTIONS': {}}]

DATABASES = {
    'default': dj_database_url.config(
        env='DATABASE_URL', default='postgres://ribasrig:ribasrig@localhost:5432/ribasrig', conn_max_age=60,
    ),
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'contas.Usuario'

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# Arquivos enviados (PDFs dos anexos, laudos, certificados; logo e assinatura). Ficam fora de
# qualquer pasta pública e só saem pela API, com login.
ARQUIVOS_DIR = Path(os.environ.get('RIBASRIG_ARQUIVOS_DIR', BASE_DIR / 'dados' / 'arquivos'))
MEDIA_ROOT = ARQUIVOS_DIR
MEDIA_URL = None
TAMANHO_MAX_PDF = int(os.environ.get('RIBASRIG_TAMANHO_MAX_PDF_MB', '25')) * 1024 * 1024
TAMANHO_MAX_IMAGEM = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024

# "Hoje" das regras de negócio (laudo, inspeção, numeração). Vazio = data real de Curitiba.
# Para a demonstração com o cenário de exemplo, use 2026-10-07 (o mesmo HOJE do front).
RIBASRIG_HOJE = os.environ.get('RIBASRIG_HOJE', '').strip() or None
if RIBASRIG_HOJE:
    try:
        date.fromisoformat(RIBASRIG_HOJE)
    except ValueError:
        raise ImproperlyConfigured(f'RIBASRIG_HOJE="{RIBASRIG_HOJE}" não é uma data aaaa-mm-dd (ex.: 2026-10-07). Deixe vazio para usar a data real.') from None

# Validade da senha provisória gerada pelo administrador
SENHA_PROVISORIA_HORAS = int(os.environ.get('RIBASRIG_SENHA_PROVISORIA_HORAS', '48'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['contas.autenticacao.JWTSemTrocaPendente'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
    'EXCEPTION_HANDLER': 'nucleo.excecoes.tratar_excecao',
    # Decimais saem como número no JSON (o front espera number); a conta é feita em Decimal no servidor.
    'COERCE_DECIMAL_TO_STRING': False,
    # Mesmo formato do front: 'aaaa-mm-ddThh:mm', hora local de Curitiba.
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M',
    # Limite de tentativas no login e na troca de senha (ScopedRateThrottle nessas duas views), por IP.
    'DEFAULT_THROTTLE_RATES': {'login': os.environ.get('RIBASRIG_LIMITE_LOGIN', '10/min')},
    # Proxies de confiança na frente do Django (0 = acesso direto, o caso do escritório). Com 0, o IP é o da conexão:
    # um X-Forwarded-For inventado pelo cliente não escapa do limite. Atrás de um proxy HTTPS (servidor remoto), use 1.
    'NUM_PROXIES': int(os.environ.get('RIBASRIG_PROXIES', '0')),
}

# Cache em arquivo: o contador do limite de tentativas vale para todos os processos do gunicorn (com o cache em
# memória, cada processo contaria à parte e o limite real seria 3 vezes maior).
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
        'LOCATION': os.environ.get('RIBASRIG_CACHE_DIR', str(Path(tempfile.gettempdir()) / 'ribasrig-cache')),
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=12),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    # Trocar a senha (ou gerar senha provisória) invalida os tokens já emitidos.
    'CHECK_REVOKE_TOKEN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

PASSWORD_HASHERS = os.environ.get('RIBASRIG_PASSWORD_HASHERS', '').split(',') if os.environ.get('RIBASRIG_PASSWORD_HASHERS') else [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
]

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# `check --deploy`: o aviso de CSRF não se aplica. A API não usa sessão nem cookie (só JWT no cabeçalho Authorization)
# e não tem admin. HSTS e redirecionamento para HTTPS (W004, W008) continuam aparecendo de propósito: o servidor
# escuta só em 127.0.0.1, em HTTP; num servidor remoto eles são do proxy HTTPS na frente do Django.
SILENCED_SYSTEM_CHECKS = ['security.W003']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.environ.get('RIBASRIG_LOG', 'INFO')},
}
