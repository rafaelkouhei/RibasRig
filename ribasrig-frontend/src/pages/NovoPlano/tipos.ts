import type { Etapa, FormPlano, ResultadoPlano } from '../../domain/plano';
import type { Acessorio, Cliente, Configuracoes, Guindaste, PlanoRigging, TipoIcamento } from '../../domain/types';

/** Cadastros que o formulário usa (carregados da api). */
export interface Cadastros {
  guindastes: Guindaste[];
  acessorios: Acessorio[];
  clientes: Cliente[];
  tipos: TipoIcamento[];
  config: Configuracoes;
  planos: PlanoRigging[];
}

/** Laudo renovado anexado no plano (validade digitada + PDF), por guindaste. `pdf`: o arquivo escolhido (com o servidor). */
export interface Renovacao { validade: string; arquivo: boolean; pdf?: File | null }

export type Mudar = <K extends keyof FormPlano>(campo: K, valor: FormPlano[K]) => void;

/** O que toda etapa recebe. */
export interface PropsEtapa {
  f: FormPlano;
  set: Mudar;
  patch: (p: Partial<FormPlano>) => void;
  r: ResultadoPlano;
  cad: Cadastros;
  /** Nº do plano (null até o primeiro salvamento) */
  numero: string | null;
  /** Mostra erros de campos vazios (a pessoa tentou avançar desta etapa) */
  tentou: boolean;
  irPara: (n: Etapa) => void;
  abrirArt: () => void;
  notificar: (msg: string, tipo?: 'success' | 'info' | 'warning' | 'error') => void;
  confirmar: (pergunta: { titulo: string; texto: string; acao: string }, ok: () => void) => void;
}
