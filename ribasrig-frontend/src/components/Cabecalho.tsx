import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import { Dica } from './Dica';

/** Botão Voltar padrão (igual em todas as telas secundárias). */
export function BotaoVoltar({ para }: { para: string }) {
  return (
    <Button component={RouterLink} to={para} variant="outlined" startIcon={<ArrowBack />} sx={{ flexShrink: 0, bgcolor: '#fff', borderColor: '#8F9AB0', color: 'primary.main' }}>
      Voltar
    </Button>
  );
}

/**
 * Cadastros e administração: título dentro da página, com Voltar à esquerda e ação principal à direita.
 * `descricao` não aparece como texto: vira o ícone "i" ao lado do título (explicação ao passar o mouse).
 */
export function Cabecalho({ secao, titulo, descricao, voltar, acao }: { secao?: string; titulo: string; descricao?: ReactNode; voltar?: string; acao?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 2.5 }}>
      {voltar && <BotaoVoltar para={voltar} />}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {secao && <Typography variant="body2" sx={{ color: 'secondary.main', fontWeight: 600, letterSpacing: 1.4, fontSize: 12 }}>{secao}</Typography>}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h1">{titulo}</Typography>
          {descricao && <Dica tamanho={22}>{descricao}</Dica>}
        </Box>
      </Box>
      {acao}
    </Box>
  );
}

/** Telas do plano: barra branca no topo, com Voltar, caminho, título e ações. Use como primeiro filho da página (ocupa a largura toda). */
export function BarraPlano({ voltar, caminho, titulo, selo, acoes }: { voltar: string; caminho: ReactNode; titulo: ReactNode; selo?: ReactNode; acoes?: ReactNode }) {
  return (
    // Quebra linha quando falta espaço (ex.: 1280 px): ações descem e o selo vai para baixo do título, sem sobrepor
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.75, rowGap: 1, minHeight: 76, px: 3.5, py: 1.25, boxSizing: 'border-box', mx: { xs: -2, md: '-36px' }, mt: { xs: -2, md: '-28px' }, mb: 3, bgcolor: '#fff', borderBottom: '1px solid #D5DAE3' }}>
      <BotaoVoltar para={voltar} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{caminho}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, rowGap: 0.5 }}>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 600, color: 'primary.main' }}>{titulo}</Typography>
          {selo}
        </Box>
      </Box>
      {/* As ações andam juntas: se não couberem ao lado do título, descem inteiras, alinhadas à direita */}
      {acoes && <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1.75, ml: 'auto' }}>{acoes}</Box>}
    </Box>
  );
}
