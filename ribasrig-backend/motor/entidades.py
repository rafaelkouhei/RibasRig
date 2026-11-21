"""Entradas do motor: cópias simples dos cadastros e do plano, sem Django.

A camada Django monta estes objetos a partir dos models (planos/motor_adapter.py); os testes do
motor montam direto, com os valores do plano 2607036.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

Num = Decimal | None


@dataclass
class Ponto:
    alcance_m: Decimal
    capacidade_kg: Decimal


@dataclass
class Tabela:
    id: str
    nome: str
    pontos: list[Ponto]


@dataclass
class Laudo:
    inicio: date | None
    fim: date | None
    art: str
    arquivo: str | None
    atual: bool


@dataclass
class Guindaste:
    id: int
    modelo: str
    a_m: Num = None
    b_m: Num = None
    pg_kgf: Num = None
    laudos: list[Laudo] = field(default_factory=list)
    tabelas: list[Tabela] = field(default_factory=list)


@dataclass
class Acessorio:
    id: int
    descricao: str
    nome_curto: str
    capacidade_t: Num
    capacidade_trabalho_t: Num
    unidade_capacidade: str  # 't' | 'tf'
    peso_kg: Decimal
    situacao: str  # 'uso' | 'inspecao' | 'descartado' | 'inativo'
    proxima_inspecao: date | None = None
    vencimento: date | None = None


@dataclass
class TipoIcamento:
    id: str
    balancim: bool


@dataclass
class Cliente:
    id: int
    razao_social: str
    endereco: str


@dataclass
class ItemLingada:
    acessorio_id: int
    quantidade: Num
    posicao: str  # 'pernasInferiores' | 'pernasSuperiores' | 'carga' | 'gancho'


@dataclass
class GuindasteAdicional:
    guindaste_id: int
    tabela_id: str | None
    raio_m: Num
    pct: Num


@dataclass
class Obra:
    mesmo_endereco_contratante: bool = False
    nome: str = ''
    endereco: str = ''
    cidade: str = ''
    uf: str = ''
    cep: str = ''


@dataclass
class Anexos:
    desenhos: str | None = None
    art_plano: bool = False
    arquivo_art: str | None = None


@dataclass
class DadosPlano:
    """Mesmos campos de `DadosPlano` (types.ts) que o cálculo usa."""
    cliente_id: int | None = None
    obra: Obra = field(default_factory=Obra)
    data_operacao: date | None = None
    art: str = ''
    carga_comprimento_m: Num = None
    carga_largura_m: Num = None
    carga_altura_m: Num = None
    carga_peso_kg: Num = None
    tipo_icamento_id: str = 't1'
    lingada: list[ItemLingada] = field(default_factory=list)
    angulo_inferior_graus: Num = None
    angulo_superior_graus: Num = None
    dispositivo_acessorio_id: int | None = None
    dispositivo_quantidade: Num = None
    dispositivo_peso_unitario_kg: Num = None
    cargas_extras_kg: Num = None
    guindaste_id: int | None = None
    tabela_id: str | None = None
    comprimento_lanca_m: Num = None
    raio_m: Num = None
    guindastes_adicionais: list[GuindasteAdicional] = field(default_factory=list)
    vento_max_ms: Num = None
    raio_isolamento_m: Num = None
    dormente_largura_cm: Num = None
    dormente_comprimento_cm: Num = None
    dormente_quantidade: Num = None
    anexos: Anexos = field(default_factory=Anexos)
