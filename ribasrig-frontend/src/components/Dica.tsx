import type { ReactNode } from 'react';
import { Box, Tooltip } from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';

/**
 * Ícone "i" que mostra uma explicação ao passar o mouse (ou ao focar pelo teclado, Tab).
 * Substitui as frases descritivas soltas embaixo de títulos e as notas de rodapé: a tela fica limpa
 * e a explicação continua a um gesto de distância. Erros, alertas e valores calculados NÃO vão para cá.
 * `claro`: para fundo marinho (cabeçalho de cartão). `texto`: rótulo visível ao lado do ícone (opcional).
 */
export function Dica({ children, claro, texto, tamanho = 18 }: { children: ReactNode; claro?: boolean; texto?: string; tamanho?: number }) {
  const cor = claro ? '#BCC6DA' : '#4A6192';
  return (
    <Tooltip title={<Box sx={{ '& p': { m: 0 }, '& p + p': { mt: 0.75 }, '& a': { color: '#BCC6DA', fontWeight: 600 } }}>{children}</Box>} arrow placement="bottom-start" enterDelay={80} describeChild
      slotProps={{
        tooltip: { sx: { bgcolor: '#1F2A40', color: '#fff', fontSize: 13, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, textTransform: 'none', maxWidth: 380, px: 1.5, py: 1.125, borderRadius: '3px', boxShadow: '0 4px 14px rgba(31,42,64,0.25)' } },
        arrow: { sx: { color: '#1F2A40' } },
      }}>
      <Box component="button" type="button" aria-label={texto ?? 'Mais informações'}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5, p: '2px', m: 0, border: 0, borderRadius: '3px', bgcolor: 'transparent',
          color: cor, font: 'inherit', fontSize: 12, fontWeight: 600, letterSpacing: 0, textTransform: 'none', cursor: 'help', verticalAlign: 'middle', flexShrink: 0,
          '&:hover': { color: claro ? '#fff' : '#34446A' }, '&:focus-visible': { outline: `2px solid ${claro ? '#BCC6DA' : '#34446A'}`, outlineOffset: 1 },
        }}>
        <InfoOutlined aria-hidden sx={{ fontSize: tamanho }} />{texto}
      </Box>
    </Tooltip>
  );
}
