import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gravarNaPasta, parteSegura, resolverDestino } from './arquivos';

test('caminho do plano no Windows: <raiz>\\<cliente>\\<nº>\\Relatório\\<arquivo>', () => {
  const c = resolverDestino({ pastaRaiz: 'C:\\Guindastes Ribas\\Planos de Rigging', partes: ['Kaefer Rip', '2607036', 'Relatório'], nome: 'Plano_de_Rigging_2607036_Rev2.pdf' }, 'win32');
  assert.equal(c, 'C:\\Guindastes Ribas\\Planos de Rigging\\Kaefer Rip\\2607036\\Relatório\\Plano_de_Rigging_2607036_Rev2.pdf');
});

test('nada sai da pasta raiz', () => {
  assert.throws(() => resolverDestino({ pastaRaiz: 'C:\\Planos', partes: ['..', '..', 'Windows'], nome: 'a.pdf' }, 'win32'), /inválido/);
  assert.throws(() => resolverDestino({ pastaRaiz: 'C:\\Planos\\..\\Windows', partes: ['a'], nome: 'a.pdf' }, 'win32'), /\.\./);
  // separadores e pontos nas pontas do nome são removidos, não seguidos
  assert.equal(resolverDestino({ pastaRaiz: '/planos', partes: ['../../etc'], nome: 'x.pdf' }, 'linux'), '/planos/etc/x.pdf');
  assert.equal(resolverDestino({ pastaRaiz: '/planos', partes: ['..a'], nome: 'x.pdf' }, 'linux'), '/planos/a/x.pdf');
});

test('só .pdf e .xlsx; nomes reservados do Windows ganham prefixo', () => {
  assert.throws(() => resolverDestino({ pastaRaiz: '/p', partes: ['a'], nome: 'script.exe' }, 'linux'), /Só são gravados/);
  assert.equal(parteSegura('CON'), '_CON');
  assert.equal(parteSegura('  Cliente: "A/B"  . '), 'Cliente AB');
});

test('raiz do Windows num Mac é recusada com mensagem para ajustar em Configurações', () => {
  assert.throws(() => resolverDestino({ pastaRaiz: 'C:\\Planos', partes: ['a'], nome: 'a.pdf' }, 'darwin'), /Ajuste em Configurações/);
});

test('grava criando as pastas', async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), 'ribasrig-'));
  const c = await gravarNaPasta({ pastaRaiz: raiz, partes: ['Kaefer Rip', '2610003', 'Cálculo'], nome: 'Memorial_2610003_Rev1.pdf' }, new TextEncoder().encode('%PDF-1.4'));
  assert.equal(c, path.join(raiz, 'Kaefer Rip', '2610003', 'Cálculo', 'Memorial_2610003_Rev1.pdf'));
  assert.equal(await readFile(c, 'utf-8'), '%PDF-1.4');
  await assert.rejects(gravarNaPasta({ pastaRaiz: raiz, partes: ['a'], nome: 'v.pdf' }, new Uint8Array()), /vazio/);
});
