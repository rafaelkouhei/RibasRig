"""Cadastros que alimentam os cálculos. Espelham os tipos de src/domain/types.ts.

Medidas em DecimalField (numeric no PostgreSQL): nada é guardado como float.
"""
from django.db import models

from nucleo.models import Arquivo


def Medida(**kw) -> models.DecimalField:  # noqa: N802 — "tipo" de campo usado em todos os cadastros
    kw.setdefault('null', True)
    kw.setdefault('blank', True)
    return models.DecimalField(max_digits=20, decimal_places=8, **kw)


class Origem(models.TextChoices):
    SISTEMA = 'sistema', 'Sistema'
    EXEMPLO = 'exemplo', 'Exemplo da equipe (fictício)'
    CRIADO = 'criado', 'Criado pelo usuário'


# =============================================================================================
# Clientes
# =============================================================================================

class Cliente(models.Model):
    """Contratante: quem contrata o serviço e assina a ART."""
    razao_social = models.CharField(max_length=200)
    nome_pasta = models.CharField(max_length=100)
    cnpj = models.CharField(max_length=20, blank=True, default='')
    endereco = models.CharField(max_length=300, blank=True, default='')
    cidade = models.CharField(max_length=100, blank=True, default='')
    uf = models.CharField(max_length=2, blank=True, default='')
    cep = models.CharField(max_length=12, blank=True, default='')
    contato = models.CharField(max_length=150, blank=True, default='')
    telefone = models.CharField(max_length=40, blank=True, default='')
    email = models.CharField(max_length=200, blank=True, default='')
    exemplo = models.BooleanField(default=False)

    class Meta:
        ordering = ['id']

    def __str__(self) -> str:
        return self.razao_social


class LocalObra(models.Model):
    """Onde o guindaste opera. Pode ser outra empresa (a Kaefer contrata, a operação é na Bosch)."""
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='locais_obra')
    ordem = models.PositiveIntegerField(default=0)
    nome = models.CharField(max_length=150, blank=True, default='')
    endereco = models.CharField(max_length=300, blank=True, default='')
    cidade = models.CharField(max_length=100, blank=True, default='')
    uf = models.CharField(max_length=2, blank=True, default='')
    cep = models.CharField(max_length=12, blank=True, default='')

    class Meta:
        ordering = ['ordem', 'id']


# =============================================================================================
# Guindastes
# =============================================================================================

class Guindaste(models.Model):
    modelo = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, blank=True, default='')
    veiculo = models.CharField(max_length=150, blank=True, default='')
    placa = models.CharField(max_length=20, blank=True, default='')
    chassi = models.CharField(max_length=40, blank=True, default='')
    ano = models.PositiveIntegerField(null=True, blank=True)
    capacidade_nominal_t = Medida()
    comprimento_lanca_m = Medida(help_text='Informativo: o cálculo usa o gráfico de carga, nunca este valor.')
    a_m = Medida(help_text='a: eixo da coluna até a sapata (m)')
    b_m = Medida(help_text='b: abertura entre sapatas (m)')
    pg_kgf = Medida(help_text='Pg: peso do guindaste + caminhão (kgf)')
    dados_pendentes = models.BooleanField(default=False)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']

    def __str__(self) -> str:
        return self.modelo


class Laudo(models.Model):
    guindaste = models.ForeignKey(Guindaste, on_delete=models.CASCADE, related_name='laudos')
    ordem = models.PositiveIntegerField(default=0)
    inicio = models.DateField(null=True, blank=True)
    fim = models.DateField(null=True, blank=True)
    art = models.CharField(max_length=20, blank=True, default='')
    arquivo = models.CharField(max_length=255, null=True, blank=True, help_text='Nome do PDF do laudo')
    arquivo_ref = models.ForeignKey(Arquivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    atual = models.BooleanField(default=False)

    class Meta:
        ordering = ['ordem', 'id']
        constraints = [models.UniqueConstraint(fields=['guindaste'], condition=models.Q(atual=True), name='um_laudo_atual_por_guindaste')]


class TabelaCapacidade(models.Model):
    """Gráfico de carga do fabricante. `chave` é o id que o front usa (ex.: 'lp8')."""
    guindaste = models.ForeignKey(Guindaste, on_delete=models.CASCADE, related_name='tabelas')
    chave = models.CharField(max_length=40)
    ordem = models.PositiveIntegerField(default=0)
    nome = models.CharField(max_length=100)

    class Meta:
        ordering = ['ordem', 'id']
        constraints = [models.UniqueConstraint(fields=['guindaste', 'chave'], name='tabela_chave_unica_por_guindaste')]


class PontoGrafico(models.Model):
    """Guindaste articulado: alcance máximo de uma extensão e a capacidade dela."""
    tabela = models.ForeignKey(TabelaCapacidade, on_delete=models.CASCADE, related_name='pontos')
    alcance_m = models.DecimalField(max_digits=20, decimal_places=8)
    capacidade_kg = models.DecimalField(max_digits=20, decimal_places=8)

    class Meta:
        ordering = ['alcance_m']
        constraints = [
            models.UniqueConstraint(fields=['tabela', 'alcance_m'], name='alcance_unico_por_tabela'),
            models.CheckConstraint(condition=models.Q(alcance_m__gt=0, capacidade_kg__gt=0), name='ponto_positivo'),
        ]


# =============================================================================================
# Acessórios de lingada
# =============================================================================================

class TipoAcessorio(models.TextChoices):
    CINTA = 'cinta', 'Cinta plana'
    TUBULAR = 'tubular', 'Cinta tubular'
    MANILHA = 'manilha', 'Manilha'
    LACO = 'laco', 'Laço de cabo de aço'
    DISPOSITIVO = 'dispositivo', 'Balancim / dispositivo'


class Acessorio(models.Model):
    class Situacao(models.TextChoices):
        USO = 'uso', 'Em uso'
        INSPECAO = 'inspecao', 'Em inspeção'
        DESCARTADO = 'descartado', 'Descartado'
        INATIVO = 'inativo', 'Inativo'

    tipo = models.CharField(max_length=20, choices=TipoAcessorio.choices)
    descricao = models.CharField(max_length=200)
    nome_curto = models.CharField(max_length=150, blank=True, default='')
    medida = models.CharField(max_length=50, blank=True, default='')
    norma = models.CharField(max_length=100, blank=True, default='')
    capacidade_t = Medida()
    capacidade_trabalho_t = Medida(help_text='Usada no cálculo; vazia = usa a capacidade nominal')
    unidade_capacidade = models.CharField(max_length=2, choices=[('t', 't'), ('tf', 'tf')], default='t')
    peso_kg = models.DecimalField(max_digits=20, decimal_places=8, default=0)
    situacao = models.CharField(max_length=20, choices=Situacao.choices, default=Situacao.USO)
    ultima_inspecao = models.DateField(null=True, blank=True)
    proxima_inspecao = models.DateField(null=True, blank=True)
    data_entrada = models.DateField(null=True, blank=True)
    certificado = models.CharField(max_length=100, blank=True, default='')
    certificado_arquivo = models.CharField(max_length=255, null=True, blank=True)
    certificado_ref = models.ForeignKey(Arquivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    vencimento = models.DateField(null=True, blank=True, help_text='Validade definida pelo engenheiro (aviso 30 dias antes)')
    motivo_descarte = models.CharField(max_length=500, blank=True, default='')

    class Meta:
        ordering = ['id']
        constraints = [models.CheckConstraint(
            condition=~models.Q(situacao='descartado') | ~models.Q(motivo_descarte=''), name='descartado_tem_motivo')]

    def __str__(self) -> str:
        return self.descricao


class RegistroInspecao(models.Model):
    """Inspeção pelo padrão do tipo. Guarda a CÓPIA dos itens conferidos."""
    acessorio = models.ForeignKey(Acessorio, on_delete=models.CASCADE, related_name='inspecoes')
    data = models.DateField()
    responsavel = models.CharField(max_length=150, blank=True, default='')
    resultado = models.CharField(max_length=10, choices=[('aprovado', 'Aprovado'), ('reprovado', 'Reprovado')])
    itens = models.JSONField(default=list)
    observacao = models.TextField(blank=True, default='')
    proxima = models.DateField(null=True, blank=True)
    registrado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data', '-id']


class EventoAcessorio(models.Model):
    acessorio = models.ForeignKey(Acessorio, on_delete=models.CASCADE, related_name='historico')
    data = models.DateField()
    descricao = models.CharField(max_length=500)

    class Meta:
        ordering = ['-id']


class PadraoInspecao(models.Model):
    """Itens que o inspetor confere em cada tipo de acessório. Editado pelo engenheiro."""
    tipo = models.CharField(max_length=20, choices=TipoAcessorio.choices, primary_key=True)
    referencia = models.TextField(blank=True, default='')
    itens = models.JSONField(default=list)
    atualizado_em = models.DateField(null=True, blank=True)


# =============================================================================================
# Regras de cálculo e tipos de içamento
# =============================================================================================

class RegraCalculo(models.Model):
    id = models.CharField(max_length=20, primary_key=True)
    nome = models.CharField(max_length=150)
    categoria = models.CharField(max_length=30)
    descricao = models.TextField(blank=True, default='')
    formula = models.CharField(max_length=500)
    resultado_nome = models.CharField(max_length=30, blank=True, default='')
    resultado_unidade = models.CharField(max_length=30, blank=True, default='')
    variaveis = models.JSONField(default=list)
    limite = models.BooleanField(default=False)
    origem_capacidade = models.CharField(max_length=150, null=True, blank=True)
    capacidade_teste = models.CharField(max_length=30, blank=True, default='')
    no_resumo = models.BooleanField(default=True)
    no_memorial = models.BooleanField(default=True)
    automatica = models.BooleanField(default=False)
    origem = models.CharField(max_length=10, choices=Origem.choices, default=Origem.CRIADO)
    autor = models.CharField(max_length=150, blank=True, default='')
    versao = models.PositiveIntegerField(default=1)
    criada_em_ordem = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ['criada_em_ordem']


class VersaoRegra(models.Model):
    """Versões de uma regra. Planos emitidos guardam a versão usada."""
    regra = models.ForeignKey(RegraCalculo, on_delete=models.CASCADE, related_name='versoes')
    versao = models.PositiveIntegerField()
    formula = models.CharField(max_length=500)
    variaveis = models.JSONField(default=list)
    salva_em = models.DateTimeField()
    salva_em_so_data = models.BooleanField(default=False)
    autor = models.CharField(max_length=150, blank=True, default='')

    class Meta:
        ordering = ['versao']
        constraints = [models.UniqueConstraint(fields=['regra', 'versao'], name='versao_unica_por_regra')]


class TipoIcamento(models.Model):
    id = models.CharField(max_length=20, primary_key=True)
    nome = models.CharField(max_length=150)
    descricao = models.TextField(blank=True, default='')
    origem = models.CharField(max_length=10, choices=Origem.choices, default=Origem.CRIADO)
    balancim = models.BooleanField(default=False)
    pernas = models.PositiveIntegerField(default=2)
    pernas_superiores = models.PositiveIntegerField(default=0)
    campos = models.JSONField(default=dict)
    regras = models.ManyToManyField(RegraCalculo, through='RegraDoTipo', related_name='tipos')
    acessorios_sugeridos = models.CharField(max_length=300, blank=True, default='')
    geometria = models.CharField(max_length=200, blank=True, default='')
    aviso_sem_acessorio = models.CharField(max_length=300, null=True, blank=True)
    autor = models.CharField(max_length=150, blank=True, default='')
    versao = models.PositiveIntegerField(default=1)
    criado_em_ordem = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ['criado_em_ordem']


class RegraDoTipo(models.Model):
    tipo = models.ForeignKey(TipoIcamento, on_delete=models.CASCADE)
    regra = models.ForeignKey(RegraCalculo, on_delete=models.PROTECT)
    ordem = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['ordem']
        constraints = [models.UniqueConstraint(fields=['tipo', 'regra'], name='regra_unica_por_tipo')]
