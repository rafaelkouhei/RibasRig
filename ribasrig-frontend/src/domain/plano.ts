// Plano de Rigging: formulário em TEXTO → validação de todos os campos → todos os resultados,
// checklist da etapa 6, situação de segurança e se pode emitir. Funções puras (sem React).
// A mesma lógica deve rodar no back-end antes de emitir.
import {
  ATENCAO_PADRAO_PCT, LIMITE_PCT, capacidadeDeTrabalho, capacidadeKg, capacidadeNoGrafico, esforcoSapatas, extensaoQueAlcanca, formulaPosicao, laudoAtual, nivelTaxa,
  nomeGrafico, piorSituacao, situacaoInspecao, situacaoLaudo, tabelaDoGuindaste, taxaPct, tracoesPorPosicao,
  type CapacidadeNoGrafico, type ResultadoInspecao, type ResultadoLaudo, type ResultadoSapatas,
} from './calculos';
import { casasDe, dataBR, dataIsoValida, fmt, fmtPct, lerNum, numParaTexto } from './formatacao';
import { erroNumeroArt, validarCampo, type CampoValidado, type NomeFaixa } from './validacao';
import type {
  Acessorio, AnexosPlano, Cliente, Configuracoes, DadosPlano, Guindaste, ISODate, ISODateTime, PlanoRigging,
  PosicaoLingada, ResultadosRevisao, SituacaoSeguranca, TabelaCapacidade, TipoIcamento,
} from './types';

// =============================================================================================
// Formulário (texto, do jeito que o usuário digita)
// =============================================================================================

export type Etapa = 1 | 2 | 3 | 4 | 5 | 6;
export const ETAPAS: { n: Etapa; rotulo: string }[] = [
  { n: 1, rotulo: 'Dados gerais' }, { n: 2, rotulo: 'Carga' }, { n: 3, rotulo: 'Lingada' },
  { n: 4, rotulo: 'Guindaste' }, { n: 5, rotulo: 'Anexos' }, { n: 6, rotulo: 'Revisão' },
];

export const POSICOES: PosicaoLingada[] = ['pernasInferiores', 'pernasSuperiores', 'carga', 'gancho'];
/** "pernas inferiores", "carga"… (minúsculas, para frases) */
export const NOME_POSICAO: Record<PosicaoLingada, string> = { pernasInferiores: 'pernas inferiores', pernasSuperiores: 'pernas superiores', carga: 'carga', gancho: 'gancho' };
/** "Pernas inferiores", "Carga"… (rótulos) */
export const ROTULO_POSICAO: Record<PosicaoLingada, string> = { pernasInferiores: 'Pernas inferiores', pernasSuperiores: 'Pernas superiores', carga: 'Carga', gancho: 'Gancho' };

export interface FormItemLingada { acessorioId: number | null; quantidade: string; posicao: PosicaoLingada | '' }
export interface FormGuindasteAdicional { guindasteId: number | null; tabelaId: string | null; raio: string; pct: string }

export interface FormPlano {
  // etapa 1
  clienteId: number | null;
  obraMesmoEndereco: boolean;
  obraNome: string; obraEndereco: string; obraCidade: string; obraUf: string; obraCep: string;
  /** ISO 'aaaa-mm-dd' ou '' */
  dataOperacao: string;
  descricao: string; rigger: string;
  /** Nº da ART do plano (13 dígitos) */
  art: string;
  artContrato: string; artCelebracao: string; artValor: string; artTermino: string;
  // etapa 2
  cargaDescricao: string; comprimento: string; largura: string; altura: string; peso: string;
  // etapa 3
  tipoIcamentoId: string;
  lingada: FormItemLingada[];
  /** Com balancim: pernas inferiores. Sem balancim: ângulo único. */
  anguloInferior: string;
  anguloSuperior: string;
  dispositivoAcessorioId: number | null; dispositivoDescricao: string; dispositivoQtd: string; dispositivoPeso: string;
  extras: string;
  // etapa 4
  guindasteId: number | null; tabelaId: string | null;
  lanca: string; raio: string; isolamento: string; quadranteInicial: string; quadranteFinal: string; vento: string;
  guindastesAdicionais: FormGuindasteAdicional[];
  dormenteLargura: string; dormenteComprimento: string; dormenteQtd: string;
  // etapa 5
  anexos: AnexosPlano;
}

// =============================================================================================
// Entrada e saída do cálculo
// =============================================================================================

export interface EntradaCalculo {
  form: FormPlano;
  /** Nº do plano ('' se ainda não criado). Usado em nomes de arquivo e para não acusar a própria ART como repetida. */
  numero: string;
  acessorios: Acessorio[];
  guindastes: Guindaste[];
  tipos: TipoIcamento[];
  clientes: Cliente[];
  /** `limitePct` ausente = o limite em uso (LIMITE_PCT) */
  configuracoes: Pick<Configuracoes, 'avisoAtencaoPct'> & Partial<Pick<Configuracoes, 'limitePct'>>;
  /** Data de hoje (use HOJE de formatacao.ts) */
  hoje: ISODate;
  /** Nº da ART → nº do plano que já a usa. A do próprio plano é ignorada. */
  artsEmUso?: Record<string, string>;
}

export interface CampoPlano extends CampoValidado {
  rotulo: string;
  etapa: Etapa;
  /** false = o tipo de içamento não pede este campo (não valida, não bloqueia) */
  ativo: boolean;
}

export interface ItemCalculado {
  indice: number;
  acessorio: Acessorio | null;
  quantidade: number;
  pesoTotalKg: number;
  posicao: PosicaoLingada | null;
  erroAcessorio: string | null;
  erroPosicao: string | null;
}

export interface ResultadoPosicao {
  posicao: PosicaoLingada;
  /** Posição exigida pelo tipo de içamento */
  obrigatoria: boolean;
  formula: string;
  /** Tração (t) ou esforço (tf). NaN = inválido */
  tracao: number;
  unidade: 't' | 'tf';
  quantidadeItens: number;
  /** Item de MENOR capacidade na posição (é o que governa a taxa) */
  governante: Acessorio | null;
  capacidadeGovernante: number;
  taxaPct: number;
  nivel: SituacaoSeguranca;
  /** Por que a posição bloqueia sem taxa ("sem acessório na posição carga", "item sem capacidade no cadastro"…) */
  problema: string | null;
}

export interface ResultadoGuindasteAdicional {
  indice: number;
  guindaste: Guindaste | null;
  tabela: TabelaCapacidade | null;
  raioM: number;
  pct: number;
  cargaKg: number;
  capacidade: CapacidadeNoGrafico;
  capacidadeKg: number;
  taxaPct: number;
  nivel: SituacaoSeguranca;
  /** Mesmo modelo do principal ou de outro adicional: bloqueia */
  repetido: boolean;
  laudo: ResultadoLaudo;
}

export interface InspecaoItem {
  acessorio: Acessorio;
  /** Contra a data da operação (decide o checklist) */
  naOperacao: ResultadoInspecao;
  /** Contra HOJE (aviso "vence em N dias", 30 dias antes) */
  hoje: ResultadoInspecao;
}

export type IdChecklist = 'campos' | 'contratante' | 'data' | 'laudo' | 'raio' | 'guindaste' | 'acessorios' | 'inspecoes' | 'isolamento' | 'anexos' | 'art';

export interface ItemChecklist { id: IdChecklist; rotulo: string; ok: boolean; detalhe: string; etapa: Etapa }

export interface ResultadoPlano {
  /** Campos numéricos validados. Chaves: nomes do FormPlano ('peso', 'raio'…), 'lingada.<i>.quantidade', 'adicionais.<i>.raio', 'adicionais.<i>.pct' */
  campos: Record<string, CampoPlano>;
  camposInvalidos: { chave: string; rotulo: string; etapa: Etapa; erro: string }[];
  dataOperacao: { iso: ISODate | null; erro: string | null; anteriorAHoje: boolean };
  art: { numero: string; erro: string | null };
  tipo: TipoIcamento | null;
  balancim: boolean;
  itens: ItemCalculado[];
  cargaKg: number;
  lingadaKg: number;
  dispositivosKg: number;
  extrasKg: number;
  pbKg: number;
  /** P = carga + cargas extras (t) */
  pT: number;
  /** Balancim/dispositivos (t) */
  bT: number;
  guindaste: Guindaste | null;
  tabela: TabelaCapacidade | null;
  raioM: number;
  capacidade: CapacidadeNoGrafico;
  /** Capacidade no raio (kg); NaN sem capacidade */
  capacidadeKg: number;
  referenciaConservadora: { alcanceM: number; capacidadeKg: number; taxaPct: number } | null;
  /** Fração da Pb do guindaste principal (100% sem adicionais) */
  pctPrincipal: number;
  pbPrincipalKg: number;
  taxaGuindaste: number;
  nivelGuindaste: SituacaoSeguranca;
  adicionais: ResultadoGuindasteAdicional[];
  /** Soma dos % dos adicionais ≥ 100 */
  divisaoInvalida: boolean;
  porPosicao: ResultadoPosicao[];
  sapatas: ResultadoSapatas;
  rmet: number;
  /** Laudo do guindaste principal na data da operação */
  laudo: ResultadoLaudo;
  inspecoes: { itens: InspecaoItem[]; ok: boolean; detalhe: string };
  isolamentoOk: boolean;
  anexosPendentes: string[];
  checklist: ItemChecklist[];
  /** Motivos da situação 'bloqueado' (vazio quando não bloqueado) */
  motivosBloqueio: string[];
  /** Maior taxa válida entre guindastes e posições (NaN se nenhuma) */
  maiorTaxaPct: number;
  situacaoSeguranca: SituacaoSeguranca;
  podeEmitir: boolean;
}

// =============================================================================================
// Cálculo
// =============================================================================================

const finito = (v: number) => Number.isFinite(v);
const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lido = (x: number) => fmt(x, casasDe(x));
const lido1 = (x: number) => (finito(x) ? fmt(x, Math.max(1, casasDe(x))) : '—');

/**
 * Calcula o plano inteiro a partir do formulário em texto. Nada é arredondado.
 * Regras: P = carga + cargas extras; tipos sem balancim usam ângulo único e não têm pernas superiores;
 * qualquer NaN, negativo ou cos ≤ 0 = bloqueio; acima do limite das Configurações bloqueia (85% por padrão; o valor exato passa); atenção a partir do aviso das Configurações.
 */
export function calcularPlano(e: EntradaCalculo): ResultadoPlano {
  const f = e.form;
  const aviso = e.configuracoes.avisoAtencaoPct;
  const limite = e.configuracoes.limitePct ?? LIMITE_PCT;
  const lim = `${numParaTexto(limite)}%`;
  const tipo = e.tipos.find((t) => t.id === f.tipoIcamentoId) ?? null;
  const balancim = tipo ? tipo.balancim : true;

  // ---------- campos ----------
  const campos: Record<string, CampoPlano> = {};
  const campo = (chave: string, nome: NomeFaixa, texto: string, etapa: Etapa, rotulo: string, ativo = true): number => {
    if (!ativo) { campos[chave] = { valor: NaN, erro: null, lidoComo: null, rotulo, etapa, ativo: false }; return NaN; }
    const r = validarCampo(nome, texto);
    campos[chave] = { ...r, rotulo, etapa, ativo: true };
    return r.valor;
  };
  campo('comprimento', 'dimensao', f.comprimento, 2, 'Comprimento da carga');
  campo('largura', 'dimensao', f.largura, 2, 'Largura da carga');
  campo('altura', 'dimensao', f.altura, 2, 'Altura da carga');
  const peso = campo('peso', 'pesoCarga', f.peso, 2, 'Peso da carga');
  const angInf = campo('anguloInferior', 'angulo', f.anguloInferior, 3, balancim ? 'Ângulo das pernas inferiores' : 'Ângulo das pernas');
  const angSup = campo('anguloSuperior', 'angulo', f.anguloSuperior, 3, 'Ângulo das pernas superiores', balancim);
  const dispQtd = campo('dispositivoQtd', 'quantidade', f.dispositivoQtd, 3, 'Quantidade do dispositivo', balancim);
  const dispPeso = campo('dispositivoPeso', 'pesoDispositivo', f.dispositivoPeso, 3, 'Peso unitário do dispositivo', balancim);
  const extras = campo('extras', 'cargasExtras', f.extras, 3, 'Cargas extras');
  campo('lanca', 'comprimentoLanca', f.lanca, 4, 'Comprimento da lança');
  const raio = campo('raio', 'raio', f.raio, 4, 'Raio de operação');
  campo('vento', 'vento', f.vento, 4, 'Vento máximo');
  let isol = campo('isolamento', 'raioIsolamento', f.isolamento, 4, 'Raio de isolamento');
  const ld = campo('dormenteLargura', 'dormente', f.dormenteLargura, 4, 'Largura do dormente');
  const cd = campo('dormenteComprimento', 'dormente', f.dormenteComprimento, 4, 'Comprimento do dormente');
  const nd = campo('dormenteQtd', 'dormentesPorSapata', f.dormenteQtd, 4, 'Dormentes por sapata');
  const isolamentoCurto = finito(isol) && finito(raio) && isol < raio;
  if (isolamentoCurto) {
    campos.isolamento = { ...campos.isolamento, valor: NaN, erro: `Menor que o raio de operação (${lido1(raio)} m).` };
    isol = NaN;
  }

  // ---------- lingada ----------
  const itens: ItemCalculado[] = f.lingada.map((it, i) => {
    const acessorio = e.acessorios.find((a) => a.id === it.acessorioId) ?? null;
    const quantidade = campo(`lingada.${i}.quantidade`, 'quantidade', it.quantidade, 3, `Quantidade do item ${i + 1}`);
    const erroPosicao = !it.posicao ? 'Escolha a posição.' : !balancim && it.posicao === 'pernasSuperiores' ? 'Este tipo não tem pernas superiores.' : null;
    return {
      indice: i, acessorio, quantidade, pesoTotalKg: acessorio ? quantidade * acessorio.pesoKg : NaN,
      posicao: it.posicao || null, erroAcessorio: acessorio ? null : 'Escolha o acessório.', erroPosicao,
    };
  });
  const lingadaKg = itens.reduce((s, x) => s + x.pesoTotalKg, 0);
  const dispositivosKg = balancim ? dispQtd * dispPeso : 0;
  const pbKg = peso + lingadaKg + dispositivosKg + extras;
  const pT = (peso + extras) / 1000;
  const bT = dispositivosKg / 1000;

  const tracoes = tracoesPorPosicao({ pT, balancimT: bT, anguloInferior: angInf, anguloSuperior: angSup, balancim });
  const angTxt = (a: number) => (finito(a) ? `${lido(a)}°` : '—');
  const obrigatorias: PosicaoLingada[] = balancim ? POSICOES : ['pernasInferiores'];
  const porPosicao: ResultadoPosicao[] = [];
  for (const p of POSICOES) {
    const naPos = itens.filter((x) => x.posicao === p);
    const obrigatoria = obrigatorias.includes(p);
    if (!obrigatoria && !naPos.length) continue;
    let problema: string | null = null;
    let governante: Acessorio | null = null;
    let cap = NaN;
    if (!balancim && p === 'pernasSuperiores') problema = 'posição não existe neste tipo de içamento';
    else if (!naPos.length) problema = `sem acessório na posição ${NOME_POSICAO[p]}`;
    else {
      for (const x of naPos) {
        const c = capacidadeDeTrabalho(x.acessorio);
        if (!x.acessorio) problema = 'item sem acessório escolhido';
        else if (!(c > 0)) problema = 'item sem capacidade no cadastro';
        else if (!governante || c < cap) { governante = x.acessorio; cap = c; }
      }
    }
    const tracao = tracoes[p];
    const taxa = problema ? NaN : taxaPct(tracao, cap);
    porPosicao.push({
      posicao: p, obrigatoria, formula: formulaPosicao(p, balancim, angTxt(angInf), angTxt(angSup)), tracao,
      unidade: governante?.unidadeCapacidade ?? (p === 'carga' || p === 'gancho' ? 'tf' : 't'),
      quantidadeItens: naPos.length, governante, capacidadeGovernante: problema ? NaN : cap, taxaPct: taxa,
      nivel: problema ? 'bloqueado' : nivelTaxa(taxa, aviso, limite), problema,
    });
  }
  const problemasItens = itens.flatMap((x) => [x.erroAcessorio, x.erroPosicao].filter((m): m is string => !!m).map((m) => `item ${x.indice + 1}: ${m.toLowerCase().replace(/\.$/, '')}`));
  const problemasLingada = [
    ...(f.lingada.length === 0 ? ['nenhum acessório na lingada'] : []),
    ...(tipo ? [] : ['tipo de içamento não cadastrado']),
    ...problemasItens,
    ...porPosicao.filter((r) => r.problema).map((r) => (r.problema === 'posição não existe neste tipo de içamento' ? `${NOME_POSICAO[r.posicao]}: ${r.problema}` : r.problema!)),
  ];

  // ---------- data da operação ----------
  const dataOk = dataIsoValida(f.dataOperacao);
  const dataOp = dataOk ? f.dataOperacao : null;
  const dataOperacao = {
    iso: dataOp,
    erro: dataOk ? null : 'Informe a data da operação: laudo e inspeções são conferidos contra ela.',
    anteriorAHoje: dataOk && f.dataOperacao < e.hoje,
  };

  // ---------- guindastes ----------
  const guindaste = e.guindastes.find((g) => g.id === f.guindasteId) ?? null;
  const tabela = tabelaDoGuindaste(guindaste, f.tabelaId);
  const capacidade: CapacidadeNoGrafico = tabela ? capacidadeNoGrafico(tabela.pontos, raio) : { tipo: 'sem-grafico' };
  const capKg = capacidadeKg(capacidade);

  let somaPct = 0;
  const adicionaisBase = f.guindastesAdicionais.map((a, k) => {
    const g = e.guindastes.find((x) => x.id === a.guindasteId) ?? null;
    const tab = tabelaDoGuindaste(g, a.tabelaId);
    const r = campo(`adicionais.${k}.raio`, 'raio', a.raio, 4, `Raio do guindaste adicional ${k + 1}`);
    const p = campo(`adicionais.${k}.pct`, 'pctAdicional', a.pct, 4, `% da carga do guindaste adicional ${k + 1}`);
    somaPct += p;
    const repetido = a.guindasteId != null && (a.guindasteId === f.guindasteId || f.guindastesAdicionais.some((y, j) => j < k && y.guindasteId === a.guindasteId));
    const capA: CapacidadeNoGrafico = tab ? capacidadeNoGrafico(tab.pontos, r) : { tipo: 'sem-grafico' };
    return { indice: k, guindaste: g, tabela: tab, raioM: r, pct: p, capacidade: capA, capacidadeKg: capacidadeKg(capA), repetido, laudo: situacaoLaudo(g, dataOp) };
  });
  const divisaoInvalida = adicionaisBase.length > 0 && finito(somaPct) && somaPct >= 100;
  const fracao = adicionaisBase.length ? (divisaoInvalida ? NaN : (100 - somaPct) / 100) : 1;
  const pbPrincipalKg = pbKg * fracao;
  const taxaGuindaste = taxaPct(pbPrincipalKg, capKg);
  const nivelGuindaste = nivelTaxa(taxaGuindaste, aviso, limite);
  const adicionais: ResultadoGuindasteAdicional[] = adicionaisBase.map((a) => {
    const cargaKg = (pbKg * a.pct) / 100;
    const taxa = taxaPct(cargaKg, a.capacidadeKg);
    return { ...a, cargaKg, taxaPct: taxa, nivel: a.repetido ? 'bloqueado' : nivelTaxa(taxa, aviso, limite) };
  });
  const comCapacidade = capacidade.tipo === 'exato' || capacidade.tipo === 'interpolado';
  const ext = tabela && comCapacidade ? extensaoQueAlcanca(tabela.pontos, raio) : null;
  const referenciaConservadora = ext ? { alcanceM: ext.alcanceM, capacidadeKg: ext.capacidadeKg, taxaPct: taxaPct(pbPrincipalKg, ext.capacidadeKg) } : null;

  const sapatas = esforcoSapatas({
    pbKg: pbPrincipalKg, raioM: raio, pgKgf: guindaste?.pgKgf ?? NaN, aM: guindaste?.aM ?? NaN, bM: guindaste?.bM ?? NaN,
    dormente: { larguraCm: ld, comprimentoCm: cd, quantidade: nd },
  });

  // ---------- laudo e inspeções ----------
  const laudo = situacaoLaudo(guindaste, dataOp);
  const laudosOk = laudo.aprovado && adicionais.every((a) => a.laudo.aprovado);

  const vistos = new Set<number>();
  const paraInspecionar: Acessorio[] = [];
  for (const x of itens) if (x.acessorio && !vistos.has(x.acessorio.id)) { vistos.add(x.acessorio.id); paraInspecionar.push(x.acessorio); }
  if (balancim && f.dispositivoAcessorioId != null) {
    const d = e.acessorios.find((a) => a.id === f.dispositivoAcessorioId);
    if (d && !vistos.has(d.id)) paraInspecionar.push(d);
  }
  const inspItens: InspecaoItem[] = paraInspecionar.map((a) => ({ acessorio: a, naOperacao: situacaoInspecao(a, dataOp), hoje: situacaoInspecao(a, e.hoje) }));
  const inspReprovadas = inspItens.filter((x) => !x.naOperacao.aprovado);
  const inspOk = dataOk && inspReprovadas.length === 0;
  const prox = inspItens.filter((x) => x.naOperacao.proxima).sort((a, b) => a.naOperacao.proxima!.localeCompare(b.naOperacao.proxima!))[0];
  const diasTxt = (n: number) => (n === 0 ? 'vence no dia da operação' : `vence ${n} ${n === 1 ? 'dia' : 'dias'} depois da operação`);
  const inspDetalhe = !dataOk ? 'sem data da operação para conferir'
    : inspReprovadas.length ? `problema na data da operação: ${inspReprovadas.map((x) => `${x.acessorio.nomeCurto} (${x.naOperacao.texto})`).join(', ')}`
    : `em dia para ${dataBR(dataOp)}${prox ? ` · ${prox.acessorio.nomeCurto} vence em ${dataBR(prox.naOperacao.proxima)} (${diasTxt(prox.naOperacao.dias ?? 0)})` : ''}`;

  // ---------- etapa 1: contratante, obra, ART ----------
  const cliente = e.clientes.find((c) => c.id === f.clienteId) ?? null;
  const obraOk = f.obraMesmoEndereco ? !!cliente?.endereco.trim() : !!f.obraEndereco.trim() && !!f.obraCidade.trim();
  const artNum = f.art.trim();
  const artRepetida = artNum && e.artsEmUso?.[artNum] && e.artsEmUso[artNum] !== e.numero ? e.artsEmUso[artNum] : null;
  const artErro = erroNumeroArt(artNum) ?? (artRepetida ? `Esta ART já pertence ao plano ${artRepetida}.` : null);
  const artOk = !!artNum && !artErro;

  // ---------- anexos ----------
  const anexosPendentes: string[] = [];
  if (!f.anexos.desenhos) anexosPendentes.push('Desenhos de posicionamento (falta)');
  if (!f.anexos.artPlano || !f.anexos.arquivoArt) anexosPendentes.push('ART do plano de rigging (falta)');
  else if (!artOk || f.anexos.arquivoArt !== `ART_${artNum}.pdf`) anexosPendentes.push('ART do plano de rigging (nome não confere com o nº da ART)');
  for (const g of [guindaste, ...adicionais.map((a) => a.guindaste)]) {
    if (!g) continue;
    const l = laudoAtual(g);
    if (!l?.arquivo) anexosPendentes.push(`Laudo técnico · ${g.modelo} (falta)`);
    if (!l?.art.trim()) anexosPendentes.push(`ART do laudo · ${g.modelo} (falta)`);
  }

  // ---------- consolidação ----------
  const camposInvalidos = Object.entries(campos).filter(([, c]) => c.ativo && c.erro).map(([chave, c]) => ({ chave, rotulo: c.rotulo, etapa: c.etapa, erro: c.erro! }));
  const resultadosOk = finito(pbKg) && finito(sapatas.esforcoKgf) && finito(sapatas.rmet);
  const capOk = (c: CapacidadeNoGrafico) => c.tipo === 'exato' || c.tipo === 'interpolado';
  const raioOk = !!guindaste && capOk(capacidade) && adicionais.every((a) => capOk(a.capacidade));
  const guindOk = finito(taxaGuindaste) && nivelGuindaste !== 'bloqueado' && !divisaoInvalida && adicionais.every((a) => !a.repetido && finito(a.taxaPct) && a.nivel !== 'bloqueado');
  const acessoriosOk = problemasLingada.length === 0 && porPosicao.every((r) => r.nivel !== 'bloqueado');
  const isolamentoOk = finito(isol);

  const taxas = [taxaGuindaste, ...adicionais.map((a) => a.taxaPct), ...porPosicao.map((r) => r.taxaPct)].filter(finito);
  const maiorTaxaPct = taxas.length ? Math.max(...taxas) : NaN;
  const nivelTxt = (taxa: number) => { const n = nivelTaxa(taxa, aviso, limite); return !finito(taxa) ? 'Bloqueado · —' : `${n === 'bloqueado' ? 'Bloqueado · ' : n === 'atencao' ? 'Atenção · ' : ''}${fmtPct(taxa)}`; };
  const raioDet = (nome: string, c: CapacidadeNoGrafico, r: number) =>
    `${nome}: ${c.tipo === 'sem-grafico' ? 'sem gráfico cadastrado' : !finito(r) || c.tipo === 'raio-invalido' ? 'raio inválido'
      : c.tipo === 'fora-do-grafico' ? `raio ${lido1(r)} m fora do gráfico (${fmt(c.alcanceMinM, 2)} a ${fmt(c.alcanceMaxM, 2)} m)` : `raio ${lido1(r)} m dentro do gráfico`}`;
  const nomeG = (g: Guindaste | null) => g?.modelo ?? 'guindaste não escolhido';
  const maiorPos = porPosicao.filter((r) => !r.problema && finito(r.taxaPct)).sort((a, b) => b.taxaPct - a.taxaPct)[0];
  const semRes = porPosicao.filter((r) => !r.problema && !finito(r.taxaPct)).map((r) => NOME_POSICAO[r.posicao]);

  const checklist: ItemChecklist[] = [
    { id: 'campos', rotulo: 'Todos os campos com valores válidos', ok: camposInvalidos.length === 0 && resultadosOk, etapa: camposInvalidos[0]?.etapa ?? 4,
      detalhe: camposInvalidos.length
        ? `${camposInvalidos.length} ${camposInvalidos.length > 1 ? 'campos vazios ou fora da faixa' : 'campo vazio ou fora da faixa'}: ${camposInvalidos.slice(0, 3).map((x) => x.rotulo.toLowerCase()).join(', ')}${camposInvalidos.length > 3 ? '…' : ''}`
        : resultadosOk ? 'nenhum campo vazio, inválido ou fora da faixa' : 'esforço nas sapatas ou RMET sem resultado (faltam dados do guindaste)' },
    { id: 'contratante', rotulo: 'Contratante e local da obra', ok: !!cliente && obraOk, etapa: 1,
      detalhe: `${cliente?.razaoSocial ?? 'sem contratante'} → obra: ${obraOk ? (f.obraMesmoEndereco ? 'endereço do contratante' : [f.obraNome, f.obraEndereco, `${f.obraCidade}${f.obraUf ? `/${f.obraUf.toUpperCase()}` : ''}`].filter((x) => x.trim()).join(' · ')) : 'falta endereço/cidade'}` },
    { id: 'data', rotulo: 'Data da operação informada', ok: dataOk, etapa: 1,
      detalhe: dataOk ? `${dataBR(dataOp)}${dataOperacao.anteriorAHoje ? ` · aviso: anterior a hoje (${dataBR(e.hoje)})` : ''}` : 'campo obrigatório: laudo e inspeções são conferidos contra ela' },
    { id: 'laudo', rotulo: 'Laudo do guindaste válido na data da operação', ok: laudosOk, etapa: 4,
      detalhe: [`${nomeG(guindaste)}: ${laudo.texto}`, ...adicionais.map((a) => `${nomeG(a.guindaste)}: ${a.laudo.texto}`)].join(' · ') + (dataOk ? ` · operação em ${dataBR(dataOp)}` : '') },
    { id: 'raio', rotulo: 'Raio dentro do gráfico de carga', ok: raioOk, etapa: 4,
      detalhe: [raioDet(nomeG(guindaste), capacidade, raio), ...adicionais.map((a) => raioDet(nomeG(a.guindaste), a.capacidade, a.raioM))].join(' · ') },
    { id: 'guindaste', rotulo: adicionais.length ? `Guindastes até ${lim}` : `Guindaste até ${lim}`, ok: guindOk, etapa: 4,
      detalhe: `${nomeG(guindaste)} ${nivelTxt(taxaGuindaste)}${adicionais.map((a) => ` · ${nomeG(a.guindaste)}${a.repetido ? ' repetido' : ` ${nivelTxt(a.taxaPct)}`}`).join('')}${divisaoInvalida ? ' · divisão da carga passa de 100%' : ''}` },
    { id: 'acessorios', rotulo: `Acessórios até ${lim}`, ok: acessoriosOk, etapa: 3,
      detalhe: problemasLingada.length ? problemasLingada.join('; ') : semRes.length ? `sem resultado por valor inválido: ${semRes.join(', ')}`
        : maiorPos ? `maior taxa: ${maiorPos.governante!.nomeCurto} (${NOME_POSICAO[maiorPos.posicao]}) ${nivelTxt(maiorPos.taxaPct)}` : '—' },
    { id: 'inspecoes', rotulo: 'Acessórios com inspeção em dia', ok: inspOk, etapa: 3, detalhe: inspDetalhe },
    { id: 'isolamento', rotulo: 'Raio de isolamento cobre o raio de operação', ok: isolamentoOk, etapa: 4,
      detalhe: isolamentoCurto ? `${lido1(lerNum(f.isolamento))} m · menor que o raio de operação (${lido1(raio)} m)` : finito(isol) ? `${lido1(isol)} m` : 'valor inválido' },
    { id: 'anexos', rotulo: 'Anexos obrigatórios', ok: anexosPendentes.length === 0, etapa: 5,
      detalhe: anexosPendentes.length ? anexosPendentes.join(', ') : 'desenhos, ART do plano, laudo e ART do guindaste' },
    { id: 'art', rotulo: 'Nº da ART do plano', ok: artOk, etapa: 1,
      detalhe: artNum ? artErro ?? `nº ${artNum}` : 'falta informar · vai no cabeçalho, no procedimento e nos desenhos' },
  ];

  // ---------- situação de segurança ----------
  const motivos: string[] = [];
  const posSemTaxa = porPosicao.some((r) => !r.problema && !finito(r.taxaPct));
  if (!finito(pbKg) || !finito(taxaGuindaste) || posSemTaxa || !resultadosOk || adicionais.some((a) => !a.repetido && !finito(a.taxaPct))) motivos.push('faltam valores válidos para calcular');
  if ((finito(taxaGuindaste) && nivelGuindaste === 'bloqueado') || adicionais.some((a) => finito(a.taxaPct) && nivelTaxa(a.taxaPct, aviso, limite) === 'bloqueado') || porPosicao.some((r) => finito(r.taxaPct) && r.nivel === 'bloqueado')) motivos.push(`taxa acima de ${lim}`);
  if (problemasLingada.length) motivos.push(`lingada incompleta (${problemasLingada[0]})`);
  if (!guindaste) motivos.push('guindaste não escolhido');
  else if (capacidade.tipo === 'sem-grafico') motivos.push(`sem gráfico de carga cadastrado para o ${guindaste.modelo}`);
  else if (capacidade.tipo === 'fora-do-grafico') motivos.push(`raio fora do gráfico de carga do ${guindaste.modelo}`);
  for (const a of adicionais) {
    if (a.repetido) motivos.push(`guindaste adicional ${a.indice + 1} repetido`);
    else if (a.capacidade.tipo === 'sem-grafico') motivos.push(`sem gráfico de carga para o ${nomeG(a.guindaste)}`);
    else if (a.capacidade.tipo === 'fora-do-grafico') motivos.push(`raio fora do gráfico do ${nomeG(a.guindaste)}`);
  }
  if (divisaoInvalida) motivos.push('divisão da carga entre guindastes passa de 100%');
  if (!laudosOk) {
    const ruim = [laudo, ...adicionais.map((a) => a.laudo)].map((l, i) => ({ l, g: i === 0 ? guindaste : adicionais[i - 1].guindaste })).filter((x) => !x.l.aprovado);
    for (const { l, g } of ruim) {
      motivos.push(l.situacao === 'vencido' ? `laudo do ${nomeG(g)} vencido em ${dataBR(l.fim)}` : l.situacao === 'sem-data' ? 'laudo do guindaste sem data da operação para conferir' : g ? `${nomeG(g)} sem laudo cadastrado` : 'guindaste não escolhido');
    }
  }
  if (dataOk && inspReprovadas.length) motivos.push(`acessório com inspeção vencida ou indisponível (${inspReprovadas[0].acessorio.nomeCurto})`);
  if (isolamentoCurto) motivos.push('raio de isolamento menor que o raio de operação');
  if (camposInvalidos.length) motivos.push(`${camposInvalidos.length} ${camposInvalidos.length > 1 ? 'campos vazios ou fora da faixa' : 'campo vazio ou fora da faixa'}`);
  const motivosBloqueio = [...new Set(motivos)];

  const situacaoSeguranca: SituacaoSeguranca = motivosBloqueio.length
    ? 'bloqueado'
    : piorSituacao([nivelGuindaste, ...adicionais.map((a) => a.nivel), ...porPosicao.map((r) => r.nivel)]);

  return {
    campos, camposInvalidos, dataOperacao, art: { numero: artNum, erro: artErro }, tipo, balancim, itens,
    cargaKg: peso, lingadaKg, dispositivosKg, extrasKg: extras, pbKg, pT, bT,
    guindaste, tabela, raioM: raio, capacidade, capacidadeKg: capKg, referenciaConservadora,
    pctPrincipal: fracao * 100, pbPrincipalKg, taxaGuindaste, nivelGuindaste, adicionais, divisaoInvalida,
    porPosicao, sapatas, rmet: sapatas.rmet, laudo,
    inspecoes: { itens: inspItens, ok: inspOk, detalhe: inspDetalhe },
    isolamentoOk, anexosPendentes, checklist, motivosBloqueio, maiorTaxaPct, situacaoSeguranca,
    podeEmitir: situacaoSeguranca !== 'bloqueado' && checklist.every((c) => c.ok),
  };
}

/** Texto da situação de segurança (com motivo quando bloqueado). `aviso` = início da faixa de atenção (Configurações). */
export function textoSituacao(r: Pick<ResultadoPlano, 'situacaoSeguranca' | 'motivosBloqueio'>, aviso = ATENCAO_PADRAO_PCT, limite = LIMITE_PCT): { titulo: string; texto: string } {
  const pct = `${numParaTexto(aviso)}%`;
  const lim = `${numParaTexto(limite)}%`;
  if (r.situacaoSeguranca === 'bloqueado') return { titulo: 'Bloqueado', texto: `${cap1(r.motivosBloqueio.join('; '))}.` };
  if (r.situacaoSeguranca === 'atencao') return { titulo: `Atenção · entre ${pct} e ${lim}`, texto: `Margem pequena até os ${lim}.` };
  return { titulo: 'Dentro do limite de segurança', texto: `Guindaste e acessórios abaixo de ${pct}.` };
}

/** 'Dentro do limite' · 'Atenção' · 'Bloqueado' */
export const ROTULO_SEGURANCA: Record<SituacaoSeguranca, string> = { ok: 'Dentro do limite', atencao: 'Atenção', bloqueado: 'Bloqueado' };

// =============================================================================================
// Resultados para gravar na revisão (cópia completa, NaN → null)
// =============================================================================================

const num = (v: number): number | null => (Number.isFinite(v) ? v : null);

/** Converte o resultado do cálculo no formato gravado em Revisao.resultados. */
export function resultadosDoCalculo(r: ResultadoPlano): ResultadosRevisao {
  const principal = r.guindaste
    ? [{ guindasteId: r.guindaste.id, modelo: r.guindaste.modelo, tabelaNome: r.tabela ? nomeGrafico(r.tabela) : null, raioM: num(r.raioM), pctCarga: num(r.pctPrincipal),
        cargaKg: num(r.pbPrincipalKg), capacidadeKg: num(r.capacidadeKg), taxaPct: num(r.taxaGuindaste), laudoFim: r.laudo.fim, laudoArt: r.laudo.laudo?.art ?? null }]
    : [];
  return {
    dataOperacao: r.dataOperacao.iso,
    cargaKg: num(r.cargaKg), lingadaKg: num(r.lingadaKg), dispositivosKg: num(r.dispositivosKg), extrasKg: num(r.extrasKg), pbKg: num(r.pbKg),
    guindastes: [...principal, ...r.adicionais.filter((a) => a.guindaste).map((a) => ({
      guindasteId: a.guindaste!.id, modelo: a.guindaste!.modelo, tabelaNome: a.tabela ? nomeGrafico(a.tabela) : null, raioM: num(a.raioM), pctCarga: num(a.pct),
      cargaKg: num(a.cargaKg), capacidadeKg: num(a.capacidadeKg), taxaPct: num(a.taxaPct), laudoFim: a.laudo.fim, laudoArt: a.laudo.laudo?.art ?? null,
    }))],
    capacidadeKg: num(r.capacidadeKg), taxaGuindastePct: num(r.taxaGuindaste),
    referenciaConservadoraKg: r.referenciaConservadora?.capacidadeKg ?? null, taxaReferenciaPct: num(r.referenciaConservadora?.taxaPct ?? NaN),
    posicoes: r.porPosicao.map((p) => ({
      posicao: p.posicao, acessorioId: p.governante?.id ?? null, descricao: p.governante?.descricao ?? ROTULO_POSICAO[p.posicao],
      anguloGraus: num(p.posicao === 'pernasSuperiores' ? r.campos.anguloSuperior?.valor ?? NaN : r.campos.anguloInferior?.valor ?? NaN),
      tracao: num(p.tracao), unidade: p.unidade, capacidade: num(p.capacidadeGovernante), taxaPct: num(p.taxaPct),
    })),
    sapatas: { momentoKgfm: num(r.sapatas.momentoKgfm), forcaKgf: num(r.sapatas.forcaKgf), esforcoKgf: num(r.sapatas.esforcoKgf), areaCm2: num(r.sapatas.areaCm2), rmet: num(r.sapatas.rmet) },
    raioIsolamentoM: num(r.campos.isolamento?.valor ?? NaN), ventoMaxMs: num(r.campos.vento?.valor ?? NaN),
    situacaoSeguranca: r.situacaoSeguranca, comoNoDocumento: null,
  };
}

// =============================================================================================
// Conversões plano ⇄ formulário
// =============================================================================================

/** Dados de um plano novo em branco (tipo padrão t1, vento padrão das Configurações). */
export function dadosVazios(ventoPadraoMs: number | null = 7): DadosPlano {
  return {
    clienteId: null, obra: { mesmoEnderecoContratante: false, nome: '', endereco: '', cidade: '', uf: '', cep: '' },
    dataOperacao: null, descricaoOperacao: '', rigger: '', art: '', artRegistradaEm: null,
    contratoArt: { numero: '', celebradoEm: null, valor: '', termino: null },
    carga: { descricao: '', comprimentoM: null, larguraM: null, alturaM: null, pesoKg: null },
    tipoIcamentoId: 't1', lingada: [], anguloInferiorGraus: null, anguloSuperiorGraus: null,
    dispositivo: { acessorioId: null, descricao: 'Balancim', quantidade: 1, pesoUnitarioKg: null }, cargasExtrasKg: 0,
    guindasteId: null, tabelaId: null, comprimentoLancaM: null, raioM: null, guindastesAdicionais: [],
    quadranteInicial: '', quadranteFinal: '', ventoMaxMs: ventoPadraoMs, raioIsolamentoM: null,
    dormente: { larguraCm: null, comprimentoCm: null, quantidade: 1 },
    anexos: { desenhos: null, artPlano: false, arquivoArt: null }, etapaAtual: 1, copiaDe: null, exemplo: false,
  };
}

const t = (v: number | null | undefined, minCasas = 0) => numParaTexto(v, minCasas);

/** Plano (números) → formulário (texto pt-BR). 3450 → "3.450"; raio 5 → "5,0". */
export function formDoPlano(p: DadosPlano): FormPlano {
  return {
    clienteId: p.clienteId, obraMesmoEndereco: p.obra.mesmoEnderecoContratante, obraNome: p.obra.nome, obraEndereco: p.obra.endereco,
    obraCidade: p.obra.cidade, obraUf: p.obra.uf, obraCep: p.obra.cep,
    dataOperacao: p.dataOperacao ?? '', descricao: p.descricaoOperacao, rigger: p.rigger, art: p.art,
    artContrato: p.contratoArt.numero, artCelebracao: p.contratoArt.celebradoEm ?? '', artValor: p.contratoArt.valor, artTermino: p.contratoArt.termino ?? '',
    cargaDescricao: p.carga.descricao, comprimento: t(p.carga.comprimentoM), largura: t(p.carga.larguraM), altura: t(p.carga.alturaM), peso: t(p.carga.pesoKg),
    tipoIcamentoId: p.tipoIcamentoId,
    lingada: p.lingada.map((l) => ({ acessorioId: l.acessorioId, quantidade: t(l.quantidade), posicao: l.posicao })),
    anguloInferior: t(p.anguloInferiorGraus), anguloSuperior: t(p.anguloSuperiorGraus),
    dispositivoAcessorioId: p.dispositivo.acessorioId, dispositivoDescricao: p.dispositivo.descricao, dispositivoQtd: t(p.dispositivo.quantidade), dispositivoPeso: t(p.dispositivo.pesoUnitarioKg),
    extras: t(p.cargasExtrasKg),
    guindasteId: p.guindasteId, tabelaId: p.tabelaId, lanca: t(p.comprimentoLancaM, 1), raio: t(p.raioM, 1), isolamento: t(p.raioIsolamentoM, 1),
    quadranteInicial: p.quadranteInicial, quadranteFinal: p.quadranteFinal, vento: t(p.ventoMaxMs, 1),
    guindastesAdicionais: p.guindastesAdicionais.map((a) => ({ guindasteId: a.guindasteId, tabelaId: a.tabelaId, raio: t(a.raioM, 1), pct: t(a.pct) })),
    dormenteLargura: t(p.dormente.larguraCm), dormenteComprimento: t(p.dormente.comprimentoCm), dormenteQtd: t(p.dormente.quantidade),
    anexos: { ...p.anexos },
  };
}

const n = (texto: string): number | null => { const v = lerNum(texto); return Number.isFinite(v) ? v : null; };
const d = (iso: string): ISODate | null => (dataIsoValida(iso) ? iso : null);

/**
 * Formulário (texto) → dados do plano (números; texto ilegível ou negativo vira null).
 * Campos que o formulário não tem (etapaAtual, copiaDe, exemplo, artRegistradaEm) vêm de `base`.
 */
export function planoDoForm(f: FormPlano, base: DadosPlano): DadosPlano {
  return {
    ...base,
    clienteId: f.clienteId,
    obra: { mesmoEnderecoContratante: f.obraMesmoEndereco, nome: f.obraNome, endereco: f.obraEndereco, cidade: f.obraCidade, uf: f.obraUf, cep: f.obraCep },
    dataOperacao: d(f.dataOperacao), descricaoOperacao: f.descricao, rigger: f.rigger, art: f.art.trim(),
    contratoArt: { numero: f.artContrato, celebradoEm: d(f.artCelebracao), valor: f.artValor, termino: d(f.artTermino) },
    carga: { descricao: f.cargaDescricao, comprimentoM: n(f.comprimento), larguraM: n(f.largura), alturaM: n(f.altura), pesoKg: n(f.peso) },
    tipoIcamentoId: f.tipoIcamentoId,
    lingada: f.lingada.filter((l) => l.acessorioId != null && l.posicao).map((l) => ({ acessorioId: l.acessorioId!, quantidade: n(l.quantidade) ?? 0, posicao: l.posicao as PosicaoLingada })),
    anguloInferiorGraus: n(f.anguloInferior), anguloSuperiorGraus: n(f.anguloSuperior),
    dispositivo: { acessorioId: f.dispositivoAcessorioId, descricao: f.dispositivoDescricao, quantidade: n(f.dispositivoQtd), pesoUnitarioKg: n(f.dispositivoPeso) },
    cargasExtrasKg: n(f.extras),
    guindasteId: f.guindasteId, tabelaId: f.tabelaId, comprimentoLancaM: n(f.lanca), raioM: n(f.raio),
    guindastesAdicionais: f.guindastesAdicionais.filter((a) => a.guindasteId != null).map((a) => ({ guindasteId: a.guindasteId!, tabelaId: a.tabelaId, raioM: n(a.raio), pct: n(a.pct) })),
    quadranteInicial: f.quadranteInicial, quadranteFinal: f.quadranteFinal, ventoMaxMs: n(f.vento), raioIsolamentoM: n(f.isolamento),
    dormente: { larguraCm: n(f.dormenteLargura), comprimentoCm: n(f.dormenteComprimento), quantidade: n(f.dormenteQtd) },
    anexos: { ...f.anexos },
  };
}

/** Formulário em branco */
export const formVazio = (ventoPadraoMs: number | null = 7): FormPlano => formDoPlano(dadosVazios(ventoPadraoMs));

/** Mapa nº da ART → nº do plano, para `EntradaCalculo.artsEmUso`. */
export function artsEmUso(planos: Pick<PlanoRigging, 'art' | 'numero'>[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of planos) if (p.art.trim()) m[p.art.trim()] = p.numero;
  return m;
}

// =============================================================================================
// Revisões, situação do documento e arquivo
// =============================================================================================

/** Última revisão emitida (null se nunca foi emitido). */
export const revisaoAtual = (p: Pick<PlanoRigging, 'revisoes'>) => (p.revisoes.length ? p.revisoes[p.revisoes.length - 1] : null);
/** Nº da revisão que a próxima emissão vai gerar (rascunho nunca emitido → 1). */
export const proximaRevisao = (p: Pick<PlanoRigging, 'revisoes'>) => (revisaoAtual(p)?.numero ?? 0) + 1;

/** "Rascunho" · "Rascunho da Rev. 3" · "Emitido · Rev. 2" */
export function rotuloDocumento(p: Pick<PlanoRigging, 'situacaoDocumento' | 'revisoes'>): string {
  if (p.situacaoDocumento === 'emitido') return `Emitido · Rev. ${revisaoAtual(p)?.numero ?? 1}`;
  return p.revisoes.length ? `Rascunho da Rev. ${proximaRevisao(p)}` : 'Rascunho';
}

/** Nome do PDF: nomeArquivoPlano('Plano_de_Rigging_{nº}_Rev{rev}.pdf', '2607036', 2) → 'Plano_de_Rigging_2607036_Rev2.pdf' */
export function nomeArquivoPlano(modelo: string, numero: string, rev: number): string {
  return modelo.split('{nº}').join(numero).split('{rev}').join(String(rev));
}

/** `<pasta raiz>\<cliente>\<nº>\Relatório\<arquivo>`, com `/` quando a pasta raiz é do macOS/Linux (`/Users/…`). */
export function caminhoPlano(config: Pick<Configuracoes, 'pastaRaiz' | 'nomeArquivo'>, nomePastaCliente: string, numero: string, rev: number): string {
  const sep = config.pastaRaiz.startsWith('/') ? '/' : '\\';
  const raiz = config.pastaRaiz.replace(/[\\/]+$/, '');
  return [raiz, nomePastaCliente, numero, 'Relatório', nomeArquivoPlano(config.nomeArquivo, numero, rev)].join(sep);
}

/** Pasta de um caminho (com a barra final), em qualquer sistema. */
export const pastaDe = (caminho: string) => caminho.slice(0, Math.max(caminho.lastIndexOf('\\'), caminho.lastIndexOf('/')) + 1);

// =============================================================================================
// Rascunho local (recuperar se o RibasRig fechar no meio do plano)
// =============================================================================================

export const CHAVE_RASCUNHO = 'ribasrig.rascunho';
/**
 * Cópia local só existe enquanto há alterações ainda não salvas na api (o salvamento bem-sucedido apaga).
 * `usuario` = login de quem editava: a recuperação só é oferecida a ele.
 */
export interface RascunhoLocal { numero: string | null; form: FormPlano; etapa: Etapa; salvoEm: ISODateTime; usuario?: string }

export function lerRascunho(): RascunhoLocal | null {
  try {
    const s = localStorage.getItem(CHAVE_RASCUNHO);
    const r = s ? (JSON.parse(s) as RascunhoLocal) : null;
    // Completa com os campos atuais do formulário (cópia gravada antes de um campo novo existir)
    return r && r.form && Array.isArray(r.form.lingada) ? { ...r, form: { ...formVazio(), ...r.form } } : null;
  } catch { return null; }
}

export function gravarRascunho(r: RascunhoLocal | null): void {
  try {
    if (r) localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
    else localStorage.removeItem(CHAVE_RASCUNHO);
  } catch { /* sem armazenamento: segue sem recuperação */ }
}
