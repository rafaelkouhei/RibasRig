import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * Avisa antes de sair com alterações não salvas: fechar/recarregar a janela (beforeunload) e
 * cliques em links internos (#/…), como o Voltar e o menu. Devolve o diálogo de confirmação para renderizar.
 */
export function useAvisoSaida(sujo: boolean, texto = 'As alterações feitas nesta tela ainda não foram salvas.') {
  const navegar = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    if (!sujo) return;
    const antesDeFechar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      const href = a?.getAttribute('href') ?? '';
      if (!href.startsWith('#/')) return;
      const para = href.slice(1);
      if (para === window.location.hash.slice(1)) return;
      e.preventDefault();
      e.stopPropagation();
      setDestino(para);
    };
    window.addEventListener('beforeunload', antesDeFechar);
    document.addEventListener('click', clique, true);
    return () => {
      window.removeEventListener('beforeunload', antesDeFechar);
      document.removeEventListener('click', clique, true);
    };
  }, [sujo]);

  const dialogo = (
    <Dialog open={destino != null} onClose={() => setDestino(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Sair sem salvar?</DialogTitle>
      <DialogContent><DialogContentText>{texto}</DialogContentText></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={() => setDestino(null)}>Continuar editando</Button>
        <Button variant="contained" onClick={() => { const d = destino; setDestino(null); if (d) navegar(d); }}>Sair sem salvar</Button>
      </DialogActions>
    </Dialog>
  );
  return dialogo;
}
