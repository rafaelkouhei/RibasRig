// Processo principal do aplicativo RibasRig (Electron).
// Segurança (docs/especificacao-front-end-2026-10.md, seção 11): contextIsolation, sandbox e sem Node na página; CSP; nada de file://;
// navegação e janelas novas bloqueadas; permissões do navegador negadas; a ponte (preload) só grava .pdf/.xlsx
// dentro da pasta dos planos e só abre arquivos que o próprio aplicativo gravou.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, Menu, app, dialog, ipcMain, net, protocol, session, shell, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron';
import { ErroArquivo, gravarNaPasta, type PedidoGravacao } from './arquivos';
import { lerConfiguracao, type Configuracao } from './config';
import { ESQUEMA, HOST, ORIGEM, entregarDoPacote, pagina, repassarParaApi } from './protocolo';
import { paginaServidorDesligado, servidorNoAr, subirServidor } from './servidor';

const FUMACA = process.argv.includes('--fumaca');
const RAIZ = path.join(__dirname, '..');
const RAIZ_APP = path.join(RAIZ, 'app');

// Com ELECTRON_RUN_AS_NODE (ex.: herdado de um terminal aberto por outro app Electron) não há API do Electron
if (!protocol) {
  console.error('O RibasRig rodou como Node (variável ELECTRON_RUN_AS_NODE definida). Remova a variável e abra de novo.');
  process.exit(1);
}

// Interface do Chromium sempre em português do Brasil: o campo de data mostra dd/mm/aaaa e os textos nativos ficam em
// pt-BR, mesmo num computador com o sistema em outro idioma (num macOS com idioma asiático aparecia "年-月-日")
app.commandLine.appendSwitch('lang', 'pt-BR');

protocol.registerSchemesAsPrivileged([
  { scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

let config: Configuracao;
let janela: BrowserWindow | null = null;
let ultimoErro: string | null = null;
let tentouSubir = false;
let proximaTentativa: NodeJS.Timeout | undefined;
/** Arquivos gravados pelo aplicativo nesta sessão: só estes podem ser abertos pela página. */
const gravados = new Set<string>();

if (!FUMACA && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); }
  });
  app.whenReady().then(iniciar).catch((e: unknown) => { dialog.showErrorBox('RibasRig', String(e)); app.quit(); });
}
app.on('window-all-closed', () => app.quit());

async function iniciar(): Promise<void> {
  try {
    config = lerConfiguracao(app.getPath('userData'), RAIZ, app.isPackaged);
  } catch (e) {
    dialog.showErrorBox('RibasRig', e instanceof Error ? e.message : String(e));
    app.quit();
    return;
  }
  if (!existsSync(path.join(RAIZ_APP, 'index.html'))) {
    dialog.showErrorBox('RibasRig', 'O front não foi gerado. Rode "npm run build:front" no ribasrig-desktop.');
    app.quit();
    return;
  }
  session.defaultSession.setPermissionRequestHandler((_wc, _permissao, responder) => responder(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle(ESQUEMA, tratarPedido);
  registrarPonte();
  Menu.setApplicationMenu(menu());
  criarJanela();
  await abrirSistema();
}

async function tratarPedido(pedido: Request): Promise<Response> {
  const url = new URL(pedido.url);
  if (url.host !== HOST) return new Response('Não encontrado', { status: 404 });
  if (url.pathname.startsWith('/api/')) return repassarParaApi(config.api, pedido, net.fetch.bind(net) as typeof fetch);
  if (url.pathname === '/__servidor') return pagina(paginaServidorDesligado(config.api, ultimoErro), 503);
  if (url.pathname === '/__tentar') {
    setTimeout(() => void abrirSistema(), 0);
    return pagina(paginaServidorDesligado(config.api, 'Conferindo o servidor…'), 503);
  }
  return entregarDoPacote(RAIZ_APP, url);
}

/** Abre o sistema se o servidor responde; senão (com servidor local) tenta subir o Docker Compose uma vez e confere de novo a cada 5 s. */
async function abrirSistema(): Promise<void> {
  clearTimeout(proximaTentativa);
  if (!janela) return;
  if (await servidorNoAr(config.api)) {
    ultimoErro = null;
    await janela.loadURL(`${ORIGEM}/index.html`).catch(() => undefined);
    return;
  }
  if (!tentouSubir && config.backend) {
    tentouSubir = true;
    ultimoErro = (await subirServidor(config.backend)) ?? 'Iniciando o servidor pelo Docker… pode levar alguns segundos.';
  }
  if (FUMACA) { console.log('FUMACA ' + JSON.stringify({ ok: false, erro: `servidor fora do ar em ${config.api}` })); app.exit(1); return; }
  await janela.loadURL(`${ORIGEM}/__servidor`).catch(() => undefined);
  proximaTentativa = setTimeout(() => void abrirSistema(), 5000);
}

function criarJanela(): void {
  janela = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1280, minHeight: 720, show: false, title: 'RibasRig', backgroundColor: '#ECEEF2',
    icon: path.join(RAIZ, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  janela.once('ready-to-show', () => { if (!FUMACA) janela?.show(); });
  janela.on('closed', () => { janela = null; });
  const wc = janela.webContents;
  // Links externos (https) abrem no navegador; nenhuma janela nova dentro do aplicativo
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => { if (!url.startsWith(`${ORIGEM}/`)) e.preventDefault(); });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  if (FUMACA) wc.on('did-finish-load', () => { if (wc.getURL() === `${ORIGEM}/index.html`) void testeDeFumaca(wc); });
}

// =============================================================================================
// Ponte com a página (preload.ts): arquivos do plano e seletor de pasta
// =============================================================================================

function daPagina(e: IpcMainInvokeEvent): void {
  if (!(e.senderFrame?.url ?? '').startsWith(`${ORIGEM}/`)) throw new Error('Pedido de origem não autorizada.');
}

function pedidoGravacao(v: unknown): PedidoGravacao & { dados: ArrayBuffer | Uint8Array } {
  const p = v as Partial<PedidoGravacao & { dados: ArrayBuffer | Uint8Array }>;
  if (!p || typeof p.pastaRaiz !== 'string' || typeof p.nome !== 'string' || !Array.isArray(p.partes) || !p.partes.every((x) => typeof x === 'string')
      || !(p.dados instanceof ArrayBuffer || p.dados instanceof Uint8Array)) {
    throw new ErroArquivo('Pedido de gravação inválido.');
  }
  return p as PedidoGravacao & { dados: ArrayBuffer | Uint8Array };
}

function registrarPonte(): void {
  ipcMain.handle('arquivo:salvarNaPasta', async (e, v: unknown) => {
    daPagina(e);
    const p = pedidoGravacao(v);
    const caminho = await gravarNaPasta(p, p.dados);
    gravados.add(caminho);
    return caminho;
  });
  ipcMain.handle('arquivo:abrir', async (e, caminho: unknown) => {
    daPagina(e);
    if (typeof caminho !== 'string' || !gravados.has(caminho)) throw new ErroArquivo('Só é possível abrir arquivos gravados pelo RibasRig.');
    const erro = await shell.openPath(caminho);
    if (erro) throw new ErroArquivo(`Não foi possível abrir ${path.basename(caminho)}: ${erro}`);
  });
  ipcMain.handle('arquivo:mostrarNaPasta', (e, caminho: unknown) => {
    daPagina(e);
    if (typeof caminho !== 'string' || !gravados.has(caminho)) throw new ErroArquivo('Só é possível mostrar arquivos gravados pelo RibasRig.');
    shell.showItemInFolder(caminho);
  });
  ipcMain.handle('arquivo:abrirTemporario', async (e, v: unknown) => {
    daPagina(e);
    const p = v as { nome?: unknown; dados?: unknown };
    const caminho = await gravarNaPasta(pedidoGravacao({ pastaRaiz: path.join(app.getPath('temp'), 'RibasRig'), partes: ['consulta'], nome: p?.nome, dados: p?.dados }),
      p.dados as ArrayBuffer);
    gravados.add(caminho);
    const erro = await shell.openPath(caminho);
    if (erro) throw new ErroArquivo(`Não foi possível abrir ${path.basename(caminho)}: ${erro}`);
  });
  ipcMain.handle('pasta:escolher', async (e, atual: unknown) => {
    daPagina(e);
    const opcoes = { title: 'Pasta dos planos de rigging', properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[],
      defaultPath: typeof atual === 'string' && existsSync(atual) ? atual : undefined };
    const r = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes);
    return r.canceled ? null : r.filePaths[0] ?? null;
  });
}

function menu(): Menu {
  const mac = process.platform === 'darwin';
  const itens: MenuItemConstructorOptions[] = [
    ...(mac ? [{ role: 'appMenu' as const, label: 'RibasRig' }] : []),
    { label: 'Arquivo', submenu: [mac ? { role: 'close', label: 'Fechar janela' } : { role: 'quit', label: 'Sair' }] },
    { label: 'Editar', submenu: [
      { role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' },
      { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' },
    ] },
    { label: 'Exibir', submenu: [
      { role: 'reload', label: 'Recarregar' }, { type: 'separator' },
      { role: 'resetZoom', label: 'Tamanho original' }, { role: 'zoomIn', label: 'Aumentar' }, { role: 'zoomOut', label: 'Diminuir' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Tela cheia' },
      ...(!app.isPackaged ? [{ role: 'toggleDevTools' as const, label: 'Ferramentas do desenvolvedor' }] : []),
    ] },
    { label: 'Ajuda', submenu: [{ label: `RibasRig ${app.getVersion()} · servidor ${config.api}`, enabled: false }] },
  ];
  return Menu.buildFromTemplate(itens);
}

// =============================================================================================
// Teste de fumaça (npm run fumaca): carrega o sistema escondido e confere ponte, isolamento e proxy da API
// =============================================================================================

async function testeDeFumaca(wc: Electron.WebContents): Promise<void> {
  const pastaTeste = path.join(app.getPath('temp'), 'RibasRig-fumaca');
  const senha = process.env.RIBASRIG_E2E_SENHA ?? '';
  const script = `(async () => {
    const r = {};
    r.titulo = document.title;
    r.semNode = typeof require === 'undefined' && typeof process === 'undefined';
    r.ponte = typeof window.ribasrig === 'object' && typeof window.ribasrig.salvarNaPasta === 'function';
    r.sistema = await (await fetch('/api/sistema/')).json();
    const pdf = new TextEncoder().encode('%PDF-1.4 teste').buffer;
    r.gravou = await window.ribasrig.salvarNaPasta({ pastaRaiz: ${JSON.stringify(pastaTeste)}, partes: ['Cliente Teste', '2610999', 'Relatório'], nome: 'Plano.pdf', dados: pdf });
    r.recusouFora = await window.ribasrig.salvarNaPasta({ pastaRaiz: ${JSON.stringify(pastaTeste)}, partes: ['..', '..'], nome: 'x.pdf', dados: pdf }).then(() => false, (e) => e.message);
    r.recusouExe = await window.ribasrig.salvarNaPasta({ pastaRaiz: ${JSON.stringify(pastaTeste)}, partes: ['a'], nome: 'virus.exe', dados: pdf }).then(() => false, (e) => e.message);
    r.recusouAbrir = await window.ribasrig.abrirArquivo('/etc/hosts').then(() => false, (e) => e.message);
    if (${JSON.stringify(senha)}) {
      const login = await (await fetch('/api/auth/token/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'giuliano.breda', senha: ${JSON.stringify(senha)} }) })).json();
      const auth = { Authorization: 'Bearer ' + login.access };
      // Imagem inválida: o servidor lê o arquivo e recusa antes de gravar qualquer coisa (o teste não deixa rastro no banco)
      const corpo = new FormData();
      corpo.append('arquivo', new Blob(['nao-e-imagem'], { type: 'image/png' }), 'logo.png');
      const envio = await fetch('/api/configuracoes/logo/', { method: 'POST', headers: auth, body: corpo });
      r.uploadPeloProxy = { status: envio.status, detail: (await envio.json()).detail };
    }
    r.telaMontada = !!document.querySelector('#root')?.childElementCount;
    return r;
  })()`;
  await new Promise((ok) => setTimeout(ok, 1500));
  try {
    const r = await wc.executeJavaScript(script) as Record<string, unknown>;
    const ok = r.semNode === true && r.ponte === true && typeof r.gravou === 'string' && typeof r.recusouFora === 'string'
      && typeof r.recusouExe === 'string' && typeof r.recusouAbrir === 'string' && r.telaMontada === true
      // O servidor só diz "não é um PNG ou JPEG válido" se recebeu o arquivo: o multipart passou inteiro pelo proxy
      && (!senha || (r.uploadPeloProxy as { detail: string }).detail === 'O arquivo não é um PNG ou JPEG válido.');
    // RIBASRIG_FUMACA_IMAGEM=<arquivo.png>: guarda a tela, para conferir que a CSP não quebrou o visual
    if (process.env.RIBASRIG_FUMACA_IMAGEM) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(process.env.RIBASRIG_FUMACA_IMAGEM, (await wc.capturePage()).toPNG());
    }
    console.log('FUMACA ' + JSON.stringify({ ok, ...r }));
    app.exit(ok ? 0 : 1);
  } catch (e) {
    console.log('FUMACA ' + JSON.stringify({ ok: false, erro: String(e) }));
    app.exit(1);
  }
}
