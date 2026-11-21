// Lógica pura da Visualização: quais versões do documento dá para exibir (revisões emitidas e a prévia do rascunho)
// e os textos da ficha de dados de cada uma. Sem React, para testar.
import { casasDe, dataBR, dataHoraBR, fmt } from '../../domain/formatacao';
import { resultadosDoCalculo, rotuloDocumento, type ResultadoPlano } from '../../domain/plano';
import type { Acessorio, PlanoRigging, Revisao, ResultadosRevisao, TipoAcessorio } from '../../domain/types';

/** Seções do documento na ordem do PDF. */
export const SECOES_DOCUMENTO = [
  { rotulo: 'Ficha de dados', paginas: 'Pág. 1', origem: 'gerada pelo sistema' },
  { rotulo: 'Desenhos', paginas: 'Pág. 2–4', origem: 'anexo · SolidWorks' },
  { rotulo: 'ART do plano', paginas: 'Pág. 5', origem: 'anexo · CREA-PR' },
  { rotulo: 'Procedimento operacional', paginas: 'Pág. 6–7', origem: 'modelo + dados do plano' },
  { rotulo: 'Laudo e ART do guindaste', paginas: 'Pág. 8–10', origem: 'anexo · cadastro' },
] as const;

export type IdVista = number | 'rascunho';

export interface VistaPlano {
  id: IdVista;
  /** Rótulo do seletor: "Rev. 2 · sistema", "Rev. 1 · Excel", "Prévia do rascunho" */
  rotulo: string;
  revisao: Revisao | null;
  /** Resultados exibidos: os gravados na revisão ou, na prévia, o cálculo atual */
  resultados: ResultadosRevisao;
  /** Só na revisão do Excel: números como impressos no documento */
  doc: Record<string, string> | null;
  /** Selo ao lado do título */
  selo: string;
  nota: string;
  /** Nota em laranja (revisão do Excel com números errados) */
  notaAlerta: boolean;
}

export const NOTA_PREVIA = 'Prévia do rascunho com o cálculo atual dos dados. Os números mudam enquanto o plano é editado; só a emissão grava uma revisão.';

function notaRevisao(r: Revisao): string {
  if (r.observacao.trim()) return r.observacao;
  return r.origem === 'excel'
    ? `Emitida no Excel em ${dataBR(r.emitidaEm)}, antes do sistema, e guardada como foi entregue.`
    : `Emitida pelo sistema em ${dataHoraBR(r.emitidaEm)} por ${r.emitidaPor}. Os números são os gravados na emissão.`;
}

/** Versões exibíveis, da mais nova para a mais antiga. Rascunho: a prévia vem primeiro. */
export function vistasDoPlano(plano: PlanoRigging, calculo: ResultadoPlano): VistaPlano[] {
  const vistas: VistaPlano[] = [];
  if (plano.situacaoDocumento === 'rascunho') {
    vistas.push({
      id: 'rascunho', rotulo: plano.revisoes.length ? `Rascunho da Rev. ${plano.revisoes.length + 1}` : 'Prévia do rascunho', revisao: null,
      resultados: resultadosDoCalculo(calculo), doc: null, selo: rotuloDocumento(plano).toUpperCase(), nota: NOTA_PREVIA, notaAlerta: false,
    });
  }
  for (const r of [...plano.revisoes].reverse()) {
    const excel = r.origem === 'excel';
    vistas.push({
      id: r.numero, rotulo: `Rev. ${r.numero} · ${excel ? 'Excel' : 'sistema'}`, revisao: r, resultados: r.resultados,
      doc: r.resultados.comoNoDocumento, selo: `EMITIDO · REV. ${r.numero}${excel ? ' (EXCEL)' : ''}`,
      nota: notaRevisao(r), notaAlerta: excel && !!r.observacao.trim(),
    });
  }
  return vistas;
}

/** Vista pedida pelo parâmetro ?rev= (número da revisão); sem parâmetro ou inexistente, a primeira. */
export function escolherVista(vistas: VistaPlano[], rev: string | null): VistaPlano {
  return vistas.find((v) => rev != null && String(v.id) === rev) ?? vistas[0];
}

// =============================================================================================
// Textos da ficha de dados
// =============================================================================================

/** Inteiro sem casas, senão 2 casas (capacidade 9.260 kg; 3.746,62 kg) */
export const kg = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? fmt(v, Math.abs(v - Math.round(v)) < 1e-6 ? 0 : 2) : '—');
/** Como digitado (3.450; 4,87; 1,7; 250). Totais de valores digitados (6 × 1,7) sem ruído de ponto flutuante: 10,2. */
export const comoDigitado = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? fmt(v, casasDe(Number(v.toFixed(4)))) : '—');

export interface ValoresFicha {
  data: string; liq: string; lingada: string; dispositivos: string; extras: string; pb: string; pbT: string;
  raio: string; cap: string; capCarga: string; taxa: string;
  cinta: string; tubular: string; laco: string; manilha: string; es: string; rmet: string; isolamento: string; vento: string;
}

/** Maior taxa entre as posições cujo acessório é do tipo pedido. Sem posição desse tipo = "–". Posição sem taxa = "—". */
function taxaDoTipo(r: ResultadosRevisao, acessorios: Acessorio[], tipo: TipoAcessorio): string {
  const doTipo = r.posicoes.filter((p) => acessorios.find((a) => a.id === p.acessorioId)?.tipo === tipo);
  if (!doTipo.length) return '–';
  const taxas = doTipo.map((p) => p.taxaPct).filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  return taxas.length ? fmt(Math.max(...taxas), 2) : '—';
}

/**
 * Valores da ficha (pág. 1). Revisão emitida: os resultados gravados; revisão do Excel: os números como impressos
 * (`comoNoDocumento`) onde existirem. `lingadaItensKg` completa a composição quando a revisão do Excel não gravou a lingada.
 */
export function valoresFicha(v: VistaPlano, plano: PlanoRigging, acessorios: Acessorio[], lingadaItensKg: number): ValoresFicha {
  const r = v.resultados;
  const g = r.guindastes[0];
  const cap = r.capacidadeKg;
  const extras = r.extrasKg;
  const base: ValoresFicha = {
    data: dataBR(r.dataOperacao ?? plano.dataOperacao),
    liq: comoDigitado(r.cargaKg),
    lingada: fmt(r.lingadaKg ?? lingadaItensKg, 2),
    dispositivos: comoDigitado(r.dispositivosKg ?? (plano.dispositivo.quantidade ?? 0) * (plano.dispositivo.pesoUnitarioKg ?? 0)),
    extras: extras == null || extras === 0 ? '–' : comoDigitado(extras),
    pb: fmt(r.pbKg, 2),
    pbT: fmt(r.pbKg == null ? null : r.pbKg / 1000, 2),
    raio: fmt(g?.raioM ?? plano.raioM, 1),
    cap: fmt(cap == null ? null : cap / 1000, 2),
    capCarga: fmt(cap == null ? null : cap / 1000, 2),
    taxa: fmt(r.taxaGuindastePct, 2),
    cinta: taxaDoTipo(r, acessorios, 'cinta'),
    tubular: taxaDoTipo(r, acessorios, 'tubular'),
    laco: taxaDoTipo(r, acessorios, 'laco'),
    manilha: taxaDoTipo(r, acessorios, 'manilha'),
    es: fmt(r.sapatas.esforcoKgf, 2),
    rmet: fmt(r.sapatas.rmet, 2),
    isolamento: fmt(r.raioIsolamentoM, 1),
    vento: fmt(r.ventoMaxMs, 1),
  };
  if (!v.doc) return base;
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof ValoresFicha)[]) {
    const impresso = v.doc[k];
    if (impresso != null) out[k] = impresso;
  }
  return out;
}

// =============================================================================================
// Resumo de revisões e histórico (lateral)
// =============================================================================================

export type CorMarcador = 'atual' | 'antiga' | 'art' | 'cadastro' | 'rascunho';
export interface ItemResumo { titulo: string; meta: string; cor: CorMarcador }

/** Rascunho em edição, revisões (mais nova primeiro), ART registrada e cadastro de revisões do Excel. */
export function resumoHistorico(plano: PlanoRigging): ItemResumo[] {
  const itens: ItemResumo[] = [];
  if (plano.situacaoDocumento === 'rascunho') {
    itens.push({ titulo: rotuloDocumento(plano), meta: `atualizado em ${dataHoraBR(plano.atualizadoEm)} · ${plano.criadoPor}`, cor: 'rascunho' });
    if (plano.copiaDe && !plano.revisoes.length) itens.push({ titulo: `Cópia do plano ${plano.copiaDe}`, meta: `criado em ${dataHoraBR(plano.criadoEm)}`, cor: 'cadastro' });
  }
  const temExcel = plano.revisoes.some((r) => r.origem === 'excel');
  const ultima = plano.revisoes[plano.revisoes.length - 1];
  for (const r of [...plano.revisoes].reverse()) {
    const cor: CorMarcador = r === ultima ? 'atual' : 'antiga';
    if (r.origem === 'excel') {
      itens.push({ titulo: `Rev. ${r.numero} — emitida no Excel (antes do sistema)`, meta: `${dataBR(r.emitidaEm)} · capacidade ${kg(r.resultados.capacidadeKg)} kg`, cor });
    } else {
      const como = temExcel ? 'recalculada e emitida pelo sistema' : 'emitida pelo sistema';
      itens.push({ titulo: `Rev. ${r.numero} — ${como}`, meta: `${dataBR(r.emitidaEm)} · capacidade ${kg(r.resultados.capacidadeKg)} kg · ${r.emitidaPor}`, cor });
    }
  }
  if (plano.art && plano.artRegistradaEm) itens.push({ titulo: 'ART registrada no CREA-PR', meta: `${dataHoraBR(plano.artRegistradaEm)} · nº ${plano.art}`, cor: 'art' });
  for (const r of plano.revisoes) {
    if (r.origem === 'excel' && r.cadastradaEm) itens.push({ titulo: `Rev. ${r.numero} cadastrada no sistema`, meta: `${dataBR(r.cadastradaEm)} · ${r.emitidaPor}`, cor: 'cadastro' });
  }
  return itens;
}
