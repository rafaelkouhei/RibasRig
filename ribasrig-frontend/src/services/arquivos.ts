// Arquivos no computador: no aplicativo (Electron) o PDF e a planilha vão para a pasta do plano
// (<pasta raiz>\<cliente>\<nº>\<subpasta>) e abrem no programa padrão; no navegador, são baixados.
// A ponte `window.ribasrig` vem do preload do ribasrig-desktop (contextIsolation: a página não toca no Node).
import { pastaDe } from '../domain/plano';

/** Pastas de cada plano (o PDF do cliente em Relatório; o memorial interno em Cálculo; o carimbo em Desenhos). */
export type Subpasta = 'Relatório' | 'Cálculo' | 'Desenhos';

export interface PonteDesktop {
  versao: string;
  /** Grava em <pastaRaiz>\<partes…>\<nome> e devolve o caminho completo. */
  salvarNaPasta(p: { pastaRaiz: string; partes: string[]; nome: string; dados: ArrayBuffer }): Promise<string>;
  /** Abre no programa padrão um arquivo que o próprio aplicativo gravou. */
  abrirArquivo(caminho: string): Promise<void>;
  /** Abre o Explorador de Arquivos com o arquivo selecionado. */
  mostrarNaPasta(caminho: string): Promise<void>;
  /** Grava numa pasta temporária do aplicativo e abre (ex.: PDF de consulta, sem ir para a pasta do cliente). */
  abrirTemporario(p: { nome: string; dados: ArrayBuffer }): Promise<void>;
  /** Seletor de pastas do sistema operacional; null = cancelado. */
  escolherPasta(atual?: string): Promise<string | null>;
}

declare global {
  interface Window { ribasrig?: PonteDesktop }
}

/** A ponte do aplicativo instalado, ou null no navegador. */
export function desktop(): PonteDesktop | null {
  return typeof window !== 'undefined' ? window.ribasrig ?? null : null;
}

export interface DestinoPlano { pastaRaiz: string; pastaCliente: string; numero: string }

/** Baixa pelo navegador (fora do aplicativo). */
export function baixarNoNavegador(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Guarda um arquivo gerado pelo servidor na pasta do plano. Devolve o caminho gravado (aplicativo) ou null
 * (navegador: o arquivo foi baixado).
 */
export async function guardarNaPastaDoPlano(blob: Blob, nome: string, destino: DestinoPlano, subpasta: Subpasta): Promise<string | null> {
  const ponte = desktop();
  if (!ponte) { baixarNoNavegador(blob, nome); return null; }
  return ponte.salvarNaPasta({
    pastaRaiz: destino.pastaRaiz, partes: [destino.pastaCliente, destino.numero, subpasta], nome, dados: await blob.arrayBuffer(),
  });
}

/** Grava na pasta do plano e abre (aplicativo) ou abre numa aba nova (navegador). */
export async function abrirDoPlano(blob: Blob, nome: string, destino: DestinoPlano, subpasta: Subpasta): Promise<string | null> {
  const ponte = desktop();
  if (!ponte) {
    const url = URL.createObjectURL(blob);
    // Sem 'noopener' na chamada: com ele, window.open SEMPRE devolve null e o PDF também seria baixado. O opener é
    // cortado à mão; null aqui = janela bloqueada pelo navegador, então baixa.
    const aba = window.open(url, '_blank');
    if (aba) aba.opener = null;
    else baixarNoNavegador(blob, nome);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  }
  const caminho = await guardarNaPastaDoPlano(blob, nome, destino, subpasta);
  if (caminho) await ponte.abrirArquivo(caminho);
  return caminho;
}

/** Abre o seletor de arquivos do sistema e devolve o escolhido (null = cancelado). */
export function escolherArquivo(aceitar: string): Promise<File | null> {
  return new Promise((ok) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = aceitar;
    entrada.addEventListener('change', () => ok(entrada.files?.[0] ?? null), { once: true });
    entrada.addEventListener('cancel', () => ok(null), { once: true });
    entrada.click();
  });
}

/** Mensagem curta de onde o arquivo foi parar. */
export const ondeFicou = (caminho: string | null, nome: string) => (caminho ? `${nome} salvo em ${pastaDe(caminho)}` : `${nome} baixado.`);
