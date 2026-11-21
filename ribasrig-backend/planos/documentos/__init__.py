"""Documentos gerados pelo sistema: PDF do plano (cliente), memorial de cálculo (interno) e planilha do carimbo."""
from nucleo.arquivos import guardar_bytes
from nucleo.excecoes import Conflito

from ..models import DocumentoRevisao, Revisao
from .contexto import contexto
from .pdf_memorial import montar_memorial
from .pdf_plano import montar_pdf_plano, usar_logo


def nome_memorial(numero: str, rev: int) -> str:
    return f'Memorial_{numero}_Rev{rev}.pdf'


def _gerar(revisao: Revisao, tipo: str, usuario, estrito: bool = True) -> DocumentoRevisao:
    c = contexto(revisao)
    usar_logo(c.arquivos.get('logo'))
    if tipo == 'plano':
        conteudo, paginas = montar_pdf_plano(c, estrito)
        nome, finalidade = revisao.arquivo_pdf, 'plano_pdf'
    else:
        conteudo, paginas = montar_memorial(c)
        nome, finalidade = nome_memorial(c.numero, revisao.numero), 'memorial'
    arq = guardar_bytes(conteudo, nome, finalidade, 'application/pdf', usuario)
    return DocumentoRevisao.objects.create(revisao=revisao, tipo=tipo, arquivo=arq, paginas=paginas)


def gerar_documentos(revisao: Revisao, usuario) -> None:
    """Na emissão: PDF do cliente e memorial interno, presos à revisão."""
    for tipo in ('plano', 'memorial'):
        _gerar(revisao, tipo, usuario)


def documento(revisao: Revisao, tipo: str, usuario) -> DocumentoRevisao:
    """Documento da revisão. Revisões do sistema emitidas antes desta função (cenário de exemplo) ganham o
    documento no primeiro pedido, gerado da mesma cópia gravada (anexo ilegível vira página de aviso, porque a
    revisão não pode mais ser corrigida); a do Excel não tem (o original ficou fora)."""
    if revisao.origem == 'excel':
        raise Conflito(f'A Rev. {revisao.numero} foi emitida no Excel, antes do sistema: o PDF original não está guardado no sistema.')
    existente = revisao.documentos.filter(tipo=tipo).select_related('arquivo').first()
    return existente or _gerar(revisao, tipo, usuario, estrito=False)
