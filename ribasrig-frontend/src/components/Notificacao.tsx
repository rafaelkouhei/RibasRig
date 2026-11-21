import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert, Box, Snackbar } from '@mui/material';

type Tipo = 'success' | 'info' | 'warning' | 'error';
const Ctx = createContext<(msg: string, tipo?: Tipo) => void>(() => {});

const escondido = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const;

/**
 * Notificações curtas (canto inferior direito). O texto também vai para uma região aria-live
 * que fica sempre na página, para o leitor de tela anunciar mesmo quando a mensagem se repete.
 */
export function NotificacaoProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; texto: string; tipo: Tipo } | null>(null);
  const [aberta, setAberta] = useState(false);
  const notificar = useCallback((texto: string, tipo: Tipo = 'success') => {
    setMsg((m) => ({ id: (m?.id ?? 0) + 1, texto, tipo }));
    setAberta(true);
  }, []);
  const fechar = () => setAberta(false);
  const urgente = msg?.tipo === 'error' || msg?.tipo === 'warning';
  return (
    <Ctx.Provider value={notificar}>
      {children}
      <Box role={urgente ? 'alert' : 'status'} aria-live={urgente ? 'assertive' : 'polite'} aria-atomic="true" sx={escondido}>
        {aberta && msg && <span key={msg.id}>{msg.texto}</span>}
      </Box>
      {/* bottom 88: fica acima do rodapé fixo do plano (68 px), sem tapar "Próximo" e "Emitir" */}
      <Snackbar open={aberta} autoHideDuration={6000} onClose={(_, motivo) => { if (motivo !== 'clickaway') fechar(); }} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ bottom: { xs: 88, sm: 88 } }}>
        <Alert role="none" severity={msg?.tipo ?? 'success'} variant="filled" onClose={fechar} slotProps={{ closeButton: { 'aria-label': 'Fechar aviso' } }}
          sx={{ maxWidth: 560, fontSize: 14, alignItems: 'center', ...(msg?.tipo === 'success' && { bgcolor: '#1F2A40' }), ...(msg?.tipo === 'info' && { bgcolor: '#4A6192' }), ...(msg?.tipo === 'warning' && { bgcolor: '#9A4A08' }) }}>
          {msg?.texto}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}
export const useNotificacao = () => useContext(Ctx);
