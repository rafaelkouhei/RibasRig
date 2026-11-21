import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pode, type Acao } from './permissoes';
import type { Perfil } from '../domain/types';

/** Rotas restritas → ação do mapa único de `permissoes.ts`. */
const ACAO_DA_ROTA: { padrao: RegExp; acao: Acao }[] = [
  { padrao: /^\/usuarios\/?$/, acao: 'gerenciarUsuarios' },
  { padrao: /^\/configuracoes\/?$/, acao: 'alterarConfiguracoes' },
  { padrao: /^\/planos\/[^/]+\/memorial\/?$/, acao: 'verMemorial' },
  { padrao: /^\/planos\/(novo|lote|[^/]+\/(editar|duplicar))\/?$/, acao: 'editarRascunhos' },
  { padrao: /^\/planos\/[^/]+\/revisao\/?$/, acao: 'novaRevisao' },
  { padrao: /^\/planos\/[^/]+\/historico\/?$/, acao: 'verHistorico' },
];

export function acaoDaRota(caminho: string): Acao | null {
  return ACAO_DA_ROTA.find((r) => r.padrao.test(caminho))?.acao ?? null;
}

/**
 * Exige sessão e a permissão da rota (pelo caminho, ou `acao` explícita).
 * `perfil` é aceito por compatibilidade, mas a regra vem de `pode()`. Sem permissão volta para o Início.
 */
export function RequireAuth({ children, perfil, acao }: { children: ReactNode; perfil?: Perfil | Perfil[]; acao?: Acao }) {
  const { usuario } = useAuth();
  const local = useLocation();
  if (!usuario) return <Navigate to="/login" state={{ de: local.pathname }} replace />;
  const exigida = acao ?? acaoDaRota(local.pathname);
  const perfis = perfil == null ? null : Array.isArray(perfil) ? perfil : [perfil];
  const permitido = exigida ? pode(usuario.perfil, exigida) : !perfis || perfis.includes(usuario.perfil);
  if (!permitido) return <Navigate to="/" replace />;
  return <>{children}</>;
}
