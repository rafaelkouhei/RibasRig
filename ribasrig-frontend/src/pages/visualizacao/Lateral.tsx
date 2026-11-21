import { Box, Button, Link, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ROTULO_SEGURANCA, textoSituacao, type ResultadoPlano } from '../../domain/plano';
import type { PlanoRigging } from '../../domain/types';
import { pode } from '../../auth/permissoes';
import { useAuth } from '../../auth/AuthContext';
import { Dica } from '../../components/Dica';
import { resumoHistorico, type CorMarcador, type IdVista, type VistaPlano } from './vistas';

const COR_MARCADOR: Record<CorMarcador, string> = { atual: '#34446A', antiga: '#8F9AB0', art: '#4A6192', cadastro: '#A9B4C9', rascunho: '#566075' };
const rotuloSecao = { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#566075' } as const;
const link = { fontSize: 13, fontWeight: 600 } as const;

/** Seletor de revisão em botões segmentados (Rev. 2 · sistema | Rev. 1 · Excel). */
export function SeletorRevisao({ vistas, atual, escolher }: { vistas: VistaPlano[]; atual: IdVista; escolher: (id: IdVista) => void }) {
  return (
    <Box role="group" aria-label="Revisão exibida" sx={{ display: 'flex', border: '1px solid #34446A', borderRadius: '3px', overflow: 'hidden' }}>
      {vistas.map((v) => {
        const on = v.id === atual;
        return (
          <Box key={v.id} component="button" type="button" aria-pressed={on} onClick={() => escolher(v.id)}
            sx={{ flex: 1, minHeight: 36, px: 0.75, border: 0, borderLeft: '1px solid #34446A', '&:first-of-type': { borderLeft: 0 }, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', bgcolor: on ? '#34446A' : '#FFFFFF', color: on ? '#FFFFFF' : '#34446A', '&:hover': on ? undefined : { bgcolor: '#E6E9F0' } }}>
            {v.rotulo}
          </Box>
        );
      })}
    </Box>
  );
}

function SituacaoRascunho({ calculo }: { calculo: ResultadoPlano }) {
  const s = calculo.situacaoSeguranca;
  const t = textoSituacao(calculo);
  const cor = s === 'ok' ? { bgcolor: '#EEF1F6', color: '#34446A', borderLeft: '4px solid #4A6192' } : { bgcolor: '#FBE1C6', color: '#8A3F04', borderLeft: '4px solid #C2610C' };
  return (
    <Box sx={{ ...cor, p: '10px 12px', borderRadius: '3px', fontSize: 13, lineHeight: 1.45 }} role="status">
      <b>Segurança: {ROTULO_SEGURANCA[s]}</b>
      <div>{t.texto}</div>
      {!calculo.podeEmitir && s !== 'bloqueado' && <div>Ainda não pode ser emitido: veja o checklist na etapa 6.</div>}
    </Box>
  );
}

export interface PropsLateral {
  plano: PlanoRigging;
  calculo: ResultadoPlano;
  vistas: VistaPlano[];
  vista: VistaPlano;
  escolher: (id: IdVista) => void;
}

/** Coluna direita: revisão exibida, ações do plano e resumo de revisões e histórico. */
export function Lateral({ plano, calculo, vistas, vista, escolher }: PropsLateral) {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const perfil = usuario?.perfil;
  const emitido = plano.situacaoDocumento === 'emitido';
  const historico = resumoHistorico(plano);
  return (
    <Box component="aside" aria-label="Revisões e ações do plano" sx={{ width: { lg: 290 }, flexShrink: 0, bgcolor: '#FFFFFF', borderLeft: { lg: '1px solid #D5DAE3' }, borderTop: { xs: '1px solid #D5DAE3', lg: 0 } }}>
      <Box sx={{ p: '16px 18px', borderBottom: '1px solid #E4E8EE', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>{emitido ? 'Revisão exibida' : 'Situação do rascunho'}</Typography>
          {emitido && <Dica tamanho={16}>Plano bloqueado para edição. Para qualquer mudança, crie uma nova revisão: as anteriores continuam guardadas como foram entregues.</Dica>}
        </Box>
        {!emitido && <SituacaoRascunho calculo={calculo} />}
        {vistas.length > 1 && <SeletorRevisao vistas={vistas} atual={vista.id} escolher={escolher} />}
        <Box sx={{ p: '10px 12px', borderRadius: '3px', fontSize: 12, lineHeight: 1.45, ...(vista.notaAlerta ? { bgcolor: '#FBE1C6', color: '#8A3F04' } : { bgcolor: '#EEF1F6', color: '#34446A' }) }}>{vista.nota}</Box>
        {emitido && (
          <>
            {pode(perfil, 'novaRevisao') && <Button variant="outlined" onClick={() => navegar(`/planos/${plano.numero}/revisao`)} sx={{ minHeight: 42, borderColor: '#34446A' }}>Criar nova revisão</Button>}
          </>
        )}
        {pode(perfil, 'editarRascunhos') && <Link component={RouterLink} to={`/planos/${plano.numero}/duplicar`} sx={link}>Duplicar para nova operação</Link>}
        {pode(perfil, 'verMemorial') && (
          <Link component={RouterLink} to={`/planos/${plano.numero}/memorial${vista.revisao ? `?rev=${vista.revisao.numero}` : ''}`} sx={{ ...link, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <LockOutlined sx={{ fontSize: 14 }} aria-hidden />Memorial de cálculo (interno · Administrador e Engenheiro)
          </Link>
        )}
      </Box>
      <Box sx={{ p: '14px 18px', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
          <Typography component="h2" sx={{ ...rotuloSecao, flexGrow: 1 }}>REVISÕES E HISTÓRICO</Typography>
          {pode(perfil, 'verHistorico') && <Link component={RouterLink} to={`/planos/${plano.numero}/historico`} sx={{ fontSize: 12, fontWeight: 600 }}>Ver tudo</Link>}
        </Box>
        {historico.map((h) => (
          <Box key={h.titulo + h.meta} sx={{ display: 'flex', gap: 1.25, py: 1, borderTop: '1px solid #EEF0F4' }}>
            <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: '5px', mt: '5px', flexShrink: 0, bgcolor: COR_MARCADOR[h.cor] }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{h.titulo}</Typography>
              <Typography sx={{ fontSize: 12, color: '#5A6478' }}>{h.meta}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
