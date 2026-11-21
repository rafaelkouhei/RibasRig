"""Endpoints dos planos (ver a tabela de endpoints em docs/backend.md, na raiz)."""
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from contas.permissoes import pode, permissao
from motor.numeracao import ErroNumeracao
from nucleo import arquivos
from nucleo.campos import iso_data_hora
from nucleo.excecoes import Conflito, DadosInvalidos
from nucleo.tempo import agora, hoje

from . import servicos as S
from .entrada import aplicar_dados, ler_dados
from .json import dados_json, plano_json, qs_planos
from .models import PlanoRigging


class _PorMetodo(BasePermission):
    """GET para quem consulta planos; demais métodos conforme `acao_escrita` da view."""
    message = 'Seu perfil não tem permissão para esta ação.'

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return pode(request.user, 'consultarPlanos')
        return pode(request.user, view.acao_escrita)


def _quem(request) -> str:
    return getattr(request.user, 'nome', '') or request.user.get_username()


def _obter(numero: str, travar: bool = False) -> PlanoRigging:
    qs = PlanoRigging.objects.select_for_update() if travar else qs_planos()
    p = qs.filter(numero=numero).first()
    if p is None:
        raise NotFound(f'Plano {numero} não encontrado.')
    return p


def _resposta(p: PlanoRigging, status_http=status.HTTP_200_OK) -> Response:
    return Response(plano_json(qs_planos().get(id=p.id)), status=status_http)


def _novo_rascunho(numero: str, d: dict, request) -> PlanoRigging:
    quando = agora()
    p = PlanoRigging(numero=numero, criado_em=quando, atualizado_em=quando, criado_por=_quem(request), criado_por_usuario=request.user)
    p.save()
    aplicar_dados(p, d)
    return p


class PlanosView(APIView):
    """GET /api/planos/ · POST /api/planos/ (número gerado pelo servidor, nunca digitado)."""
    permission_classes = [_PorMetodo]
    acao_escrita = 'editarRascunhos'

    def get(self, request):
        return Response([plano_json(p) for p in qs_planos()])

    @transaction.atomic
    def post(self, request):
        d = ler_dados(request.data)
        try:
            numero = S.reservar_numeros(hoje())[0]
        except ErroNumeracao as e:
            raise Conflito(str(e)) from None
        p = _novo_rascunho(numero, d, request)
        S.registrar_evento(p, 'cadastro', 'Criou o rascunho', f'Cópia do plano {d["copia_de"]}.' if d['copia_de'] else 'Plano novo.', _quem(request))
        return _resposta(p, status.HTTP_201_CREATED)


class PlanoView(APIView):
    """GET /api/planos/{numero}/ · PATCH /api/planos/{numero}/ (rascunho; plano emitido recusa com 409)."""
    permission_classes = [_PorMetodo]
    acao_escrita = 'editarRascunhos'

    def get(self, request, numero):
        return Response(plano_json(_obter(numero)))

    @transaction.atomic
    def patch(self, request, numero):
        p = _obter(numero, travar=True)
        if p.situacao_documento == 'emitido':
            raise Conflito(f'Plano {numero} emitido não pode ser alterado. Crie uma nova revisão.')
        d = ler_dados(request.data)
        p.atualizado_em = agora()
        aplicar_dados(p, d)
        return _resposta(p)


class _Emitir(serializers.Serializer):
    observacao = serializers.CharField(allow_blank=True, required=False, default='', max_length=2000)


class EmitirView(APIView):
    """POST /api/planos/{numero}/emitir/ → o servidor recalcula; se pode, cria a Rev. N+1 e trava o plano (422 com os motivos se não)."""
    permission_classes = [permissao('emitirPlano')]

    def post(self, request, numero):
        s = _Emitir(data=request.data or {})
        s.is_valid(raise_exception=True)
        p = S.emitir(numero, request.user, s.validated_data['observacao'].strip())
        return _resposta(p)


class NovaRevisaoView(APIView):
    """POST /api/planos/{numero}/nova-revisao/ → volta a rascunho (Rev. N+1, mesmo número). As revisões emitidas ficam."""
    permission_classes = [permissao('novaRevisao')]

    @transaction.atomic
    def post(self, request, numero):
        p = _obter(numero, travar=True)
        if p.situacao_documento != 'emitido':
            raise Conflito('O plano já está em rascunho.')
        p.situacao_documento = 'rascunho'
        p.atualizado_em = agora()
        p.save(update_fields=['situacao_documento', 'atualizado_em'])
        proxima = (p.revisoes.order_by('-numero').values_list('numero', flat=True).first() or 0) + 1
        S.registrar_evento(p, 'edicao', f'Criou a Rev. {proxima} (rascunho)', 'As revisões emitidas continuam guardadas como foram entregues.', _quem(request))
        return _resposta(p)


class DuplicarView(APIView):
    """POST /api/planos/{numero}/duplicar/ → novo rascunho (novo número) com os dados, sem ART nem anexos."""
    permission_classes = [permissao('editarRascunhos')]

    @transaction.atomic
    def post(self, request, numero):
        origem = _obter(numero)
        d = ler_dados({**dados_json(origem), 'art': '', 'art_registrada_em': None, 'etapa_atual': 1, 'copia_de': numero})
        try:
            novo = S.reservar_numeros(hoje())[0]
        except ErroNumeracao as e:
            raise Conflito(str(e)) from None
        p = _novo_rascunho(novo, d, request)
        S.registrar_evento(p, 'cadastro', 'Criou o rascunho', f'Cópia do plano {numero}.', _quem(request))
        return _resposta(p, status.HTTP_201_CREATED)


class _Lote(serializers.Serializer):
    dados = serializers.DictField()
    quantidade = serializers.IntegerField(min_value=1, max_value=50)


class LoteView(APIView):
    """POST /api/planos/lote/ {dados, quantidade} → N rascunhos com números seguidos (sem invadir o mês seguinte)."""
    permission_classes = [permissao('editarRascunhos')]

    @transaction.atomic
    def post(self, request):
        s = _Lote(data=request.data)
        s.is_valid(raise_exception=True)
        d = ler_dados(s.validated_data['dados'])
        qtd = s.validated_data['quantidade']
        try:
            numeros = S.reservar_numeros(hoje(), qtd)
        except ErroNumeracao as e:
            raise DadosInvalidos(str(e)) from None
        criados = []
        for n in numeros:
            p = _novo_rascunho(n, d, request)
            S.registrar_evento(p, 'cadastro', 'Criou o rascunho (lote)', f'Lote de {qtd} planos: {numeros[0]} a {numeros[-1]}.', _quem(request))
            criados.append(p.id)
        return Response([plano_json(p) for p in qs_planos().filter(id__in=criados).order_by('numero')], status=status.HTTP_201_CREATED)


class HistoricoView(APIView):
    """GET /api/planos/{numero}/historico/ → eventos do mais novo para o mais antigo."""
    permission_classes = [permissao('verHistorico')]

    def get(self, request, numero):
        p = _obter(numero)
        return Response([{'id': e.id, 'plano_numero': p.numero, 'tipo': e.tipo, 'titulo': e.titulo, 'detalhe': e.detalhe,
                          'usuario': e.usuario, 'quando': iso_data_hora(e.quando)} for e in p.eventos.order_by('-id')])


TIPOS_ANEXO = {'desenhos': 'desenhos', 'art': 'art_plano'}


class AnexoView(APIView):
    """POST (multipart, campo "arquivo") · GET · DELETE /api/planos/{numero}/anexos/{desenhos|art}/.
    Só PDF (conferido pelos bytes). O nome do PDF da ART precisa ser ART_<nº da ART>.pdf para o checklist aceitar."""
    permission_classes = [_PorMetodo]
    acao_escrita = 'editarRascunhos'
    parser_classes = [MultiPartParser, JSONParser]

    def _tipo(self, tipo: str) -> str:
        if tipo not in TIPOS_ANEXO:
            raise NotFound('Anexo não encontrado. Use "desenhos" ou "art".')
        return tipo

    def get(self, request, numero, tipo):
        p = _obter(numero)
        ref = p.anexo_desenhos_ref if self._tipo(tipo) == 'desenhos' else p.anexo_art_ref
        if not ref:
            raise NotFound('Este anexo ainda não foi enviado.')
        return arquivos.entregar(ref)

    def _rascunho(self, numero: str) -> PlanoRigging:
        p = _obter(numero, travar=True)
        if p.situacao_documento == 'emitido':
            raise Conflito(f'Plano {numero} emitido não pode ser alterado. Crie uma nova revisão.')
        return p

    @transaction.atomic
    def post(self, request, numero, tipo):
        tipo = self._tipo(tipo)
        p = self._rascunho(numero)
        arq = arquivos.receber(request.FILES.get('arquivo'), TIPOS_ANEXO[tipo], request.user)
        if tipo == 'desenhos':
            p.anexo_desenhos, p.anexo_desenhos_ref = arq.nome_original, arq
            titulo = 'Anexou os desenhos'
        else:
            p.anexo_art_plano, p.anexo_arquivo_art, p.anexo_art_ref = True, arq.nome_original, arq
            titulo = 'Anexou a ART do plano'
        p.atualizado_em = agora()
        p.save()
        S.registrar_evento(p, 'anexo', titulo, arq.nome_original, _quem(request))
        return _resposta(p)

    @transaction.atomic
    def delete(self, request, numero, tipo):
        tipo = self._tipo(tipo)
        p = self._rascunho(numero)
        if tipo == 'desenhos':
            p.anexo_desenhos, p.anexo_desenhos_ref = None, None
        else:
            p.anexo_art_plano, p.anexo_arquivo_art, p.anexo_art_ref = False, None, None
        p.atualizado_em = agora()
        p.save()
        S.registrar_evento(p, 'anexo', 'Removeu os desenhos' if tipo == 'desenhos' else 'Removeu a ART do plano', '', _quem(request))
        return _resposta(p)


# =============================================================================================
# Documentos gerados: PDF do plano (cliente), memorial (interno) e planilha do carimbo
# =============================================================================================

class _DocumentoPermissao(BasePermission):
    message = 'Seu perfil não tem permissão para esta ação.'

    def has_permission(self, request, view):
        tipo = view.kwargs.get('tipo')
        return pode(request.user, 'verMemorial' if tipo == 'memorial' else 'consultarPlanos')


class DocumentoRevisaoView(APIView):
    """GET /api/planos/{numero}/revisoes/{rev}/pdf/ (PDF do cliente) · /memorial/ (só Administrador e Engenheiro).
    Gerados na emissão; a revisão do Excel não tem (409)."""
    permission_classes = [_DocumentoPermissao]

    def get(self, request, numero, rev, tipo):
        from django.db import IntegrityError

        from .documentos import documento
        p = _obter(numero)
        revisao = p.revisoes.filter(numero=rev).first()
        if revisao is None:
            raise NotFound(f'A Rev. {rev} não existe no plano {numero}.')
        try:
            with transaction.atomic():
                doc = documento(revisao, tipo, request.user)
        except IntegrityError:  # dois pedidos geraram ao mesmo tempo: vale o primeiro
            doc = revisao.documentos.get(tipo=tipo)
        resposta = arquivos.entregar(doc.arquivo, baixar=request.query_params.get('baixar') == '1')
        resposta['X-Paginas'] = str(doc.paginas)
        return resposta


class CarimboView(APIView):
    """GET /api/planos/{numero}/carimbo/ → Carimbo_{numero}.xlsx com os dados do plano (rascunho: cálculo atual;
    emitido: a cópia gravada na última revisão, como o PDF), para vincular no carimbo dos desenhos do SolidWorks."""
    permission_classes = [permissao('editarRascunhos')]

    def get(self, request, numero):
        from django.http import HttpResponse

        from motor.plano import resultados_da_revisao
        from .documentos.carimbo import montar_carimbo
        from .documentos.contexto import cliente_do_banco, config_do_banco, contexto, guindaste_do_banco
        p = _obter(numero)
        ultima = p.revisoes.order_by('-numero').first()
        if p.situacao_documento == 'emitido' and ultima and (ultima.entradas or {}).get('dados'):
            # Mudar o cadastro do contratante ou do guindaste depois da emissão não muda o carimbo (nem o PDF)
            c = contexto(ultima)
            dados, resultados, cliente, guindaste, responsavel = c.dados, c.resultados, c.cliente, c.guindaste, c.config['responsavel']
            revisao = f'Rev. {ultima.numero}'
        else:
            dados = dados_json(p)
            resultados = ultima.resultados if p.situacao_documento == 'emitido' and ultima else resultados_da_revisao(S.calcular(p))
            cliente, guindaste, responsavel = cliente_do_banco(p.cliente_id), guindaste_do_banco(p.guindaste_id), config_do_banco()['responsavel']
            revisao = f'Rev. {ultima.numero}' if p.situacao_documento == 'emitido' and ultima else f'Rascunho da Rev. {(ultima.numero if ultima else 0) + 1}'
        conteudo = montar_carimbo(numero, revisao, dados, resultados, cliente, guindaste, responsavel)
        resposta = HttpResponse(conteudo, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resposta['Content-Disposition'] = f'attachment; filename="Carimbo_{numero}.xlsx"'
        return resposta
