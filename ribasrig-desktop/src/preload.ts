// Ponte entre a página e o aplicativo (window.ribasrig). Roda isolada (contextIsolation + sandbox):
// a página não vê o Node nem o ipcRenderer, só estas funções. Preload com sandbox não importa arquivos locais,
// por isso fica tudo neste arquivo. A interface espelha `PonteDesktop` em ribasrig-frontend/src/services/arquivos.ts.
import { contextBridge, ipcRenderer } from 'electron';

// Versão do package.json, passada pelo processo principal (main.ts, additionalArguments): o preload com sandbox não lê arquivos
const VERSAO = process.argv.find((a) => a.startsWith('--ribasrig-versao='))?.split('=')[1] ?? '';

/** "Error invoking remote method 'x': ErroArquivo: mensagem" → "mensagem" (a tela mostra o texto). */
async function chamar<T>(canal: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(canal, ...args)) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, ''));
  }
}

contextBridge.exposeInMainWorld('ribasrig', {
  versao: VERSAO,
  salvarNaPasta: (p: { pastaRaiz: string; partes: string[]; nome: string; dados: ArrayBuffer }) => chamar<string>('arquivo:salvarNaPasta', p),
  abrirArquivo: (caminho: string) => chamar<void>('arquivo:abrir', caminho),
  mostrarNaPasta: (caminho: string) => chamar<void>('arquivo:mostrarNaPasta', caminho),
  abrirTemporario: (p: { nome: string; dados: ArrayBuffer }) => chamar<void>('arquivo:abrirTemporario', p),
  escolherPasta: (atual?: string) => chamar<string | null>('pasta:escolher', atual),
});
