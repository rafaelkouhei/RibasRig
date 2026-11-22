// Lógica pura da tela Cálculos (sem React): rascunhos de regra/tipo, validação para salvar e textos.
import {
  ORIGENS_CAPACIDADE, ORIGENS_VARIAVEL, RESULTADOS_REGRA, erroMontagemDoTipo, erroRegrasDoTipo, testarRegra, type TesteRegra,
} from '../../domain/regras';
import type { Acessorio, CategoriaRegra, RegraCalculo, TipoIcamento, VariavelRegra } from '../../domain/types';

export const NOVA = 'nova';
export const NOVO = 'novo';

export const CATEGORIAS: readonly CategoriaRegra[] = ['Carga', 'Lingada', 'Guindaste', 'Sapatas e terreno'];

/** Origens que o usuário pode escolher para uma variável (valores do plano e resultados de regras do sistema). */
export const ORIGENS_ESCOLHA: readonly string[] = [...Object.keys(ORIGENS_VARIAVEL), ...Object.keys(RESULTADOS_REGRA)];
export const ORIGENS_CAP: readonly string[] = Object.keys(ORIGENS_CAPACIDADE);

const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function novaRegra(autor: string): RegraCalculo {
  const formula = '';
  const variaveis: VariavelRegra[] = [{ simbolo: 'P', nome: 'Peso da carga', unidade: 't', origem: 'Peso da carga (t)', teste: '3,45' }];
  return {
    id: NOVA, nome: '', categoria: 'Lingada', descricao: '', formula, resultadoNome: 'R', resultadoUnidade: '', variaveis,
    limite: false, origemCapacidade: null, capacidadeTeste: '', noResumo: true, noMemorial: true, automatica: false,
    origem: 'criado', autor, versao: 0, versoes: [], planos: [],
  };
}

export function duplicarRegra(r: RegraCalculo, autor: string): RegraCalculo {
  return { ...copia(r), id: NOVA, nome: `${r.nome || 'Regra'} (cópia)`, origem: 'criado', autor, versao: 0, versoes: [], planos: [] };
}

/** Nova origem da variável: o valor de teste passa a ser o do plano 2607036 para essa origem. */
export function trocarOrigem(v: VariavelRegra, origem: string): VariavelRegra {
  const padrao = ORIGENS_VARIAVEL[origem]?.[0];
  return { ...v, origem, teste: RESULTADOS_REGRA[origem] ? '' : padrao ?? v.teste };
}

/** Nova origem da capacidade de comparação: o teste vira o valor do plano 2607036. */
export function trocarOrigemCapacidade(r: RegraCalculo, origem: string): RegraCalculo {
  return { ...r, origemCapacidade: origem || null, capacidadeTeste: ORIGENS_CAPACIDADE[origem]?.[0] ?? r.capacidadeTeste };
}

/** Mensagem do teste: prefere o erro do valor de teste da variável ao erro genérico da fórmula. */
export function erroDoTeste(t: TesteRegra): string | null {
  if (t.resultado.ok) return null;
  if (/valor de teste/i.test(t.resultado.erro)) {
    const v = t.variaveis.find((x) => x.simbolo && x.erro);
    if (v) return `Valor de teste de "${v.simbolo}": ${v.erro}`;
  }
  return t.resultado.erro;
}

/** Motivo que impede salvar a regra, ou null. */
export function erroSalvarRegra(r: RegraCalculo, catalogo: RegraCalculo[]): string | null {
  if (!r.nome.trim()) return 'Dê um nome para a regra.';
  const outra = catalogo.find((x) => x.id !== r.id && x.nome.trim().toLowerCase() === r.nome.trim().toLowerCase());
  if (outra) return `Já existe a regra "${outra.nome}". Use outro nome.`;
  const simbolos = r.variaveis.map((v) => v.simbolo.trim());
  if (simbolos.some((s) => !s)) return 'Cada variável precisa de um símbolo.';
  if (simbolos.some((s, i) => simbolos.indexOf(s) !== i)) return 'Cada variável precisa de um símbolo único.';
  if (simbolos.some((s) => !/^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_0-9]*$/.test(s))) return 'Símbolo inválido: use letras, números e _ (começando por letra).';
  const t = testarRegra(r, catalogo);
  const erro = erroDoTeste(t);
  if (erro) return erro;
  if (r.limite && !r.origemCapacidade) return 'Escolha de onde vem a capacidade de comparação.';
  if (r.limite && t.erroCapacidade) return `Capacidade de teste: ${t.erroCapacidade}`;
  return null;
}

export function textoUsoRegra(r: RegraCalculo): string {
  if (!r.planos.length) return 'ainda não usada';
  if (r.origem === 'sistema') return `usada no plano ${r.planos.join(', ')} (Rev. 2)`;
  return `usada em ${r.planos.length} ${r.planos.length === 1 ? 'plano' : 'planos'}`;
}

export function textoUsoTipo(t: TipoIcamento): string {
  if (!t.planos.length) return 'ainda não usado';
  return `usado em ${t.planos.length} ${t.planos.length === 1 ? 'plano' : 'planos'} (${t.planos.join(', ')})`;
}

export function novoTipo(autor: string): TipoIcamento {
  return {
    id: NOVO, nome: '', descricao: '', origem: 'criado', balancim: false, pernas: 2, pernasSuperiores: 0,
    campos: { anguloInferior: false, anguloSuperior: false, anguloUnico: true, pesoBalancim: false, capacidadeLaco: false },
    regras: ['r1', 'r2', 'r9', 'r6', 'r7'], acessoriosSugeridos: '', geometria: '', avisoSemAcessorio: null, autor, versao: 0, planos: [],
  };
}

export function duplicarTipo(t: TipoIcamento, autor: string): TipoIcamento {
  return { ...copia(t), id: NOVO, nome: `${t.nome} (cópia)`, origem: 'criado', autor, versao: 0, planos: [] };
}

/** Liga/desliga o balancim e ajusta os campos pedidos (como no protótipo). */
export function alternarBalancim(t: TipoIcamento): TipoIcamento {
  const balancim = !t.balancim;
  return {
    // Com balancim, a única montagem que o cálculo cobre é 4 pernas até a carga + 2 até o gancho (erroMontagemDoTipo)
    ...t, balancim, pernas: balancim ? 4 : t.pernas, pernasSuperiores: balancim ? 2 : 0,
    campos: { ...t.campos, pesoBalancim: balancim, anguloInferior: balancim, anguloSuperior: balancim, anguloUnico: !balancim },
  };
}

/** Título da geometria mostrado na etapa Lingada. */
export function geometriaDoTipo(t: Pick<TipoIcamento, 'balancim' | 'pernas' | 'pernasSuperiores' | 'campos'>): string {
  const laco = t.campos.capacidadeLaco ? 'LAÇO DE CABO DE AÇO · ' : '';
  return t.balancim
    ? `GEOMETRIA DA LINGADA (${laco}BALANCIM · ${t.pernas} PERNAS INFERIORES · ${t.pernasSuperiores} ${t.pernasSuperiores === 1 ? 'SUPERIOR' : 'SUPERIORES'})`
    : `GEOMETRIA DA LINGADA (${laco || 'SEM BALANCIM · '}${t.pernas} PERNAS)`;
}

export const AVISO_SEM_LACO = 'Não há laço de cabo de aço cadastrado em Acessórios; o tipo não pode ser usado até haver um.';

/** Aviso quando o tipo pede capacidade de laço e não há laço em uso no cadastro. */
export function avisoAcessorioFaltando(t: TipoIcamento, acessorios: Acessorio[]): string | null {
  if (!t.campos.capacidadeLaco) return null;
  const temLaco = acessorios.some((a) => a.tipo === 'laco' && a.situacao === 'uso');
  return temLaco ? null : t.avisoSemAcessorio ?? AVISO_SEM_LACO;
}

export function erroSalvarTipo(t: TipoIcamento, catalogo: RegraCalculo[], tipos: TipoIcamento[]): string | null {
  if (!t.nome.trim()) return 'Dê um nome para o tipo de içamento.';
  const outro = tipos.find((x) => x.id !== t.id && x.nome.trim().toLowerCase() === t.nome.trim().toLowerCase());
  if (outro) return `Já existe o tipo "${outro.nome}". Use outro nome.`;
  if (t.regras.some((id) => !catalogo.some((r) => r.id === id))) return 'O tipo usa uma regra que não existe mais. Desmarque-a.';
  const regras = erroRegrasDoTipo(t.regras, catalogo);
  if (regras) return regras;
  if (!t.campos.anguloInferior && !t.campos.anguloSuperior && !t.campos.anguloUnico) return 'Marque pelo menos um campo de ângulo das pernas.';
  return erroMontagemDoTipo(t);
}

/** Prepara o tipo para gravar: geometria coerente com a montagem e aviso de acessório. */
export function tipoParaSalvar(t: TipoIcamento): TipoIcamento {
  return {
    ...t, nome: t.nome.trim(), pernasSuperiores: t.balancim ? t.pernasSuperiores : 0, geometria: geometriaDoTipo(t),
    avisoSemAcessorio: t.campos.capacidadeLaco ? t.avisoSemAcessorio ?? AVISO_SEM_LACO : null,
  };
}

/** Tipos que usam a regra (para avisar antes de excluir). */
export const tiposQueUsam = (idRegra: string, tipos: TipoIcamento[]) => tipos.filter((t) => t.regras.includes(idRegra));
