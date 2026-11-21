import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';

/** id do campo "Buscar plano" do Início (o atalho "/" ou Ctrl + K foca este campo). */
export const ID_BUSCA_PLANOS = 'busca-planos';

/** Teclas: cada grupo é uma combinação; grupos alternativos são separados por "ou". */
export interface Atalho { acao: string; teclas: string[][]; soNoPlano?: boolean }

export const ATALHOS: Atalho[] = [
  { acao: 'Buscar plano', teclas: [['/'], ['Ctrl', 'K']] },
  { acao: 'Novo plano', teclas: [['Alt', 'N']] },
  { acao: 'Próxima etapa', teclas: [['Ctrl', 'Enter']], soNoPlano: true },
  { acao: 'Etapa anterior', teclas: [['Alt', '←']], soNoPlano: true },
  { acao: 'Salvar rascunho', teclas: [['Ctrl', 'S']], soNoPlano: true },
  { acao: 'Visualizar PDF', teclas: [['Ctrl', 'P']], soNoPlano: true },
  { acao: 'Fechar janela', teclas: [['Esc']] },
  { acao: 'Esta lista de atalhos', teclas: [['Ctrl', '/']] },
];

/** O foco está num campo de texto? (aí "/" é só uma barra digitada) */
function digitando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName);
}

/**
 * Atalhos globais. Ctrl + / abre/fecha a lista; Alt + N abre um plano novo; "/" ou Ctrl + K foca a busca do Início
 * (vai para o Início se estiver em outra tela). Esc fecha qualquer janela (comportamento do Dialog).
 * Os atalhos do formulário do plano ficam na própria tela do plano.
 */
export function useAtalhosGlobais() {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const criaPlano = pode(useAuth().usuario?.perfil, 'editarRascunhos');
  const [aberto, setAberto] = useState(false);

  const focarBusca = useCallback(() => {
    setAberto(false);
    const campo = document.getElementById(ID_BUSCA_PLANOS);
    if (pathname === '/' && campo) campo.focus();
    else navegar('/', { state: { focarBusca: true } });
  }, [navegar, pathname]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.altKey && (e.key === '/' || e.code === 'Slash' || e.code === 'IntlRo')) { e.preventDefault(); setAberto((a) => !a); return; }
      if (ctrl && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); focarBusca(); return; }
      if (e.altKey && !ctrl && e.code === 'KeyN') { e.preventDefault(); if (criaPlano) { setAberto(false); navegar('/planos/novo'); } return; }
      if (!ctrl && !e.altKey && e.key === '/' && !digitando(e.target)) { e.preventDefault(); focarBusca(); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [navegar, focarBusca, criaPlano]);

  return { aberto, abrir: () => setAberto(true), fechar: () => setAberto(false) };
}

const Tecla = ({ t }: { t: string }) => (
  <Box component="kbd" sx={{ minWidth: 34, height: 30, px: 1, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #B9C2D2', borderBottomWidth: 3, borderRadius: '3px', bgcolor: '#F7F8FA', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'primary.main' }}>{t}</Box>
);

function Combinacoes({ teclas }: { teclas: string[][] }) {
  return (
    <Box component="dd" sx={{ m: 0, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, color: 'text.secondary' }}>
      {teclas.map((grupo, g) => (
        <Box key={grupo.join('+')} sx={{ display: 'contents' }}>
          {g > 0 && <span>ou</span>}
          {grupo.map((t, i) => <Box key={t} sx={{ display: 'contents' }}>{i > 0 && '+'}<Tecla t={t} /></Box>)}
        </Box>
      ))}
    </Box>
  );
}

export function DialogoAtalhos({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  return (
    <Dialog open={aberto} onClose={fechar} maxWidth={false} slotProps={{ paper: { sx: { width: 500 } } }} aria-describedby="atalhos-nota">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.25, pl: 2.75, pr: 1.5, bgcolor: 'primary.main', color: '#fff', fontSize: 18, fontWeight: 600 }}>
        <Box component="span" sx={{ flexGrow: 1 }}>Atalhos de teclado</Box>
        <IconButton aria-label="Fechar" onClick={fechar} sx={{ color: '#fff', width: 44, height: 44 }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2.75, pt: '6px !important', pb: 0.5 }}>
        <Box component="dl" sx={{ m: 0 }}>
          {ATALHOS.map((a) => (
            <Box key={a.acao} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 1.1, borderTop: '1px solid #EEF0F4', '&:first-of-type': { borderTop: 0 } }}>
              <Box component="dt" sx={{ flexGrow: 1, fontSize: 15, color: 'text.primary' }}>
                {a.acao}
                {a.soNoPlano && <Box component="span" sx={{ ml: 1, px: 0.75, py: 0.25, borderRadius: '2px', bgcolor: '#EEF0F4', color: '#3C4A5E', fontSize: 12, fontWeight: 600 }}>na tela do plano</Box>}
              </Box>
              <Combinacoes teclas={a.teclas} />
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ gap: 1.5, px: 2.75, pt: 1.5, pb: 2.25, borderTop: '1px solid #EEF0F4' }}>
        <Typography id="atalhos-nota" sx={{ flexGrow: 1, fontSize: 12, color: 'text.secondary' }}>Os marcados “na tela do plano” só valem dentro do plano.</Typography>
        <Button variant="outlined" onClick={fechar} sx={{ borderColor: '#8F9AB0' }}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
