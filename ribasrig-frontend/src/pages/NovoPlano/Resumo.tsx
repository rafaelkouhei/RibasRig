// Resumo lateral dos cálculos: recalculado na hora no rascunho; no plano emitido, mostra os resultados gravados na revisão.
import { Box, Typography } from '@mui/material';
import { LIMITE_PCT, nivelTaxa } from '../../domain/calculos';
import { fmtPct, fmtUn } from '../../domain/formatacao';
import { NOME_POSICAO, ROTULO_POSICAO, textoSituacao, type ResultadoPlano } from '../../domain/plano';
import type { Acessorio, ResultadosRevisao, SituacaoSeguranca } from '../../domain/types';
import { BarraTaxa, COR, corNivel, taxaTexto } from './ui';

export interface LinhaTaxa { rotulo: string; taxa: number; nivel: SituacaoSeguranca; problema: boolean }

export interface DadosResumo {
  cargaKg: number;
  lingadaKg: number;
  /** null = tipo sem balancim */
  dispositivosKg: number | null;
  extrasKg: number;
  pbKg: number;
  capacidade: string;
  taxaGuindaste: number;
  nivelGuindaste: SituacaoSeguranca;
  acessorios: LinhaTaxa[];
  esforcoKgf: number;
  rmet: number;
  situacao: SituacaoSeguranca;
  titulo: string;
  texto: string;
  /** Limite mostrado em "ACESSÓRIOS (LIMITE x%)": o da revisão emitida ou o das Configurações */
  limitePct: number;
}

const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const n = (v: number | null | undefined) => (typeof v === 'number' ? v : NaN);

export function resumoDoCalculo(r: ResultadoPlano, aviso?: number): DadosResumo {
  const c = r.capacidade;
  const s = textoSituacao(r, aviso);
  return {
    cargaKg: r.cargaKg, lingadaKg: r.lingadaKg, dispositivosKg: r.balancim ? r.dispositivosKg : null, extrasKg: r.extrasKg, pbKg: r.pbKg,
    capacidade: c.tipo === 'exato' || c.tipo === 'interpolado' ? fmtUn(c.capacidadeKg, 2, 'kg') : !r.guindaste ? 'sem guindaste' : c.tipo === 'sem-grafico' ? 'sem gráfico' : c.tipo === 'fora-do-grafico' ? 'fora do gráfico' : '—',
    taxaGuindaste: r.taxaGuindaste, nivelGuindaste: r.nivelGuindaste,
    acessorios: r.porPosicao.map((x) => ({
      rotulo: x.governante ? `${cap1(x.governante.nomeCurto)} (${NOME_POSICAO[x.posicao]})` : ROTULO_POSICAO[x.posicao],
      taxa: x.taxaPct, nivel: x.nivel, problema: !!x.problema,
    })),
    esforcoKgf: r.sapatas.esforcoKgf, rmet: r.sapatas.rmet,
    situacao: r.situacaoSeguranca, titulo: s.titulo, texto: s.texto, limitePct: LIMITE_PCT,
  };
}

/** Resultados gravados na emissão (plano emitido não é recalculado). */
/** `limite`: o gravado na revisão (as Configurações podem ter mudado depois da emissão); sem ele, o atual. */
export function resumoDaRevisao(res: ResultadosRevisao, acessorios: Acessorio[], aviso: number, limite: number = LIMITE_PCT): DadosResumo {
  const nivel = nivelTaxa(n(res.taxaGuindastePct), aviso, limite);
  return {
    cargaKg: n(res.cargaKg), lingadaKg: n(res.lingadaKg), dispositivosKg: res.dispositivosKg, extrasKg: n(res.extrasKg), pbKg: n(res.pbKg),
    capacidade: fmtUn(res.capacidadeKg, 2, 'kg'),
    taxaGuindaste: n(res.taxaGuindastePct), nivelGuindaste: nivel,
    acessorios: res.posicoes.map((x) => {
      const a = acessorios.find((y) => y.id === x.acessorioId);
      return { rotulo: a ? `${cap1(a.nomeCurto)} (${NOME_POSICAO[x.posicao]})` : ROTULO_POSICAO[x.posicao], taxa: n(x.taxaPct), nivel: nivelTaxa(n(x.taxaPct), aviso, limite), problema: false };
    }),
    esforcoKgf: n(res.sapatas.esforcoKgf), rmet: n(res.sapatas.rmet),
    situacao: res.situacaoSeguranca,
    titulo: textoSituacao({ situacaoSeguranca: res.situacaoSeguranca, motivosBloqueio: [] }, aviso, limite).titulo,
    texto: 'Resultados gravados na emissão. Plano emitido não é recalculado.',
    limitePct: limite,
  };
}

const Linha = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.5, fontSize: 13 }}>
    <Box component="span" sx={{ color: COR.sec }}>{rotulo}</Box>
    <Box component="span" sx={{ fontWeight: 600, textAlign: 'right' }}>{valor}</Box>
  </Box>
);

export function Resumo({ d }: { d: DadosResumo }) {
  const tag = d.nivelGuindaste === 'bloqueado' ? 'Bloqueado' : d.nivelGuindaste === 'atencao' ? 'Atenção' : '';
  const caixa = d.situacao === 'bloqueado'
    ? { bgcolor: COR.alertaFundo, color: COR.alertaTexto, borderLeft: `4px solid ${COR.alertaTexto}` }
    : d.situacao === 'atencao' ? { bgcolor: COR.alertaFundo, color: COR.alertaTexto, borderLeft: `4px solid ${COR.alerta}` } : { bgcolor: COR.okFundo, color: COR.marinho };
  return (
    <Box component="aside" aria-label="Resumo dos cálculos" sx={{ bgcolor: '#fff', border: `1px solid ${COR.borda}`, borderRadius: '3px', display: 'flex', flexDirection: 'column', position: { lg: 'sticky' }, top: { lg: 16 }, overflow: 'hidden' }}>
      <Typography component="h2" sx={{ p: '10px 16px', bgcolor: COR.marinho, color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '1px' }}>RESUMO DOS CÁLCULOS</Typography>
      <Box sx={{ px: 2, py: 0.75 }}>
        <Linha rotulo="Carga líquida" valor={fmtUn(d.cargaKg, 2, 'kg')} />
        <Linha rotulo="Lingada / amarração" valor={fmtUn(d.lingadaKg, 2, 'kg')} />
        <Linha rotulo="Balancim / dispositivos" valor={d.dispositivosKg == null ? 'sem balancim' : fmtUn(d.dispositivosKg, 2, 'kg')} />
        <Linha rotulo="Cargas extras" valor={fmtUn(d.extrasKg, 2, 'kg')} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', pt: '7px', pb: '5px', borderTop: `1.5px solid ${COR.marinho}`, mt: 0.5 }}>
          <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: COR.marinho }}>Carga bruta (Pb)</Box>
          <Box component="span" sx={{ fontSize: 18, fontWeight: 700, color: COR.marinho }}>{fmtUn(d.pbKg, 2, 'kg')}</Box>
        </Box>
        <Linha rotulo="Capacidade no raio" valor={d.capacidade} />
      </Box>
      <Box sx={{ p: '8px 16px 10px', borderTop: '1px solid #E4E8EE', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: COR.marinho }}>Taxa do guindaste</Box>
          <span>
            {tag && <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: COR.alertaTexto, mr: 0.75 }}>{tag}</Box>}
            <Box component="span" sx={{ fontSize: 20, fontWeight: 700, color: corNivel(d.nivelGuindaste) }}>{fmtPct(d.taxaGuindaste)}</Box>
          </span>
        </Box>
        <BarraTaxa taxa={d.taxaGuindaste} nivel={d.nivelGuindaste} rotulo="Taxa de utilização do guindaste" />
      </Box>
      <Box sx={{ p: '6px 16px', borderTop: '1px solid #E4E8EE' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', color: COR.fraco, py: 0.25 }}>ACESSÓRIOS (LIMITE {d.limitePct}%)</Typography>
        {d.acessorios.length === 0 && <Typography sx={{ fontSize: 13, color: COR.alertaTexto, fontWeight: 600, py: 0.5 }}>Bloqueado · lingada sem acessórios</Typography>}
        {d.acessorios.map((a) => (
          <Box key={a.rotulo} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.4, fontSize: 13 }}>
            <Box component="span" sx={{ color: '#3A465E' }}>{a.rotulo}</Box>
            <Box component="span" sx={{ fontWeight: 700, textAlign: 'right', color: corNivel(a.nivel), whiteSpace: 'nowrap' }}>{a.problema ? 'Bloqueado · sem item' : taxaTexto(a.taxa, a.nivel)}</Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: '6px 16px', borderTop: '1px solid #E4E8EE' }}>
        <Linha rotulo="Esforço nas sapatas" valor={fmtUn(d.esforcoKgf, 2, 'kgf')} />
        <Linha rotulo="RMET" valor={fmtUn(d.rmet, 2, 'kgf/cm²')} />
      </Box>
      <Box role="status" sx={{ m: '4px 16px 12px', p: '10px 12px', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: 0.25, ...caixa }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{d.situacao === 'bloqueado' ? '! ' : ''}{d.titulo}</Typography>
        <Typography sx={{ fontSize: 12 }}>{d.texto}</Typography>
      </Box>
    </Box>
  );
}
