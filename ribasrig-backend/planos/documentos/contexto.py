"""Tudo que os documentos de uma revisão precisam, tirado da cópia gravada na emissão (`Revisao.entradas`).

Revisões emitidas antes de a cópia guardar contratante, guindaste e empresa (o cenário de exemplo) completam
esses dados com o cadastro atual.
"""
from dataclasses import dataclass
from decimal import Decimal

from cadastros.models import Acessorio, Cliente, Guindaste, TipoIcamento
from nucleo.models import Configuracoes

from ..models import Revisao


@dataclass
class Contexto:
    numero: str
    revisao: Revisao
    dados: dict
    resultados: dict
    cliente: dict | None
    guindaste: dict | None
    acessorios: dict[int, dict]
    tabela: dict | None
    balancim: bool
    config: dict
    arquivos: dict
    aviso: Decimal
    limite: Decimal


def cliente_do_banco(cliente_id) -> dict | None:
    c = Cliente.objects.filter(id=cliente_id).first() if cliente_id else None
    return {k: getattr(c, k) for k in ('id', 'razao_social', 'nome_pasta', 'cnpj', 'endereco', 'cidade', 'uf', 'cep')} if c else None


def guindaste_do_banco(guindaste_id) -> dict | None:
    g = Guindaste.objects.filter(id=guindaste_id).first() if guindaste_id else None
    campos = ('id', 'modelo', 'codigo', 'veiculo', 'placa', 'chassi', 'ano', 'capacidade_nominal_t', 'comprimento_lanca_m', 'a_m', 'b_m', 'pg_kgf')
    return {k: getattr(g, k) for k in campos} if g else None


def config_do_banco() -> dict:
    c = Configuracoes.atual()
    return {'nome_arquivo': c.nome_arquivo,
            'empresa': {k: getattr(c, f'empresa_{k}') for k in ('razao_social', 'cnpj', 'ie', 'endereco', 'cep')},
            'responsavel': {k: getattr(c, f'responsavel_{k}') for k in ('nome_completo', 'nome_assinatura', 'titulo', 'crea', 'rnp', 'rpp')}}


def contexto(revisao: Revisao) -> Contexto:
    e = revisao.entradas or {}
    dados = e.get('dados') or {}
    acessorios = {a['id']: a for a in e.get('acessorios', [])}
    faltando = [a for a in acessorios.values() if 'tipo' not in a]
    for a in Acessorio.objects.filter(id__in=[x['id'] for x in faltando]):
        acessorios[a.id] = {**acessorios[a.id], 'tipo': a.tipo, 'norma': a.norma}
    tipo = e.get('tipo_icamento') or {}
    balancim = tipo['balancim'] if 'balancim' in tipo else TipoIcamento.objects.filter(id=dados.get('tipo_icamento_id'), balancim=True).exists()
    graficos = e.get('graficos') or []
    arquivos = dict(e.get('arquivos') or {})
    if 'laudo' not in arquivos and dados.get('guindaste_id'):
        g = Guindaste.objects.filter(id=dados['guindaste_id']).first()
        laudo = g.laudos.filter(atual=True).first() if g else None
        arquivos.update(laudo=str(laudo.arquivo_ref_id) if laudo and laudo.arquivo_ref_id else None,
                        laudo_nome=laudo.arquivo if laudo else None, laudo_art=laudo.art if laudo else None)
    return Contexto(
        numero=revisao.plano.numero, revisao=revisao, dados=dados, resultados=revisao.resultados,
        cliente=e['cliente'] if 'cliente' in e else cliente_do_banco(dados.get('cliente_id')),
        guindaste=e['guindaste'] if 'guindaste' in e else guindaste_do_banco(dados.get('guindaste_id')),
        acessorios=acessorios, tabela=graficos[0] if graficos else None, balancim=balancim,
        config=e.get('configuracoes') or config_do_banco(), arquivos=arquivos,
        aviso=Decimal(str(e.get('aviso_atencao_pct', '75'))),
        # Revisões gravadas antes do limite configurável usavam 85%
        limite=Decimal(str(e.get('limite_pct', '85'))),
    )


def endereco_contratante(c: dict) -> str:
    cidade_uf = '/'.join(x for x in [c.get('cidade', '').strip(), c.get('uf', '').strip().upper()] if x)
    linha = ', '.join(x for x in [c.get('endereco', '').strip(), cidade_uf] if x)
    cep = c.get('cep', '').strip()
    return ' – '.join(x for x in [linha, f'CEP {cep}' if cep else ''] if x)


def endereco_obra(obra: dict, cliente: dict | None) -> str:
    """Mesmo texto de enderecoObra (src/domain/art.ts)."""
    if obra.get('mesmo_endereco_contratante'):
        return endereco_contratante(cliente) if cliente else ''
    uf = obra.get('uf', '').strip()
    cidade_uf = f"{obra.get('cidade', '').strip()}{'/' + uf.upper() if uf else ''}"
    return ' · '.join(x.strip() for x in [obra.get('nome', ''), obra.get('endereco', ''), cidade_uf] if x.strip())
