"""Planilha do carimbo (.xlsx) para o SolidWorks: os dados do plano numa planilha que os desenhos vinculam.

Cada valor tem um nome definido (ex.: ESFORCO_SAPATAS), para o carimbo não depender da posição da célula.
Valores já formatados em pt-BR, com a unidade no rótulo (o problema do "3,17 t" do plano 2607036 era
copiar à mão o número de um campo para outro).
"""
import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.workbook.defined_name import DefinedName

from .contexto import endereco_obra
from .formatos import como_digitado, data_br, f, pct


def montar_carimbo(numero: str, revisao: str, dados: dict, resultados: dict, cliente: dict | None, guindaste: dict | None,
                   responsavel: dict) -> bytes:
    principal = (resultados.get('guindastes') or [{}])[0]
    cap = resultados.get('capacidade_kg')
    linhas = [
        ('NUMERO_PLANO', 'Nº do plano de rigging', numero),
        ('REVISAO', 'Revisão', revisao),
        ('ART', 'Nº da ART do plano', dados.get('art') or ''),
        ('CONTRATANTE', 'Contratante', (cliente or {}).get('razao_social', '')),
        ('LOCAL_OBRA', 'Local da obra', endereco_obra(dados.get('obra') or {}, cliente)),
        ('DATA_OPERACAO', 'Data da operação', data_br(resultados.get('data_operacao') or dados.get('data_operacao'))),
        ('CARGA', 'Carga', (dados.get('carga') or {}).get('descricao', '')),
        ('PESO_CARGA_KG', 'Peso da carga (kg)', como_digitado(resultados.get('carga_kg'))),
        ('CARGA_BRUTA_KG', 'Carga bruta Pb (kg)', f(resultados.get('pb_kg'))),
        ('GUINDASTE', 'Guindaste', (guindaste or {}).get('modelo', '')),
        ('RAIO_M', 'Raio de operação (m)', f(principal.get('raio_m') if principal.get('raio_m') is not None else dados.get('raio_m'), 1)),
        ('CAPACIDADE_RAIO_T', 'Capacidade no raio (t)', f(None if cap is None else cap / 1000)),
        ('TAXA_GUINDASTE', 'Taxa de utilização do guindaste', pct(resultados.get('taxa_guindaste_pct'))),
        ('ESFORCO_SAPATAS_KGF', 'Esforço nas sapatas (kgf)', f(resultados['sapatas'].get('esforco_kgf'))),
        ('RMET_KGF_CM2', 'Resistência mínima do terreno (kgf/cm²)', f(resultados['sapatas'].get('rmet'))),
        ('RAIO_ISOLAMENTO_M', 'Raio de isolamento (m)', f(resultados.get('raio_isolamento_m'), 1)),
        ('RESPONSAVEL', 'Responsável técnico', responsavel.get('nome_assinatura', '')),
        ('CREA', 'CREA', responsavel.get('crea', '')),
    ]
    wb = Workbook()
    ws = wb.active
    ws.title = 'Carimbo'
    ws.append(['Nome', 'Campo', 'Valor'])
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='34446A')
    for i, (nome, rotulo, valor) in enumerate(linhas, start=2):
        ws.append([nome, rotulo, valor])
        ws.cell(i, 3).alignment = Alignment(horizontal='left')
        wb.defined_names[nome] = DefinedName(nome, attr_text=f'Carimbo!$C${i}')
    ws.column_dimensions['A'].width = 22
    ws.column_dimensions['B'].width = 40
    ws.column_dimensions['C'].width = 60
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
