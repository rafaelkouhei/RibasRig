"""Entrada do plano (DadosPlano do front) → campos do model. Os anexos NÃO entram por aqui: só pelo
upload (planos/views.py, AnexoView), para o checklist nunca aprovar um PDF que não existe."""
from rest_framework import serializers

from cadastros.models import Acessorio, Cliente, Guindaste
from nucleo.campos import Data, Numero, Texto, ler_data_hora
from nucleo.excecoes import DadosInvalidos

from .models import GuindasteAdicional, ItemLingada, PlanoRigging

POSICOES = ['pernasInferiores', 'pernasSuperiores', 'carga', 'gancho']


class _Obra(serializers.Serializer):
    mesmo_endereco_contratante = serializers.BooleanField(required=False, default=False)
    nome = Texto(max_length=150)
    endereco = Texto(max_length=300)
    cidade = Texto(max_length=100)
    uf = Texto(max_length=2)
    cep = Texto(max_length=12)


class _Contrato(serializers.Serializer):
    numero = Texto(max_length=50)
    celebrado_em = Data()
    valor = Texto(max_length=30)
    termino = Data()


class _Carga(serializers.Serializer):
    descricao = Texto(max_length=200)
    comprimento_m = Numero()
    largura_m = Numero()
    altura_m = Numero()
    peso_kg = Numero()


class _Item(serializers.Serializer):
    acessorio_id = serializers.IntegerField()
    quantidade = Numero()
    posicao = serializers.ChoiceField(choices=POSICOES)


class _Dispositivo(serializers.Serializer):
    acessorio_id = serializers.IntegerField(allow_null=True, required=False, default=None)
    descricao = Texto(max_length=150)
    quantidade = Numero()
    peso_unitario_kg = Numero()


class _Adicional(serializers.Serializer):
    guindaste_id = serializers.IntegerField()
    tabela_id = serializers.CharField(max_length=40, allow_null=True, allow_blank=True, required=False, default=None)
    raio_m = Numero()
    pct = Numero()


class _Dormente(serializers.Serializer):
    largura_cm = Numero()
    comprimento_cm = Numero()
    quantidade = Numero()


class DadosPlanoEntrada(serializers.Serializer):
    cliente_id = serializers.IntegerField(allow_null=True, required=False, default=None)
    obra = _Obra(required=False, default=dict)
    data_operacao = Data()
    descricao_operacao = Texto(max_length=5000)
    rigger = Texto(max_length=200)
    art = Texto(max_length=20)
    art_registrada_em = serializers.CharField(allow_null=True, allow_blank=True, required=False, default=None)
    contrato_art = _Contrato(required=False, default=dict)
    carga = _Carga(required=False, default=dict)
    tipo_icamento_id = Texto(max_length=20)
    lingada = _Item(many=True, required=False, default=list)
    angulo_inferior_graus = Numero()
    angulo_superior_graus = Numero()
    dispositivo = _Dispositivo(required=False, default=dict)
    cargas_extras_kg = Numero()
    guindaste_id = serializers.IntegerField(allow_null=True, required=False, default=None)
    tabela_id = serializers.CharField(max_length=40, allow_null=True, allow_blank=True, required=False, default=None)
    comprimento_lanca_m = Numero()
    raio_m = Numero()
    guindastes_adicionais = _Adicional(many=True, required=False, default=list)
    quadrante_inicial = Texto(max_length=50)
    quadrante_final = Texto(max_length=50)
    vento_max_ms = Numero()
    raio_isolamento_m = Numero()
    dormente = _Dormente(required=False, default=dict)
    etapa_atual = serializers.IntegerField(min_value=1, max_value=6, required=False, default=1)
    copia_de = serializers.CharField(max_length=7, allow_null=True, allow_blank=True, required=False, default=None)
    exemplo = serializers.BooleanField(required=False, default=False)


def ler_dados(dados) -> dict:
    s = DadosPlanoEntrada(data=dados)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if d['art_registrada_em']:
        try:
            ler_data_hora(d['art_registrada_em'])
        except ValueError:
            raise DadosInvalidos('Data de registro da ART inválida: use aaaa-mm-ddThh:mm.') from None
    _conferir_referencias(d)
    return d


def _conferir_referencias(d: dict) -> None:
    if d['cliente_id'] is not None and not Cliente.objects.filter(id=d['cliente_id']).exists():
        raise DadosInvalidos('Contratante não encontrado no cadastro de clientes.')
    ids_acessorios = {i['acessorio_id'] for i in d['lingada']}
    if d['dispositivo'].get('acessorio_id') is not None:
        ids_acessorios.add(d['dispositivo']['acessorio_id'])
    faltando = ids_acessorios - set(Acessorio.objects.filter(id__in=ids_acessorios).values_list('id', flat=True))
    if faltando:
        raise DadosInvalidos(f'Acessório não encontrado: {", ".join(map(str, sorted(faltando)))}.')
    ids_guindastes = {a['guindaste_id'] for a in d['guindastes_adicionais']}
    if d['guindaste_id'] is not None:
        ids_guindastes.add(d['guindaste_id'])
    faltando = ids_guindastes - set(Guindaste.objects.filter(id__in=ids_guindastes).values_list('id', flat=True))
    if faltando:
        raise DadosInvalidos(f'Guindaste não encontrado: {", ".join(map(str, sorted(faltando)))}.')


def aplicar_dados(p: PlanoRigging, d: dict) -> None:
    """Grava os dados no plano (já salvo) e troca lingada e guindastes adicionais."""
    obra, contrato, carga, disp, dorm = d['obra'], d['contrato_art'], d['carga'], d['dispositivo'], d['dormente']
    p.cliente_id = d['cliente_id']
    p.obra_mesmo_endereco_contratante = obra.get('mesmo_endereco_contratante', False)
    for k in ('nome', 'endereco', 'cidade', 'cep'):
        setattr(p, f'obra_{k}', obra.get(k, ''))
    p.obra_uf = obra.get('uf', '').upper()
    p.data_operacao = d['data_operacao']
    p.descricao_operacao = d['descricao_operacao']
    p.rigger = d['rigger']
    p.art = d['art'].strip()
    p.art_registrada_em = ler_data_hora(d['art_registrada_em'])[0] if d['art_registrada_em'] else None
    p.contrato_art_numero = contrato.get('numero', '')
    p.contrato_art_celebrado_em = contrato.get('celebrado_em')
    p.contrato_art_valor = contrato.get('valor', '')
    p.contrato_art_termino = contrato.get('termino')
    p.carga_descricao = carga.get('descricao', '')
    for k in ('comprimento_m', 'largura_m', 'altura_m', 'peso_kg'):
        setattr(p, f'carga_{k}', carga.get(k))
    p.tipo_icamento_id = d['tipo_icamento_id']
    p.angulo_inferior_graus = d['angulo_inferior_graus']
    p.angulo_superior_graus = d['angulo_superior_graus']
    p.dispositivo_acessorio_id = disp.get('acessorio_id')
    p.dispositivo_descricao = disp.get('descricao', '')
    p.dispositivo_quantidade = disp.get('quantidade')
    p.dispositivo_peso_unitario_kg = disp.get('peso_unitario_kg')
    p.cargas_extras_kg = d['cargas_extras_kg']
    p.guindaste_id = d['guindaste_id']
    p.tabela_id = d['tabela_id'] or None
    for k in ('comprimento_lanca_m', 'raio_m', 'quadrante_inicial', 'quadrante_final', 'vento_max_ms', 'raio_isolamento_m',
              'etapa_atual', 'exemplo'):
        setattr(p, k, d[k])
    p.copia_de = d['copia_de'] or None
    p.dormente_largura_cm = dorm.get('largura_cm')
    p.dormente_comprimento_cm = dorm.get('comprimento_cm')
    p.dormente_quantidade = dorm.get('quantidade')
    p.save()
    p.lingada.all().delete()
    ItemLingada.objects.bulk_create([ItemLingada(plano=p, ordem=i, acessorio_id=x['acessorio_id'], quantidade=x['quantidade'], posicao=x['posicao'])
                                     for i, x in enumerate(d['lingada'])])
    p.guindastes_adicionais.all().delete()
    GuindasteAdicional.objects.bulk_create([
        GuindasteAdicional(plano=p, ordem=i, guindaste_id=a['guindaste_id'], tabela_id=a['tabela_id'] or None, raio_m=a['raio_m'], pct=a['pct'])
        for i, a in enumerate(d['guindastes_adicionais'])
    ])
