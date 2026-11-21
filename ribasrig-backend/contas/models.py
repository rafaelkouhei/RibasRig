from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    """Usuário do RibasRig. Login só por `username` (o "usuario" do front); sem e-mail."""

    class Perfil(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        ENGENHEIRO = 'engenheiro', 'Engenheiro responsável'
        OPERACAO = 'operacao', 'Operação (consulta)'

    nome = models.CharField(max_length=150)
    perfil = models.CharField(max_length=20, choices=Perfil.choices, default=Perfil.OPERACAO)
    # Administrador principal: não pode ser desativado nem mudar de perfil
    principal = models.BooleanField(default=False)
    # Senha provisória pendente: o login não entrega token até a troca
    trocar_senha = models.BooleanField(default=False)
    senha_provisoria_expira_em = models.DateTimeField(null=True, blank=True)
    observacao = models.CharField(max_length=300, blank=True, default='')

    REQUIRED_FIELDS: list[str] = []

    class Meta:
        verbose_name = 'usuário'
        ordering = ['id']
        constraints = [models.UniqueConstraint(fields=['principal'], condition=models.Q(principal=True), name='um_admin_principal')]

    def __str__(self) -> str:
        return f'{self.nome} ({self.username})'
