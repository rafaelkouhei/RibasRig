// O aplicativo confere se o servidor (Django + PostgreSQL) responde e, se não, mostra uma página de servidor fora do ar.
// Com a pasta do back-end configurada (servidor neste computador), tenta antes subir o Docker Compose (docker compose up -d).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export async function servidorNoAr(api: string, buscar: typeof fetch = fetch, ms = 3000): Promise<boolean> {
  try {
    const r = await buscar(`${api}/api/sistema/`, { signal: AbortSignal.timeout(ms) });
    return r.ok;
  } catch {
    return false;
  }
}

/** docker compose up -d na pasta do back-end. Resolve com a mensagem de erro (ou null se iniciou o comando). */
export function subirServidor(backend: string | null): Promise<string | null> {
  if (!backend || !existsSync(path.join(backend, 'docker-compose.yml'))) {
    return Promise.resolve('A pasta do servidor não está configurada (configuracao.json › "backend").');
  }
  return new Promise((ok) => {
    const p = spawn('docker', ['compose', 'up', '-d'], { cwd: backend, windowsHide: true, stdio: 'ignore' });
    p.on('error', () => ok('O Docker não foi encontrado. Instale e abra o Docker Desktop.'));
    p.on('exit', (codigo) => ok(codigo === 0 ? null : 'O Docker não conseguiu subir o servidor. Abra o Docker Desktop e tente de novo.'));
  });
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Página mostrada enquanto o servidor não responde. O aplicativo tenta de novo sozinho a cada poucos segundos. */
export function paginaServidorDesligado(api: string, detalhe: string | null): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>RibasRig — servidor desligado</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #ECEEF2; color: #1F2A40;
         font-family: "Segoe UI", system-ui, sans-serif; }
  main { background: #fff; border-radius: 3px; box-shadow: 0 6px 24px rgba(31,42,64,.18); padding: 32px 36px; max-width: 560px; }
  h1 { margin: 0 0 8px; font-size: 22px; color: #34446A; }
  p { line-height: 1.5; margin: 8px 0; }
  .aviso { background: #FBE1C6; color: #8A3F04; padding: 10px 12px; border-radius: 3px; font-weight: 600; }
  code { background: #F3F4F6; padding: 1px 5px; border-radius: 3px; }
  a { display: inline-block; margin-top: 14px; background: #3F4D6E; color: #fff; text-decoration: none; padding: 11px 18px; border-radius: 3px; font-weight: 600; }
</style></head><body><main role="alert">
  <h1>O servidor do RibasRig está fora do ar</h1>
  <p>Não foi possível conectar ao servidor. Confira a conexão com a internet ou fale com o responsável pelo sistema.</p>
  ${detalhe ? `<p class="aviso">${escapar(detalhe)}</p>` : ''}
  <p>O RibasRig tenta de novo sozinho a cada 5 segundos.</p>
  <p>Endereço conferido: <code>${escapar(api)}</code></p>
  <a href="app://ribasrig/__tentar">Tentar agora</a>
</main></body></html>`;
}
