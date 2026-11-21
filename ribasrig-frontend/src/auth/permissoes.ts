import type { Perfil } from '../domain/types';

/** Ações controladas por perfil — a mesma lista gera a matriz da tela Usuários e protege rotas e botões. */
export type Acao =
  | 'consultarPlanos'
  | 'editarRascunhos'
  | 'emitirPlano'
  | 'novaRevisao'
  | 'verMemorial'
  | 'editarCadastros'
  | 'verHistorico'
  | 'gerenciarUsuarios'
  | 'alterarConfiguracoes';

export const PERFIS: readonly Perfil[] = ['admin', 'engenheiro', 'operacao'];

export const ROTULO_PERFIL: Record<Perfil, string> = {
  admin: 'Administrador',
  engenheiro: 'Engenheiro responsável',
  operacao: 'Operação (consulta)',
};

export const SIGLA_PERFIL: Record<Perfil, string> = { admin: 'ADMIN', engenheiro: 'ENG.', operacao: 'OPER.' };

/** Mapa único: ação → rótulo e perfis que podem. Administrador inclui tudo do Engenheiro. */
export const PERMISSOES: readonly { acao: Acao; rotulo: string; perfis: readonly Perfil[] }[] = [
  { acao: 'consultarPlanos', rotulo: 'Consultar planos e baixar PDF', perfis: ['admin', 'engenheiro', 'operacao'] },
  { acao: 'editarRascunhos', rotulo: 'Criar e editar rascunhos', perfis: ['admin', 'engenheiro'] },
  { acao: 'emitirPlano', rotulo: 'Emitir plano (com ART)', perfis: ['admin', 'engenheiro'] },
  { acao: 'novaRevisao', rotulo: 'Criar nova revisão', perfis: ['admin', 'engenheiro'] },
  { acao: 'verMemorial', rotulo: 'Ver memorial de cálculo', perfis: ['admin', 'engenheiro'] },
  { acao: 'editarCadastros', rotulo: 'Editar cadastros (guindastes, acessórios, clientes, cálculos)', perfis: ['admin', 'engenheiro'] },
  { acao: 'verHistorico', rotulo: 'Ver histórico de alterações', perfis: ['admin', 'engenheiro'] },
  { acao: 'gerenciarUsuarios', rotulo: 'Gerenciar usuários, perfis e senhas provisórias', perfis: ['admin'] },
  { acao: 'alterarConfiguracoes', rotulo: 'Alterar configurações do sistema', perfis: ['admin'] },
];

const MAPA = new Map(PERMISSOES.map((p) => [p.acao, p.perfis]));

/** O perfil pode fazer a ação? Perfil desconhecido ou ausente = não pode. */
export function pode(perfil: Perfil | null | undefined, acao: Acao): boolean {
  if (!perfil) return false;
  return MAPA.get(acao)?.includes(perfil) ?? false;
}
