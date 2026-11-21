// Faixas válidas dos campos numéricos (especificação de 07/10/2026) e validação de um campo digitado.
// Fora da faixa = mensagem no campo e o plano fica bloqueado.
import { fmt, casasDe, lerNum, lidoComo } from './formatacao';

export interface Faixa {
  min: number;
  /** Infinity = sem limite superior ("a partir de …") */
  max: number;
  /** Só aceita número inteiro */
  inteiro?: boolean;
  /** 'kg', 'm', '°', 'pç', 't', '%', … ('' = sem unidade) */
  unidade: string;
  rotulo: string;
  /** Exemplo mostrado na mensagem de número inválido */
  exemplo: string;
  /** Mensagem própria para campo vazio */
  vazio?: string;
}

const ANGULO_VAZIO = 'Informe o ângulo: 0° a 60° (a partir da vertical). Vazio não vale como 0°.';

/** Faixas da especificação, como dados. A chave é o "nome" aceito por `validarCampo`. */
export const FAIXAS = {
  // carga
  pesoCarga: { min: 1, max: 100000, unidade: 'kg', rotulo: 'Peso da carga', exemplo: '3.450' },
  dimensao: { min: 0.1, max: 50, unidade: 'm', rotulo: 'Dimensão da carga', exemplo: '4,7' },
  cargasExtras: { min: 0, max: Infinity, unidade: 'kg', rotulo: 'Cargas extras', exemplo: '0', vazio: 'Informe 0 se não houver cargas extras.' },
  // lingada
  quantidade: { min: 1, max: 50, inteiro: true, unidade: 'pç', rotulo: 'Quantidade', exemplo: '4' },
  angulo: { min: 0, max: 60, unidade: '°', rotulo: 'Ângulo (a partir da vertical)', exemplo: '28', vazio: ANGULO_VAZIO },
  pesoDispositivo: { min: 0, max: 100000, unidade: 'kg', rotulo: 'Peso unitário do dispositivo', exemplo: '250' },
  // acessório (cadastro)
  capacidadeAcessorio: { min: 0.1, max: 100, unidade: 't', rotulo: 'Capacidade do acessório', exemplo: '4,2' },
  pesoAcessorio: { min: 0.01, max: 5000, unidade: 'kg', rotulo: 'Peso unitário do acessório', exemplo: '4,87' },
  // guindaste e operação
  raio: { min: 0.5, max: 30, unidade: 'm', rotulo: 'Raio de operação', exemplo: '5,0' },
  comprimentoLanca: { min: 0.5, max: 50, unidade: 'm', rotulo: 'Comprimento da lança', exemplo: '5,1' },
  raioIsolamento: { min: 0.5, max: 50, unidade: 'm', rotulo: 'Raio de isolamento', exemplo: '7,0' },
  vento: { min: 0, max: 20, unidade: 'm/s', rotulo: 'Vento máximo', exemplo: '7,0' },
  pctAdicional: { min: 1, max: 99, unidade: '%', rotulo: '% da carga do guindaste adicional', exemplo: '50' },
  distanciaA: { min: 0.5, max: 15, unidade: 'm', rotulo: 'Eixo da coluna até a sapata (a)', exemplo: '2,95' },
  aberturaB: { min: 0.5, max: 15, unidade: 'm', rotulo: 'Abertura entre sapatas (b)', exemplo: '5,70' },
  pesoGuindaste: { min: 500, max: 100000, unidade: 'kgf', rotulo: 'Peso guindaste + caminhão (Pg)', exemplo: '11.550' },
  alcanceGrafico: { min: 0.5, max: 30, unidade: 'm', rotulo: 'Alcance do gráfico de carga', exemplo: '4,18' },
  capacidadeGrafico: { min: 1, max: 100000, unidade: 'kg', rotulo: 'Capacidade do gráfico de carga', exemplo: '10.900' },
  anoGuindaste: { min: 1950, max: 2027, inteiro: true, unidade: '', rotulo: 'Ano', exemplo: '2013' },
  capacidadeNominal: { min: 0.1, max: 500, unidade: 't', rotulo: 'Capacidade nominal', exemplo: '45,0' },
  // sapatas
  dormente: { min: 10, max: 200, unidade: 'cm', rotulo: 'Dimensão do dormente', exemplo: '50' },
  dormentesPorSapata: { min: 1, max: 50, inteiro: true, unidade: 'pç', rotulo: 'Dormentes por sapata', exemplo: '1' },
  // configurações
  limitePct: { min: 50, max: 100, unidade: '%', rotulo: 'Limite da taxa de utilização', exemplo: '85' },
  avisoAtencaoPct: { min: 50, max: 100, unidade: '%', rotulo: 'Aviso de atenção', exemplo: '75' },
  ventoPadrao: { min: 0, max: 20, unidade: 'm/s', rotulo: 'Vento padrão', exemplo: '7,0' },
} as const satisfies Record<string, Faixa>;

export type NomeFaixa = keyof typeof FAIXAS;

export interface CampoValidado {
  /** Número lido; NaN quando há erro (nunca use um valor com erro no cálculo) */
  valor: number;
  /** Mensagem para mostrar no campo; null = válido */
  erro: string | null;
  /** "lido como …" quando o texto tem ponto; null caso contrário. Pode vir junto com um erro. */
  lidoComo: string | null;
}

const unTxt = (u: string) => (!u ? '' : u === '°' || u === '%' ? u : ` ${u}`);

/** "1 a 100.000 kg" · "0° a 60° (a partir da vertical)" · "a partir de 0 kg" */
export function faixaTexto(f: Faixa): string {
  const v = (x: number) => fmt(x, casasDe(x));
  const base = f.max === Infinity ? `a partir de ${v(f.min)}${unTxt(f.unidade)}` : `${v(f.min)}${unTxt(f.unidade)} a ${v(f.max)}${unTxt(f.unidade)}`;
  return f.unidade === '°' ? `${base} (a partir da vertical)` : base;
}

/** Valida um texto contra uma faixa (use quando a faixa não está em FAIXAS). */
export function validarFaixa(faixa: Faixa, texto: string | null | undefined): CampoValidado {
  const t = String(texto ?? '').trim();
  const x = lerNum(t);
  const lido = lidoComo(t, undefined, faixa.unidade);
  let erro: string | null = null;
  if (t === '') erro = faixa.vazio ?? `Campo obrigatório: ${faixaTexto(faixa)}.`;
  else if (Number.isNaN(x)) erro = `Número inválido. Use vírgula nos decimais (ex.: ${faixa.exemplo}).`;
  else if (faixa.inteiro && !Number.isInteger(x)) erro = `Use um número inteiro (${faixaTexto(faixa)}).`;
  else if (x < faixa.min || x > faixa.max) erro = `Fora da faixa: ${faixaTexto(faixa)}.`;
  return { valor: erro ? NaN : x, erro, lidoComo: lido };
}

/**
 * Valida um campo pelo nome da faixa.
 * validarCampo('angulo', '95') → { valor: NaN, erro: 'Fora da faixa: 0° a 60° (a partir da vertical).', lidoComo: null }
 * validarCampo('pesoCarga', '3.450') → { valor: 3450, erro: null, lidoComo: 'lido como 3.450 kg' }
 */
export function validarCampo(nome: NomeFaixa, texto: string | null | undefined): CampoValidado {
  return validarFaixa(FAIXAS[nome], texto);
}

/** Nº da ART: 13 dígitos, só números. Vazio = null (a falta é tratada no checklist). */
export function erroNumeroArt(art: string): string | null {
  const a = String(art ?? '').trim();
  if (!a) return null;
  return /^\d{13}$/.test(a) ? null : `O nº da ART tem 13 dígitos, só números (você digitou ${a.replace(/\D/g, '').length}).`;
}

/** Usuário (login): minúsculas, números, ponto, hífen e sublinhado; 3 a 30 caracteres. */
export function erroLogin(login: string): string | null {
  const l = String(login ?? '').trim();
  if (!l) return 'Informe o usuário.';
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(l) ? null : 'Use de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.';
}

/** Nome do arquivo do plano precisa ter {nº} e {rev}. */
export function erroNomeArquivo(nome: string): string | null {
  const n = String(nome ?? '');
  const temNum = n.includes('{nº}'), temRev = n.includes('{rev}');
  if (!temNum && !temRev) return 'O nome precisa ter {nº} e {rev}.';
  if (!temNum) return 'O nome precisa ter {nº} (número do plano).';
  if (!temRev) return 'O nome precisa ter {rev} (número da revisão).';
  return null;
}
