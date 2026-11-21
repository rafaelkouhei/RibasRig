// Motor de cálculos do Plano de Rigging — funções puras, sem React e SEM ARREDONDAR NADA.
// Fórmulas conferidas com o memorial de cálculo da Guindastes Ribas (plano 2607036, Rev. 2).
// A mesma lógica deve existir no back-end (Django) para validar antes de emitir.
import { dataIsoValida, diasEntre } from './formatacao';
import type { Acessorio, Guindaste, ISODate, Laudo, PontoGrafico, PosicaoLingada, SituacaoSeguranca, TabelaCapacidade } from './types';

/** Limite padrão da taxa de utilização: acima dele bloqueia (o valor exato é permitido). */
export const LIMITE_PADRAO_PCT = 85;
/**
 * Limite em uso. Com o servidor, vem das Configurações (`definirLimite`, chamado em main.tsx e ao salvar as
 * Configurações); é um `let` exportado, então quem importa sempre lê o valor atual.
 */
export let LIMITE_PCT = LIMITE_PADRAO_PCT;
export function definirLimite(pct: number): void {
  if (Number.isFinite(pct) && pct > 0) LIMITE_PCT = pct;
}
/** Padrão do aviso de atenção (o valor usado vem de Configuracoes.avisoAtencaoPct) */
export const ATENCAO_PADRAO_PCT = 75;
/** Dias antes do vencimento (laudo e inspeção) em que o sistema passa a avisar */
export const AVISO_VENCIMENTO_DIAS = 30;
/**
 * Tolerância numérica (em pontos percentuais) só para absorver erro de ponto flutuante
 * (ex.: 7871 / 9260 × 100 = 85,00000000000001). O valor guardado nunca é arredondado.
 */
export const TOLERANCIA_PCT = 1e-9;

const finitoNaoNegativo = (v: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * Nível de uma taxa de utilização (%). NaN, infinito ou negativo = 'bloqueado' (nunca "dentro do limite").
 * nivelTaxa(85) → 'atencao' · nivelTaxa(85.06) → 'bloqueado' · nivelTaxa(75) → 'atencao' · nivelTaxa(74.99) → 'ok'
 * (com o limite padrão de 85%; `limitePct` vem das Configurações)
 */
export function nivelTaxa(taxaPct: number, avisoAtencaoPct: number = ATENCAO_PADRAO_PCT, limitePct: number = LIMITE_PCT): SituacaoSeguranca {
  if (!finitoNaoNegativo(taxaPct)) return 'bloqueado';
  if (taxaPct > limitePct + TOLERANCIA_PCT) return 'bloqueado';
  if (taxaPct >= avisoAtencaoPct - TOLERANCIA_PCT) return 'atencao';
  return 'ok';
}

/** Pior situação de uma lista (bloqueado > atencao > ok). Lista vazia = 'ok'. */
export function piorSituacao(lista: SituacaoSeguranca[]): SituacaoSeguranca {
  if (lista.includes('bloqueado')) return 'bloqueado';
  if (lista.includes('atencao')) return 'atencao';
  return 'ok';
}

/** carga ÷ capacidade × 100. Qualquer valor inválido, negativo ou capacidade ≤ 0 = NaN. */
export function taxaPct(carga: number, capacidade: number): number {
  if (!finitoNaoNegativo(carga) || !(Number.isFinite(capacidade) && capacidade > 0)) return NaN;
  return (carga / capacidade) * 100;
}

// =============================================================================================
// Gráfico de carga
// =============================================================================================

export type CapacidadeNoGrafico =
  | { tipo: 'sem-grafico' }
  | { tipo: 'raio-invalido' }
  /** Abaixo do primeiro OU acima do último alcance: BLOQUEIA (não extrapola). */
  | { tipo: 'fora-do-grafico'; lado: 'abaixo' | 'acima'; alcanceMinM: number; alcanceMaxM: number }
  | { tipo: 'exato'; capacidadeKg: number; ponto: PontoGrafico; alcanceMinM: number; alcanceMaxM: number }
  | { tipo: 'interpolado'; capacidadeKg: number; p1: PontoGrafico; p2: PontoGrafico; alcanceMinM: number; alcanceMaxM: number };

/** Pontos válidos e ordenados por alcance; null se o gráfico tiver ponto inválido ou alcance repetido. */
export function pontosOrdenados(pontos: PontoGrafico[]): PontoGrafico[] | null {
  if (!pontos.length) return null;
  if (pontos.some((p) => !(Number.isFinite(p.alcanceM) && p.alcanceM > 0 && Number.isFinite(p.capacidadeKg) && p.capacidadeKg > 0))) return null;
  const pts = [...pontos].sort((a, b) => a.alcanceM - b.alcanceM);
  for (let i = 1; i < pts.length; i++) if (pts[i].alcanceM === pts[i - 1].alcanceM) return null;
  return pts;
}

/**
 * Capacidade no raio por interpolação linear entre os pontos do gráfico (confirmado pelo engenheiro).
 * MD 45.007, raio 5,0 → { tipo: 'interpolado', capacidadeKg: 9260 } · raio 5,98 → 'exato' 7300 · raio 3 ou 18 → 'fora-do-grafico'.
 * Gráfico vazio ou com ponto inválido → 'sem-grafico'.
 */
export function capacidadeNoGrafico(pontos: PontoGrafico[], raioM: number): CapacidadeNoGrafico {
  const pts = pontosOrdenados(pontos);
  if (!pts) return { tipo: 'sem-grafico' };
  if (!(Number.isFinite(raioM) && raioM > 0)) return { tipo: 'raio-invalido' };
  const alcanceMinM = pts[0].alcanceM, alcanceMaxM = pts[pts.length - 1].alcanceM;
  if (raioM < alcanceMinM) return { tipo: 'fora-do-grafico', lado: 'abaixo', alcanceMinM, alcanceMaxM };
  if (raioM > alcanceMaxM) return { tipo: 'fora-do-grafico', lado: 'acima', alcanceMinM, alcanceMaxM };
  const exato = pts.find((p) => p.alcanceM === raioM);
  if (exato) return { tipo: 'exato', capacidadeKg: exato.capacidadeKg, ponto: exato, alcanceMinM, alcanceMaxM };
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    if (raioM > p1.alcanceM && raioM < p2.alcanceM) {
      const capacidadeKg = p1.capacidadeKg + ((raioM - p1.alcanceM) * (p2.capacidadeKg - p1.capacidadeKg)) / (p2.alcanceM - p1.alcanceM);
      return { tipo: 'interpolado', capacidadeKg, p1, p2, alcanceMinM, alcanceMaxM };
    }
  }
  return { tipo: 'sem-grafico' }; // inalcançável com pontos válidos
}

/** Capacidade (kg) de um resultado de `capacidadeNoGrafico`; NaN quando não há. */
export function capacidadeKg(r: CapacidadeNoGrafico): number {
  return r.tipo === 'exato' || r.tipo === 'interpolado' ? r.capacidadeKg : NaN;
}

/**
 * Referência conservadora: capacidade do primeiro ponto com alcance ≥ raio
 * ("Extensão que alcança o raio"). MD 45.007, raio 5,0 → { alcanceM: 5.98, capacidadeKg: 7300 }.
 * Fora do gráfico, raio inválido ou sem gráfico = null. Só informativa: não bloqueia.
 */
export function extensaoQueAlcanca(pontos: PontoGrafico[], raioM: number): PontoGrafico | null {
  const pts = pontosOrdenados(pontos);
  if (!pts || !(Number.isFinite(raioM) && raioM > 0) || raioM < pts[0].alcanceM) return null;
  return pts.find((p) => p.alcanceM >= raioM) ?? null;
}

/** Gráfico escolhido do guindaste (pelo id) ou, sem id/id inexistente, o primeiro. null = sem gráfico. */
export function tabelaDoGuindaste(g: Guindaste | null | undefined, tabelaId: string | null | undefined): TabelaCapacidade | null {
  if (!g || !g.tabelas.length) return null;
  return g.tabelas.find((t) => t.id === tabelaId) ?? g.tabelas[0];
}

/** "Gráfico de carga · lança principal (8 extensões)" */
export function nomeGrafico(t: TabelaCapacidade | null | undefined): string {
  if (!t) return 'sem gráfico cadastrado';
  const n = t.pontos.length;
  return `Gráfico de carga · ${t.nome} (${n} ${n === 1 ? 'extensão' : 'extensões'})`;
}

// =============================================================================================
// Lingada: tração por posição
// =============================================================================================

export interface EntradaTracoes {
  /** P = carga + cargas extras, em t */
  pT: number;
  /** Peso do balancim/dispositivos, em t (0 sem balancim) */
  balancimT: number;
  /** Graus a partir da vertical. Sem balancim: ângulo único das pernas. */
  anguloInferior: number;
  anguloSuperior: number;
  balancim: boolean;
}

const rad = (graus: number) => (graus * Math.PI) / 180;
/** cos em graus; ≤ 0 (90° ou mais) ou entrada inválida = NaN */
const cosPositivo = (graus: number) => {
  if (!Number.isFinite(graus) || graus < 0) return NaN;
  const c = Math.cos(rad(graus));
  return c > 1e-12 ? c : NaN;
};

/**
 * Tração (t) ou esforço (tf) em cada posição. Fórmulas da especificação:
 * - com balancim: inferiores = P ÷ (2·cos αi) · superiores = (P + B) ÷ (2·cos αs) · carga = P ÷ (4·cos αi) · gancho = 2·Te superior
 * - sem balancim: pernas (inferiores) = P ÷ (2·cos α) · carga = P ÷ (2·cos α) · gancho = 2·Te das pernas · superiores = não existe (NaN)
 * Qualquer NaN, negativo ou cos ≤ 0 = NaN (bloqueia).
 */
export function tracoesPorPosicao(e: EntradaTracoes): Record<PosicaoLingada, number> {
  const P = finitoNaoNegativo(e.pT) ? e.pT : NaN;
  const B = e.balancim ? (finitoNaoNegativo(e.balancimT) ? e.balancimT : NaN) : 0;
  const ci = cosPositivo(e.anguloInferior);
  if (e.balancim) {
    const cs = cosPositivo(e.anguloSuperior);
    const sup = (P + B) / (2 * cs);
    return { pernasInferiores: P / (2 * ci), pernasSuperiores: sup, carga: P / (4 * ci), gancho: 2 * sup };
  }
  const pernas = P / (2 * ci);
  return { pernasInferiores: pernas, pernasSuperiores: NaN, carga: P / (2 * ci), gancho: 2 * pernas };
}

/** Texto da fórmula de cada posição (para o memorial e a tela). */
export function formulaPosicao(posicao: PosicaoLingada, balancim: boolean, angInf: string, angSup: string): string {
  if (balancim) {
    return { pernasInferiores: `P ÷ (2 · cos ${angInf})`, pernasSuperiores: `(P + balancim) ÷ (2 · cos ${angSup})`, carga: `P ÷ (4 · cos ${angInf})`, gancho: '2 · Te superior' }[posicao];
  }
  return { pernasInferiores: `P ÷ (2 · cos ${angInf})`, pernasSuperiores: 'não existe neste tipo', carga: `P ÷ (2 · cos ${angInf})`, gancho: '2 · Te das pernas' }[posicao];
}

/** Capacidade usada no cálculo: capacidade de trabalho; sem ela, a capacidade nominal. NaN se não houver. */
export function capacidadeDeTrabalho(a: Acessorio | null | undefined): number {
  if (!a) return NaN;
  const c = a.capacidadeTrabalhoT ?? a.capacidadeT;
  return c != null && Number.isFinite(c) && c > 0 ? c : NaN;
}

// =============================================================================================
// Sapatas e terreno
// =============================================================================================

export interface EntradaSapatas {
  /** Carga bruta (Pb) que este guindaste levanta, em kg (= kgf) */
  pbKg: number;
  raioM: number;
  pgKgf: number;
  aM: number;
  bM: number;
  dormente: { larguraCm: number; comprimentoCm: number; quantidade: number };
}

export interface ResultadoSapatas { momentoKgfm: number; forcaKgf: number; esforcoKgf: number; areaCm2: number; rmet: number }

/**
 * M = Pb × R · F = M ÷ (a + b) · ES = Pg ÷ 2 + F · área = LD × CD × ND · RMET = ES ÷ área (kgf/cm²)
 * 2607036: Pb 3.746,62, R 5, Pg 11.550, a 2,95, b 5,70, dormente 50 × 50 × 1 → ES 7.940,68 kgf, RMET 3,1763.
 * Entrada inválida ou negativa → NaN no que depende dela.
 */
export function esforcoSapatas(e: EntradaSapatas): ResultadoSapatas {
  const ok = (v: number) => (finitoNaoNegativo(v) ? v : NaN);
  const momentoKgfm = ok(e.pbKg) * ok(e.raioM);
  const vao = ok(e.aM) + ok(e.bM);
  const forcaKgf = vao > 0 ? momentoKgfm / vao : NaN;
  const esforcoKgf = ok(e.pgKgf) / 2 + forcaKgf;
  const areaCm2 = ok(e.dormente.larguraCm) * ok(e.dormente.comprimentoCm) * ok(e.dormente.quantidade);
  const rmet = areaCm2 > 0 ? esforcoKgf / areaCm2 : NaN;
  return { momentoKgfm, forcaKgf, esforcoKgf, areaCm2, rmet };
}

// =============================================================================================
// Laudo do guindaste e inspeção dos acessórios
// =============================================================================================

export type SituacaoLaudo = 'vencido' | 'vence-em-breve' | 'em-dia' | 'nao-cadastrado' | 'sem-data';

export interface ResultadoLaudo {
  /**
   * vencido = data de referência depois do fim · vence-em-breve = faltam 0 a 30 dias · em-dia ·
   * nao-cadastrado = sem laudo ou laudo sem data de fim · sem-data = sem data de referência (operação) para conferir
   */
  situacao: SituacaoLaudo;
  /** true só para 'em-dia' e 'vence-em-breve'. Sem laudo ou sem data = reprova. */
  aprovado: boolean;
  /** Dias da data de referência até o fim do laudo (negativo = vencido há N dias). null sem datas. */
  dias: number | null;
  fim: ISODate | null;
  laudo: Laudo | null;
  /** Texto curto: "vencido em 06/10/2026", "válido até 06/10/2026", "vence em 5 dias", "sem laudo cadastrado"… */
  texto: string;
}

/** Laudo vigente: o marcado como atual; senão, o de fim mais recente. */
export function laudoAtual(g: Guindaste | null | undefined): Laudo | null {
  if (!g || !g.laudos.length) return null;
  return g.laudos.find((l) => l.atual) ?? [...g.laudos].sort((a, b) => String(b.fim ?? '').localeCompare(String(a.fim ?? '')))[0];
}

const br = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };

/**
 * Situação do laudo do guindaste numa data. No plano a referência é a DATA DA OPERAÇÃO;
 * no cadastro de guindastes, HOJE.
 * MD 45.007 (laudo até 06/10/2026): em 24/07/2026 → 'em-dia'; em 15/10/2026 → 'vencido'; em 07/10/2026 → 'vencido'.
 */
export function situacaoLaudo(g: Guindaste | null | undefined, dataReferencia: ISODate | null | undefined): ResultadoLaudo {
  const laudo = laudoAtual(g);
  const fim = laudo?.fim && dataIsoValida(laudo.fim) ? laudo.fim : null;
  if (!laudo || !fim) return { situacao: 'nao-cadastrado', aprovado: false, dias: null, fim: null, laudo, texto: 'sem laudo cadastrado' };
  if (!dataReferencia || !dataIsoValida(dataReferencia)) return { situacao: 'sem-data', aprovado: false, dias: null, fim, laudo, texto: 'sem data da operação para conferir' };
  const dias = diasEntre(dataReferencia, fim);
  if (dias < 0) return { situacao: 'vencido', aprovado: false, dias, fim, laudo, texto: `vencido em ${br(fim)}` };
  if (dias <= AVISO_VENCIMENTO_DIAS) {
    return { situacao: 'vence-em-breve', aprovado: true, dias, fim, laudo, texto: dias === 0 ? `vence no dia (${br(fim)})` : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${br(fim)})` };
  }
  return { situacao: 'em-dia', aprovado: true, dias, fim, laudo, texto: `válido até ${br(fim)}` };
}

export type SituacaoInspecao = 'em-dia' | 'vence-em-breve' | 'vencida' | 'sem-inspecao' | 'indisponivel' | 'sem-data';

export interface ResultadoInspecao {
  /**
   * em-dia · vence-em-breve (0 a 30 dias) · vencida (próxima inspeção antes da data de referência) ·
   * sem-inspecao (próxima inspeção não informada) · indisponivel (em inspeção, descartado ou inativo) · sem-data (sem data de referência)
   */
  situacao: SituacaoInspecao;
  aprovado: boolean;
  /** Dias da data de referência até a data-limite (`proxima`). null sem datas. */
  dias: number | null;
  /** Data-limite que definiu a situação: a próxima inspeção ou, se `motivo` = 'validade', o vencimento do item. */
  proxima: ISODate | null;
  /** O que definiu a situação: a inspeção periódica ou o vencimento (validade) do acessório. */
  motivo: 'inspecao' | 'validade';
  texto: string;
}

/**
 * Inspeção e validade de um acessório numa data. No plano a referência é a DATA DA OPERAÇÃO; na tela de acessórios, HOJE.
 * Cinta plana 3 m (próxima 20/10/2026): em HOJE → 'vence-em-breve', dias 13 ("vence em 13 dias"); em 15/10/2026 → aprovado.
 * Validade (vencimento do item, resposta 25): vencida reprova como a inspeção vencida; nos 30 dias antes, avisa.
 * Vale o que vence primeiro.
 */
export function situacaoInspecao(a: Acessorio | null | undefined, dataReferencia: ISODate | null | undefined): ResultadoInspecao {
  const insp = situacaoSoInspecao(a, dataReferencia);
  const venc = a?.vencimento && dataIsoValida(a.vencimento) ? a.vencimento : null;
  if (!a || a.situacao !== 'uso' || !venc || !dataReferencia || !dataIsoValida(dataReferencia)) return insp;
  const dias = diasEntre(dataReferencia, venc);
  if (dias < 0) return { situacao: 'vencida', aprovado: false, dias, proxima: venc, motivo: 'validade', texto: `validade vencida em ${br(venc)}` };
  if (!insp.aprovado) return insp;
  if (dias <= AVISO_VENCIMENTO_DIAS && (insp.dias == null || dias <= insp.dias)) {
    return { situacao: 'vence-em-breve', aprovado: true, dias, proxima: venc, motivo: 'validade', texto: dias === 0 ? `validade vence no dia (${br(venc)})` : `validade vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${br(venc)})` };
  }
  return insp;
}

/** Só a inspeção periódica (próxima inspeção), sem olhar a validade do item. */
function situacaoSoInspecao(a: Acessorio | null | undefined, dataReferencia: ISODate | null | undefined): ResultadoInspecao {
  const motivo = 'inspecao';
  if (!a) return { situacao: 'indisponivel', aprovado: false, dias: null, proxima: null, motivo, texto: 'acessório não cadastrado' };
  const proxima = a.proximaInspecao && dataIsoValida(a.proximaInspecao) ? a.proximaInspecao : null;
  if (a.situacao !== 'uso') {
    const t = { inspecao: 'em inspeção', descartado: 'descartado', inativo: 'inativo' }[a.situacao];
    return { situacao: 'indisponivel', aprovado: false, dias: null, proxima, motivo, texto: t };
  }
  if (!proxima) return { situacao: 'sem-inspecao', aprovado: false, dias: null, proxima: null, motivo, texto: 'próxima inspeção não informada' };
  if (!dataReferencia || !dataIsoValida(dataReferencia)) return { situacao: 'sem-data', aprovado: false, dias: null, proxima, motivo, texto: 'sem data da operação para conferir' };
  const dias = diasEntre(dataReferencia, proxima);
  if (dias < 0) return { situacao: 'vencida', aprovado: false, dias, proxima, motivo, texto: `inspeção vencida em ${br(proxima)}` };
  if (dias <= AVISO_VENCIMENTO_DIAS) {
    return { situacao: 'vence-em-breve', aprovado: true, dias, proxima, motivo, texto: dias === 0 ? `inspeção vence no dia (${br(proxima)})` : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${br(proxima)})` };
  }
  return { situacao: 'em-dia', aprovado: true, dias, proxima, motivo, texto: `inspeção em dia até ${br(proxima)}` };
}

/** O raio de isolamento precisa cobrir todo o giro da carga (≥ raio de operação). */
export function isolamentoCobre(raioIsolamentoM: number, raioOperacaoM: number): boolean {
  return Number.isFinite(raioIsolamentoM) && Number.isFinite(raioOperacaoM) && raioIsolamentoM > 0 && raioIsolamentoM >= raioOperacaoM;
}
