import re

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from contas.permissoes import leitura_ou
from motor.formatacao import cnpj_valido
from motor.validacao import erro_nome_arquivo

from . import arquivos
from .campos import Numero, Texto, n
from .excecoes import DadosInvalidos
from .models import Configuracoes
from .tempo import hoje

DESCRICAO_NUMERACAO = ('AAMM + 3 dígitos, gerado pelo sistema pela data de criação do plano; zera todo mês '
                       '(ex.: 2610001 é o primeiro de outubro/2026). Revisões mantêm o número.')

AlterarConfiguracoes = leitura_ou('alterarConfiguracoes')
# Faixa aceita para o limite da taxa de utilização (o padrão das normas usadas pela empresa é 85%)
LIMITE_MIN, LIMITE_MAX = 50, 100


def configuracoes_json(c: Configuracoes) -> dict:
    return {
        'pasta_raiz': c.pasta_raiz, 'nome_arquivo': c.nome_arquivo,
        'empresa': {'razao_social': c.empresa_razao_social, 'cnpj': c.empresa_cnpj, 'ie': c.empresa_ie,
                    'endereco': c.empresa_endereco, 'cep': c.empresa_cep},
        'responsavel': {'nome_completo': c.responsavel_nome_completo, 'nome_assinatura': c.responsavel_nome_assinatura,
                        'titulo': c.responsavel_titulo, 'crea': c.responsavel_crea, 'rnp': c.responsavel_rnp, 'rpp': c.responsavel_rpp,
                        'assinatura': c.responsavel_assinatura},
        'limite_pct': n(c.limite_pct), 'aviso_atencao_pct': n(c.aviso_atencao_pct), 'vento_padrao_ms': n(c.vento_padrao_ms),
        'numeracao': {'descricao': DESCRICAO_NUMERACAO},
    }


class _Empresa(serializers.Serializer):
    razao_social = Texto(max_length=200)
    cnpj = Texto(max_length=20)
    ie = Texto(max_length=30)
    endereco = Texto(max_length=300)
    cep = Texto(max_length=12)


class _Responsavel(serializers.Serializer):
    nome_completo = Texto(max_length=200)
    nome_assinatura = Texto(max_length=200)
    titulo = Texto(max_length=100)
    crea = Texto(max_length=50)
    rnp = Texto(max_length=50)
    rpp = Texto(max_length=50)
    assinatura = serializers.ChoiceField(choices=['digitalizada', 'govbr'], required=False, default='digitalizada')


class _Configuracoes(serializers.Serializer):
    pasta_raiz = Texto(max_length=500)
    nome_arquivo = Texto(max_length=200)
    empresa = _Empresa()
    responsavel = _Responsavel()
    limite_pct = Numero(allow_null=False, required=False, default=None)
    aviso_atencao_pct = Numero(allow_null=False, required=True)
    vento_padrao_ms = Numero(allow_null=False, required=True)


def _caminho_seguro(pasta: str) -> bool:
    """Pasta raiz absoluta (Windows 'C:\\…' ou '/…'), sem '..' e sem caracteres de controle."""
    partes = re.split(r'[\\/]', pasta)
    return bool(re.match(r'^([A-Za-z]:[\\/]|[\\/])', pasta)) and '..' not in partes and not re.search(r'[\x00-\x1f<>"|?*]', pasta[2:])


class ConfiguracoesView(APIView):
    """GET /api/configuracoes/ (todos) · PUT /api/configuracoes/ (Administrador)."""
    permission_classes = [AlterarConfiguracoes]

    def get(self, request):
        return Response(configuracoes_json(Configuracoes.atual()))

    @transaction.atomic
    def put(self, request):
        s = _Configuracoes(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        erro = erro_nome_arquivo(d['nome_arquivo'])
        if erro:
            raise DadosInvalidos(erro)
        if re.search(r'[\\/:*?"<>|]', d['nome_arquivo'].replace('{nº}', '').replace('{rev}', '')):
            raise DadosInvalidos('O nome do arquivo não pode ter pasta nem os caracteres \\ / : * ? " < > |.')
        pasta = d['pasta_raiz'].strip()
        if not pasta:
            raise DadosInvalidos('Informe a pasta raiz dos planos.')
        if not _caminho_seguro(pasta):
            raise DadosInvalidos('Pasta raiz inválida: use um caminho completo (ex.: C:\\Guindastes Ribas\\Planos de Rigging), sem "..".')
        c = Configuracoes.objects.select_for_update().get_or_create(id=1)[0]
        limite = c.limite_pct if d['limite_pct'] is None else d['limite_pct']
        if not (LIMITE_MIN <= limite <= LIMITE_MAX):
            raise DadosInvalidos(f'Limite da taxa de utilização: use um valor entre {LIMITE_MIN} e {LIMITE_MAX}%.')
        if not (50 <= d['aviso_atencao_pct'] < limite):
            raise DadosInvalidos(f'Aviso de atenção: use um valor a partir de 50% e menor que o limite ({n(limite)}%).')
        if not (0 <= d['vento_padrao_ms'] <= 20):
            raise DadosInvalidos('Vento padrão: use um valor entre 0 e 20 m/s.')
        if d['empresa']['cnpj'].strip() and not cnpj_valido(d['empresa']['cnpj']):
            raise DadosInvalidos('CNPJ da empresa inválido.')
        c.pasta_raiz, c.nome_arquivo = pasta, d['nome_arquivo'].strip()
        for k, v in d['empresa'].items():
            setattr(c, f'empresa_{k}', v.strip())
        for k, v in d['responsavel'].items():
            setattr(c, f'responsavel_{k}', v.strip())
        c.limite_pct, c.aviso_atencao_pct, c.vento_padrao_ms = limite, d['aviso_atencao_pct'], d['vento_padrao_ms']
        c.save()
        return Response(configuracoes_json(c))


IMAGENS = ('image/png', 'image/jpeg')


class ImagemConfiguracaoView(APIView):
    """POST (multipart, campo "arquivo") · GET /api/configuracoes/{logo|assinatura}/ — só PNG ou JPEG."""
    permission_classes = [AlterarConfiguracoes]
    parser_classes = [MultiPartParser]
    campos = {'logo': 'logo', 'assinatura': 'assinatura_arquivo'}

    def get(self, request, qual):
        arq = getattr(Configuracoes.atual(), self.campos[qual])
        if not arq:
            raise NotFound('Imagem não enviada.')
        return arquivos.entregar(arq)

    @transaction.atomic
    def post(self, request, qual):
        arq = arquivos.receber(request.FILES.get('arquivo'), qual, request.user, aceitos=IMAGENS)
        c = Configuracoes.objects.select_for_update().get_or_create(id=1)[0]
        setattr(c, self.campos[qual], arq)
        c.save()
        return Response(configuracoes_json(c))


class SistemaView(APIView):
    """GET /api/sistema/ (sem login) → {hoje, versao, limite_pct}. O front usa este "hoje" e este limite nas regras,
    para a tela e o servidor conferirem contra a mesma data e o mesmo limite."""
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        return Response({'hoje': hoje().isoformat(), 'versao': VERSAO, 'limite_pct': n(Configuracoes.atual().limite_pct)})


VERSAO = '1.0.0'
