"""Model → JSON em snake_case (o front converte para camelCase em api.ts)."""
from collections import defaultdict

from nucleo.campos import iso_data, iso_data_hora, n

from .models import Acessorio, Cliente, Guindaste, PadraoInspecao, RegraCalculo, TipoIcamento


def usos(tipo: str) -> dict[str, list[str]]:
    """ref → números dos planos emitidos que usaram o cadastro (uma consulta só)."""
    from planos.models import UsoCadastro
    m: dict[str, list[str]] = defaultdict(list)
    for ref, numero in UsoCadastro.objects.filter(tipo=tipo).order_by('plano__numero').values_list('ref', 'plano__numero'):
        m[ref].append(numero)
    return m


def cliente_json(c: Cliente) -> dict:
    return {
        'id': c.id, 'razao_social': c.razao_social, 'nome_pasta': c.nome_pasta, 'cnpj': c.cnpj, 'endereco': c.endereco,
        'cidade': c.cidade, 'uf': c.uf, 'cep': c.cep,
        'locais_obra': [{'nome': l.nome, 'endereco': l.endereco, 'cidade': l.cidade, 'uf': l.uf, 'cep': l.cep} for l in c.locais_obra.all()],
        'contato': c.contato, 'telefone': c.telefone, 'email': c.email, 'exemplo': c.exemplo,
    }


def guindaste_json(g: Guindaste) -> dict:
    return {
        'id': g.id, 'modelo': g.modelo, 'codigo': g.codigo, 'veiculo': g.veiculo, 'placa': g.placa, 'chassi': g.chassi, 'ano': g.ano,
        'capacidade_nominal_t': n(g.capacidade_nominal_t), 'comprimento_lanca_m': n(g.comprimento_lanca_m),
        'a_m': n(g.a_m), 'b_m': n(g.b_m), 'pg_kgf': n(g.pg_kgf),
        # Nome do PDF só com o arquivo guardado (laudos do cenário de exemplo têm o nome, mas não o arquivo)
        'laudos': [{'inicio': iso_data(l.inicio), 'fim': iso_data(l.fim), 'art': l.art, 'arquivo': l.arquivo if l.arquivo_ref_id else None,
                    'atual': l.atual} for l in g.laudos.all()],
        'tabelas': [{'id': t.chave, 'nome': t.nome, 'pontos': [{'alcance_m': n(p.alcance_m), 'capacidade_kg': n(p.capacidade_kg)} for p in t.pontos.all()]}
                    for t in g.tabelas.all()],
        'dados_pendentes': g.dados_pendentes, 'ativo': g.ativo,
    }


def acessorio_json(a: Acessorio, planos: list[str]) -> dict:
    return {
        'id': a.id, 'tipo': a.tipo, 'descricao': a.descricao, 'nome_curto': a.nome_curto, 'medida': a.medida, 'norma': a.norma,
        'capacidade_t': n(a.capacidade_t), 'capacidade_trabalho_t': n(a.capacidade_trabalho_t), 'unidade_capacidade': a.unidade_capacidade,
        'peso_kg': n(a.peso_kg), 'situacao': a.situacao, 'ultima_inspecao': iso_data(a.ultima_inspecao),
        'proxima_inspecao': iso_data(a.proxima_inspecao), 'data_entrada': iso_data(a.data_entrada), 'certificado': a.certificado,
        'certificado_arquivo': a.certificado_arquivo, 'vencimento': iso_data(a.vencimento), 'motivo_descarte': a.motivo_descarte,
        'inspecoes': [{'data': iso_data(i.data), 'responsavel': i.responsavel, 'resultado': i.resultado, 'itens': i.itens,
                       'observacao': i.observacao, 'proxima': iso_data(i.proxima)} for i in a.inspecoes.all()],
        'historico': [{'data': iso_data(e.data), 'descricao': e.descricao} for e in a.historico.all()],
        'planos': planos,
    }


def padrao_json(p: PadraoInspecao) -> dict:
    return {'tipo': p.tipo, 'referencia': p.referencia, 'itens': p.itens, 'atualizado_em': iso_data(p.atualizado_em)}


def regra_json(r: RegraCalculo, planos: list[str]) -> dict:
    return {
        'id': r.id, 'nome': r.nome, 'categoria': r.categoria, 'descricao': r.descricao, 'formula': r.formula,
        'resultado_nome': r.resultado_nome, 'resultado_unidade': r.resultado_unidade, 'variaveis': r.variaveis,
        'limite': r.limite, 'origem_capacidade': r.origem_capacidade, 'capacidade_teste': r.capacidade_teste,
        'no_resumo': r.no_resumo, 'no_memorial': r.no_memorial, 'automatica': r.automatica, 'origem': r.origem,
        'autor': r.autor, 'versao': r.versao,
        'versoes': [{'versao': v.versao, 'formula': v.formula, 'variaveis': v.variaveis, 'salva_em': iso_data_hora(v.salva_em, v.salva_em_so_data),
                     'autor': v.autor} for v in r.versoes.all()],
        'planos': planos,
    }


def tipo_json(t: TipoIcamento, planos: list[str]) -> dict:
    return {
        'id': t.id, 'nome': t.nome, 'descricao': t.descricao, 'origem': t.origem, 'balancim': t.balancim, 'pernas': t.pernas,
        'pernas_superiores': t.pernas_superiores, 'campos': t.campos,
        'regras': [rt.regra_id for rt in t.regradotipo_set.all()],
        'acessorios_sugeridos': t.acessorios_sugeridos, 'geometria': t.geometria, 'aviso_sem_acessorio': t.aviso_sem_acessorio,
        'autor': t.autor, 'versao': t.versao, 'planos': planos,
    }
