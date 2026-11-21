import { Alert, Box, Button, LinearProgress, Skeleton } from '@mui/material';
import { BarraPlano } from '../../components/Cabecalho';

/** Carregando (barra + esqueleto) ou erro (com "Tentar de novo"). Nunca deixa a tela em branco. */
export function EstadoCarga({ numero, erro, recarregar, voltar = '/' }: { numero: string; erro: string | null; recarregar: () => void; voltar?: string }) {
  return (
    <Box>
      <BarraPlano voltar={voltar} caminho={`Planos de Rigging / ${numero}`} titulo={`Plano de Rigging nº ${numero}`} />
      {erro ? (
        <Alert severity="warning" action={<Button color="inherit" onClick={recarregar}>Tentar de novo</Button>}>{erro}</Alert>
      ) : (
        <Box aria-busy="true" aria-label="Carregando o plano">
          <LinearProgress sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={480} sx={{ maxWidth: 560, mx: 'auto' }} />
        </Box>
      )}
    </Box>
  );
}
