from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from motor.validacao import erro_login
from nucleo.excecoes import Conflito, DadosInvalidos, LoginRecusado

from .permissoes import permissao
from .servicos import aplicar_senha_provisoria, erro_senha_nova, provisoria_vencida, usuario_json

Usuario = get_user_model()
PERFIS = [p for p, _ in Usuario.Perfil.choices]


# =============================================================================================
# Autenticação
# =============================================================================================

class _Login(serializers.Serializer):
    usuario = serializers.CharField(allow_blank=True, trim_whitespace=True)
    senha = serializers.CharField(allow_blank=True, trim_whitespace=False)


class LoginView(APIView):
    """POST /api/auth/token/ {usuario, senha} → {access, refresh, usuario}.
    Com senha provisória pendente: {trocar_senha: true, usuario} e NENHUM token (troca antes de entrar)."""
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        s = _Login(data=request.data)
        s.is_valid(raise_exception=True)
        login, senha = s.validated_data['usuario'].lower(), s.validated_data['senha']
        if not login or not senha:
            raise DadosInvalidos('Informe usuário e senha.')
        u = authenticate(request, username=login, password=senha)
        if u is None:
            raise LoginRecusado('Usuário ou senha incorretos.')
        if u.trocar_senha:
            if provisoria_vencida(u):
                raise LoginRecusado('Senha provisória vencida. Peça uma nova ao administrador.')
            return Response({'trocar_senha': True, 'usuario': usuario_json(u)})
        u.last_login = timezone.now()
        u.save(update_fields=['last_login'])
        refresh = RefreshToken.for_user(u)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh), 'usuario': usuario_json(u)})


class LogoutView(APIView):
    """POST /api/auth/logout/ {refresh} → invalida o refresh. Sempre 204 (sair nunca falha para o usuário)."""
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        try:
            RefreshToken(str(request.data.get('refresh', ''))).blacklist()
        except TokenError:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class EuView(APIView):
    """GET /api/auth/me/ → usuário logado (o front confia nisto, não no que guardou no navegador)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(usuario_json(request.user))


class _TrocarSenha(serializers.Serializer):
    usuario = serializers.CharField()
    senha_atual = serializers.CharField(allow_blank=True, trim_whitespace=False)
    senha_nova = serializers.CharField(allow_blank=True, trim_whitespace=False)


class TrocarSenhaView(APIView):
    """POST /api/auth/trocar-senha/ {usuario, senha_atual, senha_nova} → 204. Primeiro acesso e redefinição."""
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        s = _TrocarSenha(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if not d['senha_atual']:
            raise DadosInvalidos('Informe a senha provisória.')
        u = authenticate(request, username=d['usuario'].strip().lower(), password=d['senha_atual'])
        if u is None or provisoria_vencida(u):
            raise LoginRecusado('Usuário ou senha provisória incorretos.')
        erro = erro_senha_nova(d['senha_nova'], d['senha_atual'])
        if erro:
            raise DadosInvalidos(erro)
        u.set_password(d['senha_nova'])
        u.trocar_senha = False
        u.senha_provisoria_expira_em = None
        u.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================================
# Usuários (só Administrador)
# =============================================================================================

class _NovoUsuario(serializers.Serializer):
    nome = serializers.CharField(allow_blank=True)
    usuario = serializers.CharField(allow_blank=True)
    perfil = serializers.ChoiceField(choices=PERFIS)


class _EditarUsuario(serializers.Serializer):
    nome = serializers.CharField(required=False, allow_blank=True)
    perfil = serializers.ChoiceField(choices=PERFIS, required=False)
    ativo = serializers.BooleanField(required=False)
    observacao = serializers.CharField(required=False, allow_blank=True, max_length=300)


GerenciarUsuarios = permissao('gerenciarUsuarios')


def _obter(id_: int):
    try:
        return Usuario.objects.get(id=id_)
    except Usuario.DoesNotExist:
        raise NotFound('Usuário não encontrado.') from None


class UsuariosView(APIView):
    """GET /api/usuarios/ · POST /api/usuarios/ → {usuario, senha_provisoria} (mostrada uma vez)."""
    permission_classes = [GerenciarUsuarios]

    def get(self, request):
        return Response([usuario_json(u) for u in Usuario.objects.all()])

    @transaction.atomic
    def post(self, request):
        s = _NovoUsuario(data=request.data)
        s.is_valid(raise_exception=True)
        nome, login = s.validated_data['nome'].strip(), s.validated_data['usuario'].strip().lower()
        if not nome:
            raise DadosInvalidos('Informe o nome.')
        erro = erro_login(login)
        if erro:
            raise DadosInvalidos(erro)
        if Usuario.objects.filter(username=login).exists():
            raise Conflito(f'O usuário "{login}" já existe.')
        u = Usuario(username=login, nome=nome, perfil=s.validated_data['perfil'], observacao='Troca a senha no primeiro acesso')
        senha = aplicar_senha_provisoria(u)
        u.save()
        return Response({'usuario': usuario_json(u), 'senha_provisoria': senha}, status=status.HTTP_201_CREATED)


class UsuarioView(APIView):
    """PATCH /api/usuarios/{id}/ → nome, perfil, ativo, observação."""
    permission_classes = [GerenciarUsuarios]

    def patch(self, request, id):
        u = _obter(id)
        s = _EditarUsuario(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if u.principal and (d.get('perfil', u.perfil) != 'admin' or not d.get('ativo', u.is_active)):
            raise Conflito('O administrador principal não pode ser desativado nem mudar de perfil.')
        if 'nome' in d:
            if not d['nome'].strip():
                raise DadosInvalidos('Informe o nome.')
            u.nome = d['nome'].strip()
        if 'perfil' in d:
            u.perfil = d['perfil']
        if 'ativo' in d:
            u.is_active = d['ativo']
        if 'observacao' in d:
            u.observacao = d['observacao']
        u.save()
        return Response(usuario_json(u))


class SenhaProvisoriaView(APIView):
    """POST /api/usuarios/{id}/senha-provisoria/ → nova senha provisória (de uso único e com validade)."""
    permission_classes = [GerenciarUsuarios]

    def post(self, request, id):
        u = _obter(id)
        if u.principal:
            raise Conflito('A senha do administrador principal é trocada por ele mesmo.')
        senha = aplicar_senha_provisoria(u)
        u.save()
        return Response({'usuario': usuario_json(u), 'senha_provisoria': senha})
