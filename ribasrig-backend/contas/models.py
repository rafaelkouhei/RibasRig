from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class UsuarioManager(UserManager):
    """Usuário sempre em minúsculas (o login converte o que foi digitado) e `createsuperuser` = Administrador.

    Sem isso, `manage.py createsuperuser` criaria um perfil Operação (só consulta) e, com maiúsculas, um login
    que nunca entra. O primeiro superusuário de um banco sem administrador principal vira o principal."""

    use_in_migrations = True

    def create_user(self, username, email=None, password=None, **extra_fields):
        return super().create_user((username or '').lower(), email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('perfil', Usuario.Perfil.ADMIN)
        extra_fields.setdefault('nome', username)
        if not self.filter(principal=True).exists():
            extra_fields.setdefault('principal', True)
        return super().create_superuser((username or '').lower(), email, password, **extra_fields)


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

    objects = UsuarioManager()

    class Meta:
        verbose_name = 'usuário'
        ordering = ['id']
        constraints = [models.UniqueConstraint(fields=['principal'], condition=models.Q(principal=True), name='um_admin_principal')]

    def __str__(self) -> str:
        return f'{self.nome} ({self.username})'
