"""Recebimento e entrega de arquivos.

PDF só é aceito se os bytes começarem com %PDF- (não importa a extensão); logo e assinatura só PNG
ou JPEG pelos bytes. Tamanho máximo em settings. O nome no disco é gerado pelo servidor.
"""
import hashlib
import re

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.http import FileResponse

from .excecoes import DadosInvalidos
from .models import Arquivo

ASSINATURAS = {
    'application/pdf': [b'%PDF-'],
    'image/png': [b'\x89PNG\r\n\x1a\n'],
    'image/jpeg': [b'\xff\xd8\xff'],
}


def _tipo_pelos_bytes(cabeca: bytes) -> str | None:
    for tipo, assinaturas in ASSINATURAS.items():
        if any(cabeca.startswith(a) for a in assinaturas):
            return tipo
    return None


def nome_seguro(nome: str) -> str:
    """Só o nome do arquivo, sem pasta nem caracteres de caminho (para mostrar e para baixar)."""
    base = re.split(r'[\\/]', str(nome or ''))[-1]
    base = re.sub(r'[\x00-\x1f<>:"|?*]', '', base).strip().strip('.')
    return base[:200] or 'arquivo'


def receber(enviado: UploadedFile | None, finalidade: str, usuario, aceitos: tuple[str, ...] = ('application/pdf',)) -> Arquivo:
    if enviado is None:
        raise DadosInvalidos('Envie o arquivo no campo "arquivo" (multipart/form-data).')
    limite = settings.TAMANHO_MAX_PDF if aceitos == ('application/pdf',) else settings.TAMANHO_MAX_IMAGEM
    if enviado.size > limite:
        raise DadosInvalidos(f'Arquivo grande demais: o máximo é {limite // (1024 * 1024)} MB.')
    cabeca = enviado.read(16)
    enviado.seek(0)
    tipo = _tipo_pelos_bytes(cabeca)
    if tipo not in aceitos:
        esperado = 'PDF' if aceitos == ('application/pdf',) else 'PNG ou JPEG'
        raise DadosInvalidos(f'O arquivo não é um {esperado} válido.')
    h = hashlib.sha256()
    for parte in enviado.chunks():
        h.update(parte)
    enviado.seek(0)
    arq = Arquivo(finalidade=finalidade, nome_original=nome_seguro(enviado.name), tipo_conteudo=tipo,
                  tamanho=enviado.size, sha256=h.hexdigest(), enviado_por=usuario)
    arq.arquivo.save(arq.nome_original, enviado, save=False)
    arq.save()
    return arq


def guardar_bytes(conteudo: bytes, nome: str, finalidade: str, tipo_conteudo: str, usuario) -> Arquivo:
    """Guarda um arquivo gerado pelo próprio sistema (PDF do plano, memorial)."""
    arq = Arquivo(finalidade=finalidade, nome_original=nome_seguro(nome), tipo_conteudo=tipo_conteudo, tamanho=len(conteudo),
                  sha256=hashlib.sha256(conteudo).hexdigest(), enviado_por=usuario if getattr(usuario, 'pk', None) else None)
    arq.arquivo.save(arq.nome_original, ContentFile(conteudo), save=False)
    arq.save()
    return arq


def entregar(arq: Arquivo, baixar: bool = False) -> FileResponse:
    resposta = FileResponse(arq.arquivo.open('rb'), content_type=arq.tipo_conteudo, as_attachment=baixar, filename=arq.nome_original)
    resposta['X-Content-Type-Options'] = 'nosniff'
    return resposta
