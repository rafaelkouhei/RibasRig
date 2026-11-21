from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTSemTrocaPendente(JWTAuthentication):
    """JWT normal, mas recusa usuário com senha provisória pendente (precisa trocar antes de usar)."""

    def get_user(self, validated_token):
        usuario = super().get_user(validated_token)
        if usuario.trocar_senha:
            raise AuthenticationFailed('Troque a senha provisória antes de continuar.', code='trocar_senha')
        return usuario
