"""Erros sempre como {"detail": "mensagem"} com o status certo (combinado com o front):
400 dados inválidos · 401 login · 403 sem permissão · 404 não encontrado · 409 conflito · 422 regra de negócio ·
429 tentativas demais · 500 erro inesperado (detalhe só no log do servidor).
"""
import math

from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import APIException, Throttled, ValidationError
from rest_framework.views import exception_handler


class Conflito(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Conflito com o estado atual.'


class RegraNegocio(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = 'Regra de negócio não atendida.'


class LoginRecusado(APIException):
    """401 nas rotas de login/troca de senha. (AuthenticationFailed do DRF vira 403 em views sem
    autenticador, porque não há cabeçalho WWW-Authenticate.)"""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Usuário ou senha incorretos.'


class DadosInvalidos(APIException):
    """400 com mensagem simples (sem o dicionário de campos do ValidationError)."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Dados inválidos.'


def _primeira_mensagem(dados, caminho: str = '') -> str | None:
    if isinstance(dados, (list, tuple)):
        for i, x in enumerate(dados):
            m = _primeira_mensagem(x, caminho if not isinstance(x, (dict, list)) else f'{caminho}[{i}]')
            if m:
                return m
        return None
    if isinstance(dados, dict):
        for k, v in dados.items():
            sub = caminho if k in ('non_field_errors', 'detail') else (f'{caminho}.{k}' if caminho else str(k))
            m = _primeira_mensagem(v, sub)
            if m:
                return m
        return None
    texto = str(dados)
    return f'{caminho}: {texto}' if caminho else texto


def tratar_excecao(exc, context):
    resposta = exception_handler(exc, context)
    if resposta is None:
        return None
    dados = resposta.data
    if isinstance(exc, Throttled):
        # A tradução do DRF deixa metade em inglês ("Pedido foi limitado. Expected available in 57 seconds.")
        espera = f'{math.ceil(exc.wait)} segundos' if exc.wait else 'um pouco'
        resposta.data = {'detail': f'Muitas tentativas seguidas. Aguarde {espera} e tente de novo.'}
    elif isinstance(exc, ValidationError):
        resposta.data = {'detail': _primeira_mensagem(dados) or 'Dados inválidos.', 'erros': dados}
    elif not (isinstance(dados, dict) and 'detail' in dados):
        resposta.data = {'detail': _primeira_mensagem(dados) or 'Erro.'}
    return resposta


# Fora das views do DRF (URL que não existe, exceção não tratada), o Django responderia com uma página HTML.
# Estes dois mantêm o mesmo formato {"detail"} (config/urls.py: handler404 e handler500).

def nao_encontrado(request, exception=None) -> JsonResponse:
    return JsonResponse({'detail': 'Endereço não encontrado.'}, status=404, json_dumps_params={'ensure_ascii': False})


def erro_interno(request) -> JsonResponse:
    return JsonResponse({'detail': 'Erro interno do servidor. Tente de novo; se continuar, avise o administrador.'}, status=500,
                        json_dumps_params={'ensure_ascii': False})
