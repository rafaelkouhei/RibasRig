// Plano emitido: somente leitura, com o arquivo salvo, links e o resumo gravado na revisão.
import { Box, Button, Typography } from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { enderecoObra } from '../../domain/art';
import { casasDe, dataBR, dataHoraBR, fmt, fmtPct, fmtUn } from '../../domain/formatacao';
import { NOME_POSICAO, pastaDe, revisaoAtual } from '../../domain/plano';
import type { PlanoRigging } from '../../domain/types';
import type { Cadastros } from './tipos';
import { COR, Info, TituloEtapa } from './ui';

const medida = (v: number | null) => (v == null ? '—' : fmt(v, casasDe(v)));

export function Emitido({ plano, cad, caminho, recemEmitido, novaRevisao }: {
  plano: PlanoRigging; cad: Cadastros; caminho: string; recemEmitido: boolean; novaRevisao: () => void;
}) {
  const rev = revisaoAtual(plano);
  const res = rev?.resultados;
  const cliente = cad.clientes.find((c) => c.id === plano.clienteId) ?? null;
  const g = res?.guindastes[0];
  const pasta = pastaDe(caminho);
  const linhas: [string, string][] = [
    ['Situação', `Emitido · Rev. ${rev?.numero ?? 1} · ${dataHoraBR(rev?.emitidaEm)}${rev?.emitidaPor ? ` · ${rev.emitidaPor}` : ''}`],
    ['Contratante', cliente?.razaoSocial ?? '—'],
    ['Local da obra', enderecoObra(plano.obra, cliente) || '—'],
    ['Data da operação', dataBR(res?.dataOperacao ?? plano.dataOperacao)],
    ['Carga', `${plano.carga.descricao || '—'} · ${fmtUn(res?.cargaKg ?? plano.carga.pesoKg, casasDe(res?.cargaKg ?? 0), 'kg')} · ${[plano.carga.comprimentoM, plano.carga.larguraM, plano.carga.alturaM].map(medida).join(' × ')} m`],
    ['Carga bruta (Pb)', fmtUn(res?.pbKg, 2, 'kg')],
    ['Guindaste', g ? `${g.modelo}${g.tabelaNome ? ` · ${g.tabelaNome}` : ''} · raio ${g.raioM != null ? fmt(g.raioM, Math.max(1, casasDe(g.raioM))) : '—'} m` : '—'],
    ['Capacidade no raio', res?.capacidadeKg != null ? `${fmtUn(res.capacidadeKg, 2, 'kg')} (${fmt(res.capacidadeKg / 1000, 2)} t)` : '—'],
    ['Taxa do guindaste', fmtPct(res?.taxaGuindastePct)],
    ['Acessórios', res?.posicoes.map((p) => `${cad.acessorios.find((a) => a.id === p.acessorioId)?.nomeCurto ?? NOME_POSICAO[p.posicao]} ${fmtPct(p.taxaPct)}`).join(' · ') || '—'],
    ['Esforço na sapata · RMET', `${fmtUn(res?.sapatas.esforcoKgf, 2, 'kgf')} · ${fmtUn(res?.sapatas.rmet, 2, 'kgf/cm²')}`],
    ['Laudo do guindaste', g?.laudoFim ? `válido até ${dataBR(g.laudoFim)}${g.laudoArt ? ` · ART do laudo ${g.laudoArt}` : ''}` : '—'],
    ['ART do plano', plano.art || '—'],
    ['Arquivo', rev?.arquivoPdf ?? '—'],
  ];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.75, p: '14px 16px', borderRadius: '3px', bgcolor: COR.okFundo, color: COR.marinho, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <CheckCircleOutline sx={{ fontSize: 22 }} />
        <Box sx={{ flexGrow: 1, fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>
          {recemEmitido ? <><strong>{rev?.arquivoPdf}</strong> salvo em {pasta}</> : <><strong>Plano nº {plano.numero} · Emitido · Rev. {rev?.numero}</strong> · {rev?.arquivoPdf}</>}
        </Box>
        <Button component={RouterLink} to={`/planos/${plano.numero}`} variant="outlined" sx={{ minHeight: 40, flexShrink: 0, borderColor: COR.marinho, bgcolor: '#fff' }}>Ver plano</Button>
        <Button component={RouterLink} to={`/planos/${plano.numero}/pdf`} variant="contained" sx={{ minHeight: 40, flexShrink: 0 }}>Abrir PDF</Button>
      </Box>
      <Info sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1, minWidth: 240 }}><b>Plano emitido · somente leitura.</b> Para mudar algo, crie uma nova revisão (Rev. {(rev?.numero ?? 0) + 1}); as revisões emitidas ficam guardadas como foram entregues.</Box>
        <Button variant="outlined" onClick={novaRevisao} sx={{ minHeight: 40, bgcolor: '#fff', borderColor: COR.marinho }}>Criar nova revisão</Button>
      </Info>
      <TituloEtapa titulo={`Resumo do plano nº ${plano.numero} · Rev. ${rev?.numero ?? 1}`} texto="Somente leitura. Estes são os resultados gravados na emissão; o plano emitido não é recalculado." />
      <Box component="dl" sx={{ m: 0, border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
        {linhas.map(([k, v], i) => (
          <Box key={k} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '210px minmax(0, 1fr)' }, gap: 1.75, p: '8px 14px', borderTop: i ? '1px solid #E4E8EE' : 0, fontSize: 14 }}>
            <Typography component="dt" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', color: COR.fraco, textTransform: 'uppercase', pt: '2px' }}>{k}</Typography>
            <Typography component="dd" sx={{ m: 0, fontSize: 14, color: COR.texto, overflowWrap: 'anywhere' }}>{v}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
