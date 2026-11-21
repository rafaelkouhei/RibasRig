import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import fundo from '../assets/guindaste-ceu.jpg';
import logo from '../assets/logo-ribas-branca.png';

/** Cartão de dois painéis sobre a foto (Login e Redefinir senha). `topo` = espaço acima do título do painel direito, em px. */
export function CartaoAcesso({ saudacao, texto, topo = 60, children }: { saudacao: string; texto?: string; topo?: number; children: ReactNode }) {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#4F6B99',
      backgroundImage: `url(${fundo})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, width: '100%', maxWidth: 900, minHeight: { md: 490 } }}>
        <Box sx={{ flex: { md: '546 1 0' }, bgcolor: 'rgba(52, 67, 102, 0.93)', color: '#fff', p: { xs: 4, md: '60px 40px' }, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontWeight: 300, fontSize: { xs: 28, md: 36 }, lineHeight: 1.2 }}>{saudacao}</Typography>
          <Typography sx={{ fontWeight: 600, fontSize: { xs: 30, md: 38 }, lineHeight: 1.2, mt: 2.75 }}>Sistema RibasRig</Typography>
          {texto && <Typography sx={{ fontWeight: 300, fontSize: 18, lineHeight: 1.45, mt: 3, color: '#DDE2EC', maxWidth: 420 }}>{texto}</Typography>}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25, mt: 'auto', pt: 6 }}>
            <Box component="img" src={logo} alt="Logo Guindastes Ribas" sx={{ width: 62, height: 40, objectFit: 'contain' }} />
            <Typography sx={{ fontWeight: 500, fontSize: { xs: 20, md: 27 }, letterSpacing: 0.3 }}>GUINDASTES RIBAS</Typography>
          </Box>
        </Box>
        <Box sx={{ flex: { md: '354 1 0' }, bgcolor: 'rgba(214, 218, 225, 0.9)', p: { xs: 4, md: `${topo}px 40px 12px` }, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

/** Campo no estilo do login: contorno reto, legenda na borda. */
export const campoAcesso = {
  '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: 'transparent', color: '#1F2A40' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#7E889A', borderWidth: 1.5 },
  '& .MuiInputLabel-root': { color: '#34446A' },
};

/** Botão principal dos cartões de acesso. */
export const botaoAcesso = {
  height: 44, borderRadius: 0, bgcolor: '#3F4D6E', fontSize: 18, fontWeight: 400, textTransform: 'none', boxShadow: 'none',
  '&:hover': { bgcolor: '#34446A', boxShadow: 'none' },
};

/** Rodapé dos cartões (links no fim do painel). */
export const rodapeAcesso = { display: 'flex', flexDirection: 'column', mt: 'auto', pt: 4 } as const;
