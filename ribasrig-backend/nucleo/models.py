import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


def _caminho_arquivo(instancia: 'Arquivo', _nome_enviado: str) -> str:
    # Nome gerado pelo servidor: o nome enviado nunca vira caminho no disco.
    ext = {'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg'}.get(instancia.tipo_conteudo, 'bin')
    return f'{instancia.finalidade}/{instancia.id.hex}.{ext}'


class Arquivo(models.Model):
    """Arquivo enviado (PDF de anexo, laudo, certificado; PNG/JPEG de logo e assinatura)."""

    class Finalidade(models.TextChoices):
        DESENHOS = 'desenhos', 'Desenhos de posicionamento'
        ART_PLANO = 'art_plano', 'ART do plano'
        LAUDO = 'laudo', 'Laudo técnico do guindaste'
        CERTIFICADO = 'certificado', 'Certificado do acessório'
        LOGO = 'logo', 'Logo da empresa'
        ASSINATURA = 'assinatura', 'Assinatura digitalizada'
        PLANO_PDF = 'plano_pdf', 'PDF do plano gerado pelo sistema'
        MEMORIAL = 'memorial', 'Memorial de cálculo gerado pelo sistema'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finalidade = models.CharField(max_length=20, choices=Finalidade.choices)
    nome_original = models.CharField(max_length=255)
    arquivo = models.FileField(upload_to=_caminho_arquivo, max_length=255)
    tipo_conteudo = models.CharField(max_length=50)
    tamanho = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    enviado_em = models.DateTimeField(auto_now_add=True)
    enviado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        verbose_name = 'arquivo'

    def __str__(self) -> str:
        return self.nome_original


class Configuracoes(models.Model):
    """Configurações do sistema (uma linha só, id = 1)."""

    pasta_raiz = models.CharField(max_length=500, default='C:\\Guindastes Ribas\\Planos de Rigging')
    nome_arquivo = models.CharField(max_length=200, default='Plano_de_Rigging_{nº}_Rev{rev}.pdf')
    empresa_razao_social = models.CharField(max_length=200, blank=True, default='')
    empresa_cnpj = models.CharField(max_length=20, blank=True, default='')
    empresa_ie = models.CharField(max_length=30, blank=True, default='')
    empresa_endereco = models.CharField(max_length=300, blank=True, default='')
    empresa_cep = models.CharField(max_length=12, blank=True, default='')
    responsavel_nome_completo = models.CharField(max_length=200, blank=True, default='')
    responsavel_nome_assinatura = models.CharField(max_length=200, blank=True, default='')
    responsavel_titulo = models.CharField(max_length=100, blank=True, default='')
    responsavel_crea = models.CharField(max_length=50, blank=True, default='')
    responsavel_rnp = models.CharField(max_length=50, blank=True, default='')
    responsavel_rpp = models.CharField(max_length=50, blank=True, default='')
    responsavel_assinatura = models.CharField(max_length=20, default='digitalizada', choices=[('digitalizada', 'Digitalizada'), ('govbr', 'GOV.BR')])
    # Limite da taxa de utilização: acima dele o plano é bloqueado (o valor exato é permitido). Só o Administrador muda.
    limite_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal(85))
    aviso_atencao_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal(75))
    vento_padrao_ms = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal(7))
    logo = models.ForeignKey(Arquivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    assinatura_arquivo = models.ForeignKey(Arquivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        verbose_name = 'configurações'
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name='configuracoes_linha_unica')]

    @classmethod
    def atual(cls) -> 'Configuracoes':
        obj, _ = cls.objects.get_or_create(id=1)
        return obj
