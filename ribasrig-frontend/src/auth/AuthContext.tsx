import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, EVENTO_SESSAO_EXPIRADA, MODO_API } from '../services/api';
import type { Perfil, Usuario } from '../domain/types';

/** Usuário que entrou com senha provisória e precisa criar uma senha nova antes de usar o sistema. */
export interface TrocaPendente { usuario: string; provisoria: string }

interface AuthValor {
  usuario: Usuario | null;
  /** Entra no sistema. Se o usuário precisa trocar a senha, não abre a sessão e devolve `'trocar-senha'`. */
  entrar: (usuario: string, senha: string) => Promise<'ok' | 'trocar-senha'>;
  sair: () => void;
  trocaPendente: TrocaPendente | null;
  /** Marca a troca de senha como concluída para este login (o mock não tem endpoint de troca). */
  concluirTroca: (login: string) => void;
}

const AuthContext = createContext<AuthValor | null>(null);
const CHAVE = 'ribasrig.sessao';
const CHAVE_TROCADAS = 'ribasrig.senhasTrocadas';
const PERFIS: readonly Perfil[] = ['admin', 'engenheiro', 'operacao'];

function lerJson(chave: string): unknown {
  try {
    const salvo = sessionStorage.getItem(chave);
    return salvo ? (JSON.parse(salvo) as unknown) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    if (valor == null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch { /* armazenamento indisponível: a sessão vale só nesta aba */ }
}

/** Lê a sessão salva; formato inválido ou antigo = sem sessão. */
export function lerSessao(bruto: unknown): Usuario | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const u = (bruto as { usuario?: unknown }).usuario;
  if (!u || typeof u !== 'object') return null;
  const c = u as Partial<Usuario>;
  if (typeof c.nome !== 'string' || typeof c.perfil !== 'string' || !PERFIS.includes(c.perfil)) return null;
  return {
    id: typeof c.id === 'number' ? c.id : 0, nome: c.nome, usuario: typeof c.usuario === 'string' ? c.usuario : '',
    perfil: c.perfil, ativo: c.ativo !== false, principal: c.principal === true, trocarSenha: false,
    ultimoAcesso: typeof c.ultimoAcesso === 'string' ? c.ultimoAcesso : null, observacao: typeof c.observacao === 'string' ? c.observacao : '',
  };
}

function senhasTrocadas(): string[] {
  const v = lerJson(CHAVE_TROCADAS);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => lerSessao(lerJson(CHAVE)));
  const [trocaPendente, setTrocaPendente] = useState<TrocaPendente | null>(null);

  const entrar = async (login: string, senha: string): Promise<'ok' | 'trocar-senha'> => {
    const r = await api.login(login, senha);
    // Sem token (servidor) = troca pendente de verdade; a lista local só vale para o mock, que não grava a troca
    if (r.usuario.trocarSenha && (!r.token || !senhasTrocadas().includes(r.usuario.usuario))) {
      setTrocaPendente({ usuario: r.usuario.usuario, provisoria: senha });
      return 'trocar-senha';
    }
    gravar(CHAVE, { usuario: r.usuario }); // só o usuário (para a tela); o token fica em memória, em api.ts
    setUsuario({ ...r.usuario, trocarSenha: false });
    setTrocaPendente(null);
    return 'ok';
  };

  const sair = () => {
    gravar(CHAVE, null);
    setUsuario(null);
    void api.sair().catch(() => undefined);
  };

  // Com o servidor: ao abrir, renova o token e pega o perfil de GET /api/auth/me/ (não confia no navegador);
  // sessão vencida ou revogada em qualquer chamada volta para o login.
  useEffect(() => {
    if (MODO_API !== 'http') return;
    const expirou = () => { gravar(CHAVE, null); setUsuario(null); };
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
    api.retomarSessao()
      .then((u) => { if (u) { gravar(CHAVE, { usuario: u }); setUsuario(u); } else expirou(); })
      .catch(() => undefined); // sem conexão: mantém a tela; as chamadas mostram o erro
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
  }, []);

  const concluirTroca = (login: string) => {
    const l = login.trim().toLowerCase();
    gravar(CHAVE_TROCADAS, [...new Set([...senhasTrocadas(), l])]);
    setTrocaPendente(null);
  };

  return <AuthContext.Provider value={{ usuario, entrar, sair, trocaPendente, concluirTroca }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
