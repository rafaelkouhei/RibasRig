// Cenário único de exemplo (especificação de 07/10/2026). Hoje = 07/10/2026.
// Será substituído pelas respostas da API do Django REST. Use pela camada services/api.ts,
// nunca importando direto nas telas (as telas recebem cópias; a api altera estes arrays).
import { calcularPlano, formDoPlano, resultadosDoCalculo } from '../domain/plano';
import { REGRAS_CALCULO, TIPOS_ICAMENTO } from '../domain/regras';
import { HOJE } from '../domain/formatacao';
import type {
  Acessorio, Cliente, Configuracoes, DadosPlano, EventoAcessorio, EventoHistorico, Guindaste, PadraoInspecao, PlanoRigging, RegraCalculo,
  ResultadosRevisao, TipoIcamento, Usuario,
} from '../domain/types';
import { PADROES_INSPECAO } from '../domain/inspecao';

export { HOJE };

// =============================================================================================
// Guindastes
// =============================================================================================

const semDados = (id: number, modelo: string): Guindaste => ({
  id, modelo, codigo: modelo.replace(/[^A-Za-z0-9]/g, ''), veiculo: '', placa: '', chassi: '', ano: null, capacidadeNominalT: null,
  comprimentoLancaM: null, aM: null, bM: null, pgKgf: null, laudos: [], tabelas: [], dadosPendentes: true, ativo: true,
});

export const GUINDASTES: Guindaste[] = [
  {
    id: 1, modelo: 'Palfinger MD 45.007', codigo: 'MD45007', veiculo: 'Volvo/VM 270 6X2R', placa: 'IUL8A16', chassi: '93KP0R1C7DE141594', ano: 2013,
    capacidadeNominalT: 45, comprimentoLancaM: 5.1, aM: 2.95, bM: 5.7, pgKgf: 11550,
    laudos: [{ inicio: '2026-04-06', fim: '2026-10-06', art: '1720261926954', arquivo: 'Laudo_MD45007.pdf', atual: true }],
    tabelas: [{
      id: 'lp8', nome: 'lança principal',
      pontos: [
        { alcanceM: 4.18, capacidadeKg: 10900 }, { alcanceM: 5.98, capacidadeKg: 7300 }, { alcanceM: 7.83, capacidadeKg: 5200 },
        { alcanceM: 9.68, capacidadeKg: 3900 }, { alcanceM: 11.53, capacidadeKg: 3300 }, { alcanceM: 13.46, capacidadeKg: 1900 },
        { alcanceM: 15.46, capacidadeKg: 1200 }, { alcanceM: 17.51, capacidadeKg: 900 },
      ],
    }],
    dadosPendentes: false, ativo: true,
  },
  // A empresa ainda não forneceu os dados destes (marcadores [XXX] nas telas são legítimos)
  semDados(2, 'MD 55'), semDados(3, 'DM 130'), semDados(4, 'MD 300L'),
];

// =============================================================================================
// Acessórios
// =============================================================================================

const usoNo2607036 = (un: number, fem: boolean): EventoAcessorio[] => {
  const u = fem ? 'Usada' : 'Usado';
  const q = un ? ` (${un} un.)` : '';
  return [
    { data: '2026-10-07', descricao: `${u} no plano 2607036 Rev. 2, emitido no sistema${q}` },
    { data: '2026-07-24', descricao: `${u} no plano 2607036 Rev. 1, emitido no Excel e cadastrado no sistema em 07/10/2026${q}` },
  ];
};

// Compra, certificado e vencimento dos acessórios reais ainda não foram informados pela empresa.
const semControle = () => ({ dataEntrada: null, certificado: '', certificadoArquivo: null, vencimento: null, motivoDescarte: '', inspecoes: [] });

export const ACESSORIOS: Acessorio[] = [
  { id: 1, tipo: 'cinta', descricao: 'Cinta plana 3 m · 6 t', nomeCurto: 'cinta plana 3 m', medida: '3 m', norma: '', capacidadeT: 6, capacidadeTrabalhoT: 4.2, unidadeCapacidade: 't', pesoKg: 4.87,
    situacao: 'uso', ultimaInspecao: '2026-04-20', proximaInspecao: '2026-10-20', planos: ['2607036'], ...semControle(),
    historico: [...usoNo2607036(4, true), { data: '2026-04-20', descricao: 'Inspeção periódica: aprovada' }] },
  { id: 2, tipo: 'cinta', descricao: 'Cinta plana 4 m · 6 t', nomeCurto: 'cinta plana 4 m', medida: '4 m', norma: '', capacidadeT: 6, capacidadeTrabalhoT: 4.2, unidadeCapacidade: 't', pesoKg: 5.97,
    situacao: 'uso', ultimaInspecao: '2026-07-15', proximaInspecao: '2027-01-15', planos: ['2607036'], ...semControle(),
    historico: [...usoNo2607036(2, true), { data: '2026-07-15', descricao: 'Inspeção periódica: aprovada' }] },
  { id: 3, tipo: 'manilha', descricao: 'Manilha curva 7/8" com pino roscado', nomeCurto: 'manilha 7/8"', medida: '7/8"', norma: 'Grau 6 · FS 6:1', capacidadeT: 5.5, capacidadeTrabalhoT: 5.5, unidadeCapacidade: 'tf', pesoKg: 1.7,
    situacao: 'uso', ultimaInspecao: '2026-06-01', proximaInspecao: '2026-12-01', planos: ['2607036'], ...semControle(),
    historico: [...usoNo2607036(6, true), { data: '2026-06-01', descricao: 'Inspeção periódica: aprovada' }] },
  { id: 4, tipo: 'manilha', descricao: 'Manilha curva 1" com pino roscado', nomeCurto: 'manilha 1"', medida: '1"', norma: 'Grau 6 · FS 6:1', capacidadeT: 7.2, capacidadeTrabalhoT: 7.2, unidadeCapacidade: 'tf', pesoKg: 2.5,
    situacao: 'uso', ultimaInspecao: '2026-06-01', proximaInspecao: '2026-12-01', planos: ['2607036'], ...semControle(),
    historico: [...usoNo2607036(2, true), { data: '2026-06-01', descricao: 'Inspeção periódica: aprovada' }] },
  { id: 5, tipo: 'dispositivo', descricao: 'Balancim', nomeCurto: 'balancim', medida: '', norma: '', capacidadeT: null, capacidadeTrabalhoT: null, unidadeCapacidade: 't', pesoKg: 250,
    situacao: 'uso', ultimaInspecao: '2026-02-10', proximaInspecao: '2027-02-10', planos: ['2607036'], ...semControle(),
    historico: [...usoNo2607036(0, false), { data: '2026-02-10', descricao: 'Inspeção anual: aprovado' }] },
  { id: 6, tipo: 'cinta', descricao: 'Cinta plana 3 m · 6 t (lote 2023)', nomeCurto: 'cinta plana 3 m (lote 2023)', medida: '3 m', norma: '', capacidadeT: 6, capacidadeTrabalhoT: 4.2, unidadeCapacidade: 't', pesoKg: 4.87,
    situacao: 'descartado', ultimaInspecao: '2026-05-05', proximaInspecao: null, planos: [], ...semControle(), motivoDescarte: 'Costura desgastada',
    historico: [{ data: '2026-05-05', descricao: 'Descartada na inspeção: costura desgastada' }, { data: '2025-11-10', descricao: 'Inspeção periódica: aprovada' }] },
  // Exemplo do próprio Giuliano (áudio de 08/10/2026): "cinta tubular, 3 toneladas, 3 metros, data de entrada tal e data de
  // vencimento tal". Datas, certificado e peso são de demonstração, não da empresa.
  { id: 7, tipo: 'tubular', descricao: 'Cinta tubular 3 m · 3 t (exemplo)', nomeCurto: 'cinta tubular 3 m (exemplo)', medida: '3 m', norma: '', capacidadeT: 3, capacidadeTrabalhoT: null, unidadeCapacidade: 't', pesoKg: 1.5,
    situacao: 'uso', ultimaInspecao: '2026-09-15', proximaInspecao: '2027-03-15', planos: [],
    dataEntrada: '2025-03-10', certificado: 'EXEMPLO-001', certificadoArquivo: 'Certificado_cinta_tubular_3t_exemplo.pdf', vencimento: '2026-10-30', motivoDescarte: '',
    inspecoes: [{ data: '2026-09-15', responsavel: 'Rigger de campo (exemplo)', resultado: 'aprovado', observacao: '', proxima: '2027-03-15',
      itens: PADROES_INSPECAO.find((p) => p.tipo === 'tubular')!.itens.map((texto) => ({ texto, conforme: true })) }],
    historico: [
      { data: '2026-09-15', descricao: 'Inspeção pelo padrão por Rigger de campo (exemplo): aprovada (6 de 6 itens conformes); próxima em 15/03/2027' },
      { data: '2025-03-10', descricao: 'Cadastrado no sistema' },
    ] },
];

// =============================================================================================
// Clientes
// =============================================================================================

export const CLIENTES: Cliente[] = [
  { id: 1, razaoSocial: 'Kaefer Rip Serviços Industriais Ltda.', nomePasta: 'Kaefer Rip', cnpj: '07.522.191/0048-64',
    endereco: 'Rod. Engenheiro Ermênio de Oliveira Penteado, 57 – Helvetia', cidade: 'Indaiatuba', uf: 'SP', cep: '13337-300',
    locaisObra: [{ nome: 'Bosch', endereco: 'Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial', cidade: 'Curitiba', uf: 'PR', cep: '81460-000' }],
    contato: '', telefone: '', email: '', exemplo: false },
  { id: 2, razaoSocial: 'Volvo do Brasil', nomePasta: 'Volvo', cnpj: '', endereco: '', cidade: '', uf: '', cep: '', locaisObra: [], contato: '', telefone: '', email: '', exemplo: true },
  { id: 3, razaoSocial: 'Renault do Brasil', nomePasta: 'Renault', cnpj: '', endereco: '', cidade: '', uf: '', cep: '', locaisObra: [], contato: '', telefone: '', email: '', exemplo: true },
];

// =============================================================================================
// Usuários e configurações
// =============================================================================================

// Usuários de teste. O login é só por usuário (sem e-mail). O back-end precisa cadastrar estes mesmos
// usuários (giuliano.breda e rigger.campo) para o front conseguir entrar quando for testado com o servidor.
export const USUARIOS: Usuario[] = [
  { id: 1, nome: 'Giuliano Breda', usuario: 'giuliano.breda', perfil: 'admin', ativo: true, principal: true, trocarSenha: false, ultimoAcesso: '2026-10-07T09:05', observacao: 'Administrador principal · responsável técnico' },
  { id: 2, nome: 'Rigger de campo (exemplo)', usuario: 'rigger.campo', perfil: 'operacao', ativo: true, principal: false, trocarSenha: false, ultimoAcesso: '2026-10-06', observacao: 'Usuário de exemplo' },
];

export const CONFIGURACOES: Configuracoes = {
  pastaRaiz: 'C:\\Guindastes Ribas\\Planos de Rigging',
  nomeArquivo: 'Plano_de_Rigging_{nº}_Rev{rev}.pdf',
  empresa: { razaoSocial: 'Guindastes Ribas Ltda.', cnpj: '81.076.242/0001-60', ie: '10171012-22', endereco: 'Rua Justo Manfron, 2845 G, Santa Felicidade, Curitiba/PR', cep: '82.410-540' },
  responsavel: {
    nomeCompleto: 'Giuliano Cesar Breda de Souza', nomeAssinatura: 'Giuliano Breda', titulo: 'Engenheiro Mecânico',
    crea: 'CREA-PR 78755/D', rnp: '1701211920', rpp: 'RPP-23-1040', assinatura: 'digitalizada',
  },
  limitePct: 85,
  avisoAtencaoPct: 75,
  ventoPadraoMs: 7,
  numeracao: { descricao: 'AAMM + 3 dígitos, gerado pelo sistema pela data de criação do plano; zera todo mês (ex.: 2610001 é o primeiro de outubro/2026). Revisões mantêm o número.' },
};

// =============================================================================================
// Tipos de içamento e regras de cálculo (catálogo do sistema + exemplos da equipe)
// =============================================================================================

export const TIPOS: TipoIcamento[] = structuredClone(TIPOS_ICAMENTO);
export const REGRAS: RegraCalculo[] = structuredClone(REGRAS_CALCULO);
/** Padrões de inspeção por tipo de acessório (o engenheiro edita na tela de Acessórios) */
export const PADROES: PadraoInspecao[] = structuredClone(PADROES_INSPECAO);

// =============================================================================================
// Planos
// =============================================================================================

const LINGADA_CHILLER: DadosPlano['lingada'] = [
  { acessorioId: 1, quantidade: 4, posicao: 'pernasInferiores' },
  { acessorioId: 3, quantidade: 6, posicao: 'carga' },
  { acessorioId: 2, quantidade: 2, posicao: 'pernasSuperiores' },
  { acessorioId: 4, quantidade: 2, posicao: 'gancho' },
];

const OBRA_BOSCH = { mesmoEnderecoContratante: false, nome: 'Bosch', endereco: 'Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial', cidade: 'Curitiba', uf: 'PR', cep: '81460-000' };

const DADOS_2607036: DadosPlano = {
  clienteId: 1, obra: { ...OBRA_BOSCH },
  dataOperacao: '2026-07-24', descricaoOperacao: 'Içamento de chiller — movimentação de equipamento na Bosch', rigger: 'Giuliano Breda — RPP-23-1040',
  art: '1720264496217', artRegistradaEm: '2026-07-24T18:19',
  contratoArt: { numero: '', celebradoEm: '2026-07-24', valor: '2.700,00', termino: '2026-08-24' },
  carga: { descricao: 'Chiller', comprimentoM: 4.7, larguraM: 1.95, alturaM: 2.3, pesoKg: 3450 },
  tipoIcamentoId: 't1', lingada: LINGADA_CHILLER, anguloInferiorGraus: 28, anguloSuperiorGraus: 41,
  dispositivo: { acessorioId: 5, descricao: 'Balancim', quantidade: 1, pesoUnitarioKg: 250 }, cargasExtrasKg: 0,
  guindasteId: 1, tabelaId: 'lp8', comprimentoLancaM: 5.1, raioM: 5.0, guindastesAdicionais: [],
  quadranteInicial: 'Lateral', quadranteFinal: 'Lateral', ventoMaxMs: 7, raioIsolamentoM: 7,
  dormente: { larguraCm: 50, comprimentoCm: 50, quantidade: 1 },
  anexos: { desenhos: 'Desenhos_2607036.pdf', artPlano: true, arquivoArt: 'ART_1720264496217.pdf' },
  etapaAtual: 6, copiaDe: null, exemplo: false,
};

/** Rev. 1: números exatamente como no documento emitido no Excel (antes do sistema). */
const RESULTADOS_REV1_EXCEL: ResultadosRevisao = {
  dataOperacao: '2026-07-24', cargaKg: 3450, lingadaKg: null, dispositivosKg: null, extrasKg: null, pbKg: 3747,
  guindastes: [{ guindasteId: 1, modelo: 'Palfinger MD 45.007', tabelaNome: null, raioM: 5, pctCarga: 100, cargaKg: 3747, capacidadeKg: 7948, taxaPct: 47.1, laudoFim: '2026-10-06', laudoArt: '1720261926954' }],
  capacidadeKg: 7948, taxaGuindastePct: 47.1, referenciaConservadoraKg: null, taxaReferenciaPct: null,
  posicoes: [
    { posicao: 'pernasInferiores', acessorioId: 1, descricao: 'Cinta plana 3 m · 6 t', anguloGraus: 28, tracao: null, unidade: 't', capacidade: 4.2, taxaPct: null },
    { posicao: 'pernasSuperiores', acessorioId: 2, descricao: 'Cinta plana 4 m · 6 t', anguloGraus: 41, tracao: 2.5, unidade: 't', capacidade: 4.2, taxaPct: 60.0 },
    { posicao: 'carga', acessorioId: 3, descricao: 'Manilha curva 7/8" com pino roscado', anguloGraus: 28, tracao: null, unidade: 'tf', capacidade: 5.5, taxaPct: null },
    { posicao: 'gancho', acessorioId: 4, descricao: 'Manilha curva 1" com pino roscado', anguloGraus: 41, tracao: 5.0, unidade: 'tf', capacidade: 7.2, taxaPct: 70.0 },
  ],
  sapatas: { momentoKgfm: null, forcaKgf: null, esforcoKgf: 7914, areaCm2: 2500, rmet: 3.17 },
  raioIsolamentoM: 7, ventoMaxMs: 7, situacaoSeguranca: 'ok',
  comoNoDocumento: { liq: '3450', pb: '3747', pbT: '3,75', cap: '7,95', capCarga: '7,9', taxa: '47,1', cinta: '60,0', manilha: '70,0', es: '7914', rmet: '3,17' },
};

export const OBS_REV1 = 'Emitida em 24/07/2026 no Excel, antes do sistema, e guardada como foi entregue. A capacidade saiu 7.948 kg porque a interpolação não dividiu pela distância entre 4,18 m e 5,98 m (o certo é 9.260 kg); a taxa do guindaste herdou esse erro. As sapatas deram 7.914 kgf porque o Excel não somou a lingada (46,62 kg) na carga. Cinta e manilha saíram 60% e 70% porque a tração foi arredondada para 2,5 t antes de dividir.';
export const OBS_REV2 = 'Recalculada pelo sistema em 07/10/2026 com interpolação do gráfico de carga do MD 45.007 (lança principal, 8 extensões). Nada foi arredondado antes do cálculo. Laudo do guindaste válido na data da operação (24/07/2026).';

/** Rev. 2: resultados calculados pelo próprio motor (domain/plano.ts), nunca digitados. */
const RESULTADOS_REV2 = resultadosDoCalculo(calcularPlano({
  form: formDoPlano(DADOS_2607036), numero: '2607036', acessorios: ACESSORIOS, guindastes: GUINDASTES, tipos: TIPOS, clientes: CLIENTES,
  configuracoes: CONFIGURACOES, hoje: HOJE,
}));

export const PLANOS: PlanoRigging[] = [
  {
    ...DADOS_2607036, id: 1, numero: '2607036', situacaoDocumento: 'emitido',
    criadoEm: '2026-07-24', criadoPor: 'Giuliano Breda', atualizadoEm: '2026-10-07T09:40',
    revisoes: [
      { numero: 1, origem: 'excel', emitidaEm: '2026-07-24', emitidaPor: 'Giuliano Breda', cadastradaEm: '2026-10-07T09:12',
        arquivoPdf: 'Plano_de_Rigging_2607036_Rev1.pdf', observacao: OBS_REV1, resultados: RESULTADOS_REV1_EXCEL },
      { numero: 2, origem: 'sistema', emitidaEm: '2026-10-07T09:40', emitidaPor: 'Giuliano Breda', cadastradaEm: null,
        arquivoPdf: 'Plano_de_Rigging_2607036_Rev2.pdf', observacao: OBS_REV2, resultados: RESULTADOS_REV2 },
    ],
  },
  {
    // Cópia do 2607036 para uma nova operação. Parou na etapa 4. Bloqueado: laudo do MD 45.007 venceu em 06/10/2026.
    ...structuredClone(DADOS_2607036), id: 2, numero: '2610001', situacaoDocumento: 'rascunho', revisoes: [],
    criadoEm: '2026-10-07T14:12', criadoPor: 'Giuliano Breda', atualizadoEm: '2026-10-07T14:12',
    dataOperacao: '2026-10-15', art: '', artRegistradaEm: null,
    contratoArt: { numero: '', celebradoEm: '2026-07-24', valor: '2.700,00', termino: null },
    anexos: { desenhos: null, artPlano: false, arquivoArt: null }, etapaAtual: 4, copiaDe: '2607036',
  },
  {
    // Exemplo (fictício): prensa de 4.800 kg no raio de 7,83 m → taxa acima de 85%, bloqueado.
    ...structuredClone(DADOS_2607036), id: 3, numero: '2610002', situacaoDocumento: 'rascunho', revisoes: [],
    criadoEm: '2026-10-07T14:20', criadoPor: 'Giuliano Breda', atualizadoEm: '2026-10-07T14:20',
    clienteId: 2, obra: { mesmoEnderecoContratante: false, nome: 'Volvo (exemplo)', endereco: 'Endereço de exemplo', cidade: 'Curitiba', uf: 'PR', cep: '' },
    dataOperacao: null, descricaoOperacao: 'Içamento de prensa (exemplo)', art: '', artRegistradaEm: null,
    contratoArt: { numero: '', celebradoEm: null, valor: '', termino: null },
    carga: { descricao: 'Prensa (exemplo)', comprimentoM: 2.4, larguraM: 1.6, alturaM: 2, pesoKg: 4800 },
    raioM: 7.83, raioIsolamentoM: 9,
    anexos: { desenhos: null, artPlano: false, arquivoArt: null }, etapaAtual: 4, copiaDe: null, exemplo: true,
  },
];

// =============================================================================================
// Histórico de eventos por plano
// =============================================================================================

export const EVENTOS: EventoHistorico[] = [
  { id: 1, planoNumero: '2607036', tipo: 'cadastro', titulo: 'Cadastrou a Rev. 1 no sistema', detalhe: 'Emitida no Excel em 24/07/2026, antes do sistema; PDF guardado sem alteração.', usuario: 'Giuliano Breda', quando: '2026-10-07T09:12' },
  { id: 2, planoNumero: '2607036', tipo: 'anexo', titulo: 'Anexou a ART do plano', detalhe: 'ART_1720264496217.pdf · registrada no CREA-PR em 24/07/2026', usuario: 'Giuliano Breda', quando: '2026-10-07T09:14' },
  { id: 3, planoNumero: '2607036', tipo: 'anexo', titulo: 'Anexou os desenhos', detalhe: 'Desenhos_2607036.pdf · 3 folhas', usuario: 'Giuliano Breda', quando: '2026-10-07T09:15' },
  { id: 4, planoNumero: '2607036', tipo: 'calculo', titulo: 'Recalculou no sistema', detalhe: 'Capacidade no raio: 7.948 kg → 9.260 kg · Taxa do guindaste: 47,1% → 40,46% · Cinta: 60,0% → 58,36% · Manilha: 70,0% → 68,09% · Esforço nas sapatas: 7.914 → 7.940,68 kgf (a lingada passou a entrar na carga) · RMET: 3,17 → 3,18 kgf/cm²', usuario: 'Giuliano Breda', quando: '2026-10-07T09:31' },
  { id: 5, planoNumero: '2607036', tipo: 'emissao', titulo: 'Emitiu a Rev. 2', detalhe: 'Plano_de_Rigging_2607036_Rev2.pdf · 10 páginas', usuario: 'Giuliano Breda', quando: '2026-10-07T09:40' },
  { id: 6, planoNumero: '2610001', tipo: 'cadastro', titulo: 'Criou o rascunho', detalhe: 'Cópia do plano 2607036 para nova operação (prevista para 15/10/2026).', usuario: 'Giuliano Breda', quando: '2026-10-07T14:12' },
  { id: 7, planoNumero: '2610002', tipo: 'cadastro', titulo: 'Criou o rascunho (exemplo)', detalhe: 'Prensa 4.800 kg no raio de 7,83 m (exemplo).', usuario: 'Giuliano Breda', quando: '2026-10-07T14:20' },
];
