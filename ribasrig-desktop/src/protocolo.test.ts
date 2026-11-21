import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CSP, arquivoDoPacote, entregarDoPacote, repassarParaApi } from './protocolo';

test('arquivos do pacote: index na raiz e nada fora da pasta', () => {
  assert.equal(arquivoDoPacote('/app', '/'), path.resolve('/app/index.html'));
  assert.equal(arquivoDoPacote('/app', '/assets/a.js'), path.resolve('/app/assets/a.js'));
  assert.equal(arquivoDoPacote('/app', '/../segredo.txt'), null);
  assert.equal(arquivoDoPacote('/app', '/%2e%2e/%2e%2e/etc/passwd'), null);
  assert.equal(arquivoDoPacote('/app', '/%E0%A4%A'), null);
});

test('entrega com CSP e tipo certo; 404 para o que não existe', async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), 'ribasrig-app-'));
  await writeFile(path.join(raiz, 'index.html'), '<!doctype html>');
  const r = await entregarDoPacote(raiz, new URL('app://ribasrig/'));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('content-security-policy'), CSP);
  assert.match(CSP, /script-src 'self'(;|$)/);
  assert.equal((await entregarDoPacote(raiz, new URL('app://ribasrig/nao-existe.js'))).status, 404);
});

test('proxy da API: mesmo caminho e query, só cabeçalhos permitidos, sem cookies na volta', async () => {
  let visto: { url: string; init: RequestInit } | null = null;
  const falso = (async (url: string, init: RequestInit) => {
    visto = { url, init };
    return new Response('{"ok":true}', { status: 201, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'x=1' } });
  }) as unknown as typeof fetch;
  const pedido = new Request('app://ribasrig/api/planos/?busca=a', { method: 'POST', body: '{}', headers: { Authorization: 'Bearer T', Cookie: 'c=1', 'Content-Type': 'application/json' } });
  const r = await repassarParaApi('http://127.0.0.1:8000/', pedido, falso);
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('set-cookie'), null);
  assert.equal(visto!.url, 'http://127.0.0.1:8000/api/planos/?busca=a');
  const h = visto!.init.headers as Headers;
  assert.equal(h.get('authorization'), 'Bearer T');
  assert.equal(h.get('cookie'), null);
});

test('proxy sem servidor: 503 com mensagem para a tela', async () => {
  const falha = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  const r = await repassarParaApi('http://127.0.0.1:8000', new Request('app://ribasrig/api/planos/'), falha);
  assert.equal(r.status, 503);
  assert.match((await r.json() as { detail: string }).detail, /fora do ar/);
});
