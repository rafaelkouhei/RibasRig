"""Cenário de exemplo (o mesmo de ribasrig-frontend/src/data/mock.ts), como dados simples em snake_case.

Usado pelo comando `python manage.py carregar_exemplo` e pelos testes do motor. "Hoje" no cenário
é 07/10/2026. A Rev. 2 do 2607036 NÃO está aqui: é calculada pelo motor ao carregar.
"""

HOJE = '2026-10-07'

# =============================================================================================
# Guindastes
# =============================================================================================

PONTOS_MD45007 = [
    ('4.18', '10900'), ('5.98', '7300'), ('7.83', '5200'), ('9.68', '3900'),
    ('11.53', '3300'), ('13.46', '1900'), ('15.46', '1200'), ('17.51', '900'),
]


def _sem_dados(id_: int, modelo: str) -> dict:
    return {
        'id': id_, 'modelo': modelo, 'codigo': ''.join(c for c in modelo if c.isalnum()), 'veiculo': '', 'placa': '', 'chassi': '',
        'ano': None, 'capacidade_nominal_t': None, 'comprimento_lanca_m': None, 'a_m': None, 'b_m': None, 'pg_kgf': None,
        'laudos': [], 'tabelas': [], 'dados_pendentes': True, 'ativo': True,
    }


GUINDASTES = [
    {
        'id': 1, 'modelo': 'Palfinger MD 45.007', 'codigo': 'MD45007', 'veiculo': 'Volvo/VM 270 6X2R', 'placa': 'IUL8A16',
        'chassi': '93KP0R1C7DE141594', 'ano': 2013, 'capacidade_nominal_t': '45', 'comprimento_lanca_m': '5.1',
        'a_m': '2.95', 'b_m': '5.7', 'pg_kgf': '11550',
        'laudos': [{'inicio': '2026-04-06', 'fim': '2026-10-06', 'art': '1720261926954', 'arquivo': 'Laudo_MD45007.pdf', 'atual': True}],
        'tabelas': [{'id': 'lp8', 'nome': 'lança principal', 'pontos': [{'alcance_m': a, 'capacidade_kg': c} for a, c in PONTOS_MD45007]}],
        'dados_pendentes': False, 'ativo': True,
    },
    # A empresa ainda não forneceu os dados destes (marcadores [XXX] nas telas são legítimos)
    _sem_dados(2, 'MD 55'), _sem_dados(3, 'DM 130'), _sem_dados(4, 'MD 300L'),
]

# =============================================================================================
# Padrões de inspeção (src/domain/inspecao.ts)
# =============================================================================================

_A_VALIDAR = 'Itens iniciais levantados pela equipe nas normas, a validar pelo engenheiro responsável.'

PADROES_INSPECAO = [
    {'tipo': 'cinta', 'atualizado_em': None,
     'referencia': f'ABNT NBR 15637-1 (cintas planas), Anexo A: inspeção e descarte; manual do fabricante. {_A_VALIDAR}',
     'itens': [
         'Etiqueta presente e legível (capacidade, comprimento, material, fabricante)',
         'Fita sem cortes, rasgos ou furos',
         'Sem desgaste por abrasão nas bordas e na superfície',
         'Sem queimadura, parte derretida ou endurecida (calor ou atrito)',
         'Sem dano por produto químico ou ressecamento pelo sol',
         'Costuras íntegras, sem fios rompidos ou soltos',
         'Olhais sem desgaste, rasgo ou deformação',
         'Sem nós',
     ]},
    {'tipo': 'tubular', 'atualizado_em': None,
     'referencia': f'ABNT NBR 15637-2 (cintas tubulares); manual do fabricante. {_A_VALIDAR}',
     'itens': [
         'Etiqueta presente e legível (capacidade, comprimento, material, fabricante)',
         'Capa sem cortes, furos ou desgaste que deixe os fios internos à mostra',
         'Sem queimadura ou parte derretida',
         'Sem dano por produto químico ou ressecamento pelo sol',
         'Costura de união da capa íntegra',
         'Sem nós, caroços ou partes achatadas (sinal de fio interno rompido)',
     ]},
    {'tipo': 'manilha', 'atualizado_em': None,
     'referencia': f'Manual do fabricante (limites de desgaste e de abertura); ASME B30.26 como referência; NR-11 para o uso. {_A_VALIDAR}',
     'itens': [
         'Carga de trabalho (CMT/WLL) e fabricante gravados e legíveis',
         'Corpo sem trincas, entalhes ou marcas de solda',
         'Corpo sem deformação, torção ou abertura além do limite do fabricante',
         'Pino original da manilha, reto, com rosca sem dano, encaixando e travando por completo',
         'Desgaste do corpo e do pino dentro do limite do fabricante',
         'Sem corrosão que reduza a seção e sem sinais de superaquecimento',
     ]},
    {'tipo': 'laco', 'atualizado_em': None,
     'referencia': f'ABNT NBR 13541-2 (lingas de cabo de aço: utilização e inspeção); ABNT NBR ISO 4309 (inspeção e descarte de cabos de aço); manual do fabricante. {_A_VALIDAR}',
     'itens': [
         'Plaqueta de identificação presente e legível',
         'Arames rompidos dentro do limite da norma',
         'Sem amassamento, dobra permanente, nó ou "gaiola de passarinho"',
         'Sem corrosão severa nem redução de diâmetro além do limite',
         'Olhais e luva prensada sem trinca, deformação ou deslizamento do cabo',
         'Sem sinais de calor, arco elétrico ou respingo de solda',
     ]},
    {'tipo': 'dispositivo', 'atualizado_em': None,
     'referencia': f'Projeto e manual do fabricante do dispositivo. {_A_VALIDAR}',
     'itens': [
         'Identificação e capacidade gravadas e legíveis',
         'Estrutura sem trincas, deformação ou corrosão severa',
         'Soldas íntegras',
         'Olhais, furos e pinos sem desgaste ou ovalização',
     ]},
]

# =============================================================================================
# Acessórios
# =============================================================================================


def _uso_no_2607036(un: int, fem: bool) -> list[dict]:
    u = 'Usada' if fem else 'Usado'
    q = f' ({un} un.)' if un else ''
    return [
        {'data': '2026-10-07', 'descricao': f'{u} no plano 2607036 Rev. 2, emitido no sistema{q}'},
        {'data': '2026-07-24', 'descricao': f'{u} no plano 2607036 Rev. 1, emitido no Excel e cadastrado no sistema em 07/10/2026{q}'},
    ]


_SEM_CONTROLE = {'data_entrada': None, 'certificado': '', 'certificado_arquivo': None, 'vencimento': None, 'motivo_descarte': '', 'inspecoes': []}
_ITENS_TUBULAR = next(p['itens'] for p in PADROES_INSPECAO if p['tipo'] == 'tubular')

ACESSORIOS = [
    {'id': 1, 'tipo': 'cinta', 'descricao': 'Cinta plana 3 m · 6 t', 'nome_curto': 'cinta plana 3 m', 'medida': '3 m', 'norma': '',
     'capacidade_t': '6', 'capacidade_trabalho_t': '4.2', 'unidade_capacidade': 't', 'peso_kg': '4.87', 'situacao': 'uso',
     'ultima_inspecao': '2026-04-20', 'proxima_inspecao': '2026-10-20', 'planos': ['2607036'], **_SEM_CONTROLE,
     'historico': [*_uso_no_2607036(4, True), {'data': '2026-04-20', 'descricao': 'Inspeção periódica: aprovada'}]},
    {'id': 2, 'tipo': 'cinta', 'descricao': 'Cinta plana 4 m · 6 t', 'nome_curto': 'cinta plana 4 m', 'medida': '4 m', 'norma': '',
     'capacidade_t': '6', 'capacidade_trabalho_t': '4.2', 'unidade_capacidade': 't', 'peso_kg': '5.97', 'situacao': 'uso',
     'ultima_inspecao': '2026-07-15', 'proxima_inspecao': '2027-01-15', 'planos': ['2607036'], **_SEM_CONTROLE,
     'historico': [*_uso_no_2607036(2, True), {'data': '2026-07-15', 'descricao': 'Inspeção periódica: aprovada'}]},
    {'id': 3, 'tipo': 'manilha', 'descricao': 'Manilha curva 7/8" com pino roscado', 'nome_curto': 'manilha 7/8"', 'medida': '7/8"',
     'norma': 'Grau 6 · FS 6:1', 'capacidade_t': '5.5', 'capacidade_trabalho_t': '5.5', 'unidade_capacidade': 'tf', 'peso_kg': '1.7',
     'situacao': 'uso', 'ultima_inspecao': '2026-06-01', 'proxima_inspecao': '2026-12-01', 'planos': ['2607036'], **_SEM_CONTROLE,
     'historico': [*_uso_no_2607036(6, True), {'data': '2026-06-01', 'descricao': 'Inspeção periódica: aprovada'}]},
    {'id': 4, 'tipo': 'manilha', 'descricao': 'Manilha curva 1" com pino roscado', 'nome_curto': 'manilha 1"', 'medida': '1"',
     'norma': 'Grau 6 · FS 6:1', 'capacidade_t': '7.2', 'capacidade_trabalho_t': '7.2', 'unidade_capacidade': 'tf', 'peso_kg': '2.5',
     'situacao': 'uso', 'ultima_inspecao': '2026-06-01', 'proxima_inspecao': '2026-12-01', 'planos': ['2607036'], **_SEM_CONTROLE,
     'historico': [*_uso_no_2607036(2, True), {'data': '2026-06-01', 'descricao': 'Inspeção periódica: aprovada'}]},
    {'id': 5, 'tipo': 'dispositivo', 'descricao': 'Balancim', 'nome_curto': 'balancim', 'medida': '', 'norma': '',
     'capacidade_t': None, 'capacidade_trabalho_t': None, 'unidade_capacidade': 't', 'peso_kg': '250', 'situacao': 'uso',
     'ultima_inspecao': '2026-02-10', 'proxima_inspecao': '2027-02-10', 'planos': ['2607036'], **_SEM_CONTROLE,
     'historico': [*_uso_no_2607036(0, False), {'data': '2026-02-10', 'descricao': 'Inspeção anual: aprovado'}]},
    {'id': 6, 'tipo': 'cinta', 'descricao': 'Cinta plana 3 m · 6 t (lote 2023)', 'nome_curto': 'cinta plana 3 m (lote 2023)', 'medida': '3 m',
     'norma': '', 'capacidade_t': '6', 'capacidade_trabalho_t': '4.2', 'unidade_capacidade': 't', 'peso_kg': '4.87',
     'situacao': 'descartado', 'ultima_inspecao': '2026-05-05', 'proxima_inspecao': None, 'planos': [], **_SEM_CONTROLE,
     'motivo_descarte': 'Costura desgastada',
     'historico': [{'data': '2026-05-05', 'descricao': 'Descartada na inspeção: costura desgastada'},
                   {'data': '2025-11-10', 'descricao': 'Inspeção periódica: aprovada'}]},
    # Exemplo do próprio engenheiro (áudio de 08/10/2026). Datas, certificado e peso são de demonstração.
    {'id': 7, 'tipo': 'tubular', 'descricao': 'Cinta tubular 3 m · 3 t (exemplo)', 'nome_curto': 'cinta tubular 3 m (exemplo)',
     'medida': '3 m', 'norma': '', 'capacidade_t': '3', 'capacidade_trabalho_t': None, 'unidade_capacidade': 't', 'peso_kg': '1.5',
     'situacao': 'uso', 'ultima_inspecao': '2026-09-15', 'proxima_inspecao': '2027-03-15', 'planos': [],
     'data_entrada': '2025-03-10', 'certificado': 'EXEMPLO-001', 'certificado_arquivo': 'Certificado_cinta_tubular_3t_exemplo.pdf',
     'vencimento': '2026-10-30', 'motivo_descarte': '',
     'inspecoes': [{'data': '2026-09-15', 'responsavel': 'Rigger de campo (exemplo)', 'resultado': 'aprovado', 'observacao': '',
                    'proxima': '2027-03-15', 'itens': [{'texto': t, 'conforme': True} for t in _ITENS_TUBULAR]}],
     'historico': [
         {'data': '2026-09-15', 'descricao': 'Inspeção pelo padrão por Rigger de campo (exemplo): aprovada (6 de 6 itens conformes); próxima em 15/03/2027'},
         {'data': '2025-03-10', 'descricao': 'Cadastrado no sistema'},
     ]},
]

# =============================================================================================
# Clientes
# =============================================================================================

CLIENTES = [
    {'id': 1, 'razao_social': 'Kaefer Rip Serviços Industriais Ltda.', 'nome_pasta': 'Kaefer Rip', 'cnpj': '07.522.191/0048-64',
     'endereco': 'Rod. Engenheiro Ermênio de Oliveira Penteado, 57 – Helvetia', 'cidade': 'Indaiatuba', 'uf': 'SP', 'cep': '13337-300',
     'locais_obra': [{'nome': 'Bosch', 'endereco': 'Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial', 'cidade': 'Curitiba', 'uf': 'PR', 'cep': '81460-000'}],
     'contato': '', 'telefone': '', 'email': '', 'exemplo': False},
    {'id': 2, 'razao_social': 'Volvo do Brasil', 'nome_pasta': 'Volvo', 'cnpj': '', 'endereco': '', 'cidade': '', 'uf': '', 'cep': '',
     'locais_obra': [], 'contato': '', 'telefone': '', 'email': '', 'exemplo': True},
    {'id': 3, 'razao_social': 'Renault do Brasil', 'nome_pasta': 'Renault', 'cnpj': '', 'endereco': '', 'cidade': '', 'uf': '', 'cep': '',
     'locais_obra': [], 'contato': '', 'telefone': '', 'email': '', 'exemplo': True},
]

# =============================================================================================
# Usuários (sem senha: a senha de teste vem do ambiente, nunca do repositório) e configurações
# =============================================================================================

USUARIOS = [
    {'nome': 'Giuliano Breda', 'usuario': 'giuliano.breda', 'perfil': 'admin', 'principal': True,
     'observacao': 'Administrador principal · responsável técnico'},
    {'nome': 'Rigger de campo (exemplo)', 'usuario': 'rigger.campo', 'perfil': 'operacao', 'principal': False,
     'observacao': 'Usuário de exemplo'},
]

CONFIGURACOES = {
    'pasta_raiz': 'C:\\Guindastes Ribas\\Planos de Rigging',
    'nome_arquivo': 'Plano_de_Rigging_{nº}_Rev{rev}.pdf',
    'empresa': {'razao_social': 'Guindastes Ribas Ltda.', 'cnpj': '81.076.242/0001-60', 'ie': '10171012-22',
                'endereco': 'Rua Justo Manfron, 2845 G, Santa Felicidade, Curitiba/PR', 'cep': '82.410-540'},
    'responsavel': {'nome_completo': 'Giuliano Cesar Breda de Souza', 'nome_assinatura': 'Giuliano Breda', 'titulo': 'Engenheiro Mecânico',
                    'crea': 'CREA-PR 78755/D', 'rnp': '1701211920', 'rpp': 'RPP-23-1040', 'assinatura': 'digitalizada'},
    'aviso_atencao_pct': '75',
    'vento_padrao_ms': '7',
}

# =============================================================================================
# Regras de cálculo e tipos de içamento (src/domain/regras.ts)
# =============================================================================================


def _v(simbolo: str, nome: str, unidade: str, origem: str, teste: str = '') -> dict:
    return {'simbolo': simbolo, 'nome': nome, 'unidade': unidade, 'origem': origem, 'teste': teste}


def _regra(origem: str, **d) -> dict:
    sistema = origem == 'sistema'
    base = {
        'limite': False, 'origem_capacidade': None, 'capacidade_teste': '', 'no_resumo': True, 'no_memorial': True,
        'automatica': sistema, 'origem': origem, 'autor': 'Sistema RibasRig' if sistema else 'Equipe RibasRig', 'versao': 1,
        'planos': ['2607036'] if sistema else [],
    }
    base.update(d)
    base['versoes'] = [{'versao': 1, 'formula': base['formula'], 'variaveis': base['variaveis'], 'salva_em': '2026-10-07', 'autor': base['autor']}]
    return base


REGRAS = [
    _regra('sistema', id='r1', nome='Carga bruta', categoria='Carga', descricao='Soma da carga líquida com lingada, dispositivos e cargas extras.',
           formula='P + L + D + E', resultado_nome='Pb', resultado_unidade='kg',
           variaveis=[_v('P', 'Peso da carga', 'kg', 'Peso da carga (kg)', '3450'), _v('L', 'Peso da lingada', 'kg', 'Lingada (kg)', '46,62'),
                      _v('D', 'Dispositivos / balancim', 'kg', 'Dispositivos/balancim (kg)', '250'), _v('E', 'Cargas extras', 'kg', 'Cargas extras (kg)', '0')]),
    _regra('sistema', id='r2', nome='Capacidade no raio (interpolação)', categoria='Guindaste',
           descricao='Interpolação linear entre os dois pontos do gráfico de carga do fabricante mais próximos do raio.',
           formula='C1 + (r - r1) * (C2 - C1) / (r2 - r1)', resultado_nome='C', resultado_unidade='kg',
           variaveis=[_v('r', 'Raio de operação', 'm', 'Raio de operação (m)', '5'), _v('r1', 'Raio do ponto anterior', 'm', 'Tabela: raio anterior (m)', '4,18'),
                      _v('r2', 'Raio do ponto posterior', 'm', 'Tabela: raio posterior (m)', '5,98'),
                      _v('C1', 'Capacidade no ponto anterior', 'kg', 'Tabela: capacidade anterior (kg)', '10900'),
                      _v('C2', 'Capacidade no ponto posterior', 'kg', 'Tabela: capacidade posterior (kg)', '7300')]),
    _regra('sistema', id='r9', nome='Taxa de utilização do guindaste', categoria='Guindaste',
           descricao='Compara a carga bruta (Pb) com a capacidade do guindaste no raio de operação. Taxa = Pb ÷ capacidade no raio; acima de 85% o plano fica bloqueado.',
           formula='Pb', resultado_nome='Pb', resultado_unidade='kg', limite=True,
           origem_capacidade='Capacidade do guindaste no raio (kg)', capacidade_teste='9.260',
           variaveis=[_v('Pb', 'Carga bruta', 'kg', 'Resultado: carga bruta (kg)')]),
    _regra('sistema', id='r3', nome='Tração na cinta · pernas inferiores', categoria='Lingada',
           descricao='Configuração com balancim: 4 pernas entre a carga e o balancim.', formula='P / (2 * cos(a))', resultado_nome='Te', resultado_unidade='t',
           limite=True, origem_capacidade='Capacidade de trabalho da cinta · pernas inferiores (t)', capacidade_teste='4,2',
           variaveis=[_v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), _v('a', 'Ângulo das pernas inferiores', '°', 'Ângulo pernas inferiores (°)', '28')]),
    _regra('sistema', id='r4', nome='Tração na cinta · pernas superiores', categoria='Lingada',
           descricao='Configuração com balancim: 2 pernas entre o balancim e o gancho.', formula='(P + B) / (2 * cos(a))', resultado_nome='Te', resultado_unidade='t',
           limite=True, origem_capacidade='Capacidade de trabalho da cinta · pernas superiores (t)', capacidade_teste='4,2',
           variaveis=[_v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), _v('B', 'Peso do balancim', 't', 'Dispositivos/balancim (t)', '0,25'),
                      _v('a', 'Ângulo das pernas superiores', '°', 'Ângulo pernas superiores (°)', '41')]),
    _regra('sistema', id='r5', nome='Esforço na manilha da carga', categoria='Lingada', descricao='Manilha entre a carga e o balancim (4 pontos).',
           formula='P / (4 * cos(a))', resultado_nome='F', resultado_unidade='tf',
           limite=True, origem_capacidade='Capacidade de trabalho da manilha da carga (tf)', capacidade_teste='5,5',
           variaveis=[_v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), _v('a', 'Ângulo das pernas inferiores', '°', 'Ângulo pernas inferiores (°)', '28')]),
    _regra('sistema', id='r8', nome='Esforço na manilha do gancho', categoria='Lingada',
           descricao='Manilha que liga as 2 pernas superiores ao gancho: recebe as duas pernas, F = 2 · Te superior.',
           formula='2 * Te', resultado_nome='F', resultado_unidade='tf',
           limite=True, origem_capacidade='Capacidade de trabalho da manilha do gancho (tf)', capacidade_teste='7,2',
           variaveis=[_v('Te', 'Tração em cada perna superior', 't', 'Resultado: tração nas pernas superiores (t)')]),
    _regra('sistema', id='r6', nome='Esforço nas sapatas', categoria='Sapatas e terreno',
           descricao='Metade do peso do conjunto mais a força causada pelo momento da carga.', formula='Pg / 2 + Pb * R / (a + b)',
           resultado_nome='ES', resultado_unidade='kgf',
           variaveis=[_v('Pg', 'Peso do guindaste + caminhão', 'kgf', 'Peso do guindaste Pg (kgf)', '11550'), _v('Pb', 'Carga bruta', 'kg', 'Resultado: carga bruta (kg)'),
                      _v('R', 'Raio de operação', 'm', 'Raio de operação (m)', '5'), _v('a', 'Eixo da coluna até a sapata', 'm', 'Distância a (m)', '2,95'),
                      _v('b', 'Abertura entre sapatas', 'm', 'Abertura b (m)', '5,7')]),
    _regra('sistema', id='r7', nome='Resistência mínima do terreno (RMET)', categoria='Sapatas e terreno',
           descricao='Esforço na sapata dividido pela área de apoio dos dormentes.', formula='ES / (LD * CD * ND)',
           resultado_nome='RMET', resultado_unidade='kgf/cm²',
           variaveis=[_v('ES', 'Esforço nas sapatas', 'kgf', 'Resultado: esforço nas sapatas (kgf)'), _v('LD', 'Largura do dormente', 'cm', 'Largura do dormente (cm)', '50'),
                      _v('CD', 'Comprimento do dormente', 'cm', 'Comprimento do dormente (cm)', '50'), _v('ND', 'Dormentes por sapata', '', 'Dormentes por sapata', '1')]),
    _regra('exemplo', id='u1', nome='Tração · 2 pernas sem balancim', categoria='Lingada',
           descricao='Exemplo (fictício) da equipe RibasRig: içamento sem balancim, 2 pernas direto no gancho. O ângulo e a capacidade vêm do plano.',
           formula='P / (2 * cos(a))', resultado_nome='Te', resultado_unidade='t',
           limite=True, origem_capacidade='Capacidade de trabalho do acessório escolhido (t)', capacidade_teste='4,2',
           variaveis=[_v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), _v('a', 'Ângulo das pernas', '°', 'Ângulo das pernas (°)', '28')]),
    _regra('exemplo', id='u2', nome='Carga com fator dinâmico', categoria='Carga',
           descricao='Exemplo (fictício) da equipe RibasRig: carga bruta multiplicada por um fator para movimentos bruscos.',
           formula='Pb * f', resultado_nome='Pd', resultado_unidade='kg',
           limite=True, origem_capacidade='Capacidade do guindaste no raio (kg)', capacidade_teste='9.260',
           variaveis=[_v('Pb', 'Carga bruta', 'kg', 'Resultado: carga bruta (kg)'), _v('f', 'Fator dinâmico', '', 'Valor fixo', '1,1')]),
]

_REGRAS_BASE = ['r1', 'r2', 'r9', 'r6', 'r7']

TIPOS_ICAMENTO = [
    {'id': 't1', 'nome': 'Balancim · 4 pernas + 2 superiores', 'origem': 'sistema', 'autor': 'Sistema RibasRig', 'versao': 1, 'planos': ['2607036'],
     'descricao': 'Cargas largas, como o chiller do plano 2607036: o balancim abre as pernas e reduz o ângulo.',
     'balancim': True, 'pernas': 4, 'pernas_superiores': 2,
     'campos': {'angulo_inferior': True, 'angulo_superior': True, 'angulo_unico': False, 'peso_balancim': True, 'capacidade_laco': False},
     'regras': [*_REGRAS_BASE, 'r3', 'r4', 'r5', 'r8'], 'acessorios_sugeridos': 'Cinta plana 3 m, cinta plana 4 m, manilha 7/8", manilha 1", balancim',
     'geometria': 'GEOMETRIA DA LINGADA (BALANCIM · 4 PERNAS INFERIORES · 2 SUPERIORES)', 'aviso_sem_acessorio': None},
    {'id': 't2', 'nome': 'Sem balancim · 2 pernas', 'origem': 'exemplo', 'autor': 'Equipe RibasRig', 'versao': 1, 'planos': [],
     'descricao': 'Exemplo (fictício) da equipe RibasRig: cargas compactas, içadas direto no gancho.',
     'balancim': False, 'pernas': 2, 'pernas_superiores': 0,
     'campos': {'angulo_inferior': False, 'angulo_superior': False, 'angulo_unico': True, 'peso_balancim': False, 'capacidade_laco': False},
     'regras': [*_REGRAS_BASE, 'u1'], 'acessorios_sugeridos': 'Cinta plana, manilha',
     'geometria': 'GEOMETRIA DA LINGADA (SEM BALANCIM · 2 PERNAS)', 'aviso_sem_acessorio': None},
    {'id': 't3', 'nome': 'Laço de cabo de aço · 2 pernas', 'origem': 'exemplo', 'autor': 'Equipe RibasRig', 'versao': 1, 'planos': [],
     'descricao': 'Exemplo (fictício) da equipe RibasRig: içamento com laço de cabo de aço, sem balancim.',
     'balancim': False, 'pernas': 2, 'pernas_superiores': 0,
     'campos': {'angulo_inferior': False, 'angulo_superior': False, 'angulo_unico': True, 'peso_balancim': False, 'capacidade_laco': True},
     'regras': [*_REGRAS_BASE, 'u1'], 'acessorios_sugeridos': 'Laço de cabo de aço, manilha',
     'geometria': 'GEOMETRIA DA LINGADA (LAÇO DE CABO DE AÇO · 2 PERNAS)',
     'aviso_sem_acessorio': 'Não há laço de cabo de aço cadastrado em Acessórios; o tipo não pode ser usado até haver um.'},
]

# =============================================================================================
# Planos
# =============================================================================================

LINGADA_CHILLER = [
    {'acessorio_id': 1, 'quantidade': '4', 'posicao': 'pernasInferiores'},
    {'acessorio_id': 3, 'quantidade': '6', 'posicao': 'carga'},
    {'acessorio_id': 2, 'quantidade': '2', 'posicao': 'pernasSuperiores'},
    {'acessorio_id': 4, 'quantidade': '2', 'posicao': 'gancho'},
]

OBRA_BOSCH = {'mesmo_endereco_contratante': False, 'nome': 'Bosch', 'endereco': 'Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial',
              'cidade': 'Curitiba', 'uf': 'PR', 'cep': '81460-000'}

DADOS_2607036 = {
    'cliente_id': 1, 'obra': dict(OBRA_BOSCH),
    'data_operacao': '2026-07-24', 'descricao_operacao': 'Içamento de chiller — movimentação de equipamento na Bosch',
    'rigger': 'Giuliano Breda — RPP-23-1040', 'art': '1720264496217', 'art_registrada_em': '2026-07-24T18:19',
    'contrato_art': {'numero': '', 'celebrado_em': '2026-07-24', 'valor': '2.700,00', 'termino': '2026-08-24'},
    'carga': {'descricao': 'Chiller', 'comprimento_m': '4.7', 'largura_m': '1.95', 'altura_m': '2.3', 'peso_kg': '3450'},
    'tipo_icamento_id': 't1', 'lingada': [dict(x) for x in LINGADA_CHILLER], 'angulo_inferior_graus': '28', 'angulo_superior_graus': '41',
    'dispositivo': {'acessorio_id': 5, 'descricao': 'Balancim', 'quantidade': '1', 'peso_unitario_kg': '250'}, 'cargas_extras_kg': '0',
    'guindaste_id': 1, 'tabela_id': 'lp8', 'comprimento_lanca_m': '5.1', 'raio_m': '5.0', 'guindastes_adicionais': [],
    'quadrante_inicial': 'Lateral', 'quadrante_final': 'Lateral', 'vento_max_ms': '7', 'raio_isolamento_m': '7',
    'dormente': {'largura_cm': '50', 'comprimento_cm': '50', 'quantidade': '1'},
    'anexos': {'desenhos': 'Desenhos_2607036.pdf', 'art_plano': True, 'arquivo_art': 'ART_1720264496217.pdf'},
    'etapa_atual': 6, 'copia_de': None, 'exemplo': False,
}

RESULTADOS_REV1_EXCEL = {
    'data_operacao': '2026-07-24', 'carga_kg': 3450, 'lingada_kg': None, 'dispositivos_kg': None, 'extras_kg': None, 'pb_kg': 3747,
    'guindastes': [{'guindaste_id': 1, 'modelo': 'Palfinger MD 45.007', 'tabela_nome': None, 'raio_m': 5, 'pct_carga': 100, 'carga_kg': 3747,
                    'capacidade_kg': 7948, 'taxa_pct': 47.1, 'laudo_fim': '2026-10-06', 'laudo_art': '1720261926954'}],
    'capacidade_kg': 7948, 'taxa_guindaste_pct': 47.1, 'referencia_conservadora_kg': None, 'taxa_referencia_pct': None,
    'posicoes': [
        {'posicao': 'pernasInferiores', 'acessorio_id': 1, 'descricao': 'Cinta plana 3 m · 6 t', 'angulo_graus': 28, 'tracao': None, 'unidade': 't', 'capacidade': 4.2, 'taxa_pct': None},
        {'posicao': 'pernasSuperiores', 'acessorio_id': 2, 'descricao': 'Cinta plana 4 m · 6 t', 'angulo_graus': 41, 'tracao': 2.5, 'unidade': 't', 'capacidade': 4.2, 'taxa_pct': 60.0},
        {'posicao': 'carga', 'acessorio_id': 3, 'descricao': 'Manilha curva 7/8" com pino roscado', 'angulo_graus': 28, 'tracao': None, 'unidade': 'tf', 'capacidade': 5.5, 'taxa_pct': None},
        {'posicao': 'gancho', 'acessorio_id': 4, 'descricao': 'Manilha curva 1" com pino roscado', 'angulo_graus': 41, 'tracao': 5.0, 'unidade': 'tf', 'capacidade': 7.2, 'taxa_pct': 70.0},
    ],
    'sapatas': {'momento_kgfm': None, 'forca_kgf': None, 'esforco_kgf': 7914, 'area_cm2': 2500, 'rmet': 3.17},
    'raio_isolamento_m': 7, 'vento_max_ms': 7, 'situacao_seguranca': 'ok',
    'como_no_documento': {'liq': '3450', 'pb': '3747', 'pb_t': '3,75', 'cap': '7,95', 'cap_carga': '7,9', 'taxa': '47,1', 'cinta': '60,0',
                          'manilha': '70,0', 'es': '7914', 'rmet': '3,17'},
}

OBS_REV1 = ('Emitida em 24/07/2026 no Excel, antes do sistema, e guardada como foi entregue. A capacidade saiu 7.948 kg porque a '
            'interpolação não dividiu pela distância entre 4,18 m e 5,98 m (o certo é 9.260 kg); a taxa do guindaste herdou esse erro. '
            'As sapatas deram 7.914 kgf porque o Excel não somou a lingada (46,62 kg) na carga. Cinta e manilha saíram 60% e 70% porque '
            'a tração foi arredondada para 2,5 t antes de dividir.')
OBS_REV2 = ('Recalculada pelo sistema em 07/10/2026 com interpolação do gráfico de carga do MD 45.007 (lança principal, 8 extensões). '
            'Nada foi arredondado antes do cálculo. Laudo do guindaste válido na data da operação (24/07/2026).')


def _copia(d: dict, **mudancas) -> dict:
    import copy
    novo = copy.deepcopy(d)
    novo.update(mudancas)
    return novo


PLANOS = [
    {**_copia(DADOS_2607036), 'id': 1, 'numero': '2607036', 'situacao_documento': 'emitido',
     'criado_em': '2026-07-24', 'criado_por': 'Giuliano Breda', 'atualizado_em': '2026-10-07T09:40',
     'revisoes': [
         {'numero': 1, 'origem': 'excel', 'emitida_em': '2026-07-24', 'emitida_por': 'Giuliano Breda', 'cadastrada_em': '2026-10-07T09:12',
          'arquivo_pdf': 'Plano_de_Rigging_2607036_Rev1.pdf', 'observacao': OBS_REV1, 'resultados': RESULTADOS_REV1_EXCEL},
         # Rev. 2: resultados calculados pelo motor ao carregar
         {'numero': 2, 'origem': 'sistema', 'emitida_em': '2026-10-07T09:40', 'emitida_por': 'Giuliano Breda', 'cadastrada_em': None,
          'arquivo_pdf': 'Plano_de_Rigging_2607036_Rev2.pdf', 'observacao': OBS_REV2, 'resultados': None},
     ]},
    # Cópia do 2607036 para uma nova operação. Parou na etapa 4. Bloqueado: laudo do MD 45.007 venceu em 06/10/2026.
    _copia(DADOS_2607036, id=2, numero='2610001', situacao_documento='rascunho', revisoes=[],
           criado_em='2026-10-07T14:12', criado_por='Giuliano Breda', atualizado_em='2026-10-07T14:12',
           data_operacao='2026-10-15', art='', art_registrada_em=None,
           contrato_art={'numero': '', 'celebrado_em': '2026-07-24', 'valor': '2.700,00', 'termino': None},
           anexos={'desenhos': None, 'art_plano': False, 'arquivo_art': None}, etapa_atual=4, copia_de='2607036'),
    # Exemplo (fictício): prensa de 4.800 kg no raio de 7,83 m → taxa acima de 85%, bloqueado.
    _copia(DADOS_2607036, id=3, numero='2610002', situacao_documento='rascunho', revisoes=[],
           criado_em='2026-10-07T14:20', criado_por='Giuliano Breda', atualizado_em='2026-10-07T14:20',
           cliente_id=2, obra={'mesmo_endereco_contratante': False, 'nome': 'Volvo (exemplo)', 'endereco': 'Endereço de exemplo',
                               'cidade': 'Curitiba', 'uf': 'PR', 'cep': ''},
           data_operacao=None, descricao_operacao='Içamento de prensa (exemplo)', art='', art_registrada_em=None,
           contrato_art={'numero': '', 'celebrado_em': None, 'valor': '', 'termino': None},
           carga={'descricao': 'Prensa (exemplo)', 'comprimento_m': '2.4', 'largura_m': '1.6', 'altura_m': '2', 'peso_kg': '4800'},
           raio_m='7.83', raio_isolamento_m='9',
           anexos={'desenhos': None, 'art_plano': False, 'arquivo_art': None}, etapa_atual=4, copia_de=None, exemplo=True),
]

EVENTOS = [
    {'plano_numero': '2607036', 'tipo': 'cadastro', 'titulo': 'Cadastrou a Rev. 1 no sistema',
     'detalhe': 'Emitida no Excel em 24/07/2026, antes do sistema; PDF guardado sem alteração.', 'usuario': 'Giuliano Breda', 'quando': '2026-10-07T09:12'},
    {'plano_numero': '2607036', 'tipo': 'anexo', 'titulo': 'Anexou a ART do plano',
     'detalhe': 'ART_1720264496217.pdf · registrada no CREA-PR em 24/07/2026', 'usuario': 'Giuliano Breda', 'quando': '2026-10-07T09:14'},
    {'plano_numero': '2607036', 'tipo': 'anexo', 'titulo': 'Anexou os desenhos', 'detalhe': 'Desenhos_2607036.pdf · 3 folhas',
     'usuario': 'Giuliano Breda', 'quando': '2026-10-07T09:15'},
    {'plano_numero': '2607036', 'tipo': 'calculo', 'titulo': 'Recalculou no sistema',
     'detalhe': 'Capacidade no raio: 7.948 kg → 9.260 kg · Taxa do guindaste: 47,1% → 40,46% · Cinta: 60,0% → 58,36% · Manilha: 70,0% → 68,09% · '
                'Esforço nas sapatas: 7.914 → 7.940,68 kgf (a lingada passou a entrar na carga) · RMET: 3,17 → 3,18 kgf/cm²',
     'usuario': 'Giuliano Breda', 'quando': '2026-10-07T09:31'},
    {'plano_numero': '2607036', 'tipo': 'emissao', 'titulo': 'Emitiu a Rev. 2', 'detalhe': 'Plano_de_Rigging_2607036_Rev2.pdf · 10 páginas',
     'usuario': 'Giuliano Breda', 'quando': '2026-10-07T09:40'},
    {'plano_numero': '2610001', 'tipo': 'cadastro', 'titulo': 'Criou o rascunho',
     'detalhe': 'Cópia do plano 2607036 para nova operação (prevista para 15/10/2026).', 'usuario': 'Giuliano Breda', 'quando': '2026-10-07T14:12'},
    {'plano_numero': '2610002', 'tipo': 'cadastro', 'titulo': 'Criou o rascunho (exemplo)',
     'detalhe': 'Prensa 4.800 kg no raio de 7,83 m (exemplo).', 'usuario': 'Giuliano Breda', 'quando': '2026-10-07T14:20'},
]
