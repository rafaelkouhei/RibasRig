import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { HashRouter } from 'react-router-dom';
import '@fontsource/exo-2/300.css';
import '@fontsource/exo-2/400.css';
import '@fontsource/exo-2/500.css';
import '@fontsource/exo-2/600.css';
import '@fontsource/exo-2/700.css';
import { tema } from './theme';
import { AuthProvider } from './auth/AuthContext';
import { NotificacaoProvider } from './components/Notificacao';
import App from './App';
import { definirLimite } from './domain/calculos';
import { definirHoje } from './domain/formatacao';
import { api, MODO_API } from './services/api';

// Com o servidor, as regras usam a data e o limite da taxa dele (não a do computador nem a do cenário de exemplo).
async function atualizarSistema(): Promise<void> {
  const s = await api.sistema();
  definirHoje(s.hoje);
  definirLimite(s.limitePct);
}

const ESPERA_MS = 3000;
// Data e limite do servidor de novo de tempos em tempos: o aplicativo aberto de um dia para o outro (ou na virada do
// mês) passa a conferir vencimentos e numeração com a data nova.
const ATUALIZAR_MS = 10 * 60 * 1000;

/** Mensagem simples enquanto o servidor não responde (antes do React montar). */
function mostrarEspera(tentativa: number, erro: string) {
  const raiz = document.getElementById('root')!;
  raiz.innerHTML = '';
  const caixa = document.createElement('div');
  caixa.setAttribute('role', 'status');
  caixa.style.cssText = 'font-family: system-ui, sans-serif; color: #24324D; max-width: 520px; margin: 18vh auto; padding: 0 24px; line-height: 1.5';
  const titulo = document.createElement('h1');
  titulo.style.cssText = 'font-size: 20px; margin: 0 0 8px';
  titulo.textContent = 'Conectando ao servidor do RibasRig…';
  const texto = document.createElement('p');
  texto.style.cssText = 'margin: 0; font-size: 14px; color: #4A5568';
  texto.textContent = `${erro} Nova tentativa em ${ESPERA_MS / 1000} s (tentativa ${tentativa}). O sistema abre sozinho quando o servidor responder.`;
  caixa.append(titulo, texto);
  raiz.append(caixa);
}

async function iniciar() {
  if (MODO_API === 'http') {
    // Sem a data e o limite do servidor, as telas confeririam vencimentos com a data do cenário de exemplo e o
    // limite padrão: espera o servidor em vez de abrir com valores errados.
    for (let tentativa = 1; ; tentativa++) {
      try { await atualizarSistema(); break; } catch (e) {
        mostrarEspera(tentativa, e instanceof Error ? e.message : 'O servidor não respondeu.');
        await new Promise((ok) => setTimeout(ok, ESPERA_MS));
      }
    }
    document.getElementById('root')!.innerHTML = '';
    setInterval(() => { void atualizarSistema().catch(() => undefined); }, ATUALIZAR_MS);
  }
  montar();
}

// HashRouter funciona tanto no navegador quanto empacotado no Electron.
const montar = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {/* Barras de rolagem invisíveis em todo o sistema; a rolagem continua (roda do mouse, touchpad, teclado) */}
      <GlobalStyles styles={{ '*': { scrollbarWidth: 'none' }, '*::-webkit-scrollbar': { display: 'none' } }} />
      <HashRouter>
        <AuthProvider>
          <NotificacaoProvider>
            <App />
          </NotificacaoProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);

void iniciar();
