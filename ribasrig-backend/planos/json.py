"""PlanoRigging → JSON (DadosPlano + metadados + revisões), em snake_case."""
from django.db.models import Prefetch, QuerySet

from nucleo.campos import iso_data, iso_data_hora, n

from .models import PlanoRigging, Revisao


def qs_planos() -> QuerySet[PlanoRigging]:
    return PlanoRigging.objects.prefetch_related('lingada', 'guindastes_adicionais', Prefetch('revisoes', Revisao.objects.order_by('numero')))


def dados_json(p: PlanoRigging) -> dict:
    """Só os dados editáveis (DadosPlano do front). É o que o motor recebe e o que a revisão guarda como entrada."""
    return {
        'cliente_id': p.cliente_id,
        'obra': {'mesmo_endereco_contratante': p.obra_mesmo_endereco_contratante, 'nome': p.obra_nome, 'endereco': p.obra_endereco,
                 'cidade': p.obra_cidade, 'uf': p.obra_uf, 'cep': p.obra_cep},
        'data_operacao': iso_data(p.data_operacao), 'descricao_operacao': p.descricao_operacao, 'rigger': p.rigger,
        'art': p.art, 'art_registrada_em': iso_data_hora(p.art_registrada_em),
        'contrato_art': {'numero': p.contrato_art_numero, 'celebrado_em': iso_data(p.contrato_art_celebrado_em),
                         'valor': p.contrato_art_valor, 'termino': iso_data(p.contrato_art_termino)},
        'carga': {'descricao': p.carga_descricao, 'comprimento_m': n(p.carga_comprimento_m), 'largura_m': n(p.carga_largura_m),
                  'altura_m': n(p.carga_altura_m), 'peso_kg': n(p.carga_peso_kg)},
        'tipo_icamento_id': p.tipo_icamento_id,
        'lingada': [{'acessorio_id': l.acessorio_id, 'quantidade': n(l.quantidade), 'posicao': l.posicao} for l in p.lingada.all()],
        'angulo_inferior_graus': n(p.angulo_inferior_graus), 'angulo_superior_graus': n(p.angulo_superior_graus),
        'dispositivo': {'acessorio_id': p.dispositivo_acessorio_id, 'descricao': p.dispositivo_descricao,
                        'quantidade': n(p.dispositivo_quantidade), 'peso_unitario_kg': n(p.dispositivo_peso_unitario_kg)},
        'cargas_extras_kg': n(p.cargas_extras_kg),
        'guindaste_id': p.guindaste_id, 'tabela_id': p.tabela_id, 'comprimento_lanca_m': n(p.comprimento_lanca_m), 'raio_m': n(p.raio_m),
        'guindastes_adicionais': [{'guindaste_id': a.guindaste_id, 'tabela_id': a.tabela_id, 'raio_m': n(a.raio_m), 'pct': n(a.pct)}
                                  for a in p.guindastes_adicionais.all()],
        'quadrante_inicial': p.quadrante_inicial, 'quadrante_final': p.quadrante_final,
        'vento_max_ms': n(p.vento_max_ms), 'raio_isolamento_m': n(p.raio_isolamento_m),
        'dormente': {'largura_cm': n(p.dormente_largura_cm), 'comprimento_cm': n(p.dormente_comprimento_cm), 'quantidade': n(p.dormente_quantidade)},
        'anexos': {'desenhos': p.anexo_desenhos, 'art_plano': p.anexo_art_plano, 'arquivo_art': p.anexo_arquivo_art},
        'etapa_atual': p.etapa_atual, 'copia_de': p.copia_de, 'exemplo': p.exemplo,
    }


def _pct_gravado(entradas: dict | None, chave: str) -> float | None:
    v = (entradas or {}).get(chave)
    try:
        return float(v) if v not in (None, '') else None
    except (TypeError, ValueError):
        return None


def revisao_json(r: Revisao) -> dict:
    return {
        'numero': r.numero, 'emitida_em': iso_data_hora(r.emitida_em, r.emitida_em_so_data), 'emitida_por': r.emitida_por,
        'origem': r.origem, 'cadastrada_em': iso_data_hora(r.cadastrada_em), 'resultados': r.resultados,
        'arquivo_pdf': r.arquivo_pdf, 'observacao': r.observacao,
        # Limite e aviso usados na emissão (a tela julga a revisão com eles, não com as Configurações de hoje).
        # None = revisão sem essa cópia (cadastrada do Excel ou anterior ao limite configurável).
        'limite_pct': _pct_gravado(r.entradas, 'limite_pct'), 'aviso_atencao_pct': _pct_gravado(r.entradas, 'aviso_atencao_pct'),
    }


def plano_json(p: PlanoRigging) -> dict:
    return {
        **dados_json(p), 'id': p.id, 'numero': p.numero, 'situacao_documento': p.situacao_documento,
        'revisoes': [revisao_json(r) for r in p.revisoes.all()],
        'criado_em': iso_data_hora(p.criado_em, p.criado_em_so_data), 'criado_por': p.criado_por,
        'atualizado_em': iso_data_hora(p.atualizado_em),
    }
