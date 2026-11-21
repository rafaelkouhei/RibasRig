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
async function iniciar() {
  if (MODO_API === 'http') {
    try {
      const s = await api.sistema();
      definirHoje(s.hoje);
      definirLimite(s.limitePct);
    } catch { /* sem servidor: as telas mostram o erro de conexão */ }
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
