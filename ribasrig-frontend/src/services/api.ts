// Camada de acesso a dados. Duas implementações com a MESMA assinatura, escolhidas por VITE_API:
// - 'mock' (padrão: desenvolvimento, testes e demonstração): cenário de exemplo (data/mock.ts), sempre com CÓPIAS;
// - 'http': Django REST (ribasrig-backend), no endpoint do comentário de cada função. O Electron usa sempre 'http'.
// A conversão camelCase ⇄ snake_case fica só em `paraApi` / `daApi`.
import {
  ACESSORIOS, CLIENTES, CONFIGURACOES, EVENTOS, GUINDASTES, PADROES, PLANOS, REGRAS, TIPOS, USUARIOS,
} from '../data/mock';
import { aplicarInspecao, type DestinoReprovado } from '../domain/inspecao';
import { HOJE, dataBR } from '../domain/formatacao';
import { numerosParaLote, proximoNumero } from '../domain/numeracao';
import {
  artsEmUso, calcularPlano, formDoPlano, nomeArquivoPlano, proximaRevisao, resultadosDoCalculo,
} from '../domain/plano';
import { erroLogin, erroNomeArquivo } from '../domain/validacao';
import type {
  Acessorio, Cliente, Configuracoes, DadosPlano, EventoHistorico, Guindaste, PadraoInspecao, Perfil, PlanoRigging, RegraCalculo,
  RegistroInspecao, Revisao, TipoEvento, TipoIcamento, Usuario,
} from '../domain/types';

// =============================================================================================
// Infraestrutura: erros, conversão de nomes e cliente HTTP (preparado para o Django)
// =============================================================================================

export class ErroApi extends Error {
  /** Mesmo significado do HTTP: 400 dados inválidos, 401 login, 404 não encontrado, 409 conflito (ex.: plano emitido), 422 regra de negócio */
  status: number;
  constructor(status: number, mensagem: string) { super(mensagem); this.name = 'ErroApi'; this.status = status; }
}

const paraSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const paraCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
function converterChaves(v: unknown, conv: (k: string) => string): unknown {
  if (Array.isArray(v)) return v.map((x) => converterChaves(x, conv));
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [conv(k), converterChaves(x, conv)]));
  }
  return v;
}
/** camelCase (front) → snake_case (Django). Único lugar da conversão. */
export const paraApi = <T>(v: T): unknown => converterChaves(v, paraSnake);
/** snake_case (Django) → camelCase (front). Único lugar da conversão. */
export const daApi = <T>(v: unknown): T => converterChaves(v, paraCamel) as T;

/** 'mock' (padrão) ou 'http' (Django). Definido no build por VITE_API. */
export const MODO_API: 'mock' | 'http' = import.meta.env.VITE_API === 'http' ? 'http' : 'mock';
/** Origem da API. Vazio = mesma origem (o Vite em desenvolvimento e o Electron redirecionam /api para o Django). */
const BASE_API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
/** Disparado em `window` quando a sessão acaba (refresh vencido ou revogado): o AuthContext volta para o login. */
export const EVENTO_SESSAO_EXPIRADA = 'ribasrig:sessao-expirada';

// Token de acesso (curto) só em memória; refresh no sessionStorage, nunca no localStorage (auditoria de 08/10/2026).
let token: string | null = null;
const CHAVE_REFRESH = 'ribasrig.refresh';
function lerRefresh(): string | null {
  try { return sessionStorage.getItem(CHAVE_REFRESH); } catch { return null; }
}
function gravarRefresh(v: string | null) {
  try { if (v) sessionStorage.setItem(CHAVE_REFRESH, v); else sessionStorage.removeItem(CHAVE_REFRESH); } catch { /* sem armazenamento: vale só em memória */ }
}
function encerrarSessao(avisar: boolean) {
  token = null;
  gravarRefresh(null);
  if (avisar && typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
}

let renovando: Promise<boolean> | null = null;
/** Troca o refresh por um access novo (uma renovação por vez, mesmo com várias chamadas recebendo 401 juntas). */
function renovarToken(): Promise<boolean> {
  const refresh = lerRefresh();
  if (!refresh) return Promise.resolve(false);
  renovando ??= (async () => {
    try {
      const r = await fetch(`${BASE_API}/api/auth/token/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }) });
      if (!r.ok) return false;
      const d = (await r.json()) as { access: string; refresh?: string };
      token = d.access;
      if (d.refresh) gravarRefresh(d.refresh);
      return true;
    } catch { return false; } finally { renovando = null; }
  })();
  return renovando;
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Cliente HTTP para o Django REST: JWT no cabeçalho, corpo em snake_case, resposta em camelCase.
 * Com 401, renova o token uma vez e repete; sem renovar, encerra a sessão. `FormData` vai como multipart (uploads).
 */
async function requisitar(metodo: Metodo, url: string, corpo?: unknown, opcoes: { renovar?: boolean } = {}): Promise<Response> {
  const renovar = opcoes.renovar !== false;
  const enviar = async () => {
    try {
      return await fetch(`${BASE_API}${url}`, {
        method: metodo,
        headers: { ...(corpo instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: corpo === undefined ? undefined : corpo instanceof FormData ? corpo : JSON.stringify(paraApi(corpo)),
      });
    } catch {
      throw new ErroApi(0, 'Sem conexão com o servidor do RibasRig. Confira se ele está ligado e tente de novo.');
    }
  };
  let r = await enviar();
  if (r.status === 401 && renovar) {
    if (await renovarToken()) r = await enviar();
    if (r.status === 401) encerrarSessao(true);
  }
  return r;
}

async function erroDaResposta(r: Response, url: string): Promise<ErroApi> {
  const dados = await r.json().catch(() => null);
  return new ErroApi(r.status, (dados as { detail?: string } | null)?.detail ?? `Erro ${r.status} em ${url}`);
}

export async function http<T>(metodo: Metodo, url: string, corpo?: unknown, opcoes: { renovar?: boolean } = {}): Promise<T> {
  const r = await requisitar(metodo, url, corpo, opcoes);
  const dados = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ErroApi(r.status, (dados as { detail?: string } | null)?.detail ?? `Erro ${r.status} em ${url}`);
  return daApi<T>(dados);
}

/** Arquivo gerado pelo servidor (PDF, planilha), com o mesmo login e a mesma renovação de token. */
export async function httpArquivo(url: string): Promise<Blob> {
  const r = await requisitar('GET', url);
  if (!r.ok) throw await erroDaResposta(r, url);
  return r.blob();
}

/** Envia um arquivo (multipart, campo "arquivo"). */
function enviarArquivo<T>(url: string, arquivo: File): Promise<T> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo, arquivo.name);
  return http<T>('POST', url, corpo);
}

// =============================================================================================
// Utilitários do mock
// =============================================================================================

const ATRASO_MS = 120;
const copia = <T>(v: T): T => structuredClone(v);
const responder = <T>(v: T) => new Promise<T>((ok) => setTimeout(() => ok(copia(v)), ATRASO_MS));
const falhar = (status: number, msg: string) => new Promise<never>((_, nao) => setTimeout(() => nao(new ErroApi(status, msg)), ATRASO_MS));
const proximoId = (lista: { id: number }[]) => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1;

/** Data e hora "agora" no cenário: a data é sempre HOJE (07/10/2026), a hora vem do relógio. */
export function agora(): string {
  const d = new Date();
  return `${HOJE}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

let sessao: Usuario | null = null;
const nomeUsuarioAtual = () => sessao?.nome ?? 'Giuliano Breda';

function registrarEvento(planoNumero: string, tipo: TipoEvento, titulo: string, detalhe: string) {
  EVENTOS.push({ id: proximoId(EVENTOS), planoNumero, tipo, titulo, detalhe, usuario: nomeUsuarioAtual(), quando: agora() });
}

/** Mesmo cálculo que o back-end fará antes de emitir. */
function calcularNoServidor(p: PlanoRigging) {
  return calcularPlano({
    form: formDoPlano(p), numero: p.numero, acessorios: ACESSORIOS, guindastes: GUINDASTES, tipos: TIPOS, clientes: CLIENTES,
    configuracoes: CONFIGURACOES, hoje: HOJE, artsEmUso: artsEmUso(PLANOS.filter((x) => x.numero !== p.numero)),
  });
}

/** No mock não existe arquivo gerado: as telas mostram o que fariam (e só pedem o arquivo com o servidor ligado). */
const semArquivoNoMock = (nome: string) => falhar(409, `${nome}: o modo de demonstração não gera arquivos. Ligue o servidor do RibasRig.`);

/** Senha provisória fixa no protótipo; no back-end real é gerada a cada pedido. */
export const SENHA_PROVISORIA = 'Ribas-4821';

const META_PLANO = ['id', 'numero', 'situacaoDocumento', 'revisoes', 'criadoEm', 'criadoPor', 'atualizadoEm'] as const;
const soDados = (p: PlanoRigging | DadosPlano): DadosPlano => {
  const d = { ...p } as Record<string, unknown>;
  for (const k of META_PLANO) delete d[k];
  return copia(d as unknown as DadosPlano);
};

/** Próximo id textual (t11, u12…) sem repetir um que já existe, mesmo depois de exclusões. */
function proximoIdTexto(prefixo: string, lista: { id: string }[]): string {
  const usados = lista.map((x) => Number(x.id.slice(prefixo.length))).filter((n) => Number.isFinite(n));
  return `${prefixo}${Math.max(10, ...usados) + 1}`;
}

function novoRascunho(numero: string, dados: DadosPlano): PlanoRigging {
  const quando = agora();
  return { ...soDados(dados), id: proximoId(PLANOS), numero, situacaoDocumento: 'rascunho', revisoes: [], criadoEm: quando, criadoPor: nomeUsuarioAtual(), atualizadoEm: quando };
}

// =============================================================================================
// API · mock
// =============================================================================================

/** Anexo do plano enviado pela etapa Anexos: PDF dos desenhos ou da ART do CREA. */
export type TipoAnexoPlano = 'desenhos' | 'art';

const apiMock = {
  // ------------------------------------------------------------------ autenticação
  /** POST /api/auth/token/ (JWT, djangorestframework-simplejwt) → { access, refresh, usuario }. O perfil vem do usuário. */
  login: async (usuario: string, senha: string): Promise<{ token: string; usuario: Usuario }> => {
    const login = usuario.trim().toLowerCase();
    if (!login || !senha) return falhar(400, 'Informe usuário e senha.');
    const u = USUARIOS.find((x) => x.usuario === login);
    // Mock: qualquer senha preenchida entra para um usuário ativo existente.
    if (!u || !u.ativo) return falhar(401, 'Usuário ou senha incorretos.');
    u.ultimoAcesso = agora();
    sessao = copia(u);
    const novoToken = `token-de-desenvolvimento-${u.id}`;
    token = novoToken;
    return responder({ token: novoToken, usuario: u });
  },
  /** POST /api/auth/logout/ */
  sair: async (): Promise<void> => { sessao = null; token = null; await responder(null); },
  /** Ao abrir: POST /api/auth/token/refresh/ + GET /api/auth/me/ (perfil vem do servidor). No mock não há sessão a retomar. */
  retomarSessao: async (): Promise<Usuario | null> => null,

  // ------------------------------------------------------------------ planos
  /** GET /api/planos/ */
  listarPlanos: (): Promise<PlanoRigging[]> => responder(PLANOS),
  /** GET /api/planos/{numero}/ */
  obterPlano: (numero: string): Promise<PlanoRigging> => {
    const p = PLANOS.find((x) => x.numero === numero);
    return p ? responder(p) : falhar(404, `Plano ${numero} não encontrado.`);
  },
  /**
   * POST /api/planos/ → cria rascunho com número gerado pelo sistema (proximoNumero, pela data de criação).
   * O número nunca é digitado.
   */
  criarPlano: (dados: DadosPlano): Promise<PlanoRigging> => {
    let numero: string;
    try { numero = proximoNumero(agora(), PLANOS.map((p) => p.numero)); } catch (e) { return falhar(409, (e as Error).message); }
    const p = novoRascunho(numero, dados);
    PLANOS.push(p);
    registrarEvento(numero, 'cadastro', 'Criou o rascunho', dados.copiaDe ? `Cópia do plano ${dados.copiaDe}.` : 'Plano novo.');
    return responder(p);
  },
  /** POST /api/planos/{numero}/duplicar/ → novo rascunho (novo número) com os dados do plano, sem ART nem anexos. */
  duplicarPlano: (numero: string): Promise<PlanoRigging> => {
    const origem = PLANOS.find((x) => x.numero === numero);
    if (!origem) return falhar(404, `Plano ${numero} não encontrado.`);
    const dados: DadosPlano = { ...soDados(origem), art: '', artRegistradaEm: null, anexos: { desenhos: null, artPlano: false, arquivoArt: null }, etapaAtual: 1, copiaDe: numero };
    return apiMock.criarPlano(dados);
  },
  /**
   * PATCH /api/planos/{numero}/ → salva o rascunho mantendo id e número.
   * Plano emitido recusa alteração (409): crie uma nova revisão.
   */
  salvarRascunho: (plano: PlanoRigging): Promise<PlanoRigging> => {
    const i = PLANOS.findIndex((x) => x.id === plano.id);
    if (i < 0) return falhar(404, 'Plano não encontrado. Use criarPlano para um plano novo.');
    const atual = PLANOS[i];
    if (atual.situacaoDocumento === 'emitido') return falhar(409, `Plano ${atual.numero} emitido não pode ser alterado. Crie uma nova revisão.`);
    PLANOS[i] = { ...soDados(plano), id: atual.id, numero: atual.numero, situacaoDocumento: 'rascunho', revisoes: atual.revisoes, criadoEm: atual.criadoEm, criadoPor: atual.criadoPor, atualizadoEm: agora() };
    return responder(PLANOS[i]);
  },
  /**
   * POST /api/planos/{numero}/emitir/ → o servidor recalcula; se pode emitir, cria a Revisão N+1 com
   * cópia completa dos resultados e trava o plano (situacaoDocumento = 'emitido').
   */
  emitirPlano: (numero: string, observacao = ''): Promise<PlanoRigging> => {
    const p = PLANOS.find((x) => x.numero === numero);
    if (!p) return falhar(404, `Plano ${numero} não encontrado.`);
    if (p.situacaoDocumento === 'emitido') return falhar(409, 'Plano já emitido. Para mudar algo, crie uma nova revisão.');
    const calc = calcularNoServidor(p);
    if (!calc.podeEmitir) {
      const pend = calc.checklist.filter((c) => !c.ok).map((c) => c.rotulo.toLowerCase());
      return falhar(422, `Não dá para emitir: ${[...calc.motivosBloqueio, ...pend].join('; ')}.`);
    }
    const rev = proximaRevisao(p);
    const revisao: Revisao = {
      numero: rev, origem: 'sistema', emitidaEm: agora(), emitidaPor: nomeUsuarioAtual(), cadastradaEm: null,
      arquivoPdf: nomeArquivoPlano(CONFIGURACOES.nomeArquivo, numero, rev), observacao,
      resultados: copia(resultadosDoCalculo(calc)),
    };
    p.revisoes.push(revisao);
    p.situacaoDocumento = 'emitido';
    p.etapaAtual = 6;
    p.atualizadoEm = revisao.emitidaEm;
    for (const a of ACESSORIOS) {
      const usado = p.lingada.some((l) => l.acessorioId === a.id) || p.dispositivo.acessorioId === a.id;
      if (!usado) continue;
      if (!a.planos.includes(numero)) a.planos.push(numero);
      a.historico.unshift({ data: HOJE, descricao: `Usado no plano ${numero} Rev. ${rev}, emitido no sistema` });
    }
    registrarEvento(numero, 'emissao', `Emitiu a Rev. ${rev}`, revisao.arquivoPdf);
    return responder(p);
  },
  /** POST /api/planos/{numero}/nova-revisao/ → volta a rascunho (Rev. N+1 do mesmo número). Revisões emitidas ficam guardadas. */
  novaRevisao: (numero: string): Promise<PlanoRigging> => {
    const p = PLANOS.find((x) => x.numero === numero);
    if (!p) return falhar(404, `Plano ${numero} não encontrado.`);
    if (p.situacaoDocumento !== 'emitido') return falhar(409, 'O plano já está em rascunho.');
    p.situacaoDocumento = 'rascunho';
    p.atualizadoEm = agora();
    registrarEvento(numero, 'edicao', `Criou a Rev. ${proximaRevisao(p)} (rascunho)`, 'As revisões emitidas continuam guardadas como foram entregues.');
    return responder(p);
  },
  /**
   * POST /api/planos/lote/ → cria N rascunhos em sequência (mesmos dados), começando no próximo número livre
   * do mês. Erro se passar de 999 no mês.
   */
  criarLote: (dados: DadosPlano, quantidade: number): Promise<PlanoRigging[]> => {
    let numeros: string[];
    try { numeros = numerosParaLote(agora(), PLANOS.map((p) => p.numero), quantidade); } catch (e) { return falhar(400, (e as Error).message); }
    const criados = numeros.map((n) => { const p = novoRascunho(n, dados); PLANOS.push(p); return p; });
    for (const p of criados) registrarEvento(p.numero, 'cadastro', 'Criou o rascunho (lote)', `Lote de ${quantidade} planos: ${numeros[0]} a ${numeros[numeros.length - 1]}.`);
    return responder(criados);
  },
  /** GET /api/planos/{numero}/historico/ → eventos do mais novo para o mais antigo */
  historicoPlano: (numero: string): Promise<EventoHistorico[]> =>
    // No mock a ordem de registro (id) é a ordem real: `agora()` junta o HOJE fixo com a hora do relógio,
    // então um evento novo de madrugada ficaria "antes" dos de exemplo se a ordenação fosse por `quando`.
    responder(EVENTOS.filter((e) => e.planoNumero === numero).sort((a, b) => b.id - a.id)),
  /**
   * POST /api/planos/{numero}/anexos/{desenhos|art}/ (multipart) → plano com o nome do PDF. O servidor confere que é PDF
   * pelos bytes; plano emitido recusa (409). A ART só vale no checklist com o nome ART_<nº da ART>.pdf.
   */
  enviarAnexoPlano: (numero: string, tipo: TipoAnexoPlano, arquivo: File): Promise<PlanoRigging> => {
    const p = PLANOS.find((x) => x.numero === numero);
    if (!p) return falhar(404, `Plano ${numero} não encontrado.`);
    if (p.situacaoDocumento === 'emitido') return falhar(409, `Plano ${numero} emitido não pode ser alterado. Crie uma nova revisão.`);
    if (!/\.pdf$/i.test(arquivo.name)) return falhar(400, 'O arquivo não é um PDF válido.');
    p.anexos = tipo === 'desenhos' ? { ...p.anexos, desenhos: arquivo.name } : { ...p.anexos, artPlano: true, arquivoArt: arquivo.name };
    registrarEvento(numero, 'anexo', tipo === 'desenhos' ? 'Anexou os desenhos' : 'Anexou a ART do plano', arquivo.name);
    return responder(p);
  },
  /** DELETE /api/planos/{numero}/anexos/{desenhos|art}/ */
  removerAnexoPlano: (numero: string, tipo: TipoAnexoPlano): Promise<PlanoRigging> => {
    const p = PLANOS.find((x) => x.numero === numero);
    if (!p) return falhar(404, `Plano ${numero} não encontrado.`);
    if (p.situacaoDocumento === 'emitido') return falhar(409, `Plano ${numero} emitido não pode ser alterado. Crie uma nova revisão.`);
    p.anexos = tipo === 'desenhos' ? { ...p.anexos, desenhos: null } : { ...p.anexos, artPlano: false, arquivoArt: null };
    return responder(p);
  },

  /** GET /api/planos/{numero}/revisoes/{rev}/pdf/ → PDF único do cliente, gerado na emissão. No mock não há arquivo. */
  baixarPdfRevisao: (numero: string, rev: number): Promise<Blob> => semArquivoNoMock(`Plano_de_Rigging_${numero}_Rev${rev}.pdf`),
  /** GET /api/planos/{numero}/revisoes/{rev}/memorial/ → memorial de cálculo interno (PDF). */
  baixarMemorial: (numero: string, rev: number): Promise<Blob> => semArquivoNoMock(`Memorial_${numero}_Rev${rev}.pdf`),
  /** GET /api/planos/{numero}/carimbo/ → Carimbo_{numero}.xlsx para o SolidWorks. */
  baixarCarimbo: (numero: string): Promise<Blob> => semArquivoNoMock(`Carimbo_${numero}.xlsx`),
  /** GET /api/sistema/ (sem login) → data das regras de negócio e limite da taxa de utilização. */
  sistema: (): Promise<{ hoje: string; versao: string; limitePct: number }> => responder({ hoje: HOJE, versao: 'mock', limitePct: CONFIGURACOES.limitePct }),

  // ------------------------------------------------------------------ guindastes
  /** GET /api/guindastes/ */
  listarGuindastes: (): Promise<Guindaste[]> => responder(GUINDASTES),
  /** POST /api/guindastes/{id}/laudo/arquivo/ (multipart) → PDF do laudo vigente; o nome mostrado passa a ser o do arquivo. */
  enviarLaudoGuindaste: (id: number, arquivo: File): Promise<Guindaste> => {
    const g = GUINDASTES.find((x) => x.id === id);
    if (!g) return falhar(404, 'Guindaste não encontrado.');
    const laudo = g.laudos.find((l) => l.atual);
    if (!laudo) return falhar(409, 'Cadastre o laudo (validade e ART) antes de anexar o PDF.');
    laudo.arquivo = arquivo.name;
    return responder(g);
  },
  /**
   * POST /api/guindastes/ (id 0 ou inexistente) · PUT /api/guindastes/{id}/ — com laudos e tabelas.
   * Ordena os pontos de cada gráfico por alcance e garante um único laudo atual (o último, se nenhum marcado).
   */
  salvarGuindaste: (g: Guindaste): Promise<Guindaste> => {
    if (!g.modelo.trim()) return falhar(400, 'Informe o nome / modelo do guindaste.');
    const novo: Guindaste = copia(g);
    novo.tabelas = novo.tabelas.map((t) => ({ ...t, pontos: [...t.pontos].sort((a, b) => a.alcanceM - b.alcanceM) }));
    if (novo.laudos.length) {
      const iAtual = Math.max(novo.laudos.findIndex((l) => l.atual), 0);
      const idx = novo.laudos.some((l) => l.atual) ? iAtual : novo.laudos.length - 1;
      novo.laudos = novo.laudos.map((l, i) => ({ ...l, atual: i === idx }));
    }
    const i = GUINDASTES.findIndex((x) => x.id === g.id);
    if (i >= 0) GUINDASTES[i] = novo; else { novo.id = proximoId(GUINDASTES); GUINDASTES.push(novo); }
    return responder(novo);
  },

  // ------------------------------------------------------------------ acessórios
  /** GET /api/acessorios/ (todos, inclusive descartados e inativos; filtre na tela) */
  listarAcessorios: (): Promise<Acessorio[]> => responder(ACESSORIOS),
  /**
   * POST /api/acessorios/ · PUT /api/acessorios/{id}/ — inclui data de entrada, certificado, vencimento e motivo do descarte.
   * O servidor recusa descartado sem motivo (400). O PDF do certificado sobe à parte (multipart), como os anexos do plano.
   */
  salvarAcessorio: (a: Acessorio): Promise<Acessorio> => {
    if (!a.descricao.trim()) return falhar(400, 'Informe a descrição.');
    if (a.situacao === 'descartado' && !a.motivoDescarte.trim()) return falhar(400, 'Informe o motivo do descarte.');
    const novo = copia(a);
    const i = ACESSORIOS.findIndex((x) => x.id === a.id);
    if (i >= 0) ACESSORIOS[i] = novo; else { novo.id = proximoId(ACESSORIOS); ACESSORIOS.push(novo); }
    return responder(novo);
  },
  /** POST /api/acessorios/{id}/desativar/ → situacao 'inativo'; nada é apagado (histórico e planos ficam). */
  desativarAcessorio: (id: number): Promise<Acessorio> => {
    const a = ACESSORIOS.find((x) => x.id === id);
    if (!a) return falhar(404, 'Acessório não encontrado.');
    a.situacao = 'inativo';
    a.historico.unshift({ data: HOJE, descricao: `Desativado por ${nomeUsuarioAtual()} em ${dataBR(HOJE)}` });
    return responder(a);
  },

  /** POST /api/acessorios/{id}/reativar/ → volta para 'uso', registrando no histórico. */
  reativarAcessorio: (id: number): Promise<Acessorio> => {
    const a = ACESSORIOS.find((x) => x.id === id);
    if (!a) return falhar(404, 'Acessório não encontrado.');
    if (a.situacao !== 'inativo') return falhar(409, 'Só um acessório inativo pode ser reativado.');
    a.situacao = 'uso';
    a.historico.unshift({ data: HOJE, descricao: `Reativado por ${nomeUsuarioAtual()} em ${dataBR(HOJE)}` });
    return responder(a);
  },

  /**
   * POST /api/acessorios/{id}/inspecoes/ { data, responsavel, resultado, itens[{texto, conforme}], observacao, proxima,
   * destino, motivo } → acessório atualizado. Aprovado: volta para "Em uso" com a próxima inspeção. Reprovado: descartado
   * (com motivo) ou "Em inspeção" para reparo. A inspeção guarda a cópia dos itens conferidos.
   */
  registrarInspecao: (id: number, r: RegistroInspecao, destino: DestinoReprovado, motivo: string): Promise<Acessorio> => {
    const i = ACESSORIOS.findIndex((x) => x.id === id);
    if (i < 0) return falhar(404, 'Acessório não encontrado.');
    if (ACESSORIOS[i].situacao === 'inativo' || ACESSORIOS[i].situacao === 'descartado') return falhar(409, 'Acessório inativo ou descartado não recebe inspeção.');
    if (!r.itens.length) return falhar(400, 'A inspeção precisa ter itens conferidos.');
    if (r.resultado === 'aprovado' && !r.proxima) return falhar(400, 'Informe a próxima inspeção.');
    ACESSORIOS[i] = aplicarInspecao(ACESSORIOS[i], r, destino, motivo);
    return responder(ACESSORIOS[i]);
  },

  /** POST /api/acessorios/{id}/certificado/ (multipart) → PDF do certificado do fabricante. */
  enviarCertificadoAcessorio: (id: number, arquivo: File): Promise<Acessorio> => {
    const a = ACESSORIOS.find((x) => x.id === id);
    if (!a) return falhar(404, 'Acessório não encontrado.');
    a.certificadoArquivo = arquivo.name;
    a.historico.unshift({ data: HOJE, descricao: `Certificado anexado: ${arquivo.name}` });
    return responder(a);
  },

  // ------------------------------------------------------------------ padrões de inspeção
  /** GET /api/padroes-inspecao/ → um padrão por tipo de acessório */
  listarPadroesInspecao: (): Promise<PadraoInspecao[]> => responder(PADROES),
  /** PUT /api/padroes-inspecao/{tipo}/ — só vale para inspeções novas; as já registradas guardam a cópia dos itens. */
  salvarPadraoInspecao: (p: PadraoInspecao): Promise<PadraoInspecao> => {
    const itens = p.itens.map((t) => t.trim()).filter(Boolean);
    if (!itens.length) return falhar(400, 'O padrão precisa de pelo menos um item.');
    const novo: PadraoInspecao = { ...copia(p), itens, referencia: p.referencia.trim(), atualizadoEm: HOJE };
    const i = PADROES.findIndex((x) => x.tipo === p.tipo);
    if (i >= 0) PADROES[i] = novo; else PADROES.push(novo);
    return responder(novo);
  },

  // ------------------------------------------------------------------ clientes
  /** GET /api/clientes/ */
  listarClientes: (): Promise<Cliente[]> => responder(CLIENTES),
  /** POST /api/clientes/ · PUT /api/clientes/{id}/ (locais de obra vão juntos) */
  salvarCliente: (c: Cliente): Promise<Cliente> => {
    if (!c.razaoSocial.trim()) return falhar(400, 'Informe a razão social.');
    const novo = copia(c);
    const i = CLIENTES.findIndex((x) => x.id === c.id);
    if (i >= 0) CLIENTES[i] = novo; else { novo.id = proximoId(CLIENTES); CLIENTES.push(novo); }
    return responder(novo);
  },

  // ------------------------------------------------------------------ tipos de içamento e regras
  /** GET /api/tipos-icamento/ */
  listarTiposIcamento: (): Promise<TipoIcamento[]> => responder(TIPOS),
  /** POST /api/tipos-icamento/ · PUT /api/tipos-icamento/{id}/ — tipo do sistema é somente leitura; salvar cria nova versão. */
  salvarTipoIcamento: (t: TipoIcamento): Promise<TipoIcamento> => {
    const i = TIPOS.findIndex((x) => x.id === t.id);
    if (i >= 0 && TIPOS[i].origem === 'sistema') return falhar(409, 'Tipo padrão do sistema é somente leitura. Duplique para criar outro.');
    const novo = copia(t);
    if (i >= 0) { novo.versao = TIPOS[i].versao + 1; TIPOS[i] = novo; }
    else { novo.id = proximoIdTexto('t', TIPOS); novo.versao = 1; novo.origem = 'criado'; TIPOS.push(novo); }
    return responder(novo);
  },
  /** DELETE /api/tipos-icamento/{id}/ — tipo do sistema não pode ser excluído. Planos emitidos mantêm o resultado gravado. */
  excluirTipoIcamento: (id: string): Promise<void> => {
    const i = TIPOS.findIndex((x) => x.id === id);
    if (i < 0) return falhar(404, 'Tipo de içamento não encontrado.');
    if (TIPOS[i].origem === 'sistema') return falhar(409, 'Tipo padrão do sistema não pode ser excluído.');
    TIPOS.splice(i, 1);
    return responder(undefined);
  },
  /** GET /api/regras/ */
  listarRegras: (): Promise<RegraCalculo[]> => responder(REGRAS),
  /** POST /api/regras/ · PUT /api/regras/{id}/ — regra do sistema é somente leitura; salvar cria nova versão (planos emitidos guardam a usada). */
  salvarRegra: (r: RegraCalculo): Promise<RegraCalculo> => {
    const i = REGRAS.findIndex((x) => x.id === r.id);
    if (i >= 0 && REGRAS[i].origem === 'sistema') return falhar(409, 'Regra do sistema é somente leitura. Duplique para criar outra.');
    const novo = copia(r);
    const versao = i >= 0 ? REGRAS[i].versao + 1 : 1;
    novo.versao = versao;
    novo.versoes = [...(i >= 0 ? REGRAS[i].versoes : []), { versao, formula: novo.formula, variaveis: copia(novo.variaveis), salvaEm: agora(), autor: nomeUsuarioAtual() }];
    if (i >= 0) REGRAS[i] = novo; else { novo.id = proximoIdTexto('u', REGRAS); novo.origem = 'criado'; novo.autor = nomeUsuarioAtual(); REGRAS.push(novo); }
    return responder(novo);
  },
  /** DELETE /api/regras/{id}/ — só regras que não são do sistema. Planos emitidos mantêm o resultado gravado. */
  excluirRegra: (id: string): Promise<void> => {
    const i = REGRAS.findIndex((x) => x.id === id);
    if (i < 0) return falhar(404, 'Regra não encontrada.');
    if (REGRAS[i].origem === 'sistema') return falhar(409, 'Regra do sistema não pode ser excluída.');
    REGRAS.splice(i, 1);
    return responder(undefined);
  },

  // ------------------------------------------------------------------ usuários
  /** GET /api/usuarios/ */
  listarUsuarios: (): Promise<Usuario[]> => responder(USUARIOS),
  /** POST /api/usuarios/ → cria com senha provisória (troca no primeiro acesso). Sem e-mail. */
  criarUsuario: (dados: { nome: string; usuario: string; perfil: Perfil }): Promise<{ usuario: Usuario; senhaProvisoria: string }> => {
    const login = dados.usuario.trim().toLowerCase();
    const erro = erroLogin(login);
    if (!dados.nome.trim()) return falhar(400, 'Informe o nome.');
    if (erro) return falhar(400, erro);
    if (USUARIOS.some((u) => u.usuario === login)) return falhar(409, `O usuário "${login}" já existe.`);
    const u: Usuario = { id: proximoId(USUARIOS), nome: dados.nome.trim(), usuario: login, perfil: dados.perfil, ativo: true, principal: false, trocarSenha: true, ultimoAcesso: null, observacao: 'Troca a senha no primeiro acesso' };
    USUARIOS.push(u);
    return responder({ usuario: u, senhaProvisoria: SENHA_PROVISORIA });
  },
  /** PATCH /api/usuarios/{id}/ → nome, perfil, ativo. O administrador principal não muda de perfil nem é desativado. */
  salvarUsuario: (u: Usuario): Promise<Usuario> => {
    const i = USUARIOS.findIndex((x) => x.id === u.id);
    if (i < 0) return falhar(404, 'Usuário não encontrado.');
    const atual = USUARIOS[i];
    if (atual.principal && (u.perfil !== 'admin' || !u.ativo)) return falhar(409, 'O administrador principal não pode ser desativado nem mudar de perfil.');
    USUARIOS[i] = { ...atual, nome: u.nome, perfil: u.perfil, ativo: u.ativo, observacao: u.observacao };
    return responder(USUARIOS[i]);
  },
  /** POST /api/usuarios/{id}/senha-provisoria/ → nova senha provisória (redefinir senha = pedir ao administrador). */
  gerarSenhaProvisoria: (id: number): Promise<{ usuario: Usuario; senhaProvisoria: string }> => {
    const u = USUARIOS.find((x) => x.id === id);
    if (!u) return falhar(404, 'Usuário não encontrado.');
    if (u.principal) return falhar(409, 'A senha do administrador principal é trocada por ele mesmo.');
    u.trocarSenha = true;
    return responder({ usuario: u, senhaProvisoria: SENHA_PROVISORIA });
  },

  /** POST /api/auth/trocar-senha/ { usuario, senha_atual, senha_nova } — usada no primeiro acesso (senha provisória) e na redefinição. */
  trocarSenha: (usuario: string, senhaAtual: string, senhaNova: string): Promise<void> => {
    const u = USUARIOS.find((x) => x.usuario === usuario.trim().toLowerCase());
    if (!u || !u.ativo) return falhar(401, 'Usuário ou senha provisória incorretos.');
    if (!senhaAtual) return falhar(400, 'Informe a senha provisória.');
    if (senhaNova.length < 8 || !/\d/.test(senhaNova) || !/[A-Za-zÀ-ÿ]/.test(senhaNova)) return falhar(400, 'A nova senha precisa de 8 caracteres, com letras e números.');
    if (senhaNova === senhaAtual) return falhar(400, 'A nova senha precisa ser diferente da provisória.');
    u.trocarSenha = false;
    return responder(undefined);
  },

  // ------------------------------------------------------------------ configurações
  /** GET /api/configuracoes/ */
  obterConfiguracoes: (): Promise<Configuracoes> => responder(CONFIGURACOES),
  /** POST /api/configuracoes/{logo|assinatura}/ (multipart, PNG ou JPEG) → usada nos PDFs emitidos depois. */
  enviarImagemConfiguracao: (qual: 'logo' | 'assinatura', arquivo: File): Promise<Configuracoes> => {
    if (!/^image\/(png|jpeg)$/.test(arquivo.type)) return falhar(400, 'Use uma imagem PNG ou JPEG.');
    void qual;
    return responder(CONFIGURACOES);
  },
  /** PUT /api/configuracoes/ */
  salvarConfiguracoes: (c: Configuracoes): Promise<Configuracoes> => {
    const erro = erroNomeArquivo(c.nomeArquivo);
    if (erro) return falhar(400, erro);
    if (!c.pastaRaiz.trim()) return falhar(400, 'Informe a pasta raiz dos planos.');
    if (!(c.limitePct >= 50 && c.limitePct <= 100)) return falhar(400, 'Limite da taxa de utilização: use um valor entre 50 e 100%.');
    if (!(c.avisoAtencaoPct >= 50 && c.avisoAtencaoPct < c.limitePct)) return falhar(400, `Aviso de atenção: use um valor a partir de 50% e menor que o limite (${c.limitePct}%).`);
    if (!(c.ventoPadraoMs >= 0 && c.ventoPadraoMs <= 20)) return falhar(400, 'Vento padrão: use um valor entre 0 e 20 m/s.');
    Object.assign(CONFIGURACOES, copia(c));
    return responder(CONFIGURACOES);
  },
};

export type Api = typeof apiMock;

// =============================================================================================
// API · Django REST (ribasrig-backend)
// =============================================================================================

const em = (s: string | number) => encodeURIComponent(String(s));
/** Ids que a tela usa para "ainda não salvo" (NOVA/NOVO de pages/calculos/logica.ts; 0 nos cadastros com id numérico). */
const ehNovo = (id: string | number) => id === 0 || id === 'nova' || id === 'novo' || id === '';

/** Só os dados editáveis do plano (o servidor ignora o resto, mas não precisa recebê-lo). */
const corpoPlano = (p: PlanoRigging | DadosPlano): DadosPlano => soDados(p);

const apiHttp: Api = {
  login: async (usuario, senha) => {
    const r = await http<{ access?: string; refresh?: string; usuario: Usuario; trocarSenha?: boolean }>(
      'POST', '/api/auth/token/', { usuario, senha }, { renovar: false });
    // Senha provisória pendente: o servidor não entrega token; a tela leva para criar a senha nova
    if (r.trocarSenha || !r.access) return { token: '', usuario: { ...r.usuario, trocarSenha: true } };
    token = r.access;
    gravarRefresh(r.refresh ?? null);
    return { token: r.access, usuario: r.usuario };
  },
  sair: async () => {
    const refresh = lerRefresh();
    encerrarSessao(false);
    if (refresh) await http<void>('POST', '/api/auth/logout/', { refresh }, { renovar: false }).catch(() => undefined);
  },
  retomarSessao: async () => {
    if (!lerRefresh() || !(await renovarToken())) { encerrarSessao(false); return null; }
    return http<Usuario>('GET', '/api/auth/me/');
  },

  listarPlanos: () => http('GET', '/api/planos/'),
  obterPlano: (numero) => http('GET', `/api/planos/${em(numero)}/`),
  criarPlano: (dados) => http('POST', '/api/planos/', corpoPlano(dados)),
  duplicarPlano: (numero) => http('POST', `/api/planos/${em(numero)}/duplicar/`),
  salvarRascunho: (plano) => http('PATCH', `/api/planos/${em(plano.numero)}/`, corpoPlano(plano)),
  emitirPlano: (numero, observacao = '') => http('POST', `/api/planos/${em(numero)}/emitir/`, { observacao }),
  novaRevisao: (numero) => http('POST', `/api/planos/${em(numero)}/nova-revisao/`),
  criarLote: (dados, quantidade) => http('POST', '/api/planos/lote/', { dados: corpoPlano(dados), quantidade }),
  historicoPlano: (numero) => http('GET', `/api/planos/${em(numero)}/historico/`),
  enviarAnexoPlano: (numero, tipo, arquivo) => enviarArquivo(`/api/planos/${em(numero)}/anexos/${tipo}/`, arquivo),
  removerAnexoPlano: (numero, tipo) => http('DELETE', `/api/planos/${em(numero)}/anexos/${tipo}/`),
  baixarPdfRevisao: (numero, rev) => httpArquivo(`/api/planos/${em(numero)}/revisoes/${em(rev)}/pdf/`),
  baixarMemorial: (numero, rev) => httpArquivo(`/api/planos/${em(numero)}/revisoes/${em(rev)}/memorial/`),
  baixarCarimbo: (numero) => httpArquivo(`/api/planos/${em(numero)}/carimbo/`),
  sistema: () => http('GET', '/api/sistema/', undefined, { renovar: false }),

  listarGuindastes: () => http('GET', '/api/guindastes/'),
  salvarGuindaste: (g) => (ehNovo(g.id) ? http('POST', '/api/guindastes/', g) : http('PUT', `/api/guindastes/${em(g.id)}/`, g)),
  enviarLaudoGuindaste: (id, arquivo) => enviarArquivo(`/api/guindastes/${em(id)}/laudo/arquivo/`, arquivo),

  listarAcessorios: () => http('GET', '/api/acessorios/'),
  salvarAcessorio: (a) => (ehNovo(a.id) ? http('POST', '/api/acessorios/', a) : http('PUT', `/api/acessorios/${em(a.id)}/`, a)),
  desativarAcessorio: (id) => http('POST', `/api/acessorios/${em(id)}/desativar/`),
  reativarAcessorio: (id) => http('POST', `/api/acessorios/${em(id)}/reativar/`),
  registrarInspecao: (id, r, destino, motivo) => http('POST', `/api/acessorios/${em(id)}/inspecoes/`, { ...r, destino, motivo }),
  enviarCertificadoAcessorio: (id, arquivo) => enviarArquivo(`/api/acessorios/${em(id)}/certificado/`, arquivo),

  listarPadroesInspecao: () => http('GET', '/api/padroes-inspecao/'),
  salvarPadraoInspecao: (p) => http('PUT', `/api/padroes-inspecao/${em(p.tipo)}/`, p),

  listarClientes: () => http('GET', '/api/clientes/'),
  salvarCliente: (c) => (ehNovo(c.id) ? http('POST', '/api/clientes/', c) : http('PUT', `/api/clientes/${em(c.id)}/`, c)),

  listarTiposIcamento: () => http('GET', '/api/tipos-icamento/'),
  salvarTipoIcamento: (t) => (ehNovo(t.id) ? http('POST', '/api/tipos-icamento/', t) : http('PUT', `/api/tipos-icamento/${em(t.id)}/`, t)),
  excluirTipoIcamento: (id) => http('DELETE', `/api/tipos-icamento/${em(id)}/`),
  listarRegras: () => http('GET', '/api/regras/'),
  salvarRegra: (r) => (ehNovo(r.id) ? http('POST', '/api/regras/', r) : http('PUT', `/api/regras/${em(r.id)}/`, r)),
  excluirRegra: (id) => http('DELETE', `/api/regras/${em(id)}/`),

  listarUsuarios: () => http('GET', '/api/usuarios/'),
  criarUsuario: (dados) => http('POST', '/api/usuarios/', dados),
  salvarUsuario: (u) => http('PATCH', `/api/usuarios/${em(u.id)}/`, { nome: u.nome, perfil: u.perfil, ativo: u.ativo, observacao: u.observacao }),
  gerarSenhaProvisoria: (id) => http('POST', `/api/usuarios/${em(id)}/senha-provisoria/`),
  trocarSenha: (usuario, senhaAtual, senhaNova) => http<void>('POST', '/api/auth/trocar-senha/', { usuario, senhaAtual, senhaNova }, { renovar: false }),

  obterConfiguracoes: () => http('GET', '/api/configuracoes/'),
  salvarConfiguracoes: (c) => http('PUT', '/api/configuracoes/', c),
  enviarImagemConfiguracao: (qual, arquivo) => enviarArquivo(`/api/configuracoes/${qual}/`, arquivo),
};

/** A camada que as telas usam. Nunca empacotar o Electron com o mock (build com VITE_API=http). */
export const api: Api = MODO_API === 'http' ? apiHttp : apiMock;
