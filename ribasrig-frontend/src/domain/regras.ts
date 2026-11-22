// Regras de cálculo editáveis: avaliador de expressões SEGURO (sem eval/Function), catálogo das
// regras do sistema e tipos de içamento. Portado da tela RegrasCalculo/TiposIcamento do protótipo.
import { casasDe, fmt, lerNum, lidoComo } from './formatacao';
import { nivelTaxa } from './calculos';
import type { RegraCalculo, SituacaoSeguranca, TipoIcamento, VariavelRegra } from './types';

// =============================================================================================
// Avaliador
// =============================================================================================

export class ErroExpressao extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = 'ErroExpressao'; }
}

/** Valores das variáveis. null = valor de teste inválido (avaliar lança erro pedindo para corrigir). */
export type AmbienteExpressao = Record<string, number | null>;

const erro = (m: string): never => { throw new ErroExpressao(m); };

/** Tamanho máximo da fórmula (o teste ao vivo roda a cada tecla). */
export const MAX_FORMULA = 500;

/**
 * Avalia a fórmula e devolve o número cru (pode ser negativo). Lança ErroExpressao com mensagem em português.
 * Sintaxe: + − * / ^ (também × ÷ ·), parênteses, menos unário com precedência certa (−2^2 = −4; 2^−1 = 0,5),
 * cos/sen/sin/tg/tan em GRAUS, raiz/sqrt, min, max, abs; argumentos separados SÓ por ";"; vírgula decimal.
 * Divisão por zero e raiz de negativo = erro. |resultado| > 1e9 = Infinity (tratado como inválido).
 */
export function avaliarBruto(expr: string, env: AmbienteExpressao = {}): number {
  const s = String(expr ?? '');
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const lim0 = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x); // cos(90°) = 0 exato
  const um = (n: string, a: number[]) => { if (a.length !== 1) erro(`A função ${n}() recebe 1 valor.`); };
  const varios = (n: string, a: number[]) => { if (a.length < 2) erro(`A função ${n}() precisa de 2 ou mais valores separados por ";". Ex.: ${n}(3; 45).`); };
  const raiz = (n: string, a: number[]) => { um(n, a); if (a[0] < 0) erro('Raiz de número negativo.'); return Math.sqrt(a[0]); };
  const FN: Record<string, (a: number[]) => number> = {
    cos: (a) => { um('cos', a); return lim0(Math.cos(rad(a[0]))); },
    sen: (a) => { um('sen', a); return lim0(Math.sin(rad(a[0]))); },
    sin: (a) => { um('sin', a); return lim0(Math.sin(rad(a[0]))); },
    tg: (a) => { um('tg', a); return lim0(Math.tan(rad(a[0]))); },
    tan: (a) => { um('tan', a); return lim0(Math.tan(rad(a[0]))); },
    raiz: (a) => raiz('raiz', a),
    sqrt: (a) => raiz('sqrt', a),
    min: (a) => { varios('min', a); return Math.min(...a); },
    max: (a) => { varios('max', a); return Math.max(...a); },
    abs: (a) => { um('abs', a); return Math.abs(a[0]); },
  };

  // Precedência: soma < produto < sinal (unário) < potência (associativa à direita).
  const soma = (): number => {
    let v = prod();
    for (;;) {
      ws();
      const c = s[i];
      if (c === '+') { i++; v += prod(); } else if (c === '-' || c === '−') { i++; v -= prod(); } else return v;
    }
  };
  const prod = (): number => {
    let v = un();
    for (;;) {
      ws();
      const c = s[i];
      if (c === '*' || c === '×' || c === '·') { i++; v *= un(); } else if (c === '/' || c === '÷') { i++; const d = un(); if (d === 0) erro('Divisão por zero.'); v /= d; } else return v;
    }
  };
  const un = (): number => {
    ws();
    if (s[i] === '-' || s[i] === '−') { i++; return -un(); }
    if (s[i] === '+') { i++; return un(); }
    return pot();
  };
  const pot = (): number => {
    const b = prim();
    ws();
    if (s[i] === '^') { i++; return Math.pow(b, un()); }
    return b;
  };
  const prim = (): number => {
    ws();
    if (i >= s.length) erro('A fórmula terminou antes do esperado.');
    if (s[i] === '(') {
      i++;
      const v = soma();
      ws();
      if (s[i] !== ')') erro('Falta fechar um parêntese.');
      i++;
      return v;
    }
    const resto = s.slice(i);
    let m = /^\d+(,\d+)?/.exec(resto);
    if (m) {
      i += m[0].length;
      if (s[i] === '.' && /\d/.test(s[i + 1] ?? '')) erro('Use vírgula como separador decimal (ex.: 0,5).');
      return Number(m[0].replace(',', '.'));
    }
    // Letras com acento sem × (U+00D7) e ÷ (U+00F7), que são operadores: "P×2" = P vezes 2
    m = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ_0-9]*/.exec(resto);
    if (!m) return erro(`Caractere inesperado: "${s[i]}".`);
    const id = m[0];
    i += id.length;
    ws();
    if (s[i] === '(') {
      // hasOwn: nomes herdados do Object (constructor, toString…) não são funções da fórmula
      const f = Object.hasOwn(FN, id.toLowerCase()) ? FN[id.toLowerCase()] : undefined;
      if (!f) return erro(`Função "${id}" não existe.`);
      i++;
      const args: number[] = [];
      ws();
      if (s[i] !== ')') {
        args.push(soma());
        ws();
        while (s[i] === ';') { i++; args.push(soma()); ws(); }
      }
      if (s[i] === ',') erro(`Na função ${id}(), separe os valores com ";" (a vírgula é decimal).`);
      if (s[i] !== ')') erro(`Falta fechar o parêntese da função ${id}.`);
      i++;
      return f(args);
    }
    if (!Object.prototype.hasOwnProperty.call(env, id)) erro(`A variável "${id}" não está definida na tabela.`);
    const v = env[id];
    if (v === null || v === undefined) return erro(`Corrija o valor de teste de "${id}".`);
    return v;
  };

  if (!s.trim()) erro('Escreva a fórmula.');
  if (s.length > MAX_FORMULA) erro(`Fórmula longa demais: use até ${MAX_FORMULA} caracteres.`);
  const r = soma();
  ws();
  if (i < s.length) erro(`Caractere inesperado: "${s[i]}".`);
  if (Number.isFinite(r) && Math.abs(r) > 1e9) return Infinity; // fora de escala: tratado como inválido
  return r;
}

const rad = (g: number) => (g * Math.PI) / 180;

export type ResultadoExpressao =
  | { ok: true; valor: number }
  /** valor presente quando a conta fechou mas o resultado é negativo ou não finito */
  | { ok: false; erro: string; valor?: number };

/**
 * Avalia e valida: resultado não finito ou negativo = inválido (o plano fica bloqueado).
 * avaliarExpressao('min(3;45)') → { ok: true, valor: 3 }
 * avaliarExpressao('-2^2') → { ok: false, valor: -4, erro: 'Resultado inválido: …negativo…' }
 * avaliarExpressao('1 / cos(90)') → { ok: false, erro: 'Divisão por zero.' }
 */
export function avaliarExpressao(expr: string, env: AmbienteExpressao = {}): ResultadoExpressao {
  let valor: number;
  try { valor = avaliarBruto(expr, env); } catch (e) {
    if (e instanceof RangeError) return { ok: false, erro: 'Fórmula com parênteses ou sinais aninhados demais.' };
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
  if (!Number.isFinite(valor)) return { ok: false, valor, erro: 'Resultado inválido: a conta não dá um número (infinito ou indefinido).' };
  if (valor < 0) return { ok: false, valor, erro: 'Resultado inválido: o valor saiu negativo. Confira a fórmula e os valores.' };
  return { ok: true, valor };
}

// =============================================================================================
// Origens das variáveis (valores de teste = plano 2607036) e faixas
// =============================================================================================

/** [valor de teste, mínimo, máximo, mensagem de faixa, inteiro?] */
export type OrigemVariavel = readonly [teste: string | null, min: number, max: number, mensagem: string, inteiro?: boolean];

export const ORIGENS_VARIAVEL: Record<string, OrigemVariavel> = {
  'Valor fixo': [null, 0, Infinity, 'Use um número maior ou igual a zero.'],
  'Peso da carga (kg)': ['3450', 1, 100000, 'Peso da carga: de 1 a 100.000 kg.'],
  'Peso da carga (t)': ['3,45', 0.001, 100, 'Peso da carga: de 0,001 a 100 t.'],
  'Lingada (kg)': ['46,62', 0, Infinity, 'Lingada: zero ou mais.'],
  'Dispositivos/balancim (kg)': ['250', 0, Infinity, 'Dispositivos: zero ou mais.'],
  'Dispositivos/balancim (t)': ['0,25', 0, Infinity, 'Dispositivos: zero ou mais.'],
  'Cargas extras (kg)': ['0', 0, Infinity, 'Cargas extras: zero ou mais.'],
  'Raio de operação (m)': ['5', 0.5, 30, 'Raio: de 0,5 a 30 m.'],
  'Ângulo pernas inferiores (°)': ['28', 0, 60, 'Ângulo a partir da vertical: de 0° a 60°.'],
  'Ângulo pernas superiores (°)': ['41', 0, 60, 'Ângulo a partir da vertical: de 0° a 60°.'],
  'Ângulo das pernas (°)': ['28', 0, 60, 'Ângulo a partir da vertical: de 0° a 60°.'],
  'Peso do guindaste Pg (kgf)': ['11550', 500, 100000, 'Pg: de 500 a 100.000 kgf.'],
  'Distância a (m)': ['2,95', 0.5, 15, 'Distância a: de 0,5 a 15 m.'],
  'Abertura b (m)': ['5,7', 0.5, 15, 'Abertura b: de 0,5 a 15 m.'],
  'Largura do dormente (cm)': ['50', 10, 200, 'Dormente: de 10 a 200 cm.'],
  'Comprimento do dormente (cm)': ['50', 10, 200, 'Dormente: de 10 a 200 cm.'],
  'Dormentes por sapata': ['1', 1, 50, 'Número inteiro de 1 a 50.', true],
  'Tabela: raio anterior (m)': ['4,18', 0.5, 30, 'Raio: de 0,5 a 30 m.'],
  'Tabela: raio posterior (m)': ['5,98', 0.5, 30, 'Raio: de 0,5 a 30 m.'],
  'Tabela: capacidade anterior (kg)': ['10900', 1, 100000, 'Capacidade: de 1 a 100.000 kg.'],
  'Tabela: capacidade posterior (kg)': ['7300', 1, 100000, 'Capacidade: de 1 a 100.000 kg.'],
};

/** Variáveis que vêm do resultado de outra regra do sistema (calculado sem arredondar). origem → id da regra */
export const RESULTADOS_REGRA: Record<string, string> = {
  'Resultado: carga bruta (kg)': 'r1',
  'Resultado: tração nas pernas superiores (t)': 'r4',
  'Resultado: esforço nas sapatas (kgf)': 'r6',
};

/** Capacidade de comparação: ENTRADA do plano (acessório ou guindaste escolhido), nunca número gravado na regra. */
export const ORIGENS_CAPACIDADE: Record<string, OrigemVariavel> = {
  'Capacidade de trabalho da cinta · pernas inferiores (t)': ['4,2', 0.1, 100, 'Capacidade: de 0,1 a 100 t.'],
  'Capacidade de trabalho da cinta · pernas superiores (t)': ['4,2', 0.1, 100, 'Capacidade: de 0,1 a 100 t.'],
  'Capacidade de trabalho da manilha da carga (tf)': ['5,5', 0.1, 100, 'Capacidade: de 0,1 a 100 tf.'],
  'Capacidade de trabalho da manilha do gancho (tf)': ['7,2', 0.1, 100, 'Capacidade: de 0,1 a 100 tf.'],
  'Capacidade de trabalho do acessório escolhido (t)': ['4,2', 0.1, 100, 'Capacidade: de 0,1 a 100 t.'],
  'Capacidade do guindaste no raio (kg)': ['9.260', 1, 100000, 'Capacidade: de 1 a 100.000 kg.'],
};

export interface ValorConferido { n: number; erro: string | null; lidoComo: string | null }

/** Confere um valor de teste digitado contra a faixa da origem. */
export function conferirValor(texto: string, faixa: OrigemVariavel | null, unidade = ''): ValorConferido {
  const t = String(texto ?? '').trim();
  const n = lerNum(t);
  const lido = lidoComo(t, undefined, unidade);
  if (t === '') return { n: NaN, erro: 'Informe o valor.', lidoComo: null };
  if (Number.isNaN(n)) return { n: NaN, erro: 'Valor inválido. Use número positivo, ex.: 4,2.', lidoComo: null };
  if (faixa) {
    const [, min, max, msg, inteiro] = faixa;
    if (inteiro && !Number.isInteger(n)) return { n: NaN, erro: msg, lidoComo: lido };
    if (n < min || n > max) return { n: NaN, erro: msg, lidoComo: lido };
  }
  return { n, erro: null, lidoComo: lido };
}

/** Faixa de uma variável: unidade '°' força 0–60°; senão a faixa da origem (padrão: valor fixo ≥ 0). */
export function faixaDaVariavel(v: VariavelRegra): OrigemVariavel {
  if (String(v.unidade ?? '').trim() === '°') return [null, 0, 60, 'Ângulo a partir da vertical: de 0° a 60°.'];
  return ORIGENS_VARIAVEL[v.origem] ?? ORIGENS_VARIAVEL['Valor fixo'];
}

/** Valor de teste de uma regra do catálogo (plano 2607036), sem arredondar. NaN se não der para calcular. */
export function valorDeTeste(catalogo: RegraCalculo[], id: string, profundidade = 0): number {
  const regra = catalogo.find((r) => r.id === id);
  if (!regra || profundidade > 4) return NaN;
  const r = avaliarExpressao(regra.formula, ambienteDeTeste(catalogo, regra.variaveis, profundidade));
  return r.ok ? r.valor : NaN;
}

function ambienteDeTeste(catalogo: RegraCalculo[], vars: VariavelRegra[], profundidade: number): AmbienteExpressao {
  const env: AmbienteExpressao = {};
  for (const v of vars) {
    const k = v.simbolo.trim();
    if (!k) continue;
    const id = RESULTADOS_REGRA[v.origem];
    const n = id ? valorDeTeste(catalogo, id, profundidade + 1) : conferirValor(v.teste, faixaDaVariavel(v)).n;
    env[k] = Number.isNaN(n) ? null : n;
  }
  return env;
}

export interface TesteRegra {
  variaveis: { simbolo: string; valor: number; calculada: boolean; erro: string | null; lidoComo: string | null }[];
  resultado: ResultadoExpressao;
  /** Capacidade de comparação lida (NaN sem capacidade ou inválida) */
  capacidade: number;
  erroCapacidade: string | null;
  /** resultado ÷ capacidade × 100; NaN quando não se aplica ou é inválido */
  taxaPct: number;
  /** Nível da taxa (só para regras com limite e resultado válido) */
  nivel: SituacaoSeguranca | null;
  /** "Te = 3,45 ÷ (2 × cos(28))" */
  substituicao: string;
}

/** Testa uma regra (editada ou salva) com os valores de teste do plano 2607036. */
export function testarRegra(regra: RegraCalculo, catalogo: RegraCalculo[], avisoAtencaoPct?: number): TesteRegra {
  const env: AmbienteExpressao = {};
  const variaveis = regra.variaveis.map((v) => {
    const simbolo = v.simbolo.trim();
    const id = RESULTADOS_REGRA[v.origem];
    const c: ValorConferido = id ? { n: valorDeTeste(catalogo, id), erro: null, lidoComo: null } : conferirValor(v.teste, faixaDaVariavel(v), v.unidade);
    if (id && Number.isNaN(c.n)) c.erro = 'Não foi possível calcular pela regra do sistema.';
    if (simbolo) env[simbolo] = Number.isNaN(c.n) ? null : c.n;
    return { simbolo, valor: c.n, calculada: !!id, erro: c.erro, lidoComo: c.lidoComo };
  });
  const resultado = avaliarExpressao(regra.formula, env);
  const faixaCap = (regra.origemCapacidade && ORIGENS_CAPACIDADE[regra.origemCapacidade]) || ([null, 0.1, 100000, 'Capacidade maior que zero.'] as const);
  const cap = regra.limite && regra.origemCapacidade ? conferirValor(regra.capacidadeTeste, faixaCap) : { n: NaN, erro: null, lidoComo: null };
  const taxa = resultado.ok && Number.isFinite(cap.n) ? (resultado.valor / cap.n) * 100 : NaN;
  const subst = String(regra.formula ?? '').replace(/[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_0-9]*/g, (id) => {
    const v = env[id];
    if (v == null) return id;
    const calc = regra.variaveis.find((x) => x.simbolo.trim() === id && RESULTADOS_REGRA[x.origem]);
    return fmt(v, calc ? 2 : casasDe(v));
  });
  return {
    variaveis, resultado, capacidade: cap.n, erroCapacidade: cap.erro, taxaPct: taxa,
    nivel: regra.limite && resultado.ok && Number.isFinite(cap.n) ? nivelTaxa(taxa, avisoAtencaoPct) : null,
    substituicao: regra.formula ? `${regra.resultadoNome || 'R'} = ${subst.replace(/\*/g, '×').replace(/\//g, '÷')}` : '',
  };
}

// =============================================================================================
// Catálogo das regras (sistema + exemplos fictícios da equipe)
// =============================================================================================

const v = (simbolo: string, nome: string, unidade: string, origem: string, teste = ''): VariavelRegra => ({ simbolo, nome, unidade, origem, teste });

type DefRegra = Omit<RegraCalculo, 'versoes' | 'noResumo' | 'noMemorial' | 'automatica' | 'origemCapacidade' | 'capacidadeTeste' | 'limite' | 'origem' | 'autor' | 'versao' | 'planos'>
  & Partial<Pick<RegraCalculo, 'origemCapacidade' | 'capacidadeTeste' | 'limite' | 'automatica'>>;

const doSistema = (d: DefRegra): RegraCalculo => ({
  limite: false, origemCapacidade: null, capacidadeTeste: '', noResumo: true, noMemorial: true, automatica: true,
  origem: 'sistema', autor: 'Sistema RibasRig', versao: 1, planos: ['2607036'], ...d,
  versoes: [{ versao: 1, formula: d.formula, variaveis: d.variaveis, salvaEm: '2026-10-07', autor: 'Sistema RibasRig' }],
});
const exemploEquipe = (d: DefRegra): RegraCalculo => ({
  limite: false, origemCapacidade: null, capacidadeTeste: '', noResumo: true, noMemorial: true, automatica: false,
  origem: 'exemplo', autor: 'Equipe RibasRig', versao: 1, planos: [], ...d,
  versoes: [{ versao: 1, formula: d.formula, variaveis: d.variaveis, salvaEm: '2026-10-07', autor: 'Equipe RibasRig' }],
});

/** Rótulo do selo na lista: "Sistema" · "Exemplo da equipe (fictício)" · "Criada" */
export const rotuloOrigem = (o: RegraCalculo['origem']) => (o === 'sistema' ? 'Sistema' : o === 'exemplo' ? 'Exemplo da equipe (fictício)' : 'Criada');

export const REGRAS_CALCULO: RegraCalculo[] = [
  doSistema({ id: 'r1', nome: 'Carga bruta', categoria: 'Carga', descricao: 'Soma da carga líquida com lingada, dispositivos e cargas extras.', formula: 'P + L + D + E', resultadoNome: 'Pb', resultadoUnidade: 'kg',
    variaveis: [v('P', 'Peso da carga', 'kg', 'Peso da carga (kg)', '3450'), v('L', 'Peso da lingada', 'kg', 'Lingada (kg)', '46,62'), v('D', 'Dispositivos / balancim', 'kg', 'Dispositivos/balancim (kg)', '250'), v('E', 'Cargas extras', 'kg', 'Cargas extras (kg)', '0')] }),
  doSistema({ id: 'r2', nome: 'Capacidade no raio (interpolação)', categoria: 'Guindaste', descricao: 'Interpolação linear entre os dois pontos do gráfico de carga do fabricante mais próximos do raio.', formula: 'C1 + (r - r1) * (C2 - C1) / (r2 - r1)', resultadoNome: 'C', resultadoUnidade: 'kg',
    variaveis: [v('r', 'Raio de operação', 'm', 'Raio de operação (m)', '5'), v('r1', 'Raio do ponto anterior', 'm', 'Tabela: raio anterior (m)', '4,18'), v('r2', 'Raio do ponto posterior', 'm', 'Tabela: raio posterior (m)', '5,98'), v('C1', 'Capacidade no ponto anterior', 'kg', 'Tabela: capacidade anterior (kg)', '10900'), v('C2', 'Capacidade no ponto posterior', 'kg', 'Tabela: capacidade posterior (kg)', '7300')] }),
  doSistema({ id: 'r9', nome: 'Taxa de utilização do guindaste', categoria: 'Guindaste', descricao: 'Compara a carga bruta (Pb) com a capacidade do guindaste no raio de operação. Taxa = Pb ÷ capacidade no raio; acima do limite das Configurações (85% por padrão) o plano fica bloqueado.', formula: 'Pb', resultadoNome: 'Pb', resultadoUnidade: 'kg',
    limite: true, origemCapacidade: 'Capacidade do guindaste no raio (kg)', capacidadeTeste: '9.260',
    variaveis: [v('Pb', 'Carga bruta', 'kg', 'Resultado: carga bruta (kg)')] }),
  doSistema({ id: 'r3', nome: 'Tração na cinta · pernas inferiores', categoria: 'Lingada', descricao: 'Configuração com balancim: 4 pernas entre a carga e o balancim.', formula: 'P / (2 * cos(a))', resultadoNome: 'Te', resultadoUnidade: 't',
    limite: true, origemCapacidade: 'Capacidade de trabalho da cinta · pernas inferiores (t)', capacidadeTeste: '4,2',
    variaveis: [v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), v('a', 'Ângulo das pernas inferiores', '°', 'Ângulo pernas inferiores (°)', '28')] }),
  doSistema({ id: 'r4', nome: 'Tração na cinta · pernas superiores', categoria: 'Lingada', descricao: 'Configuração com balancim: 2 pernas entre o balancim e o gancho.', formula: '(P + B) / (2 * cos(a))', resultadoNome: 'Te', resultadoUnidade: 't',
    limite: true, origemCapacidade: 'Capacidade de trabalho da cinta · pernas superiores (t)', capacidadeTeste: '4,2',
    variaveis: [v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), v('B', 'Peso do balancim', 't', 'Dispositivos/balancim (t)', '0,25'), v('a', 'Ângulo das pernas superiores', '°', 'Ângulo pernas superiores (°)', '41')] }),
  doSistema({ id: 'r5', nome: 'Esforço na manilha da carga', categoria: 'Lingada', descricao: 'Manilha entre a carga e o balancim (4 pontos).', formula: 'P / (4 * cos(a))', resultadoNome: 'F', resultadoUnidade: 'tf',
    limite: true, origemCapacidade: 'Capacidade de trabalho da manilha da carga (tf)', capacidadeTeste: '5,5',
    variaveis: [v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), v('a', 'Ângulo das pernas inferiores', '°', 'Ângulo pernas inferiores (°)', '28')] }),
  doSistema({ id: 'r8', nome: 'Esforço na manilha do gancho', categoria: 'Lingada', descricao: 'Manilha que liga as 2 pernas superiores ao gancho: recebe as duas pernas, F = 2 · Te superior.', formula: '2 * Te', resultadoNome: 'F', resultadoUnidade: 'tf',
    limite: true, origemCapacidade: 'Capacidade de trabalho da manilha do gancho (tf)', capacidadeTeste: '7,2',
    variaveis: [v('Te', 'Tração em cada perna superior', 't', 'Resultado: tração nas pernas superiores (t)')] }),
  doSistema({ id: 'r6', nome: 'Esforço nas sapatas', categoria: 'Sapatas e terreno', descricao: 'Metade do peso do conjunto mais a força causada pelo momento da carga.', formula: 'Pg / 2 + Pb * R / (a + b)', resultadoNome: 'ES', resultadoUnidade: 'kgf',
    variaveis: [v('Pg', 'Peso do guindaste + caminhão', 'kgf', 'Peso do guindaste Pg (kgf)', '11550'), v('Pb', 'Carga bruta', 'kg', 'Resultado: carga bruta (kg)'), v('R', 'Raio de operação', 'm', 'Raio de operação (m)', '5'), v('a', 'Eixo da coluna até a sapata', 'm', 'Distância a (m)', '2,95'), v('b', 'Abertura entre sapatas', 'm', 'Abertura b (m)', '5,7')] }),
  doSistema({ id: 'r7', nome: 'Resistência mínima do terreno (RMET)', categoria: 'Sapatas e terreno', descricao: 'Esforço na sapata dividido pela área de apoio dos dormentes.', formula: 'ES / (LD * CD * ND)', resultadoNome: 'RMET', resultadoUnidade: 'kgf/cm²',
    variaveis: [v('ES', 'Esforço nas sapatas', 'kgf', 'Resultado: esforço nas sapatas (kgf)'), v('LD', 'Largura do dormente', 'cm', 'Largura do dormente (cm)', '50'), v('CD', 'Comprimento do dormente', 'cm', 'Comprimento do dormente (cm)', '50'), v('ND', 'Dormentes por sapata', '', 'Dormentes por sapata', '1')] }),
  exemploEquipe({ id: 'u1', nome: 'Tração · 2 pernas sem balancim', categoria: 'Lingada', descricao: 'Exemplo (fictício) da equipe RibasRig: içamento sem balancim, 2 pernas direto no gancho. O ângulo e a capacidade vêm do plano.', formula: 'P / (2 * cos(a))', resultadoNome: 'Te', resultadoUnidade: 't',
    limite: true, origemCapacidade: 'Capacidade de trabalho do acessório escolhido (t)', capacidadeTeste: '4,2',
    variaveis: [v('P', 'Peso da carga', 't', 'Peso da carga (t)', '3,45'), v('a', 'Ângulo das pernas', '°', 'Ângulo das pernas (°)', '28')] }),
  exemploEquipe({ id: 'u2', nome: 'Carga com fator dinâmico', categoria: 'Carga', descricao: 'Exemplo (fictício) da equipe RibasRig: carga bruta multiplicada por um fator para movimentos bruscos.', formula: 'Pb * f', resultadoNome: 'Pd', resultadoUnidade: 'kg',
    limite: true, origemCapacidade: 'Capacidade do guindaste no raio (kg)', capacidadeTeste: '9.260',
    variaveis: [v('Pb', 'Carga bruta', 'kg', 'Resultado: carga bruta (kg)'), v('f', 'Fator dinâmico', '', 'Valor fixo', '1,1')] }),
];

/** Nome da regra obrigatória em todo tipo de içamento */
export const ID_REGRA_TAXA_GUINDASTE = 'r9';

/**
 * Um tipo precisa de pelo menos uma regra de tração (nome começando com "Tração") e da taxa do guindaste.
 * Devolve a mensagem do que falta, ou null.
 */
export function erroRegrasDoTipo(regrasDoTipo: string[], catalogo: RegraCalculo[]): string | null {
  const nomes = regrasDoTipo.map((id) => catalogo.find((r) => r.id === id)?.nome ?? '');
  const temTracao = nomes.some((n) => n.startsWith('Tração'));
  const temTaxa = regrasDoTipo.includes(ID_REGRA_TAXA_GUINDASTE);
  const taxa = 'Taxa de utilização do guindaste';
  if (!temTracao && !temTaxa) return `Inclua pelo menos uma regra de tração (nome começando com "Tração") e a regra "${taxa}".`;
  if (!temTracao) return 'Inclua pelo menos uma regra de tração (nome começando com "Tração"): sem ela o formulário não confere as cintas.';
  if (!temTaxa) return `Inclua a regra "${taxa}": sem ela o plano não confere o guindaste no raio.`;
  return null;
}

/**
 * Montagens que as fórmulas de tração (calculos.ts, tracoesPorPosicao) cobrem. Com balancim, as fórmulas dividem por
 * 2 pernas superiores e a manilha da carga por 4 pernas inferiores; sem balancim, P ÷ (2·cos) por perna (exato com 2,
 * conservador com 4). Outra montagem daria tração MENOR que a real, então não é aceita (espelha motor/regras.py).
 */
export const MSG_MONTAGEM_BALANCIM = 'Com balancim, o cálculo considera 4 pernas até a carga e 2 pernas do balancim ao gancho. Outra montagem ainda não é calculada pelo sistema.';
export const MSG_MONTAGEM_SEM_BALANCIM = 'Sem balancim, o cálculo considera 2 ou 4 pernas até a carga. Outra montagem ainda não é calculada pelo sistema.';

/** (balancim, 4, 2) → null · (balancim, 4, 1) → MSG_MONTAGEM_BALANCIM · (sem, 2) → null · (sem, 3) → MSG_MONTAGEM_SEM_BALANCIM */
export function erroMontagemDoTipo(t: Pick<TipoIcamento, 'balancim' | 'pernas' | 'pernasSuperiores'>): string | null {
  if (t.balancim) return t.pernas === 4 && t.pernasSuperiores === 2 ? null : MSG_MONTAGEM_BALANCIM;
  return t.pernas === 2 || t.pernas === 4 ? null : MSG_MONTAGEM_SEM_BALANCIM;
}

// =============================================================================================
// Tipos de içamento
// =============================================================================================

const REGRAS_BASE = ['r1', 'r2', 'r9', 'r6', 'r7'];

export const TIPOS_ICAMENTO: TipoIcamento[] = [
  { id: 't1', nome: 'Balancim · 4 pernas + 2 superiores', origem: 'sistema', autor: 'Sistema RibasRig', versao: 1, planos: ['2607036'],
    descricao: 'Cargas largas, como o chiller do plano 2607036: o balancim abre as pernas e reduz o ângulo.',
    balancim: true, pernas: 4, pernasSuperiores: 2,
    campos: { anguloInferior: true, anguloSuperior: true, anguloUnico: false, pesoBalancim: true, capacidadeLaco: false },
    regras: [...REGRAS_BASE, 'r3', 'r4', 'r5', 'r8'], acessoriosSugeridos: 'Cinta plana 3 m, cinta plana 4 m, manilha 7/8", manilha 1", balancim',
    geometria: 'GEOMETRIA DA LINGADA (BALANCIM · 4 PERNAS INFERIORES · 2 SUPERIORES)', avisoSemAcessorio: null },
  { id: 't2', nome: 'Sem balancim · 2 pernas', origem: 'exemplo', autor: 'Equipe RibasRig', versao: 1, planos: [],
    descricao: 'Exemplo (fictício) da equipe RibasRig: cargas compactas, içadas direto no gancho.',
    balancim: false, pernas: 2, pernasSuperiores: 0,
    campos: { anguloInferior: false, anguloSuperior: false, anguloUnico: true, pesoBalancim: false, capacidadeLaco: false },
    regras: [...REGRAS_BASE, 'u1'], acessoriosSugeridos: 'Cinta plana, manilha',
    geometria: 'GEOMETRIA DA LINGADA (SEM BALANCIM · 2 PERNAS)', avisoSemAcessorio: null },
  { id: 't3', nome: 'Laço de cabo de aço · 2 pernas', origem: 'exemplo', autor: 'Equipe RibasRig', versao: 1, planos: [],
    descricao: 'Exemplo (fictício) da equipe RibasRig: içamento com laço de cabo de aço, sem balancim.',
    balancim: false, pernas: 2, pernasSuperiores: 0,
    campos: { anguloInferior: false, anguloSuperior: false, anguloUnico: true, pesoBalancim: false, capacidadeLaco: true },
    regras: [...REGRAS_BASE, 'u1'], acessoriosSugeridos: 'Laço de cabo de aço, manilha',
    geometria: 'GEOMETRIA DA LINGADA (LAÇO DE CABO DE AÇO · 2 PERNAS)',
    avisoSemAcessorio: 'Não há laço de cabo de aço cadastrado em Acessórios; o tipo não pode ser usado até haver um.' },
];

/** Selo do tipo na lista: "Padrão" · "Exemplo da equipe (fictício)" · "Criado" */
export const rotuloOrigemTipo = (o: TipoIcamento['origem']) => (o === 'sistema' ? 'Padrão' : o === 'exemplo' ? 'Exemplo da equipe (fictício)' : 'Criado');
