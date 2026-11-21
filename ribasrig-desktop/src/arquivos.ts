// Onde o aplicativo grava os arquivos do plano: <pasta raiz>\<cliente>\<nº>\<subpasta>\<arquivo>.
// A pasta raiz vem das Configurações (servidor); cliente, nº e nome vêm da tela. Tudo é conferido aqui:
// nada sai da pasta raiz, nada além de .pdf e .xlsx, nomes sem caracteres de caminho.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const EXTENSOES = ['.pdf', '.xlsx'] as const;
export const TAMANHO_MAXIMO = 100 * 1024 * 1024;
const RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export class ErroArquivo extends Error {}

/** Um nome de pasta ou arquivo seguro no Windows e no macOS. Vazio, "." e ".." são recusados. */
export function parteSegura(nome: string): string {
  // eslint-disable-next-line no-control-regex
  const limpo = String(nome ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/^[. ]+|[. ]+$/g, '');
  if (!limpo || limpo === '.' || limpo === '..') throw new ErroArquivo(`Nome de pasta ou arquivo inválido: "${nome}".`);
  const base = limpo.split('.')[0];
  return RESERVADOS.test(base) ? `_${limpo}` : limpo;
}

export interface PedidoGravacao { pastaRaiz: string; partes: string[]; nome: string }

/** Caminho final, conferido. `plataforma` existe para testar regras do Windows em qualquer sistema. */
export function resolverDestino(p: PedidoGravacao, plataforma: NodeJS.Platform = process.platform): string {
  const caminho = plataforma === 'win32' ? path.win32 : path.posix;
  const raiz = String(p.pastaRaiz ?? '').trim();
  if (!raiz || raiz.includes('\0') || !caminho.isAbsolute(raiz)) {
    throw new ErroArquivo(`A pasta raiz configurada (${raiz || 'vazia'}) não é um caminho deste computador. Ajuste em Configurações › Pasta dos planos.`);
  }
  if (raiz.split(/[\\/]/).includes('..')) throw new ErroArquivo('A pasta raiz não pode ter "..".');
  if (!Array.isArray(p.partes) || p.partes.length === 0 || p.partes.length > 4) throw new ErroArquivo('Pasta do plano inválida.');
  const nome = parteSegura(p.nome);
  if (!EXTENSOES.some((e) => nome.toLowerCase().endsWith(e))) throw new ErroArquivo(`Só são gravados arquivos ${EXTENSOES.join(' e ')}.`);
  const raizNormal = caminho.resolve(raiz);
  const final = caminho.join(raizNormal, ...p.partes.map(parteSegura), nome);
  const relativo = caminho.relative(raizNormal, final);
  if (!relativo || relativo === '..' || relativo.startsWith(`..${caminho.sep}`) || caminho.isAbsolute(relativo)) {
    throw new ErroArquivo('O arquivo ficaria fora da pasta raiz.');
  }
  return final;
}

/** Grava (criando as pastas) e devolve o caminho. */
export async function gravarNaPasta(p: PedidoGravacao, dados: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  if (bytes.byteLength === 0) throw new ErroArquivo('Arquivo vazio.');
  if (bytes.byteLength > TAMANHO_MAXIMO) throw new ErroArquivo('Arquivo grande demais.');
  const destino = resolverDestino(p);
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, bytes);
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException).code;
    const motivo = codigo === 'EBUSY' || codigo === 'EPERM' ? 'o arquivo está aberto em outro programa ou a pasta não permite gravar' : codigo ?? String(e);
    throw new ErroArquivo(`Não foi possível gravar em ${destino}: ${motivo}.`);
  }
  return destino;
}
