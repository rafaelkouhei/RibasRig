"""Cadastros: clientes, guindastes, acessórios (com inspeções), padrões de inspeção, tipos de içamento e regras.

Leitura: qualquer usuário logado. Escrita: perfis com 'editarCadastros' (Administrador e Engenheiro).
"""
import re
from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from contas.permissoes import leitura_ou
from motor import regras as motor_regras
from motor.calculos import pontos_ordenados
from motor.entidades import Ponto
from motor.formatacao import cnpj_valido, data_br
from motor.validacao import FAIXAS, erro_numero_art, faixa_texto, validar_faixa
from nucleo import arquivos
from nucleo.campos import Data, Numero, Texto
from nucleo.excecoes import Conflito, DadosInvalidos
from nucleo.tempo import agora, hoje

from . import json as J
from .models import (
    Acessorio, Cliente, EventoAcessorio, Guindaste, Laudo, LocalObra, PadraoInspecao, PontoGrafico, RegistroInspecao, RegraCalculo,
    RegraDoTipo, TabelaCapacidade, TipoAcessorio, TipoIcamento, VersaoRegra,
)

EditarCadastros = leitura_ou('editarCadastros')


def _faixa(nome: str, valor, rotulo: str | None = None) -> None:
    """Confere um número opcional contra a faixa do front (vazio é permitido no cadastro)."""
    if valor is None:
        return
    r = validar_faixa(FAIXAS[nome], valor)
    if r.erro:
        raise DadosInvalidos(f'{rotulo or FAIXAS[nome].rotulo}: fora da faixa ({faixa_texto(FAIXAS[nome])}).')


def _nome_pasta_seguro(nome: str) -> str:
    return re.sub(r'[\\/:*?"<>|\x00-\x1f]', '', nome).strip().strip('.')


# =============================================================================================
# Clientes
# =============================================================================================

class _Local(serializers.Serializer):
    nome = Texto(max_length=150)
    endereco = Texto(max_length=300)
    cidade = Texto(max_length=100)
    uf = Texto(max_length=2)
    cep = Texto(max_length=12)


class _Cliente(serializers.Serializer):
    razao_social = Texto(max_length=200)
    nome_pasta = Texto(max_length=100)
    cnpj = Texto(max_length=20)
    endereco = Texto(max_length=300)
    cidade = Texto(max_length=100)
    uf = Texto(max_length=2)
    cep = Texto(max_length=12)
    contato = Texto(max_length=150)
    telefone = Texto(max_length=40)
    email = Texto(max_length=200)
    exemplo = serializers.BooleanField(required=False, default=False)
    locais_obra = _Local(many=True, required=False, default=list)


def _qs_clientes():
    return Cliente.objects.prefetch_related('locais_obra')


@transaction.atomic
def _salvar_cliente(c: Cliente, dados) -> Cliente:
    s = _Cliente(data=dados)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if not d['razao_social'].strip():
        raise DadosInvalidos('Informe a razão social.')
    if d['cnpj'].strip() and not cnpj_valido(d['cnpj']):
        raise DadosInvalidos('CNPJ inválido. Confira os dígitos ou deixe como "não informado".')
    pasta = _nome_pasta_seguro(d['nome_pasta'] or d['razao_social'])
    if not pasta or '..' in pasta:
        raise DadosInvalidos('Nome da pasta do cliente inválido.')
    for campo in ('razao_social', 'cnpj', 'endereco', 'cidade', 'cep', 'contato', 'telefone', 'email', 'exemplo'):
        setattr(c, campo, d[campo].strip() if isinstance(d[campo], str) else d[campo])
    c.uf = d['uf'].strip().upper()
    c.nome_pasta = pasta
    c.save()
    c.locais_obra.all().delete()
    LocalObra.objects.bulk_create([LocalObra(cliente=c, ordem=i, **{k: v.strip().upper() if k == 'uf' else v.strip() for k, v in l.items()})
                                   for i, l in enumerate(d['locais_obra'])])
    return _qs_clientes().get(id=c.id)


class ClientesView(APIView):
    permission_classes = [EditarCadastros]

    def get(self, request):
        return Response([J.cliente_json(c) for c in _qs_clientes()])

    def post(self, request):
        return Response(J.cliente_json(_salvar_cliente(Cliente(), request.data)), status=status.HTTP_201_CREATED)


class ClienteView(APIView):
    permission_classes = [EditarCadastros]

    def put(self, request, id):
        c = Cliente.objects.filter(id=id).first() or _nao_encontrado('Cliente')
        return Response(J.cliente_json(_salvar_cliente(c, request.data)))


def _nao_encontrado(o_que: str):
    raise NotFound(f'{o_que} não encontrado.')


# =============================================================================================
# Guindastes
# =============================================================================================

class _Laudo(serializers.Serializer):
    inicio = Data()
    fim = Data()
    art = Texto(max_length=20)
    arquivo = serializers.CharField(max_length=255, allow_null=True, allow_blank=True, required=False, default=None)
    atual = serializers.BooleanField(required=False, default=False)


class _Ponto(serializers.Serializer):
    alcance_m = Numero(allow_null=False, required=True)
    capacidade_kg = Numero(allow_null=False, required=True)


class _Tabela(serializers.Serializer):
    id = serializers.CharField(max_length=40, required=False, allow_blank=True, default='')
    nome = Texto(max_length=100)
    pontos = _Ponto(many=True)


class _Guindaste(serializers.Serializer):
    modelo = Texto(max_length=150)
    codigo = Texto(max_length=50)
    veiculo = Texto(max_length=150)
    placa = Texto(max_length=20)
    chassi = Texto(max_length=40)
    ano = serializers.IntegerField(allow_null=True, required=False, default=None)
    capacidade_nominal_t = Numero()
    comprimento_lanca_m = Numero()
    a_m = Numero()
    b_m = Numero()
    pg_kgf = Numero()
    dados_pendentes = serializers.BooleanField(required=False, default=False)
    ativo = serializers.BooleanField(required=False, default=True)
    laudos = _Laudo(many=True, required=False, default=list)
    tabelas = _Tabela(many=True, required=False, default=list)


def _qs_guindastes():
    return Guindaste.objects.prefetch_related('laudos', Prefetch('tabelas', TabelaCapacidade.objects.prefetch_related('pontos')))


@transaction.atomic
def _salvar_guindaste(g: Guindaste, dados) -> Guindaste:
    s = _Guindaste(data=dados)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if not d['modelo'].strip():
        raise DadosInvalidos('Informe o nome / modelo do guindaste.')
    if d['ano'] is not None:
        _faixa('anoGuindaste', Decimal(d['ano']))
    _faixa('capacidadeNominal', d['capacidade_nominal_t'])
    _faixa('comprimentoLanca', d['comprimento_lanca_m'])
    _faixa('distanciaA', d['a_m'])
    _faixa('aberturaB', d['b_m'])
    _faixa('pesoGuindaste', d['pg_kgf'])
    chaves: set[str] = set()
    for i, t in enumerate(d['tabelas']):
        nome = t['nome'].strip() or f'gráfico {i + 1}'
        if not t['pontos']:
            raise DadosInvalidos(f'Gráfico de carga "{nome}": cadastre pelo menos um ponto.')
        if pontos_ordenados([Ponto(p['alcance_m'], p['capacidade_kg']) for p in t['pontos']]) is None:
            raise DadosInvalidos(f'Gráfico de carga "{nome}": ponto inválido ou alcance repetido.')
        for p in t['pontos']:
            _faixa('alcanceGrafico', p['alcance_m'], f'Gráfico "{nome}", alcance')
            _faixa('capacidadeGrafico', p['capacidade_kg'], f'Gráfico "{nome}", capacidade')
        chave = (t['id'] or '').strip()
        if not chave or chave in chaves:
            chave = f'g{i + 1}'
            while chave in chaves:
                chave += 'x'
        t['id'] = chave
        chaves.add(chave)
    for l in d['laudos']:
        if l['inicio'] and l['fim'] and l['fim'] < l['inicio']:
            raise DadosInvalidos('Laudo: a validade final precisa ser depois do início.')
        erro_art = erro_numero_art(l['art'])
        if erro_art:
            raise DadosInvalidos(f'ART do laudo: {erro_art}')

    for campo in ('modelo', 'veiculo', 'placa', 'chassi'):
        setattr(g, campo, d[campo].strip())
    g.codigo = d['codigo'].strip() or re.sub(r'[^A-Za-z0-9]', '', g.modelo)
    for campo in ('ano', 'capacidade_nominal_t', 'comprimento_lanca_m', 'a_m', 'b_m', 'pg_kgf', 'dados_pendentes', 'ativo'):
        setattr(g, campo, d[campo])
    g.save()

    # Laudos: um único atual (o marcado; senão o último). O arquivo já enviado acompanha o laudo pelo nome; um nome
    # sem arquivo guardado não é gravado (o PDF entra só por LaudoArquivoView), para o checklist nunca aprovar um
    # laudo que não existe.
    arquivos_por_nome = {l.arquivo: l.arquivo_ref_id for l in g.laudos.all() if l.arquivo and l.arquivo_ref_id}
    laudos = d['laudos']
    if laudos:
        marcado = next((i for i, l in enumerate(laudos) if l['atual']), len(laudos) - 1)
        for i, l in enumerate(laudos):
            l['atual'] = i == marcado
    g.laudos.all().delete()
    Laudo.objects.bulk_create([
        Laudo(guindaste=g, ordem=i, inicio=l['inicio'], fim=l['fim'], art=l['art'].strip(),
              arquivo=l['arquivo'] if arquivos_por_nome.get(l['arquivo']) else None,
              arquivo_ref_id=arquivos_por_nome.get(l['arquivo']), atual=l['atual'])
        for i, l in enumerate(laudos)
    ])
    g.tabelas.all().delete()
    for i, t in enumerate(d['tabelas']):
        tab = TabelaCapacidade.objects.create(guindaste=g, chave=t['id'], ordem=i, nome=t['nome'].strip())
        PontoGrafico.objects.bulk_create([PontoGrafico(tabela=tab, alcance_m=p['alcance_m'], capacidade_kg=p['capacidade_kg'])
                                          for p in sorted(t['pontos'], key=lambda p: p['alcance_m'])])
    return _qs_guindastes().get(id=g.id)


class GuindastesView(APIView):
    permission_classes = [EditarCadastros]

    def get(self, request):
        return Response([J.guindaste_json(g) for g in _qs_guindastes()])

    def post(self, request):
        return Response(J.guindaste_json(_salvar_guindaste(Guindaste(), request.data)), status=status.HTTP_201_CREATED)


class GuindasteView(APIView):
    permission_classes = [EditarCadastros]

    def put(self, request, id):
        g = Guindaste.objects.filter(id=id).first() or _nao_encontrado('Guindaste')
        return Response(J.guindaste_json(_salvar_guindaste(g, request.data)))


class LaudoArquivoView(APIView):
    """POST (multipart, campo "arquivo") · GET /api/guindastes/{id}/laudo/arquivo/ — PDF do laudo vigente."""
    permission_classes = [EditarCadastros]
    parser_classes = [MultiPartParser]

    def _laudo(self, id_):
        g = Guindaste.objects.filter(id=id_).first() or _nao_encontrado('Guindaste')
        laudo = g.laudos.filter(atual=True).first()
        if not laudo:
            raise Conflito('Cadastre o laudo (validade e ART) antes de anexar o PDF.')
        return g, laudo

    def get(self, request, id):
        _, laudo = self._laudo(id)
        if not laudo.arquivo_ref:
            raise NotFound('O laudo vigente não tem PDF anexado.')
        return arquivos.entregar(laudo.arquivo_ref)

    @transaction.atomic
    def post(self, request, id):
        g, laudo = self._laudo(id)
        arq = arquivos.receber(request.FILES.get('arquivo'), 'laudo', request.user)
        laudo.arquivo, laudo.arquivo_ref = arq.nome_original, arq
        laudo.save(update_fields=['arquivo', 'arquivo_ref'])
        return Response(J.guindaste_json(_qs_guindastes().get(id=g.id)))


# =============================================================================================
# Acessórios
# =============================================================================================

class _Evento(serializers.Serializer):
    data = serializers.DateField()
    descricao = serializers.CharField(max_length=500)


class _Acessorio(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=TipoAcessorio.choices)
    descricao = Texto(max_length=200)
    nome_curto = Texto(max_length=150)
    medida = Texto(max_length=50)
    norma = Texto(max_length=100)
    capacidade_t = Numero()
    capacidade_trabalho_t = Numero()
    unidade_capacidade = serializers.ChoiceField(choices=['t', 'tf'], required=False, default='t')
    peso_kg = Numero(allow_null=False, default=0)
    situacao = serializers.ChoiceField(choices=Acessorio.Situacao.choices, required=False, default='uso')
    ultima_inspecao = Data()
    proxima_inspecao = Data()
    data_entrada = Data()
    certificado = Texto(max_length=100)
    certificado_arquivo = serializers.CharField(max_length=255, allow_null=True, allow_blank=True, required=False, default=None)
    vencimento = Data()
    motivo_descarte = Texto(max_length=500)
    historico = _Evento(many=True, required=False, default=list)


def _qs_acessorios():
    return Acessorio.objects.prefetch_related('inspecoes', 'historico')


def _nome_curto(descricao: str) -> str:
    s = descricao.split(' · ')[0].strip()
    return s[:1].lower() + s[1:]


def _historico_novo(existente: list[EventoAcessorio], recebido: list[dict]) -> list[dict]:
    """O front manda [novos..., ...histórico atual]. Só os novos do topo entram; o histórico gravado não muda."""
    k = len(recebido) - len(existente)
    if k <= 0:
        return []
    cauda = [(e['data'], e['descricao']) for e in recebido[k:]]
    if cauda != [(e.data, e.descricao) for e in existente]:
        return []
    return recebido[:k]


def _conferir_mudanca_de_situacao(a: Acessorio, d: dict) -> None:
    """A edição não pode contornar o descarte, a desativação nem a inspeção (o plano confia nesses dados).

    - descartado não volta (nem para uso, nem para inspeção);
    - inativo só volta por /reativar/ (o front sempre manda 'inativo' de volta);
    - a próxima inspeção só vai para mais tarde junto com uma nova última inspeção, que não pode ser futura.
      Antecipar a próxima inspeção (mais conservador) continua livre."""
    if a.situacao == 'descartado' and d['situacao'] != 'descartado':
        raise Conflito('Acessório descartado não volta para uso nem para inspeção. Cadastre o item novo, se for o caso.')
    if a.situacao == 'inativo' and d['situacao'] != 'inativo':
        raise Conflito('Acessório inativo volta pelo botão "Reativar".')
    nova_ultima = d['ultima_inspecao'] != a.ultima_inspecao
    if nova_ultima and d['ultima_inspecao'] and d['ultima_inspecao'] > hoje():
        raise DadosInvalidos('A última inspeção não pode ter data futura.')
    adiou = d['proxima_inspecao'] and (a.proxima_inspecao is None or d['proxima_inspecao'] > a.proxima_inspecao)
    if adiou and not (nova_ultima and d['ultima_inspecao']):
        raise DadosInvalidos('Para adiar a próxima inspeção, informe a data da nova inspeção (ou registre a inspeção).')


@transaction.atomic
def _salvar_acessorio(a: Acessorio, dados) -> Acessorio:
    s = _Acessorio(data=dados)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if not d['descricao'].strip():
        raise DadosInvalidos('Informe a descrição.')
    if d['situacao'] == 'descartado' and not d['motivo_descarte'].strip():
        raise DadosInvalidos('Informe o motivo do descarte.')
    _faixa('capacidadeAcessorio', d['capacidade_t'], 'Capacidade')
    _faixa('capacidadeAcessorio', d['capacidade_trabalho_t'], 'Capacidade de trabalho')
    if d['peso_kg'] < 0:
        raise DadosInvalidos('Peso unitário: use zero ou mais.')
    if d['capacidade_t'] is not None and d['capacidade_trabalho_t'] is not None and d['capacidade_trabalho_t'] > d['capacidade_t']:
        raise DadosInvalidos('A capacidade de trabalho não pode passar da capacidade nominal.')
    if d['data_entrada'] and d['data_entrada'] > hoje():
        raise DadosInvalidos('A data de entrada não pode ser futura.')
    if d['data_entrada'] and d['vencimento'] and d['vencimento'] <= d['data_entrada']:
        raise DadosInvalidos('O vencimento precisa ser depois da data de entrada.')
    if d['ultima_inspecao'] and d['proxima_inspecao'] and d['proxima_inspecao'] < d['ultima_inspecao']:
        raise DadosInvalidos('A próxima inspeção precisa ser depois da última.')
    if a.pk:
        _conferir_mudanca_de_situacao(a, d)

    existente = list(a.historico.all()) if a.pk else []
    novos = _historico_novo(existente, d.pop('historico'))
    descricao = d['descricao'].strip()
    for campo, valor in d.items():
        setattr(a, campo, valor.strip() if isinstance(valor, str) and campo != 'certificado_arquivo' else valor)
    a.descricao = descricao
    a.nome_curto = d['nome_curto'].strip() or _nome_curto(descricao)
    # O PDF guardado só vale enquanto o nome mostrado é o dele (o upload é por CertificadoView)
    if not a.certificado_arquivo or (a.certificado_ref and a.certificado_ref.nome_original != a.certificado_arquivo):
        a.certificado_arquivo, a.certificado_ref = a.certificado_arquivo or None, None
    a.save()
    if not existente and not novos:
        novos = [{'data': hoje(), 'descricao': 'Cadastrado no sistema'}]
    EventoAcessorio.objects.bulk_create([EventoAcessorio(acessorio=a, **e) for e in reversed(novos)])
    return _qs_acessorios().get(id=a.id)


def _acessorio_resposta(a: Acessorio) -> dict:
    return J.acessorio_json(a, J.usos('acessorio').get(str(a.id), []))


class AcessoriosView(APIView):
    permission_classes = [EditarCadastros]

    def get(self, request):
        usos = J.usos('acessorio')
        return Response([J.acessorio_json(a, usos.get(str(a.id), [])) for a in _qs_acessorios()])

    def post(self, request):
        return Response(_acessorio_resposta(_salvar_acessorio(Acessorio(), request.data)), status=status.HTTP_201_CREATED)


def _obter_acessorio(id_) -> Acessorio:
    return Acessorio.objects.select_for_update().filter(id=id_).first() or _nao_encontrado('Acessório')


class AcessorioView(APIView):
    permission_classes = [EditarCadastros]

    @transaction.atomic
    def put(self, request, id):
        return Response(_acessorio_resposta(_salvar_acessorio(_obter_acessorio(id), request.data)))


def _quem(request) -> str:
    return getattr(request.user, 'nome', '') or request.user.get_username()


class DesativarAcessorioView(APIView):
    """POST /api/acessorios/{id}/desativar/ → 'inativo'. Nada é apagado (histórico e planos ficam)."""
    permission_classes = [EditarCadastros]

    @transaction.atomic
    def post(self, request, id):
        a = _obter_acessorio(id)
        a.situacao = 'inativo'
        a.save(update_fields=['situacao'])
        EventoAcessorio.objects.create(acessorio=a, data=hoje(), descricao=f'Desativado por {_quem(request)} em {data_br(hoje())}')
        return Response(_acessorio_resposta(_qs_acessorios().get(id=a.id)))


class ReativarAcessorioView(APIView):
    """POST /api/acessorios/{id}/reativar/ → volta para 'uso'."""
    permission_classes = [EditarCadastros]

    @transaction.atomic
    def post(self, request, id):
        a = _obter_acessorio(id)
        if a.situacao != 'inativo':
            raise Conflito('Só um acessório inativo pode ser reativado.')
        a.situacao = 'uso'
        a.save(update_fields=['situacao'])
        EventoAcessorio.objects.create(acessorio=a, data=hoje(), descricao=f'Reativado por {_quem(request)} em {data_br(hoje())}')
        return Response(_acessorio_resposta(_qs_acessorios().get(id=a.id)))


class _ItemInspecao(serializers.Serializer):
    texto = serializers.CharField(max_length=300)
    conforme = serializers.BooleanField()


class _Inspecao(serializers.Serializer):
    data = serializers.DateField()
    responsavel = Texto(max_length=150)
    resultado = serializers.ChoiceField(choices=['aprovado', 'reprovado'])
    itens = _ItemInspecao(many=True)
    observacao = Texto(max_length=2000)
    proxima = Data()
    destino = serializers.ChoiceField(choices=['descartado', 'inspecao'], required=False, default='descartado')
    motivo = Texto(max_length=500)


class InspecoesView(APIView):
    """POST /api/acessorios/{id}/inspecoes/ → acessório atualizado (mesmo efeito de aplicarInspecao no front)."""
    permission_classes = [EditarCadastros]

    @transaction.atomic
    def post(self, request, id):
        a = _obter_acessorio(id)
        if a.situacao in ('inativo', 'descartado'):
            raise Conflito('Acessório inativo ou descartado não recebe inspeção.')
        s = _Inspecao(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        itens = d['itens']
        if not itens:
            raise DadosInvalidos('A inspeção precisa ter itens conferidos.')
        # O resultado vem dos itens, não do que o cliente declarou
        resultado = 'aprovado' if all(i['conforme'] for i in itens) else 'reprovado'
        if resultado != d['resultado']:
            raise DadosInvalidos('O resultado não confere com os itens: um item não conforme reprova; todos conformes aprovam.')
        if d['data'] > hoje():
            raise DadosInvalidos('A inspeção não pode ter data futura.')
        if a.ultima_inspecao and d['data'] < a.ultima_inspecao:
            raise DadosInvalidos(f'Já existe inspeção mais recente ({data_br(a.ultima_inspecao)}).')
        if resultado == 'aprovado' and (not d['proxima'] or d['proxima'] <= d['data']):
            raise DadosInvalidos('Informe a próxima inspeção, depois desta.')
        proxima = d['proxima'] if resultado == 'aprovado' else None
        RegistroInspecao.objects.create(acessorio=a, data=d['data'], responsavel=d['responsavel'].strip(), resultado=resultado,
                                        itens=[dict(i) for i in itens], observacao=d['observacao'].strip(), proxima=proxima)
        n = len(itens)
        falhas = '; '.join(i['texto'] for i in itens if not i['conforme'])
        quem = f' por {d["responsavel"].strip()}' if d['responsavel'].strip() else ''
        a.ultima_inspecao = d['data']
        eventos: list[str]
        if resultado == 'aprovado':
            a.situacao, a.proxima_inspecao = 'uso', proxima
            eventos = [f'Inspeção pelo padrão{quem}: aprovada ({n} de {n} itens conformes); próxima em {data_br(proxima)}']
        else:
            base = f'Inspeção pelo padrão{quem}: reprovada (não conforme: {falhas})'
            if d['destino'] == 'descartado':
                a.situacao = 'descartado'
                a.motivo_descarte = d['motivo'].strip() or f'Reprovado na inspeção: {falhas}'
                eventos = [base, f'Descartado: {a.motivo_descarte}']
            else:
                a.situacao = 'inspecao'
                eventos = [f'{base}. Enviado para reparo (fica "Em inspeção")']
        a.save()
        EventoAcessorio.objects.bulk_create([EventoAcessorio(acessorio=a, data=d['data'], descricao=e) for e in eventos])
        return Response(_acessorio_resposta(_qs_acessorios().get(id=a.id)))


class CertificadoView(APIView):
    """POST (multipart, campo "arquivo") · GET /api/acessorios/{id}/certificado/ — PDF do certificado."""
    permission_classes = [EditarCadastros]
    parser_classes = [MultiPartParser]

    def get(self, request, id):
        a = Acessorio.objects.filter(id=id).first() or _nao_encontrado('Acessório')
        if not a.certificado_ref:
            raise NotFound('O acessório não tem certificado anexado.')
        return arquivos.entregar(a.certificado_ref)

    @transaction.atomic
    def post(self, request, id):
        a = _obter_acessorio(id)
        arq = arquivos.receber(request.FILES.get('arquivo'), 'certificado', request.user)
        a.certificado_arquivo, a.certificado_ref = arq.nome_original, arq
        a.save(update_fields=['certificado_arquivo', 'certificado_ref'])
        EventoAcessorio.objects.create(acessorio=a, data=hoje(), descricao=f'Certificado anexado: {arq.nome_original}')
        return Response(_acessorio_resposta(_qs_acessorios().get(id=a.id)))


# =============================================================================================
# Padrões de inspeção
# =============================================================================================

class _Padrao(serializers.Serializer):
    referencia = Texto(max_length=2000)
    itens = serializers.ListField(child=serializers.CharField(allow_blank=True, max_length=300, trim_whitespace=False))


class PadroesView(APIView):
    permission_classes = [EditarCadastros]

    def get(self, request):
        return Response([J.padrao_json(p) for p in PadraoInspecao.objects.all()])


class PadraoView(APIView):
    """PUT /api/padroes-inspecao/{tipo}/ — vale para inspeções novas; as registradas guardam a cópia dos itens."""
    permission_classes = [EditarCadastros]

    def put(self, request, tipo):
        if tipo not in TipoAcessorio.values:
            raise NotFound('Tipo de acessório não encontrado.')
        s = _Padrao(data=request.data)
        s.is_valid(raise_exception=True)
        itens = [t.strip() for t in s.validated_data['itens'] if t.strip()]
        if not itens:
            raise DadosInvalidos('O padrão precisa de pelo menos um item.')
        p, _ = PadraoInspecao.objects.update_or_create(
            tipo=tipo, defaults={'itens': itens, 'referencia': s.validated_data['referencia'].strip(), 'atualizado_em': hoje()})
        return Response(J.padrao_json(p))


# =============================================================================================
# Regras de cálculo
# =============================================================================================

class _Variavel(serializers.Serializer):
    simbolo = Texto(max_length=30)
    nome = Texto(max_length=150)
    unidade = Texto(max_length=30)
    origem = Texto(max_length=150)
    teste = Texto(max_length=30)


class _Regra(serializers.Serializer):
    nome = Texto(max_length=150)
    categoria = serializers.ChoiceField(choices=['Carga', 'Guindaste', 'Lingada', 'Sapatas e terreno'])
    descricao = Texto(max_length=2000)
    formula = Texto(max_length=motor_regras.MAX_FORMULA)
    resultado_nome = Texto(max_length=30)
    resultado_unidade = Texto(max_length=30)
    variaveis = _Variavel(many=True)
    limite = serializers.BooleanField(required=False, default=False)
    origem_capacidade = serializers.CharField(max_length=150, allow_null=True, allow_blank=True, required=False, default=None)
    capacidade_teste = Texto(max_length=30)
    no_resumo = serializers.BooleanField(required=False, default=True)
    no_memorial = serializers.BooleanField(required=False, default=True)
    automatica = serializers.BooleanField(required=False, default=False)


def _qs_regras():
    return RegraCalculo.objects.prefetch_related('versoes')


def _catalogo() -> dict[str, dict]:
    return {r.id: {'id': r.id, 'nome': r.nome, 'formula': r.formula, 'variaveis': r.variaveis} for r in RegraCalculo.objects.all()}


def _proximo_id(prefixo: str, ids) -> str:
    """t11, u12… sem repetir um id que já existe, mesmo depois de exclusões (como no mock)."""
    usados = [int(i[len(prefixo):]) for i in ids if i.startswith(prefixo) and i[len(prefixo):].isdigit()]
    return f'{prefixo}{max([10, *usados]) + 1}'


@transaction.atomic
def _salvar_regra(r: RegraCalculo | None, dados, request) -> RegraCalculo:
    if r is not None and r.origem == 'sistema':
        raise Conflito('Regra do sistema é somente leitura. Duplique para criar outra.')
    s = _Regra(data=dados)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    d['nome'] = d['nome'].strip()
    if not d['nome']:
        raise DadosInvalidos('Dê um nome para a regra.')
    outra = RegraCalculo.objects.filter(nome__iexact=d['nome']).exclude(id=r.id if r else None).first()
    if outra:
        raise Conflito(f'Já existe a regra "{outra.nome}". Use outro nome.')
    catalogo = _catalogo()
    erro = motor_regras.erro_regra({**d, 'variaveis': [dict(v) for v in d['variaveis']]}, catalogo)
    if erro:
        raise DadosInvalidos(erro)
    if r is None:
        r = RegraCalculo(id=_proximo_id('u', catalogo.keys()), origem='criado', autor=_quem(request), versao=0,
                         criada_em_ordem=RegraCalculo.objects.count() + 1)
    for campo, valor in d.items():
        setattr(r, campo, [dict(v) for v in valor] if campo == 'variaveis' else valor)
    r.versao += 1
    r.save()
    VersaoRegra.objects.create(regra=r, versao=r.versao, formula=r.formula, variaveis=r.variaveis, salva_em=agora(), autor=_quem(request))
    return _qs_regras().get(id=r.id)


def _regra_resposta(r: RegraCalculo) -> dict:
    return J.regra_json(r, J.usos('regra').get(r.id, []))


class RegrasView(APIView):
    permission_classes = [EditarCadastros]

    def get(self, request):
        usos = J.usos('regra')
        return Response([J.regra_json(r, usos.get(r.id, [])) for r in _qs_regras()])

    def post(self, request):
        return Response(_regra_resposta(_salvar_regra(None, request.data, request)), status=status.HTTP_201_CREATED)


class RegraView(APIView):
    permission_classes = [EditarCadastros]

    def _obter(self, id_):
        return RegraCalculo.objects.select_for_update().filter(id=id_).first() or _nao_encontrado('Regra')

    @transaction.atomic
    def put(self, request, id):
        return Response(_regra_resposta(_salvar_regra(self._obter(id), request.data, request)))

    @transaction.atomic
    def delete(self, request, id):
        r = self._obter(id)
        if r.origem == 'sistema':
            raise Conflito('Regra do sistema não pode ser excluída.')
        tipos = list(TipoIcamento.objects.filter(regradotipo__regra=r).values_list('nome', flat=True))
        if tipos:
            raise Conflito(f'A regra é usada pelo tipo "{tipos[0]}". Tire a regra do tipo antes de excluir.')
        r.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================================
# Tipos de içamento
# =============================================================================================

class _Campos(serializers.Serializer):
    angulo_inferior = serializers.BooleanField(default=False)
    angulo_superior = serializers.BooleanField(default=False)
    angulo_unico = serializers.BooleanField(default=False)
    peso_balancim = serializers.BooleanField(default=False)
    capacidade_laco = serializers.BooleanField(default=False)


class _Tipo(serializers.Serializer):
    nome = Texto(max_length=150)
    descricao = Texto(max_length=2000)
    balancim = serializers.BooleanField()
    pernas = serializers.IntegerField(min_value=1, max_value=8)
    pernas_superiores = serializers.IntegerField(min_value=0, max_value=8)
    campos = _Campos()
    regras = serializers.ListField(child=serializers.CharField(max_length=20))
    acessorios_sugeridos = Texto(max_length=300)
    geometria = Texto(max_length=200)
    aviso_sem_acessorio = serializers.CharField(max_length=300, allow_null=True, allow_blank=True, required=False, default=None)


def _qs_tipos():
    return TipoIcamento.objects.prefetch_related('regradotipo_set')


@transaction.atomic
def _salvar_tipo(t: TipoIcamento | None, dados, request) -> TipoIcamento:
    if t is not None and t.origem == 'sistema':
        raise Conflito('Tipo padrão do sistema é somente leitura. Duplique para criar outro.')
    s = _Tipo(data=dados)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    d['nome'] = d['nome'].strip()
    if not d['nome']:
        raise DadosInvalidos('Dê um nome para o tipo de içamento.')
    if TipoIcamento.objects.filter(nome__iexact=d['nome']).exclude(id=t.id if t else None).exists():
        raise Conflito(f'Já existe o tipo "{d["nome"]}". Use outro nome.')
    regras = list(dict.fromkeys(d.pop('regras')))
    catalogo = _catalogo()
    faltando = [i for i in regras if i not in catalogo]
    if faltando:
        raise DadosInvalidos(f'Regra não encontrada: {", ".join(faltando)}.')
    erro = motor_regras.erro_regras_do_tipo(regras, catalogo)
    if erro:
        raise DadosInvalidos(erro)
    if not d['balancim']:
        d['pernas_superiores'] = 0
    erro = motor_regras.erro_montagem_do_tipo(d['balancim'], d['pernas'], d['pernas_superiores'])
    if erro:
        raise DadosInvalidos(erro)
    if t is None:
        t = TipoIcamento(id=_proximo_id('t', TipoIcamento.objects.values_list('id', flat=True)), origem='criado', autor=_quem(request),
                         versao=0, criado_em_ordem=TipoIcamento.objects.count() + 1)
    for campo, valor in d.items():
        setattr(t, campo, dict(valor) if campo == 'campos' else valor)
    t.versao += 1
    t.save()
    RegraDoTipo.objects.filter(tipo=t).delete()
    RegraDoTipo.objects.bulk_create([RegraDoTipo(tipo=t, regra_id=rid, ordem=i) for i, rid in enumerate(regras)])
    return _qs_tipos().get(id=t.id)


def _tipo_resposta(t: TipoIcamento) -> dict:
    return J.tipo_json(t, J.usos('tipo').get(t.id, []))


class TiposView(APIView):
    permission_classes = [EditarCadastros]

    def get(self, request):
        usos = J.usos('tipo')
        return Response([J.tipo_json(t, usos.get(t.id, [])) for t in _qs_tipos()])

    def post(self, request):
        return Response(_tipo_resposta(_salvar_tipo(None, request.data, request)), status=status.HTTP_201_CREATED)


class TipoView(APIView):
    permission_classes = [EditarCadastros]

    def _obter(self, id_):
        return TipoIcamento.objects.select_for_update().filter(id=id_).first() or _nao_encontrado('Tipo de içamento')

    @transaction.atomic
    def put(self, request, id):
        return Response(_tipo_resposta(_salvar_tipo(self._obter(id), request.data, request)))

    @transaction.atomic
    def delete(self, request, id):
        from planos.models import PlanoRigging
        t = self._obter(id)
        if t.origem == 'sistema':
            raise Conflito('Tipo padrão do sistema não pode ser excluído.')
        em_uso = list(PlanoRigging.objects.filter(tipo_icamento_id=t.id).values_list('numero', flat=True)[:3])
        if em_uso:
            raise Conflito(f'O tipo é usado no plano {", ".join(em_uso)}. Troque o tipo nesses planos antes de excluir.')
        t.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
