import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from nucleo.campos import iso_data_hora

# Sem caracteres que se confundem (0/O, 1/l/I) para ditar ao usuário
_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'


def gerar_senha_provisoria() -> str:
    while True:
        s = ''.join(secrets.choice(_ALFABETO) for _ in range(10))
        if re.search(r'\d', s) and re.search(r'[A-Za-z]', s):
            return s


def aplicar_senha_provisoria(usuario) -> str:
    senha = gerar_senha_provisoria()
    usuario.set_password(senha)
    usuario.trocar_senha = True
    usuario.senha_provisoria_expira_em = timezone.now() + timedelta(hours=settings.SENHA_PROVISORIA_HORAS)
    return senha


def erro_senha_nova(senha_nova: str, senha_atual: str) -> str | None:
    """Mesmas regras visíveis na tela Redefinir senha."""
    if len(senha_nova) < 8 or not re.search(r'\d', senha_nova) or not re.search(r'[A-Za-zÀ-ÿ]', senha_nova):
        return 'A nova senha precisa de 8 caracteres, com letras e números.'
    if senha_nova == senha_atual:
        return 'A nova senha precisa ser diferente da provisória.'
    return None


def provisoria_vencida(usuario) -> bool:
    return bool(usuario.trocar_senha and usuario.senha_provisoria_expira_em and usuario.senha_provisoria_expira_em < timezone.now())


def usuario_json(u) -> dict:
    return {
        'id': u.id, 'nome': u.nome, 'usuario': u.username, 'perfil': u.perfil, 'ativo': u.is_active,
        'principal': u.principal, 'trocar_senha': u.trocar_senha, 'ultimo_acesso': iso_data_hora(u.last_login),
        'observacao': u.observacao,
    }
