// Numeração dos planos: AAMM + 3 dígitos, gerada pelo sistema pela DATA DE CRIAÇÃO do plano.
// Zera todo mês (2610001 é o primeiro de outubro/2026). Não é editável. Revisões mantêm o número.

export class ErroNumeracao extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = 'ErroNumeracao'; }
}

/** Maior sequência possível no mês */
export const MAX_SEQUENCIA = 999;

export interface PartesNumero { prefixo: string; ano: number; mes: number; sequencia: number }

/** "2610001" → { prefixo: '2610', ano: 2026, mes: 10, sequencia: 1 }. Formato inválido = null. */
export function partesNumero(numero: string): PartesNumero | null {
  const m = /^(\d{2})(\d{2})(\d{3})$/.exec(String(numero ?? '').trim());
  if (!m) return null;
  const mes = Number(m[2]), sequencia = Number(m[3]);
  if (mes < 1 || mes > 12 || sequencia < 1) return null;
  return { prefixo: m[1] + m[2], ano: 2000 + Number(m[1]), mes, sequencia };
}

/** Prefixo AAMM da data de criação ('aaaa-mm-dd' ou 'aaaa-mm-ddThh:mm'). */
export function prefixoDaData(dataCriacaoISO: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(dataCriacaoISO ?? ''));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new ErroNumeracao(`Data de criação inválida: "${dataCriacaoISO}".`);
  return m[1].slice(2) + m[2];
}

const montar = (prefixo: string, seq: number) => `${prefixo}${String(seq).padStart(3, '0')}`;

/**
 * Próximo número livre para um plano criado na data informada.
 * proximoNumero('2026-10-07', ['2607036', '2610001', '2610002']) → '2610003'
 * proximoNumero('2027-01-02', ['2612015']) → '2701001' (virada de ano)
 * Passou de 999 no mês → lança ErroNumeracao.
 */
export function proximoNumero(dataCriacaoISO: string, existentes: string[]): string {
  const prefixo = prefixoDaData(dataCriacaoISO);
  const maior = existentes.reduce((max, n) => {
    const p = partesNumero(n);
    return p && p.prefixo === prefixo ? Math.max(max, p.sequencia) : max;
  }, 0);
  const seq = maior + 1;
  if (seq > MAX_SEQUENCIA) throw new ErroNumeracao(`A numeração de ${prefixo.slice(2)}/20${prefixo.slice(0, 2)} chegou a ${MAX_SEQUENCIA} planos. Fale com o administrador.`);
  return montar(prefixo, seq);
}

/**
 * Números seguidos a partir do primeiro, sem invadir o mês seguinte (planos em lote).
 * numerosEmSequencia('2610003', 3) → ['2610003', '2610004', '2610005']
 * numerosEmSequencia('2610998', 3) → lança ErroNumeracao (passaria de 999)
 * Quantidade precisa ser inteira ≥ 1.
 */
export function numerosEmSequencia(primeiro: string, quantidade: number): string[] {
  const p = partesNumero(primeiro);
  if (!p) throw new ErroNumeracao(`Número inválido: "${primeiro}". Use AAMM + 3 dígitos (ex.: 2610003).`);
  if (!Number.isInteger(quantidade) || quantidade < 1) throw new ErroNumeracao('A quantidade de planos deve ser um número inteiro maior que zero.');
  const ultimo = p.sequencia + quantidade - 1;
  if (ultimo > MAX_SEQUENCIA) {
    const livres = MAX_SEQUENCIA - p.sequencia + 1;
    throw new ErroNumeracao(`Só cabem mais ${livres} ${livres === 1 ? 'plano' : 'planos'} neste mês (até ${montar(p.prefixo, MAX_SEQUENCIA)}).`);
  }
  return Array.from({ length: quantidade }, (_, i) => montar(p.prefixo, p.sequencia + i));
}

/** Números para um lote criado na data: começa no próximo livre. ('2026-10-07', existentes, 10) → 2610003 … 2610012 */
export function numerosParaLote(dataCriacaoISO: string, existentes: string[], quantidade: number): string[] {
  return numerosEmSequencia(proximoNumero(dataCriacaoISO, existentes), quantidade);
}
