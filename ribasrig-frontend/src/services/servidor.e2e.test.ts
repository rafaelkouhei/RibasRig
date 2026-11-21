import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Api } from './api';
import { HOJE } from '../domain/formatacao';
import { artsEmUso, calcularPlano, formDoPlano, planoDoForm, resultadosDoCalculo } from '../domain/plano';
import type { DadosPlano, PlanoRigging, ResultadosRevisao } from '../domain/types';

// Ponta a ponta com o back-end Django de verdade (ribasrig-backend), usando a MESMA api.ts e o MESMO motor das telas.
// Só roda com o servidor ligado e o cenário de exemplo carregado (RIBASRIG_HOJE=2026-10-07):
//   RIBASRIG_E2E_URL=http://localhost:8000 RIBASRIG_E2E_SENHA=<senha de teste> npx vitest run src/services/servidor.e2e.test.ts
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const URL_SERVIDOR = env.RIBASRIG_E2E_URL;

/** PDF de uma página em branco, válido (o servidor monta o PDF final com os anexos e recusa arquivo ilegível). */
function pdfMinimo(): string {
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>'];
  let corpo = '%PDF-1.4\n';
  const posicoes = objetos.map((o, i) => { const pos = corpo.length; corpo += `${i + 1} 0 obj\n${o}\nendobj\n`; return pos; });
  const xref = corpo.length;
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((x) => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}`;
  return `${corpo}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

const comeco = async (b: Blob, n = 5) => new TextDecoder().decode((await b.arrayBuffer()).slice(0, n));

/** Mesmos números, com tolerância só de ponto flutuante (o servidor calcula em Decimal; o front, em double). */
function igual(a: unknown, b: unknown, caminho = 'resultados'): void {
  if (typeof a === 'number' && typeof b === 'number') { expect(Math.abs(a - b), caminho).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(a))); return; }
  if (Array.isArray(a) && Array.isArray(b)) { expect(b.length, caminho).toBe(a.length); a.forEach((x, i) => igual(x, b[i], `${caminho}[${i}]`)); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(b).sort(), caminho).toEqual(Object.keys(a).sort());
    for (const k of Object.keys(a)) igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${caminho}.${k}`);
    return;
  }
  expect(b, caminho).toEqual(a);
}

describe.skipIf(!URL_SERVIDOR)('ponta a ponta com o servidor Django', () => {
  let api: Api;
  const calcularNoFront = async (p: PlanoRigging) => {
    const [acessorios, guindastes, tipos, clientes, configuracoes, planos] = await Promise.all([
      api.listarAcessorios(), api.listarGuindastes(), api.listarTiposIcamento(), api.listarClientes(), api.obterConfiguracoes(), api.listarPlanos()]);
    return calcularPlano({ form: formDoPlano(p), numero: p.numero, acessorios, guindastes, tipos, clientes, configuracoes, hoje: HOJE,
      artsEmUso: artsEmUso(planos.filter((x) => x.numero !== p.numero)) });
  };

  beforeAll(async () => {
    vi.stubEnv('VITE_API', 'http');
    vi.stubEnv('VITE_API_URL', URL_SERVIDOR!);
    vi.resetModules();
    api = (await import('./api')).api;
    await api.login('giuliano.breda', env.RIBASRIG_E2E_SENHA ?? '');
  });

  it('Rev. 2 do 2607036 gravada pelo servidor = recálculo pelo motor do front', async () => {
    const p = await api.obterPlano('2607036');
    expect(p.situacaoDocumento).toBe('emitido');
    igual(resultadosDoCalculo(await calcularNoFront(p)), p.revisoes[1].resultados as ResultadosRevisao);
  });

  it('rascunho: o que o formulário grava volta igual', async () => {
    const p = await api.obterPlano('2610001');
    const salvo = await api.salvarRascunho({ ...p, ...planoDoForm(formDoPlano(p), p) });
    expect(formDoPlano(salvo)).toEqual(formDoPlano(p));
  });

  it('cria, anexa, emite: o servidor recalcula e grava os mesmos resultados que a tela mostra', async () => {
    const modelo = await api.obterPlano('2607036');
    const art = String(Date.now()).slice(-13).padStart(13, '1');
    const dados: DadosPlano = { ...planoDoForm(formDoPlano(modelo), modelo), dataOperacao: '2026-10-01', art, artRegistradaEm: null, copiaDe: '2607036', etapaAtual: 5 };
    const rascunho = await api.criarPlano(dados);
    expect(rascunho.numero).toMatch(/^2610\d{3}$/);
    const pdf = (nome: string) => new File([pdfMinimo()], nome, { type: 'application/pdf' });
    await api.enviarAnexoPlano(rascunho.numero, 'desenhos', pdf(`Desenhos_${rascunho.numero}.pdf`));
    const comAnexos = await api.enviarAnexoPlano(rascunho.numero, 'art', pdf(`ART_${art}.pdf`));
    const naTela = await calcularNoFront(comAnexos);
    expect(naTela.podeEmitir).toBe(true);
    const emitido = await api.emitirPlano(rascunho.numero);
    expect(emitido.situacaoDocumento).toBe('emitido');
    igual(resultadosDoCalculo(naTela), emitido.revisoes[0].resultados);
    await expect(api.salvarRascunho(emitido)).rejects.toMatchObject({ status: 409 });
    // PDF único do cliente e memorial interno, gerados pelo servidor na emissão
    expect(await comeco(await api.baixarPdfRevisao(emitido.numero, 1))).toBe('%PDF-');
    expect(await comeco(await api.baixarMemorial(emitido.numero, 1))).toBe('%PDF-');
  });

  it('planilha do carimbo e data do servidor', async () => {
    expect(await comeco(await api.baixarCarimbo('2610001'), 2)).toBe('PK'); // .xlsx é um zip
    expect((await api.sistema()).hoje).toBe(HOJE);
  });

  it('servidor recusa emitir o que a tela bloqueia (laudo vencido)', async () => {
    const p = await api.obterPlano('2610001');
    expect((await calcularNoFront(p)).podeEmitir).toBe(false);
    await expect(api.emitirPlano('2610001')).rejects.toMatchObject({ status: 422, message: expect.stringContaining('laudo do Palfinger MD 45.007 vencido') });
  });
});
