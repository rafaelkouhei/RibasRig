"""Quem pode o quê. Cópia da matriz única do front (src/auth/permissoes.ts): mudou lá, muda aqui.

O front só esconde botões; quem garante a permissão é o servidor, em toda rota.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

PERMISSOES: dict[str, tuple[str, ...]] = {
    'consultarPlanos': ('admin', 'engenheiro', 'operacao'),
    'editarRascunhos': ('admin', 'engenheiro'),
    'emitirPlano': ('admin', 'engenheiro'),
    'novaRevisao': ('admin', 'engenheiro'),
    'verMemorial': ('admin', 'engenheiro'),
    'editarCadastros': ('admin', 'engenheiro'),
    'verHistorico': ('admin', 'engenheiro'),
    'gerenciarUsuarios': ('admin',),
    'alterarConfiguracoes': ('admin',),
}


def pode(usuario, acao: str) -> bool:
    perfil = getattr(usuario, 'perfil', None)
    return bool(usuario and getattr(usuario, 'is_authenticated', False) and perfil in PERMISSOES.get(acao, ()))


def permissao(acao: str) -> type[BasePermission]:
    """Classe de permissão do DRF para uma ação da matriz: Pode('editarCadastros')."""

    class _Pode(BasePermission):
        message = 'Seu perfil não tem permissão para esta ação.'

        def has_permission(self, request, view):
            return pode(request.user, acao)

    _Pode.__name__ = f'Pode_{acao}'
    return _Pode


def leitura_ou(acao: str) -> type[BasePermission]:
    """Leitura para qualquer usuário logado; escrita só para quem pode `acao`."""

    class _LeituraOu(BasePermission):
        message = 'Seu perfil pode consultar, mas não alterar.'

        def has_permission(self, request, view):
            if not (request.user and request.user.is_authenticated):
                return False
            return request.method in SAFE_METHODS or pode(request.user, acao)

    _LeituraOu.__name__ = f'LeituraOu_{acao}'
    return _LeituraOu
