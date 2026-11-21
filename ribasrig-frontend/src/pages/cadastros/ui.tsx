// Peças visuais comuns às telas de cadastro (Guindastes, Acessórios, Clientes) e à Consulta rápida.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { keyframes } from '@emotion/react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Skeleton, TextField, Typography,
  type SxProps, type TextFieldProps, type Theme,
} from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Dica } from '../../components/Dica';

export const COR = {
  marinho: '#34446A', azul: '#4A6192', texto: '#1F2A40', sec: '#5A6478', fraco: '#566075', borda: '#D5DAE3',
  alerta: '#C2610C', alertaFundo: '#FBE1C6', alertaTexto: '#8A3F04', laranjaEscuro: '#9A4A08', campoErro: '#FFF8F1',
  neutroFundo: '#ECEFF3', neutroTexto: '#3A465E', okFundo: '#DDE3EE', cabecalhoTabela: '#EEF0F4',
};

/** Perfil sem `editarCadastros`: Campo e células ficam só leitura e BotaoLeve some. Quem garante é o servidor. */
export const SomenteLeitura = createContext(false);
export const useSomenteLeitura = () => useContext(SomenteLeitura);

/** Faixa no topo do cadastro para quem só pode consultar. */
export function FaixaConsulta() {
  return (
    <Box sx={{ mb: 2.25, px: 1.75, py: 1.25, borderRadius: '3px', bgcolor: '#E6E9F0', color: 'primary.main', fontSize: 13 }}>
      Seu perfil pode consultar os cadastros, mas não alterá-los.
    </Box>
  );
}

/** Erro em laranja (nunca vermelho), como no protótipo. */
const sxErro: SxProps<Theme> = {
  '& .MuiOutlinedInput-root.Mui-error': { bgcolor: COR.campoErro },
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: COR.alerta },
  '& .MuiInputLabel-root.Mui-error': { color: COR.alertaTexto },
  '& .MuiFormHelperText-root': { mx: 0, mt: 0.5 },
};

/** Linhas de ajuda abaixo do campo: erro (laranja, negrito), "lido como …" e ajuda (cinza). */
export function Ajuda({ erro, lido, ajuda }: { erro?: string | null; lido?: string | null; ajuda?: ReactNode }) {
  if (!erro && !lido && !ajuda) return null;
  return (
    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {erro && <Box component="span" sx={{ color: COR.alertaTexto, fontWeight: 600 }}>{erro}</Box>}
      {lido && <Box component="span" sx={{ color: COR.sec }}>{lido}</Box>}
      {ajuda && <Box component="span" sx={{ color: COR.fraco }}>{ajuda}</Box>}
    </Box>
  );
}

type PropsCampo = Omit<TextFieldProps, 'error' | 'helperText' | 'onChange'> & {
  erro?: string | null;
  lido?: string | null;
  ajuda?: ReactNode;
  onValor: (v: string) => void;
  /** 'decimal' | 'numeric' | 'text' … */
  modo?: 'decimal' | 'numeric' | 'text' | 'tel' | 'email';
};

/** TextField com erro no próprio campo, "lido como" e ajuda. */
export function Campo({ erro, lido, ajuda, onValor, modo, sx, slotProps, ...resto }: PropsCampo) {
  const somenteLeitura = useSomenteLeitura();
  return (
    <TextField
      {...resto}
      error={!!erro}
      helperText={<Ajuda erro={erro} lido={lido} ajuda={ajuda} />}
      onChange={(e) => onValor(e.target.value)}
      slotProps={{
        ...slotProps,
        input: { ...(slotProps?.input as object | undefined), ...(somenteLeitura ? { readOnly: true } : {}) },
        htmlInput: { inputMode: modo, ...(slotProps?.htmlInput as object | undefined) },
      }}
      sx={[sxErro, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
  );
}

/** Título de grupo dentro de um cartão ("DADOS DO GUINDASTE E DO CAMINHÃO"); `dica` = explicação no ícone "i". */
export function TituloGrupo({ children, dica, acao, sx }: { children: ReactNode; dica?: ReactNode; acao?: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box sx={[{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexGrow: 1, minWidth: 0 }}>
        <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: COR.azul, textTransform: 'uppercase' }}>{children}</Typography>
        {dica && <Dica tamanho={16}>{dica}</Dica>}
      </Box>
      {acao}
    </Box>
  );
}

/**
 * Sombra que aparece só quando há conteúdo escondido em cima ou embaixo (as barras de rolagem são invisíveis).
 * As camadas da cor do fundo rolam junto com o conteúdo e cobrem a sombra quando se chega ao topo ou ao fim.
 * `fundo` em hexadecimal de 6 dígitos (o "00" no fim faz a versão transparente).
 */
const sombraRolagem = (fundo: string) => ({
  overflowY: 'auto',
  background: [
    `linear-gradient(${fundo} 30%, ${fundo}00) center top`,
    `linear-gradient(${fundo}00, ${fundo} 70%) center bottom`,
    'radial-gradient(farthest-side at 50% 0, rgba(31,42,64,0.18), rgba(31,42,64,0)) center top',
    'radial-gradient(farthest-side at 50% 100%, rgba(31,42,64,0.18), rgba(31,42,64,0)) center bottom',
  ].join(', '),
  backgroundRepeat: 'no-repeat',
  backgroundColor: fundo,
  backgroundSize: '100% 40px, 100% 40px, 100% 14px, 100% 14px',
  backgroundAttachment: 'local, local, scroll, scroll',
}) as const;

const quicar = keyframes`0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(3px); }`;

/**
 * Miolo que rola por dentro (lista ou formulário que não cabe na altura da janela).
 * Enquanto houver conteúdo abaixo, mostra "Role para ver mais" com a seta quicando; some ao chegar no fim.
 * O aviso é só visual (o teclado já percorre os campos); clicar nele desce um pouco.
 * `fundo`: cor atrás do conteúdo (branco nos cartões; o cinza da página quando a lista fica direto sobre ela).
 */
export function AreaRolavel({ children, fundo = '#FFFFFF', sx }: { children: ReactNode; fundo?: string; sx?: SxProps<Theme> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maisAbaixo, setMaisAbaixo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setMaisAbaixo(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    // Conteúdo que entra ou sai (mensagem de erro, local de obra novo) e janela redimensionada mudam o que sobra
    const conteudo = new MutationObserver(medir);
    conteudo.observe(el, { childList: true, subtree: true });
    const tamanho = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    tamanho?.observe(el);
    return () => { el.removeEventListener('scroll', medir); conteudo.disconnect(); tamanho?.disconnect(); };
  }, []);
  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
      <Box ref={ref} sx={[sombraRolagem(fundo), { flex: '1 1 auto', minHeight: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>{children}</Box>
      <Box component="button" type="button" tabIndex={-1} aria-hidden onClick={() => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.7, behavior: 'smooth' })}
        sx={{
          position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 0.5, pl: 1, pr: 1.5, py: 0.625, border: 0, borderRadius: '3px',
          bgcolor: COR.marinho, color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(31,42,64,0.28)', transition: 'opacity 0.2s, visibility 0.2s',
          opacity: maisAbaixo ? 1 : 0, visibility: maisAbaixo ? 'visible' : 'hidden', '&:hover': { bgcolor: COR.azul },
          '& svg': { fontSize: 18, animation: `${quicar} 1.4s ease-in-out infinite` },
          '@media (prefers-reduced-motion: reduce)': { '& svg': { animation: 'none' } },
        }}>
        <KeyboardArrowDown />Role para ver mais
      </Box>
    </Box>
  );
}

/**
 * Cartão branco com cabeçalho azul-marinho e rodapé opcional.
 * `rolar`: o cartão não passa da altura disponível; o miolo rola por dentro e cabeçalho e rodapé ficam parados.
 */
export function Cartao({ titulo, dica, selo, rodape, rolar, children, sx }: { titulo: ReactNode; dica?: ReactNode; selo?: ReactNode; rodape?: ReactNode; rolar?: boolean; children: ReactNode; sx?: SxProps<Theme> }) {
  const miolo = { p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 2 } as const;
  return (
    <Paper component="section" sx={[{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }, rolar ? { maxHeight: '100%' } : {}, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.75, bgcolor: COR.marinho, color: '#fff', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexGrow: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600, minWidth: 0 }}>{titulo}</Typography>
          {dica && <Dica claro>{dica}</Dica>}
        </Box>
        {selo}
      </Box>
      {rolar
        ? <AreaRolavel sx={{ ...miolo, '& > *': { flexShrink: 0 } }}>{children}</AreaRolavel>
        : <Box sx={{ ...miolo, flexGrow: 1 }}>{children}</Box>}
      {rodape && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 1.75, borderTop: `1px solid ${COR.borda}`, flexWrap: 'wrap', flexShrink: 0 }}>{rodape}</Box>}
    </Paper>
  );
}

export type Tom = 'ok' | 'alerta' | 'alertaForte' | 'neutro';
const ESTILO_TOM: Record<Tom, SxProps<Theme>> = {
  ok: { bgcolor: COR.okFundo, color: COR.marinho },
  alerta: { bgcolor: COR.alertaFundo, color: COR.alertaTexto },
  alertaForte: { bgcolor: COR.alertaFundo, color: COR.alertaTexto, boxShadow: `inset 0 0 0 1px ${COR.alerta}` },
  neutro: { bgcolor: COR.neutroFundo, color: COR.neutroTexto },
};

/** Selo de situação com texto (nunca só cor). */
export function Selo({ tom, children, grande }: { tom: Tom; children: ReactNode; grande?: boolean }) {
  return (
    <Box component="span" sx={[{ display: 'inline-block', alignSelf: 'flex-start', flexShrink: 0, px: grande ? 1.25 : 1, py: grande ? 0.5 : 0.375, borderRadius: '2px', fontSize: grande ? 13 : 12, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap' }, ESTILO_TOM[tom]] as SxProps<Theme>}>
      {children}
    </Box>
  );
}

/** Caixa de aviso (situação do laudo, da inspeção…). */
export function Aviso({ tom, titulo, children, icone }: { tom: Tom; titulo: ReactNode; children?: ReactNode; icone?: ReactNode }) {
  const borda = tom === 'alertaForte' ? { border: `1px solid ${COR.alerta}` } : {};
  const fundo = tom === 'ok' ? { bgcolor: '#E6E9F0', color: COR.marinho } : ESTILO_TOM[tom === 'alertaForte' ? 'alerta' : tom];
  return (
    <Box sx={[{ display: 'flex', alignItems: 'flex-start', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '3px', fontSize: 13 }, fundo, borda] as SxProps<Theme>}>
      {icone && <Box sx={{ display: 'flex', flexShrink: 0, '& svg': { fontSize: 20 } }}>{icone}</Box>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Box component="b">{titulo}</Box>
        {children && <span>{children}</span>}
      </Box>
    </Box>
  );
}

/** Carregamento e erro de carga: nunca deixa a tela em branco. */
export function EstadoCarga({ carregando, erro, recarregar }: { carregando: boolean; erro: string | null; recarregar: () => void }) {
  if (erro) {
    return <Alert severity="warning" action={<Button color="inherit" onClick={recarregar}>Tentar de novo</Button>}>Não foi possível carregar os dados: {erro}</Alert>;
  }
  if (!carregando) return null;
  return (
    <Box aria-busy="true" aria-label="Carregando">
      <LinearProgress sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 2.5 }}>
        <Skeleton variant="rectangular" height={360} />
        <Skeleton variant="rectangular" height={360} />
      </Box>
    </Box>
  );
}

/** Diálogo de confirmação para ações que apagam ou descartam. */
export function Confirmacao({ aberto, titulo, children, confirmar, rotuloConfirmar, cancelar }: {
  aberto: boolean; titulo: ReactNode; children: ReactNode; confirmar: () => void; rotuloConfirmar: string; cancelar: () => void;
}) {
  return (
    <Dialog open={aberto} onClose={cancelar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: COR.marinho, color: '#fff', fontSize: 17, fontWeight: 600, py: 1.75 }}>{titulo}</DialogTitle>
      <DialogContent sx={{ pt: '18px !important', fontSize: 14, color: COR.neutroTexto, lineHeight: 1.5 }}>{children}</DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.25 }}>
        <Button variant="outlined" onClick={cancelar} sx={{ borderColor: '#8F9AB0' }}>Cancelar</Button>
        <Button variant="contained" onClick={confirmar} sx={{ bgcolor: `${COR.laranjaEscuro} !important`, color: '#fff' }}>{rotuloConfirmar}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Botão secundário pequeno (contorno tracejado opcional), como "+ Configuração". */
export function BotaoLeve({ children, onClick, tracejado, perigo, disabled, sx }: { children: ReactNode; onClick: () => void; tracejado?: boolean; perigo?: boolean; disabled?: boolean; sx?: SxProps<Theme> }) {
  if (useSomenteLeitura()) return null;
  return (
    <Button variant="outlined" onClick={onClick} disabled={disabled}
      sx={[{ minHeight: 36, height: 36, px: 1.5, fontSize: 13, bgcolor: tracejado ? 'transparent' : '#fff', borderStyle: tracejado ? 'dashed' : 'solid', borderColor: perigo ? '#C9D0DC' : '#8F9AB0', color: perigo ? COR.alertaTexto : COR.marinho, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      {children}
    </Button>
  );
}
