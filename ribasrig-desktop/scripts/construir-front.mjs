// Gera o front (ribasrig-frontend) para o aplicativo: VITE_API=http (nunca o mock) e saída em ./app.
// Em Node, para funcionar igual no Windows (cmd não aceita "VITE_API=http comando").
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const front = resolve(aqui, '..', '..', 'ribasrig-frontend');
const saida = resolve(aqui, '..', 'app');

if (!existsSync(resolve(front, 'node_modules'))) {
  console.error(`Instale as dependências do front antes: cd "${front}" && npm ci`);
  process.exit(1);
}
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(npx, ['vite', 'build', '--outDir', saida, '--emptyOutDir'], {
  cwd: front, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, VITE_API: 'http', VITE_API_URL: '' },
});
process.exit(r.status ?? 1);
