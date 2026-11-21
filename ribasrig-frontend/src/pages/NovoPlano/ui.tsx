// Peças visuais pequenas usadas pelas etapas do formulário do plano.
import type { ReactNode } from 'react';
import { Box, TextField, Typography, type SxProps, type TextFieldProps } from '@mui/material';
import { LIMITE_PCT } from '../../domain/calculos';
import { fmtPct } from '../../domain/formatacao';
import type { SituacaoSeguranca } from '../../domain/types';
import type { CampoPlano } from '../../domain/plano';
import { Dica } from '../../components/Dica';

export const COR = {
  marinho: '#34446A', azul: '#4A6192', texto: '#1F2A40', sec: '#5A6478', fraco: '#566075', borda: '#D5DAE3', bordaCampo: '#8F9AB0',
  alerta: '#C2610C', alertaFundo: '#FBE1C6', alertaTexto: '#8A3F04', okFundo: '#E6E9F0', cinza: '#F7F8FA', cabecalho: '#EEF0F4',
};

/** Título da etapa (h2); a frase de apoio fica no ícone "i" ao lado. */
export function TituloEtapa({ titulo, texto }: { titulo: string; texto: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="h2" component="h2" sx={{ fontSize: 20 }}>{titulo}</Typography>
      <Dica tamanho={20}>{texto}</Dica>
    </Box>
  );
}

/** Cabeçalho de seção em caixa alta azul ("CONTRATANTE"), com a explicação no ícone "i". */
export function Secao({ children, nota }: { children: ReactNode; nota?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
      <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: COR.azul, textTransform: 'uppercase' }}>{children}</Typography>
      {nota && <Dica tamanho={16}>{nota}</Dica>}
    </Box>
  );
}

export const Nota = ({ children, sx }: { children: ReactNode; sx?: SxProps }) => (
  <Typography sx={{ fontSize: 12, color: COR.sec, ...sx }}>{children}</Typography>
);

/** Faixa de aviso laranja (texto #8A3F04 sobre #FBE1C6, borda #C2610C). */
export function Aviso({ children, titulo, papel = 'alert' }: { children?: ReactNode; titulo?: ReactNode; papel?: 'alert' | 'status' }) {
  return (
    <Box role={papel} sx={{ p: '10px 14px', borderRadius: '3px', bgcolor: COR.alertaFundo, borderLeft: `4px solid ${COR.alerta}`, color: COR.alertaTexto, fontSize: 14 }}>
      {titulo && <Box component="b" sx={{ display: 'block' }}>{titulo}</Box>}
      {children}
    </Box>
  );
}

/** Faixa informativa azul-clara. */
export function Info({ children, sx }: { children: ReactNode; sx?: SxProps }) {
  return (
    <Box role="status" sx={{ p: '10px 14px', borderRadius: '3px', bgcolor: '#F3F5F9', border: '1px solid #BCC6DA', borderLeft: `4px solid ${COR.azul}`, color: COR.texto, fontSize: 14, ...sx }}>
      {children}
    </Box>
  );
}

/** Texto curto de uma taxa: "40,46%", "Atenção · 78,00%", "Bloqueado · 98,00%", "Bloqueado · —". */
export function taxaTexto(taxa: number, nivel: SituacaoSeguranca): string {
  if (!Number.isFinite(taxa)) return 'Bloqueado · —';
  return `${nivel === 'bloqueado' ? 'Bloqueado · ' : nivel === 'atencao' ? 'Atenção · ' : ''}${fmtPct(taxa)}`;
}

export const corNivel = (n: SituacaoSeguranca) => (n === 'ok' ? COR.marinho : COR.alertaTexto);

const ROTULO_CHIP: Record<SituacaoSeguranca, string> = { ok: 'Dentro do limite', atencao: 'Atenção', bloqueado: 'Bloqueado' };

/** Chip de situação de segurança, sempre com texto. */
export function ChipSituacao({ nivel, texto }: { nivel: SituacaoSeguranca; texto?: string }) {
  const estilo = nivel === 'ok'
    ? { bgcolor: COR.okFundo, color: COR.marinho, border: '1px solid #BCC6DA' }
    : { bgcolor: COR.alertaFundo, color: COR.alertaTexto, border: `1px solid ${COR.alerta}` };
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: '1px', borderRadius: '3px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', ...estilo }}>
      {nivel === 'bloqueado' && <Box component="span" aria-hidden="true">!</Box>}
      {texto ?? ROTULO_CHIP[nivel]}
    </Box>
  );
}

/** Barra da taxa (0–100%) com a marca do limite (Configurações; 85% por padrão). */
export function BarraTaxa({ taxa, nivel, rotulo }: { taxa: number; nivel: SituacaoSeguranca; rotulo: string }) {
  const cor = nivel === 'ok' ? COR.azul : nivel === 'atencao' ? COR.alerta : COR.alertaTexto;
  const largura = Number.isFinite(taxa) ? Math.min(Math.max(taxa, 0), 100) : 0;
  return (
    <Box role="meter" aria-label={rotulo} aria-valuenow={Number.isFinite(taxa) ? Math.round(taxa * 100) / 100 : 0} aria-valuemin={0} aria-valuemax={100}
      sx={{ position: 'relative', height: 12, bgcolor: '#E4E8EE', borderRadius: '1px' }}>
      <Box sx={{ height: 12, borderRadius: '1px', bgcolor: cor, width: `${largura}%` }} />
      <Box title={`Limite de ${LIMITE_PCT}%`} sx={{ position: 'absolute', left: `${Math.min(LIMITE_PCT, 100)}%`, top: -4, width: 3, height: 20, bgcolor: COR.alerta }} />
    </Box>
  );
}

/** Texto de ajuda de um campo numérico: erro (com o "lido como") ou só o "lido como". */
export function ajudaCampo(c: CampoPlano | undefined, mostrarErro: boolean): { erro: boolean; texto: string | undefined } {
  if (!c) return { erro: false, texto: undefined };
  if (c.erro && mostrarErro) {
    const lido = c.lidoComo ? `${c.lidoComo.charAt(0).toUpperCase()}${c.lidoComo.slice(1)} · ` : '';
    return { erro: true, texto: lido ? `${lido}${c.erro.charAt(0).toLowerCase()}${c.erro.slice(1)}` : c.erro };
  }
  return { erro: false, texto: c.lidoComo ?? undefined };
}

type PropsNum = Omit<TextFieldProps, 'value' | 'onChange' | 'error'> & {
  valor: string;
  mudar: (v: string) => void;
  campo: CampoPlano | undefined;
  /** Mostra o erro mesmo com o campo vazio (depois de tentar avançar) */
  tentou: boolean;
  inteiro?: boolean;
  destaque?: boolean;
};

/** Campo numérico em texto: valida no domínio, mostra "lido como" e o erro no próprio campo. */
export function CampoNum({ valor, mudar, campo, tentou, inteiro, destaque, helperText, slotProps, ...resto }: PropsNum) {
  const a = ajudaCampo(campo, tentou || valor.trim() !== '');
  return (
    <TextField {...resto} value={valor} onChange={(e) => mudar(e.target.value)} error={a.erro}
      helperText={a.texto ?? helperText}
      slotProps={{ ...slotProps, htmlInput: { inputMode: inteiro ? 'numeric' : 'decimal', style: destaque ? { fontWeight: 600, fontSize: 16 } : undefined } }}
      sx={a.erro ? { '& .MuiOutlinedInput-root': { bgcolor: '#FFF8F1' } } : undefined} />
  );
}

/** Caixa de valor só leitura (com cadeado opcional), no mesmo formato dos campos. */
export function ValorFixo({ rotulo, children, ajuda, icone }: { rotulo: string; children: ReactNode; ajuda?: ReactNode; icone?: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box component="fieldset" sx={{ m: 0, border: `1.5px solid ${COR.bordaCampo}`, borderRadius: '3px', p: '0 12px 11px', minWidth: 0, bgcolor: '#F3F5F8' }}>
        <Box component="legend" sx={{ px: 0.5, fontSize: 12, color: COR.marinho }}>{rotulo}</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 15, fontWeight: 600, color: COR.marinho, pt: '5px', minHeight: 26, overflowWrap: 'anywhere' }}>{icone}{children}</Box>
      </Box>
      {ajuda && <Typography sx={{ fontSize: 12, color: COR.marinho, mt: 0.5, mx: 1.75 }}>{ajuda}</Typography>}
    </Box>
  );
}

/** Grade de células cinza com rótulo e valor (dados do guindaste, sapatas). */
export function GradeValores({ itens, colunas = 4 }: { itens: { k: string; v: ReactNode; alerta?: boolean }[]; colunas?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${colunas}, minmax(0, 1fr))` }, gap: '1px', bgcolor: COR.borda, border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
      {itens.map((i) => (
        <Box key={i.k} sx={{ p: '8px 12px', bgcolor: COR.cinza }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.8px', color: COR.fraco }}>{i.k}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: i.alerta ? COR.alertaTexto : COR.marinho, overflowWrap: 'anywhere' }}>{i.v}</Typography>
        </Box>
      ))}
    </Box>
  );
}
