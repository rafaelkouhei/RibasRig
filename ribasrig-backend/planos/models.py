"""Plano de Rigging, revisões imutáveis e histórico (espelha PlanoRigging/Revisao/EventoHistorico de types.ts)."""
from django.conf import settings
from django.db import models

from cadastros.models import Acessorio, Cliente, Guindaste, Medida
from nucleo.models import Arquivo


class PlanoRigging(models.Model):
    class Situacao(models.TextChoices):
        RASCUNHO = 'rascunho', 'Rascunho'
        EMITIDO = 'emitido', 'Emitido'

    # AAMM + 3 dígitos, gerado pelo servidor pela data de criação. Revisões mantêm o número.
    numero = models.CharField(max_length=7, unique=True)
    situacao_documento = models.CharField(max_length=10, choices=Situacao.choices, default=Situacao.RASCUNHO)

    # etapa 1 · dados gerais
    cliente = models.ForeignKey(Cliente, null=True, blank=True, on_delete=models.PROTECT, related_name='planos')
    obra_mesmo_endereco_contratante = models.BooleanField(default=False)
    obra_nome = models.CharField(max_length=150, blank=True, default='')
    obra_endereco = models.CharField(max_length=300, blank=True, default='')
    obra_cidade = models.CharField(max_length=100, blank=True, default='')
    obra_uf = models.CharField(max_length=2, blank=True, default='')
    obra_cep = models.CharField(max_length=12, blank=True, default='')
    data_operacao = models.DateField(null=True, blank=True)
    descricao_operacao = models.TextField(blank=True, default='')
    rigger = models.CharField(max_length=200, blank=True, default='')
    art = models.CharField(max_length=20, blank=True, default='', db_index=True)
    art_registrada_em = models.DateTimeField(null=True, blank=True)
    contrato_art_numero = models.CharField(max_length=50, blank=True, default='')
    contrato_art_celebrado_em = models.DateField(null=True, blank=True)
    contrato_art_valor = models.CharField(max_length=30, blank=True, default='')
    contrato_art_termino = models.DateField(null=True, blank=True)

    # etapa 2 · carga
    carga_descricao = models.CharField(max_length=200, blank=True, default='')
    carga_comprimento_m = Medida()
    carga_largura_m = Medida()
    carga_altura_m = Medida()
    carga_peso_kg = Medida()

    # etapa 3 · lingada
    tipo_icamento_id = models.CharField(max_length=20, blank=True, default='t1')
    angulo_inferior_graus = Medida()
    angulo_superior_graus = Medida()
    dispositivo_acessorio = models.ForeignKey(Acessorio, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    dispositivo_descricao = models.CharField(max_length=150, blank=True, default='')
    dispositivo_quantidade = Medida()
    dispositivo_peso_unitario_kg = Medida()
    cargas_extras_kg = Medida()

    # etapa 4 · guindaste
    guindaste = models.ForeignKey(Guindaste, null=True, blank=True, on_delete=models.PROTECT, related_name='planos')
    tabela_id = models.CharField(max_length=40, null=True, blank=True)
    comprimento_lanca_m = Medida()
    raio_m = Medida()
    quadrante_inicial = models.CharField(max_length=50, blank=True, default='')
    quadrante_final = models.CharField(max_length=50, blank=True, default='')
    vento_max_ms = Medida()
    raio_isolamento_m = Medida()
    dormente_largura_cm = Medida()
    dormente_comprimento_cm = Medida()
    dormente_quantidade = Medida()

    # etapa 5 · anexos (nome do PDF, como o front mostra, e o arquivo guardado)
    anexo_desenhos = models.CharField(max_length=255, null=True, blank=True)
    anexo_desenhos_ref = models.ForeignKey(Arquivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    anexo_art_plano = models.BooleanField(default=False)
    anexo_arquivo_art = models.CharField(max_length=255, null=True, blank=True)
    anexo_art_ref = models.ForeignKey(Arquivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    etapa_atual = models.PositiveSmallIntegerField(default=1)
    copia_de = models.CharField(max_length=7, null=True, blank=True)
    exemplo = models.BooleanField(default=False)

    criado_em = models.DateTimeField()
    criado_em_so_data = models.BooleanField(default=False)
    criado_por = models.CharField(max_length=150, blank=True, default='')
    criado_por_usuario = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    atualizado_em = models.DateTimeField()

    class Meta:
        ordering = ['-criado_em', '-numero']
        verbose_name = 'plano de rigging'
        constraints = [
            models.CheckConstraint(condition=models.Q(numero__regex=r'^\d{2}(0[1-9]|1[0-2])\d{3}$'), name='numero_aamm_seq'),
            models.CheckConstraint(condition=models.Q(etapa_atual__gte=1, etapa_atual__lte=6), name='etapa_1_a_6'),
        ]

    def __str__(self) -> str:
        return self.numero


class ItemLingada(models.Model):
    plano = models.ForeignKey(PlanoRigging, on_delete=models.CASCADE, related_name='lingada')
    ordem = models.PositiveIntegerField(default=0)
    acessorio = models.ForeignKey(Acessorio, on_delete=models.PROTECT, related_name='+')
    quantidade = Medida()
    posicao = models.CharField(max_length=20, choices=[(p, p) for p in ('pernasInferiores', 'pernasSuperiores', 'carga', 'gancho')])

    class Meta:
        ordering = ['ordem', 'id']


class GuindasteAdicional(models.Model):
    plano = models.ForeignKey(PlanoRigging, on_delete=models.CASCADE, related_name='guindastes_adicionais')
    ordem = models.PositiveIntegerField(default=0)
    guindaste = models.ForeignKey(Guindaste, on_delete=models.PROTECT, related_name='+')
    tabela_id = models.CharField(max_length=40, null=True, blank=True)
    raio_m = Medida()
    pct = Medida()

    class Meta:
        ordering = ['ordem', 'id']


class Revisao(models.Model):
    """Revisão emitida: IMUTÁVEL. Guarda a cópia completa das entradas e dos resultados.
    Mudança no plano = nova revisão (mesmo número); as anteriores ficam como foram entregues."""
    plano = models.ForeignKey(PlanoRigging, on_delete=models.PROTECT, related_name='revisoes')
    numero = models.PositiveIntegerField()
    emitida_em = models.DateTimeField()
    emitida_em_so_data = models.BooleanField(default=False)
    emitida_por = models.CharField(max_length=150)
    origem = models.CharField(max_length=10, choices=[('excel', 'Excel'), ('sistema', 'Sistema')])
    cadastrada_em = models.DateTimeField(null=True, blank=True)
    resultados = models.JSONField()
    # Entradas usadas (dados do plano, acessórios com capacidade, gráfico, versões das regras)
    entradas = models.JSONField(null=True, blank=True)
    arquivo_pdf = models.CharField(max_length=255)
    observacao = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['numero']
        constraints = [models.UniqueConstraint(fields=['plano', 'numero'], name='revisao_unica_por_plano')]

    # O trigger da migração 0002 garante o mesmo no banco
    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError('Revisão emitida é imutável.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('Revisão emitida não pode ser apagada.')


class DocumentoRevisao(models.Model):
    """PDFs gerados pelo sistema para uma revisão: o do cliente (ficha, desenhos, ART, procedimento, laudo) e o memorial
    interno. Gerados na emissão, a partir da cópia gravada na revisão; não mudam depois."""
    class Tipo(models.TextChoices):
        PLANO = 'plano', 'PDF do plano (cliente)'
        MEMORIAL = 'memorial', 'Memorial de cálculo (interno)'

    revisao = models.ForeignKey(Revisao, on_delete=models.PROTECT, related_name='documentos')
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    arquivo = models.ForeignKey(Arquivo, on_delete=models.PROTECT, related_name='+')
    paginas = models.PositiveIntegerField()
    gerado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['revisao', 'tipo'], name='documento_unico_por_revisao')]


class EventoHistorico(models.Model):
    class Tipo(models.TextChoices):
        EMISSAO = 'emissao', 'Emissão'
        CALCULO = 'calculo', 'Cálculo'
        ANEXO = 'anexo', 'Anexo'
        CADASTRO = 'cadastro', 'Cadastro'
        EDICAO = 'edicao', 'Edição'

    plano = models.ForeignKey(PlanoRigging, on_delete=models.CASCADE, related_name='eventos')
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    titulo = models.CharField(max_length=200)
    detalhe = models.TextField(blank=True, default='')
    usuario = models.CharField(max_length=150)
    quando = models.DateTimeField()

    class Meta:
        ordering = ['-id']


class UsoCadastro(models.Model):
    """Planos EMITIDOS que usaram um acessório, tipo de içamento ou regra (o "usado em …" das telas)."""
    class Tipo(models.TextChoices):
        ACESSORIO = 'acessorio'
        TIPO = 'tipo'
        REGRA = 'regra'

    plano = models.ForeignKey(PlanoRigging, on_delete=models.CASCADE, related_name='usos')
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    ref = models.CharField(max_length=20)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['plano', 'tipo', 'ref'], name='uso_unico')]
        indexes = [models.Index(fields=['tipo', 'ref'])]


class SequenciaMensal(models.Model):
    """Trava da numeração: uma linha por mês (AAMM). `select_for_update` evita dois planos com o mesmo número."""
    prefixo = models.CharField(max_length=4, primary_key=True)
    ultimo = models.PositiveIntegerField(default=0)
