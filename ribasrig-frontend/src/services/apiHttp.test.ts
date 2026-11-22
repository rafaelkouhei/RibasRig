import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from './api';

// api.ts com VITE_API=http, fetch simulado. Cada teste carrega o módulo de novo (token em memória zerado).
interface Chamada { url: string; metodo: string; corpo: unknown; headers: Record<string, string> }
let chamadas: Chamada[];
let respostas: ((c: Chamada) => Response | Promise<Response>)[];
let eventos: string[];

const json = (status: number, corpo: unknown) => new Response(corpo === null ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

async function carregar(): Promise<{ api: Api; EVENTO_SESSAO_EXPIRADA: string; ErroApi: new (...a: never[]) => Error }> {
  vi.resetModules();
  vi.stubEnv('VITE_API', 'http');
  return import('./api');
}

beforeEach(() => {
  chamadas = []; respostas = []; eventos = [];
  const guardado = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v), removeItem: (k: string) => void guardado.delete(k),
  });
  const alvo = new EventTarget();
  alvo.addEventListener('ribasrig:sessao-expirada', (e) => eventos.push(e.type));
  vi.stubGlobal('window', alvo);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const corpo = init.body instanceof FormData ? init.body : init.body ? JSON.parse(String(init.body)) : undefined;
    const c: Chamada = { url, metodo: init.method ?? 'GET', corpo, headers: (init.headers ?? {}) as Record<string, string> };
    chamadas.push(c);
    const proxima = respostas.shift();
    if (!proxima) throw new Error(`Sem resposta preparada para ${c.metodo} ${url}`);
    return proxima(c);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const USUARIO = { id: 1, nome: 'Giuliano Breda', usuario: 'giuliano.breda', perfil: 'admin', ativo: true, principal: true, trocar_senha: false, ultimo_acesso: null, observacao: '' };

async function logado() {
  const m = await carregar();
  respostas.push(() => json(200, { access: 'A1', refresh: 'R1', usuario: USUARIO }));
  await m.api.login('giuliano.breda', 'segredo');
  chamadas = [];
  return m;
}

describe('api (http)', () => {
  it('login guarda o access em memória e manda Bearer; resposta em camelCase', async () => {
    const { api } = await carregar();
    respostas.push(() => json(200, { access: 'A1', refresh: 'R1', usuario: USUARIO }));
    const r = await api.login('giuliano.breda', 'segredo');
    expect(r).toMatchObject({ token: 'A1', usuario: { trocarSenha: false, ultimoAcesso: null } });
    expect(chamadas[0]).toMatchObject({ url: '/api/auth/token/', metodo: 'POST', corpo: { usuario: 'giuliano.breda', senha: 'segredo' } });
    expect(sessionStorage.getItem('ribasrig.refresh')).toBe('R1');
    respostas.push(() => json(200, []));
    await api.listarPlanos();
    expect(chamadas[1].headers.Authorization).toBe('Bearer A1');
  });

  it('senha provisória pendente: sem token, usuário marcado para trocar', async () => {
    const { api } = await carregar();
    respostas.push(() => json(200, { trocar_senha: true, usuario: { ...USUARIO, trocar_senha: true } }));
    expect(await api.login('novo', 'Prov1234')).toMatchObject({ token: '', usuario: { trocarSenha: true } });
    expect(sessionStorage.getItem('ribasrig.refresh')).toBeNull();
  });

  it('401: renova o token uma vez e repete a chamada', async () => {
    const { api } = await logado();
    respostas.push(() => json(401, { detail: 'Token expirado' }), () => json(200, { access: 'A2', refresh: 'R2' }), () => json(200, []));
    await api.listarGuindastes();
    expect(chamadas.map((c) => c.url)).toEqual(['/api/guindastes/', '/api/auth/token/refresh/', '/api/guindastes/']);
    expect(chamadas[1].corpo).toEqual({ refresh: 'R1' });
    expect(chamadas[2].headers.Authorization).toBe('Bearer A2');
    expect(sessionStorage.getItem('ribasrig.refresh')).toBe('R2');
  });

  it('refresh recusado: encerra a sessão e avisa a tela', async () => {
    const { api } = await logado();
    respostas.push(() => json(401, { detail: 'Token expirado' }), () => json(401, { detail: 'Token inválido' }));
    await expect(api.listarClientes()).rejects.toMatchObject({ status: 401, message: 'Token expirado' });
    expect(eventos).toEqual(['ribasrig:sessao-expirada']);
    expect(sessionStorage.getItem('ribasrig.refresh')).toBeNull();
  });

  it('sem conexão ao renovar o token: mostra o erro de conexão e NÃO encerra a sessão', async () => {
    const { api } = await logado();
    respostas.push(() => json(401, { detail: 'Token expirado' }), () => { throw new TypeError('Failed to fetch'); });
    await expect(api.listarClientes()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Sem conexão') });
    expect(eventos).toEqual([]);
    expect(sessionStorage.getItem('ribasrig.refresh')).toBe('R1');
    // Servidor reiniciando (503) na renovação também não derruba a sessão
    respostas.push(() => json(401, { detail: 'Token expirado' }), () => json(503, null));
    await expect(api.listarClientes()).rejects.toMatchObject({ status: 0 });
    expect(sessionStorage.getItem('ribasrig.refresh')).toBe('R1');
  });

  it('retomar sessão sem conexão: rejeita (a tela fica) e guarda o refresh', async () => {
    const { api } = await logado();
    respostas.push(() => { throw new TypeError('Failed to fetch'); });
    await expect(api.retomarSessao()).rejects.toMatchObject({ status: 0 });
    expect(sessionStorage.getItem('ribasrig.refresh')).toBe('R1');
  });

  it('erros do servidor viram ErroApi com o detail', async () => {
    const { api, ErroApi } = await logado();
    respostas.push(() => json(422, { detail: 'Não dá para emitir: taxa acima de 85%.' }));
    const erro = await api.emitirPlano('2610002').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status: 422, message: 'Não dá para emitir: taxa acima de 85%.' });
  });

  it('sem servidor: mensagem clara (status 0)', async () => {
    const { api } = await logado();
    respostas.push(() => { throw new TypeError('Failed to fetch'); });
    await expect(api.listarPlanos()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Sem conexão com o servidor') });
  });

  it('salvar rascunho manda só os dados, em snake_case, no PATCH do número', async () => {
    const { api } = await logado();
    const { PLANOS } = await import('../data/mock');
    respostas.push((c) => json(200, { ...(c.corpo as object), numero: '2610001' }));
    await api.salvarRascunho(PLANOS[1]);
    const c = chamadas[0];
    expect([c.metodo, c.url]).toEqual(['PATCH', '/api/planos/2610001/']);
    expect(c.corpo).toMatchObject({ cliente_id: 1, carga: { peso_kg: 3450 }, lingada: [{ acessorio_id: 1, posicao: 'pernasInferiores' }, {}, {}, {}] });
    expect(c.corpo).not.toHaveProperty('revisoes');
    expect(c.corpo).not.toHaveProperty('numero');
  });

  it('novo vs. existente: POST para id 0/"nova", PUT com id', async () => {
    const { api } = await logado();
    const { GUINDASTES, REGRAS } = await import('../data/mock');
    respostas.push(() => json(201, {}), () => json(200, {}), () => json(201, {}), () => json(200, {}));
    await api.salvarGuindaste({ ...GUINDASTES[0], id: 0 });
    await api.salvarGuindaste(GUINDASTES[0]);
    await api.salvarRegra({ ...REGRAS[0], id: 'nova' });
    await api.salvarRegra(REGRAS[9]);
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual(['POST /api/guindastes/', 'PUT /api/guindastes/1/', 'POST /api/regras/', 'PUT /api/regras/u1/']);
  });

  it('anexo vai como multipart, sem Content-Type JSON', async () => {
    const { api } = await logado();
    respostas.push(() => json(200, { numero: '2610001', anexos: { desenhos: 'D.pdf', art_plano: false, arquivo_art: null } }));
    const p = await api.enviarAnexoPlano('2610001', 'desenhos', new File(['%PDF-1.4'], 'D.pdf', { type: 'application/pdf' }));
    expect(p.anexos.desenhos).toBe('D.pdf');
    expect(chamadas[0].url).toBe('/api/planos/2610001/anexos/desenhos/');
    expect(chamadas[0].corpo).toBeInstanceOf(FormData);
    expect(chamadas[0].headers['Content-Type']).toBeUndefined();
  });

  it('retomar sessão: renova e busca o perfil no servidor; sem refresh, não há sessão', async () => {
    const { api } = await logado();
    respostas.push(() => json(200, { access: 'A3' }), () => json(200, USUARIO));
    expect(await api.retomarSessao()).toMatchObject({ usuario: 'giuliano.breda', perfil: 'admin' });
    sessionStorage.removeItem('ribasrig.refresh');
    expect(await api.retomarSessao()).toBeNull();
  });
});
