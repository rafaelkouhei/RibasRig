import type { ReactNode } from 'react';
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Tab, Tabs, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Cabecalho } from '../../components/Cabecalho';
import { Dica } from '../../components/Dica';
import { AreaRolavel } from '../cadastros/ui';
import type { OrigemCadastro } from '../../domain/types';

export type AbaCalculos = 'regras' | 'tipos';

/** Cabeçalho da tela Cálculos com as abas ligadas à rota. */
export function TopoCalculos({ aba, descricao, acao }: { aba: AbaCalculos; descricao: string; acao?: ReactNode }) {
  return (
    <>
      <Cabecalho secao="CADASTROS" titulo="Cálculos" voltar="/" descricao={descricao} acao={acao} />
      <Tabs value={aba} aria-label="Seções de cálculos" sx={{ mb: 2, borderBottom: '1px solid #D5DAE3', minHeight: 44, flexShrink: 0,
        '& .MuiTab-root': { fontSize: 15, fontWeight: 600, color: '#5A6478', textTransform: 'none', minHeight: 44, px: 2.25 },
        '& .Mui-selected': { color: 'primary.main', fontWeight: 700 }, '& .MuiTabs-indicator': { height: 3, bgcolor: 'primary.main' } }}>
        <Tab value="regras" label="Regras de cálculo" component={RouterLink} to="/calculos/regras" />
        <Tab value="tipos" label="Tipos de içamento" component={RouterLink} to="/calculos/tipos" />
      </Tabs>
    </>
  );
}

/** Selo da origem: sistema (cheio), exemplo fictício (tracejado), criado. */
export function SeloOrigem({ origem, texto }: { origem: OrigemCadastro; texto: string }) {
  const estilo = origem === 'sistema' ? { bgcolor: '#E6E9F0', color: 'primary.main' }
    : origem === 'exemplo' ? { bgcolor: '#fff', color: '#3A465E', border: '1px dashed #566075' } : { bgcolor: '#EEF0F4', color: '#3A465E' };
  return <Box component="span" sx={{ flexShrink: 0, px: 1, py: '2px', borderRadius: '2px', fontSize: 12, fontWeight: 700, ...estilo }}>{texto}</Box>;
}

/** Item da lista lateral (regra ou tipo). */
export function ItemLista({ titulo, selo, linhas, atual, onClick }: { titulo: string; selo: ReactNode; linhas: ReactNode[]; atual: boolean; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} aria-current={atual ? 'true' : undefined} focusRipple
      sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.4, px: 1.75, py: 1.4, textAlign: 'left',
        borderTop: '1px solid #E4E8EE', bgcolor: atual ? '#E6E9F0' : '#fff', boxShadow: atual ? 'inset 4px 0 0 #34446A' : 'none',
        '&:hover': { bgcolor: atual ? '#E6E9F0' : '#F6F8FB' }, '&.Mui-focusVisible': { outline: '3px solid #34446A', outlineOffset: -3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ flexGrow: 1, fontSize: 14, fontWeight: 700, color: '#1F2A40' }}>{titulo}</Typography>
        {selo}
      </Box>
      {linhas.map((l, i) => <Box key={i} sx={{ fontSize: 12, color: i === 0 ? '#3A465E' : '#566075' }}>{l}</Box>)}
    </ButtonBase>
  );
}

/**
 * Painel do editor: faixa azul com título, subtítulo e aviso de alterações; o corpo rola por dentro
 * (com "Role para ver mais") e o rodapé de ações fica parado embaixo.
 */
export function PainelEditor({ titulo, subtitulo, sujo, children, acoes }: { titulo: string; subtitulo: string; sujo: boolean; children: ReactNode; acoes?: ReactNode }) {
  return (
    <Paper component="section" aria-label={`Editor: ${titulo}`} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxHeight: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, bgcolor: 'primary.main', color: '#fff', borderRadius: '3px 3px 0 0', flexShrink: 0 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>{titulo}</Typography>
          <Typography sx={{ fontSize: 12, color: '#DDE2EC' }}>{subtitulo}</Typography>
        </Box>
        {sujo && <Typography role="status" sx={{ fontSize: 12, fontWeight: 700, color: '#FBE1C6' }}>Alterações não salvas</Typography>}
      </Box>
      <AreaRolavel sx={{ p: '16px 20px', display: 'flex', flexDirection: 'column', gap: 1.75, '& > *': { flexShrink: 0 } }}>{children}</AreaRolavel>
      {acoes && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 1.5, bgcolor: '#F7F8FA', borderTop: '1px solid #D5DAE3', borderRadius: '0 0 3px 3px', flexShrink: 0 }}>
        {acoes}
      </Box>}
    </Paper>
  );
}

/** Título de seção do editor; `dica` = explicação no ícone "i" ao lado. */
export function TituloSecao({ children, dica, acao }: { children: ReactNode; dica?: ReactNode; acao?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexGrow: 1, minWidth: 0 }}>
        <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'secondary.main' }}>{children}</Typography>
        {dica && <Dica tamanho={16}>{dica}</Dica>}
      </Box>
      {acao}
    </Box>
  );
}

/** Confirmação genérica (excluir, descartar alterações). */
export function Confirmacao({ aberto, titulo, texto, confirmar, perigo, bloqueado, onConfirmar, onCancelar }: {
  aberto: boolean; titulo: string; texto: ReactNode; confirmar: string; perigo?: boolean; bloqueado?: boolean; onConfirmar: () => void; onCancelar: () => void;
}) {
  return (
    <Dialog open={aberto} onClose={onCancelar} maxWidth="xs" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent><DialogContentText component="div">{texto}</DialogContentText></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onCancelar}>Cancelar</Button>
        {!bloqueado && (
          <Button variant="contained" onClick={onConfirmar} sx={perigo ? { bgcolor: '#9A4A08', '&:hover': { bgcolor: '#8A3F04' } } : undefined}>{confirmar}</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/** Caixa de aviso do sistema com ação (ex.: "Duplicar para editar"). */
export function FaixaInfo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25, borderRadius: '3px', bgcolor: '#E6E9F0', color: 'primary.main', fontSize: 13 }}>
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
      {acao}
    </Box>
  );
}

/** Estilo dos campos somente leitura. */
export const somenteLeitura = { '& .MuiOutlinedInput-root': { bgcolor: '#F3F5F8' } } as const;

/** Erro de campo em laranja (convenção do sistema), em vez do vermelho padrão do MUI. Aplique num contêiner. */
export const erroLaranja = {
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#C2610C' },
  '& .MuiInputLabel-root.Mui-error': { color: '#8A3F04' },
  '& .MuiFormHelperText-root.Mui-error': { color: '#8A3F04', fontWeight: 600 },
  '& .MuiFormLabel-asterisk': { color: 'inherit' },
} as const;
