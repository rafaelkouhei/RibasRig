import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { lerConfiguracao } from './config';

test('configuracao.json gravado com BOM (Bloco de Notas, PowerShell 5) é lido normalmente', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'ribasrig-config-'));
  await writeFile(path.join(pasta, 'configuracao.json'), '\uFEFF{ "api": "http://127.0.0.1:8001", "backend": "C:\\\\RibasRig\\\\ribasrig-backend" }', 'utf-8');
  const c = lerConfiguracao(pasta, pasta, true);
  assert.equal(c.api, 'http://127.0.0.1:8001');
  assert.equal(c.backend, 'C:\\RibasRig\\ribasrig-backend');
});

test('sem configuracao.json, aplicativo instalado: servidor local e sem pasta do back-end', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'ribasrig-config-'));
  const c = lerConfiguracao(pasta, pasta, true);
  assert.deepEqual(c, { api: 'http://127.0.0.1:8000', backend: null });
});
