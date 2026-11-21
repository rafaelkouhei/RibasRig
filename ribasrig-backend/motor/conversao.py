"""Dicionários em snake_case (formato da API e do cenário) → entidades do motor.

Números entram como Decimal, int, str ou float e são convertidos sem passar por float binário
quando possível (`dec`). Datas entram como `date` ou texto ISO.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from . import entidades as E
from .formatacao import dec


def data(v: Any) -> date | None:
    if v is None or v == '':
        return None
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def guindaste(d: dict) -> E.Guindaste:
    return E.Guindaste(
        id=d['id'], modelo=d['modelo'], a_m=dec(d.get('a_m')), b_m=dec(d.get('b_m')), pg_kgf=dec(d.get('pg_kgf')),
        laudos=[E.Laudo(data(l.get('inicio')), data(l.get('fim')), l.get('art') or '', l.get('arquivo'), bool(l.get('atual')))
                for l in d.get('laudos', [])],
        tabelas=[E.Tabela(str(t['id']), t['nome'], [E.Ponto(dec(p['alcance_m']), dec(p['capacidade_kg'])) for p in t.get('pontos', [])])  # type: ignore[arg-type]
                 for t in d.get('tabelas', [])],
    )


def acessorio(d: dict) -> E.Acessorio:
    return E.Acessorio(
        id=d['id'], descricao=d['descricao'], nome_curto=d.get('nome_curto') or d['descricao'],
        capacidade_t=dec(d.get('capacidade_t')), capacidade_trabalho_t=dec(d.get('capacidade_trabalho_t')),
        unidade_capacidade=d.get('unidade_capacidade') or 't', peso_kg=dec(d.get('peso_kg')) or dec(0),  # type: ignore[arg-type]
        situacao=d['situacao'], proxima_inspecao=data(d.get('proxima_inspecao')), vencimento=data(d.get('vencimento')),
    )


def tipo(d: dict) -> E.TipoIcamento:
    return E.TipoIcamento(id=str(d['id']), balancim=bool(d['balancim']))


def cliente(d: dict) -> E.Cliente:
    return E.Cliente(id=d['id'], razao_social=d['razao_social'], endereco=d.get('endereco') or '')


def dados_plano(d: dict) -> E.DadosPlano:
    obra = d.get('obra') or {}
    carga = d.get('carga') or {}
    disp = d.get('dispositivo') or {}
    dorm = d.get('dormente') or {}
    anexos = d.get('anexos') or {}
    return E.DadosPlano(
        cliente_id=d.get('cliente_id'),
        obra=E.Obra(bool(obra.get('mesmo_endereco_contratante')), obra.get('nome') or '', obra.get('endereco') or '',
                    obra.get('cidade') or '', obra.get('uf') or '', obra.get('cep') or ''),
        data_operacao=data(d.get('data_operacao')), art=d.get('art') or '',
        carga_comprimento_m=dec(carga.get('comprimento_m')), carga_largura_m=dec(carga.get('largura_m')),
        carga_altura_m=dec(carga.get('altura_m')), carga_peso_kg=dec(carga.get('peso_kg')),
        tipo_icamento_id=str(d.get('tipo_icamento_id') or ''),
        lingada=[E.ItemLingada(l['acessorio_id'], dec(l.get('quantidade')), l.get('posicao') or '') for l in d.get('lingada', [])],
        angulo_inferior_graus=dec(d.get('angulo_inferior_graus')), angulo_superior_graus=dec(d.get('angulo_superior_graus')),
        dispositivo_acessorio_id=disp.get('acessorio_id'), dispositivo_quantidade=dec(disp.get('quantidade')),
        dispositivo_peso_unitario_kg=dec(disp.get('peso_unitario_kg')), cargas_extras_kg=dec(d.get('cargas_extras_kg')),
        guindaste_id=d.get('guindaste_id'), tabela_id=d.get('tabela_id'), comprimento_lanca_m=dec(d.get('comprimento_lanca_m')),
        raio_m=dec(d.get('raio_m')),
        guindastes_adicionais=[E.GuindasteAdicional(a['guindaste_id'], a.get('tabela_id'), dec(a.get('raio_m')), dec(a.get('pct')))
                               for a in d.get('guindastes_adicionais', [])],
        vento_max_ms=dec(d.get('vento_max_ms')), raio_isolamento_m=dec(d.get('raio_isolamento_m')),
        dormente_largura_cm=dec(dorm.get('largura_cm')), dormente_comprimento_cm=dec(dorm.get('comprimento_cm')),
        dormente_quantidade=dec(dorm.get('quantidade')),
        anexos=E.Anexos(anexos.get('desenhos'), bool(anexos.get('art_plano')), anexos.get('arquivo_art')),
    )
