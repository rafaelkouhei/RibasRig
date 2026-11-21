// Configuração do aplicativo: endereço da API e pasta do back-end (docker-compose).
// Ordem: variáveis de ambiente > configuracao.json na pasta de dados do aplicativo > padrão.
//   Windows: %APPDATA%\RibasRig\configuracao.json  ·  macOS: ~/Library/Application Support/RibasRig/configuracao.json
//   { "api": "http://127.0.0.1:8000", "backend": "C:\\RibasRig\\ribasrig-backend" }
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface Configuracao {
  /** Onde o Django escuta (só na própria máquina) */
  api: string;
  /** Pasta com o docker-compose.yml do back-end; com ela o aplicativo sobe o servidor se estiver desligado */
  backend: string | null;
}

export function lerConfiguracao(pastaDados: string, pastaApp: string, empacotado: boolean): Configuracao {
  let arquivo: Partial<Configuracao> = {};
  const caminho = path.join(pastaDados, 'configuracao.json');
  if (existsSync(caminho)) {
    try { arquivo = JSON.parse(readFileSync(caminho, 'utf-8')) as Partial<Configuracao>; } catch { /* arquivo inválido: usa o padrão */ }
  }
  // Em desenvolvimento o back-end está ao lado (../ribasrig-backend)
  const vizinho = path.resolve(pastaApp, '..', 'ribasrig-backend');
  const backend = process.env.RIBASRIG_BACKEND_DIR ?? arquivo.backend ?? (!empacotado && existsSync(vizinho) ? vizinho : null);
  const api = process.env.RIBASRIG_API_URL ?? arquivo.api ?? 'http://127.0.0.1:8000';
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(api.replace(/\/$/, '')) && !/^https:\/\//.test(api)) {
    throw new Error(`Endereço da API inválido: ${api}. Use http://127.0.0.1:8000 (servidor local) ou um endereço https.`);
  }
  return { api: api.replace(/\/$/, ''), backend };
}
