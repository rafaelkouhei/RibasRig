// Esquema app://ribasrig: entrega o front empacotado (pasta app/) e repassa /api/* para o servidor Django.
// Assim a página e a API ficam na mesma origem (sem CORS, sem file://) e o front usa as mesmas URLs relativas
// do desenvolvimento (/api/...).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const ESQUEMA = 'app';
export const HOST = 'ribasrig';
export const ORIGEM = `${ESQUEMA}://${HOST}`;

/** CSP do aplicativo: só o próprio pacote; estilos inline são do MUI (Emotion). */
export const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
  "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json', '.map': 'application/json',
};

/** Arquivo do pacote para o caminho pedido; null se sair da pasta ou não for um caminho válido. */
export function arquivoDoPacote(raizApp: string, caminhoUrl: string): string | null {
  let rel: string;
  try { rel = decodeURIComponent(caminhoUrl); } catch { return null; }
  if (rel.includes('\0')) return null;
  if (rel === '/' || rel === '') rel = '/index.html';
  const raiz = path.resolve(raizApp);
  const final = path.resolve(raiz, `.${rel}`);
  const relativo = path.relative(raiz, final);
  return relativo && relativo !== '..' && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo) ? final : null;
}

const cabecalhosBase = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

export function pagina(html: string, status = 200): Response {
  return new Response(html, { status, headers: { ...cabecalhosBase, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function entregarDoPacote(raizApp: string, url: URL): Promise<Response> {
  const arquivo = arquivoDoPacote(raizApp, url.pathname);
  if (!arquivo) return new Response('Não encontrado', { status: 404, headers: cabecalhosBase });
  try {
    const conteudo = await readFile(arquivo);
    return new Response(conteudo, { headers: { ...cabecalhosBase, 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream' } });
  } catch {
    return new Response('Não encontrado', { status: 404, headers: cabecalhosBase });
  }
}

/** Cabeçalhos repassados ao servidor (sem cookies nem origem do esquema app://). */
const REPASSAR = ['accept', 'authorization', 'content-type', 'accept-language'];

/** Repassa a chamada /api/* para o servidor, com corpo em fluxo (uploads de PDF). */
export async function repassarParaApi(base: string, pedido: Request, buscar: typeof fetch): Promise<Response> {
  const url = new URL(pedido.url);
  const destino = `${base.replace(/\/$/, '')}${url.pathname}${url.search}`;
  const headers = new Headers();
  for (const nome of REPASSAR) {
    const v = pedido.headers.get(nome);
    if (v) headers.set(nome, v);
  }
  const comCorpo = !['GET', 'HEAD'].includes(pedido.method);
  try {
    const r = await buscar(destino, {
      method: pedido.method, headers, body: comCorpo ? pedido.body : undefined, redirect: 'manual',
      ...(comCorpo ? { duplex: 'half' } : {}),
    } as RequestInit);
    const saida = new Headers(r.headers);
    saida.delete('set-cookie');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: saida });
  } catch {
    return new Response(JSON.stringify({ detail: 'O servidor do RibasRig está fora do ar. Tente de novo em alguns instantes.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}
