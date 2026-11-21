// Leitura e apresentação de números, datas e CNPJ em pt-BR.
// Regra de ouro: nada é arredondado antes do cálculo. Só `fmt` arredonda, na hora de mostrar.

/**
 * "Hoje" das regras (laudo, inspeção, numeração). Use sempre este valor, nunca `new Date()`.
 * No mock é o dia do cenário de exemplo (07/10/2026); com o servidor, main.tsx troca pela data do servidor
 * (`definirHoje`) antes da primeira tela, para a tela e o servidor conferirem contra a mesma data.
 */
export let HOJE = '2026-10-07';

/** Troca o "hoje" (só na inicialização, antes de montar as telas). Data inválida é ignorada. */
export function definirHoje(iso: string): void {
  if (dataIsoValida(iso)) HOJE = iso;
}

// ---------------------------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------------------------

/**
 * Lê um número digitado em pt-BR. Regra exata da especificação:
 * - "3450", "3.450" (ponto com grupos de 3 = milhar), "3.450,5", "5,0" → número;
 * - "4.2" (um ponto sem grupo de 3 dígitos) = decimal 4,2;
 * - vazio, negativo ou inválido = NaN. Espaços são ignorados.
 */
export function lerNum(texto: unknown): number {
  const s = String(texto == null ? '' : texto).trim().replace(/\s/g, '');
  if (s === '') return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d+(,\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  if (/^\d+\.\d+$/.test(s)) return Number(s);
  return NaN;
}

/** Casas decimais do próprio valor (até 4), para mostrar um valor digitado sem arredondar. */
export function casasDe(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const t = String(v).split('.')[1] ?? '';
  return Math.min(4, t.length);
}

/**
 * Apresentação: separador de milhar e casas fixas. Inválido (NaN, ±Infinity, null, não número) = "—".
 * fmt(3746.62, 2) → "3.746,62" · fmt(NaN) → "—"
 */
export function fmt(v: number | null | undefined, casas = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Percentual com 2 casas: fmtPct(40.4605) → "40,46%". Inválido = "—". */
export const fmtPct = (v: number | null | undefined, casas = 2) => (typeof v === 'number' && Number.isFinite(v) ? `${fmt(v, casas)}%` : '—');

/** Valor com unidade: fmtUn(7940.68, 2, 'kgf') → "7.940,68 kgf". Inválido = "—" (sem unidade). */
export const fmtUn = (v: number | null | undefined, casas: number, unidade: string) =>
  typeof v === 'number' && Number.isFinite(v) ? `${fmt(v, casas)}${unidade === '°' || unidade === '%' ? '' : ' '}${unidade}` : '—';

/**
 * "lido como …" quando o texto digitado tem ponto (para o usuário conferir como o sistema leu).
 * Sem ponto, ou texto inválido = null. `casas` omitido = casas do próprio valor (até 4).
 * lidoComo("4.2") → "lido como 4,2" · lidoComo("3.450", 0, "kg") → "lido como 3.450 kg" · lidoComo("3450") → null
 */
export function lidoComo(texto: string, casas?: number, unidade = ''): string | null {
  const t = String(texto ?? '').trim();
  if (t.indexOf('.') < 0) return null;
  const n = lerNum(t);
  if (!Number.isFinite(n)) return null;
  const un = !unidade ? '' : unidade === '°' || unidade === '%' ? unidade : ` ${unidade}`;
  return `lido como ${fmt(n, casas ?? casasDe(n))}${un}`;
}

/**
 * Número → texto do formulário, sem arredondar (volta igual com lerNum).
 * numParaTexto(3450) → "3.450" · numParaTexto(5, 1) → "5,0" · numParaTexto(46.62) → "46,62" · null/NaN → ""
 */
export function numParaTexto(v: number | null | undefined, minCasas = 0): string {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return '';
  const s = String(v);
  if (/e/i.test(s)) return v.toLocaleString('pt-BR', { minimumFractionDigits: minCasas, maximumFractionDigits: 20 });
  const [inteiro, frac = ''] = s.split('.');
  const grupos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const casas = frac.padEnd(minCasas, '0');
  return casas ? `${grupos},${casas}` : grupos;
}

// ---------------------------------------------------------------------------------------------
// Datas (ISO 'aaaa-mm-dd'; data e hora 'aaaa-mm-ddThh:mm', hora local de Curitiba)
// ---------------------------------------------------------------------------------------------

/** true para uma data ISO 'aaaa-mm-dd' que existe no calendário. */
export function dataIsoValida(iso: string | null | undefined): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return false;
  const a = +m[1], mes = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === d;
}

/** 'aaaa-mm-dd' (ou 'aaaa-mm-ddThh:mm') → 'dd/mm/aaaa'. Vazio/inválido = "—". */
export function dataBR(iso: string | null | undefined): string {
  const d = String(iso ?? '').slice(0, 10);
  if (!dataIsoValida(d)) return '—';
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

/** 'aaaa-mm-ddThh:mm' → '07/10/2026 às 14h12'. Sem hora → só a data. */
export function dataHoraBR(iso: string | null | undefined): string {
  const s = String(iso ?? '');
  const data = dataBR(s);
  const m = /T(\d{2}):(\d{2})/.exec(s);
  return m && data !== '—' ? `${data} às ${m[1]}h${m[2]}` : data;
}

/** 'dd/mm/aaaa' → 'aaaa-mm-dd'. Formato errado ou data inexistente = null. */
export function isoDeBR(br: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? '').trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return dataIsoValida(iso) ? iso : null;
}

/** Dias corridos de `de` até `ate` (datas ISO). diasEntre('2026-10-07', '2026-10-20') → 13. Inválida = NaN. */
export function diasEntre(de: string | null | undefined, ate: string | null | undefined): number {
  const a = String(de ?? '').slice(0, 10), b = String(ate ?? '').slice(0, 10);
  if (!dataIsoValida(a) || !dataIsoValida(b)) return NaN;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// ---------------------------------------------------------------------------------------------
// CNPJ (numérico e alfanumérico — regra da Receita Federal a partir de 2026)
// ---------------------------------------------------------------------------------------------

/** Remove pontuação e espaços e passa para maiúsculas: "12.abc.345/01de-35" → "12ABC34501DE35". */
export function normalizarCnpj(v: string): string {
  return String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Valida CNPJ numérico ou alfanumérico. As 12 primeiras posições aceitam 0–9 e A–Z; os 2 dígitos
 * verificadores são numéricos (módulo 11, pesos 2–9). Cada caractere vale (código ASCII − 48):
 * '0'–'9' = 0–9, 'A' = 17 … 'Z' = 42.
 * cnpjValido('07.522.191/0048-64') → true · cnpjValido('12.ABC.345/01DE-35') → true
 */
export function cnpjValido(v: string): boolean {
  const c = normalizarCnpj(v);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(.)\1+$/.test(c)) return false;
  const valor = (ch: string) => ch.charCodeAt(0) - 48;
  const digito = (base: string) => {
    let peso = 2, soma = 0;
    for (let i = base.length - 1; i >= 0; i--) { soma += valor(base[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(c.slice(0, 12));
  const d2 = digito(c.slice(0, 12) + d1);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}

/** Máscara XX.XXX.XXX/XXXX-DD (também para alfanumérico). Se não tiver 14 caracteres, devolve como veio. */
export function formatarCnpj(v: string): string {
  const c = normalizarCnpj(v);
  if (c.length !== 14) return v;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function somenteDigitos(v: string): string {
  return String(v ?? '').replace(/\D/g, '');
}

// ---------------------------------------------------------------------------------------------
// Nomes antigos (as páginas atuais ainda importam). Não use em código novo.
// ---------------------------------------------------------------------------------------------
/** @deprecated use `fmt` */
export const formatarNumero = (v: number, casas = 2) => fmt(v, casas);
/** @deprecated use `dataBR` */
export const formatarData = (iso: string | null) => dataBR(iso);
/** @deprecated use `fmtPct` (2 casas) */
export const formatarPercentual = (v: number | null) => fmtPct(v);
/** @deprecated use `lerNum` (mesma regra) */
export const lerNumero = (v: unknown) => lerNum(v);
