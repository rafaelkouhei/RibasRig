import { useState } from 'react';
import { Alert, Box, Button, LinearProgress, Link, Paper, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { BarraPlano } from '../components/Cabecalho';
import { useCarregar } from '../hooks';
import { api } from '../services/api';
import { dataHoraBR } from '../domain/formatacao';
import type { EventoHistorico } from '../domain/types';
import { FILTROS, passaFiltro, TIPOS_EVENTO, type Filtro } from './visualizacao/historico';


export default function Historico() {
  const numero = useParams().numero ?? '';
  const { dados: eventos, carregando, erro, recarregar } = useCarregar(() => api.historicoPlano(numero), [] as EventoHistorico[], numero);
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const visiveis = eventos.filter((e) => passaFiltro(e, filtro));
  const nomeFiltro = FILTROS.find((f) => f.id === filtro)?.rotulo ?? '';
  const resumo = carregando ? 'Carregando eventos…'
    : filtro === 'tudo' ? (eventos.length === 1 ? 'Mostrando o único evento.' : `Mostrando todos os ${eventos.length} eventos.`)
    : `Mostrando ${visiveis.length} de ${eventos.length} eventos · filtro: ${nomeFiltro}.`;

  const filtros = (
    <Box role="group" aria-label="Filtrar eventos por tipo" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {FILTROS.map((f) => {
        const on = f.id === filtro;
        return (
          <Button key={f.id} aria-pressed={on} onClick={() => setFiltro(f.id)} variant={on ? 'contained' : 'text'}
            sx={{ minHeight: 40, ...(on ? {} : { bgcolor: '#E6E9F0', color: 'primary.main', '&:hover': { bgcolor: '#DDE2EC' } }) }}>
            {f.rotulo}&nbsp;<Box component="span" sx={{ fontWeight: 400 }}>({eventos.filter((e) => passaFiltro(e, f.id)).length})</Box>
          </Button>
        );
      })}
    </Box>
  );

  return (
    <Box>
      <BarraPlano
        voltar={`/planos/${numero}`}
        caminho={<><Link component={RouterLink} to="/">Planos de Rigging</Link> / <Link component={RouterLink} to={`/planos/${numero}`}>{numero}</Link> / Histórico</>}
        titulo={`Histórico de alterações · ${numero}`}
        acoes={filtros}
      />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5, alignItems: 'flex-start' }}>
        <Paper component="section" aria-labelledby="hist-titulo" sx={{ flexGrow: 1, minWidth: 0, width: { xs: '100%', md: 'auto' }, px: 2.75, py: 0.75 }}>
          <Typography id="hist-titulo" component="h2" sx={{ mt: 1.25, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#566075' }}>EVENTOS · MAIS NOVO PRIMEIRO</Typography>
          <Typography role="status" aria-live="polite" sx={{ fontSize: 13, color: 'text.secondary', pt: 0.5, pb: 1.25 }}>{resumo}</Typography>
          {carregando && <LinearProgress sx={{ mb: 2 }} />}
          {erro && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={recarregar}>Tentar de novo</Button>}>{erro}</Alert>}
          {!carregando && !erro && !visiveis.length && (
            <Typography sx={{ py: 2, borderTop: '1px solid #EEF0F4', color: 'text.secondary' }}>{eventos.length ? 'Nenhum evento deste tipo.' : 'Nenhum evento registrado para este plano.'}</Typography>
          )}
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visiveis.map((e) => <Evento key={e.id} e={e} />)}
          </Box>
        </Paper>
        <Box component="aside" sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Typography component="h2" sx={{ px: 2.25, py: 1.5, bgcolor: 'primary.main', color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Por que registrar</Typography>
            <Typography sx={{ px: 2.25, py: 1.75, fontSize: 14, color: '#3A465E', lineHeight: 1.5 }}>O plano é assinado sob ART. Se um número mudar, fica claro quem mudou, quando e qual era o valor antes.</Typography>
          </Paper>
          <Box sx={{ p: '12px 14px', bgcolor: '#F3F5F8', borderRadius: '3px', fontSize: 13, color: '#3A465E', lineHeight: 1.5 }}>
            Em laranja, com a etiqueta <Box component="b" sx={{ color: '#8A3F04' }}>Cálculo</Box>: mudanças que alteram os cálculos (peso, raio, guindaste, acessórios). Cada evento traz também a etiqueta do tipo: Emissão, Cálculo, Anexo, Cadastro ou Edição.
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Evento({ e }: { e: EventoHistorico }) {
  const t = TIPOS_EVENTO[e.tipo];
  return (
    <Box component="li" sx={{ display: 'flex', gap: 2, py: 1.75, borderTop: '1px solid #EEF0F4' }}>
      <Box component="span" aria-hidden sx={{ width: 12, height: 12, borderRadius: '6px', mt: '5px', flexShrink: 0, bgcolor: t.cor }} />
      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box component="span" sx={{ px: 1, py: '2px', borderRadius: '2px', fontSize: 12, fontWeight: 700, ...t.etiqueta }}>{t.nome}</Box>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600 }}>{e.titulo}</Typography>
        </Box>
        <Typography sx={{ fontSize: 14, color: '#3A465E' }}>{e.detalhe}</Typography>
      </Box>
      <Typography sx={{ textAlign: 'right', fontSize: 13, color: 'text.secondary', flexShrink: 0 }}>{e.usuario}<br />{dataHoraBR(e.quando)}</Typography>
    </Box>
  );
}
