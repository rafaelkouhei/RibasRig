// Etapa 4 · Guindaste, capacidade no gráfico de carga, laudo, guindastes adicionais e sapatas.
import { Box, Button, IconButton, Link, MenuItem, TextField, Typography } from '@mui/material';
import WarningAmber from '@mui/icons-material/WarningAmber';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import Close from '@mui/icons-material/Close';
import { Link as RouterLink } from 'react-router-dom';
import { LIMITE_PCT, laudoAtual, nomeGrafico, situacaoLaudo, type CapacidadeNoGrafico } from '../../domain/calculos';
import { casasDe, dataBR, fmt, fmtPct, fmtUn, isoDeBR, numParaTexto } from '../../domain/formatacao';
import type { FormGuindasteAdicional } from '../../domain/plano';
import type { Guindaste, TabelaCapacidade } from '../../domain/types';
import type { PropsEtapa, Renovacao } from './tipos';
import { MODO_API } from '../../services/api';
import { escolherArquivo } from '../../services/arquivos';
import { Dica } from '../../components/Dica';
import { GraficoCapacidade } from '../../components/GraficoCapacidade';
import { Aviso, BarraTaxa, COR, CampoNum, ChipSituacao, GradeValores, Nota, Secao, TituloEtapa, ajudaCampo, corNivel, taxaTexto } from './ui';

const QUADRANTES = ['Lateral', 'Frontal', 'Traseiro'];
const lido1 = (x: number) => (Number.isFinite(x) ? fmt(x, Math.max(1, casasDe(x))) : '—');
const linhaGrade = (colunas: string) => ({ display: 'grid', gridTemplateColumns: { xs: '1fr', md: colunas }, gap: 2, alignItems: 'start' });

export interface PropsRenovacao {
  renov: Renovacao;
  mudarRenov: (patch: Partial<Renovacao>) => void;
  renovAberto: boolean;
  setRenovAberto: (v: boolean) => void;
  /** Laudo renovado anexado e cobrindo a data da operação */
  renovValida: boolean;
}

/** Com o servidor, escolhe o PDF de verdade (sobe para o cadastro ao emitir); no mock, só marca como anexado. */
async function selecionarLaudo(rv: PropsRenovacao) {
  if (MODO_API !== 'http') { rv.mudarRenov({ arquivo: true }); return; }
  const pdf = await escolherArquivo('.pdf,application/pdf');
  if (pdf) rv.mudarRenov({ arquivo: true, pdf });
}

/** Nome do PDF do laudo renovado (simulado). */
export const arquivoLaudoRenovado = (g: Guindaste) => `Laudo_${g.codigo}_renovado.pdf`;

// ---------------------------------------------------------------------------------------------
// Gráfico de carga (SVG) e textos da capacidade
// ---------------------------------------------------------------------------------------------

/** Gráfico de carga do guindaste com o ponto do raio de operação (capacidade interpolada) em destaque. */
function GraficoCarga({ tabela, raio, capacidade }: { tabela: TabelaCapacidade | null; raio: number; capacidade: CapacidadeNoGrafico }) {
  const temCap = capacidade.tipo === 'exato' || capacidade.tipo === 'interpolado';
  return (
    <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 380 } }}>
      <GraficoCapacidade pontos={tabela?.pontos ?? []} largura={380} altura={220}
        destaque={temCap ? { alcanceM: raio, capacidadeKg: capacidade.capacidadeKg } : null}
        rotulo={temCap ? `Gráfico de carga: no raio de ${fmt(raio, 2)} m a capacidade é ${fmt(capacidade.capacidadeKg, 2)} kg` : 'Gráfico de carga: capacidade por alcance'} />
    </Box>
  );
}

function textosCapacidade(c: CapacidadeNoGrafico, raio: number, modelo: string) {
  const faixa = 'alcanceMinM' in c ? `${fmt(c.alcanceMinM, 2)} a ${fmt(c.alcanceMaxM, 2)} m` : '';
  if (c.tipo === 'sem-grafico') return { nota: `Bloqueado · sem gráfico de carga cadastrado para o ${modelo}.`, formula: 'Cadastre o gráfico de carga em Cadastros › Guindastes.' };
  if (c.tipo === 'raio-invalido') return { nota: 'Bloqueado · informe um raio de operação válido.', formula: '' };
  if (c.tipo === 'fora-do-grafico') return { nota: `Bloqueado · raio fora do gráfico: ${lido1(raio)} m está fora de ${faixa}.`, formula: `Faixa do gráfico: ${faixa}.` };
  if (c.tipo === 'exato') return { nota: 'Raio consta direto no gráfico de carga.', formula: `C = ${fmt(c.capacidadeKg, 0)} kg (ponto de ${fmt(c.ponto.alcanceM, 2)} m)` };
  const { p1, p2 } = c;
  return {
    nota: `Interpolado entre ${fmt(p1.alcanceM, 2)} m (${fmt(p1.capacidadeKg, 0)} kg) e ${fmt(p2.alcanceM, 2)} m (${fmt(p2.capacidadeKg, 0)} kg).`,
    formula: `C = ${fmt(p1.capacidadeKg, 0)} + (${fmt(raio, 2)} − ${fmt(p1.alcanceM, 2)}) × (${fmt(p2.capacidadeKg, 0)} − ${fmt(p1.capacidadeKg, 0)}) ÷ (${fmt(p2.alcanceM, 2)} − ${fmt(p1.alcanceM, 2)}) = ${fmt(c.capacidadeKg, 2)} kg`,
  };
}

// ---------------------------------------------------------------------------------------------
// Laudo vencido e laudo renovado
// ---------------------------------------------------------------------------------------------

function AlertaLaudo({ p, g, rv }: { p: PropsEtapa; g: Guindaste; rv: PropsRenovacao }) {
  const original = situacaoLaudo(g, p.r.dataOperacao.iso);
  const l = laudoAtual(g);
  const data = dataBR(p.r.dataOperacao.iso);
  const iso = isoDeBR(rv.renov.validade);
  const dataOp = p.r.dataOperacao.iso;
  let msg = '', erro = false;
  if (rv.renov.validade.trim() && !iso) { msg = 'Use o formato dd/mm/aaaa.'; erro = true; }
  else if (iso && dataOp && iso < dataOp) { msg = `Essa validade não cobre a operação em ${data}.`; erro = true; }
  else if (iso && !rv.renov.arquivo) msg = `Validade lida: ${dataBR(iso)}. Falta anexar o PDF do laudo.`;
  else if (iso && rv.renov.arquivo) msg = `Laudo renovado aceito: válido até ${dataBR(iso)}.`;
  const vencido = original.situacao === 'vencido';

  const titulo = vencido ? 'Bloqueado · laudo vencido na data da operação'
    : original.situacao === 'nao-cadastrado' ? 'Bloqueado · guindaste sem laudo cadastrado' : 'Bloqueado · sem data da operação para conferir o laudo';
  const texto = vencido
    ? `A operação é em ${data} e o laudo do ${g.modelo} venceu em ${dataBR(original.fim)} (válido de ${dataBR(l?.inicio)} a ${dataBR(l?.fim)}). Um plano com equipamento sem laudo válido na data da operação não pode ser emitido.`
    : original.situacao === 'nao-cadastrado' ? `O ${g.modelo} não tem laudo no cadastro. Cadastre o laudo e a ART do laudo antes de usar este guindaste.`
    : 'Informe a data da operação na etapa 1: o laudo é conferido contra ela.';

  return (
    <>
      {!original.aprovado && !rv.renovValida && (
        <Box role="alert" sx={{ display: 'flex', gap: 1.75, p: '16px 18px', borderRadius: '3px', bgcolor: COR.alertaFundo, borderLeft: `4px solid ${COR.alerta}`, color: COR.alertaTexto }}>
          <WarningAmber sx={{ fontSize: 26, flexShrink: 0 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: COR.alertaTexto }}>{titulo}</Typography>
            <Typography sx={{ fontSize: 14, mt: 0.25 }}>{texto}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 1.5 }}>
              <Button variant="contained" onClick={() => p.irPara(1)} sx={{ minHeight: 40, fontSize: 13 }}>Mudar data da operação</Button>
              {vencido && <Button variant="outlined" onClick={() => rv.setRenovAberto(!rv.renovAberto)} sx={{ minHeight: 40, fontSize: 13, bgcolor: '#fff', color: COR.alertaTexto, borderColor: COR.alertaTexto }}>Anexar laudo renovado</Button>}
              <Button component={RouterLink} to="/guindastes" variant="outlined" sx={{ minHeight: 40, fontSize: 13, bgcolor: '#fff', borderColor: COR.bordaCampo }}>Atualizar no cadastro</Button>
            </Box>
          </Box>
        </Box>
      )}
      {rv.renovValida && iso && (
        <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 14px', borderRadius: '3px', bgcolor: COR.okFundo, color: COR.marinho, fontSize: 14 }}>
          <CheckCircleOutline sx={{ color: COR.azul, fontSize: 18 }} />
          <Box sx={{ flexGrow: 1 }}>Laudo renovado anexado: {rv.renov.pdf?.name ?? arquivoLaudoRenovado(g)} · válido até {dataBR(iso)}, cobre a operação em {data}. Ao emitir, ele é gravado no cadastro do guindaste.</Box>
          <Button variant="outlined" onClick={() => rv.setRenovAberto(!rv.renovAberto)} sx={{ minHeight: 36, fontSize: 13, bgcolor: '#fff', borderColor: COR.marinho }}>Alterar</Button>
        </Box>
      )}
      {rv.renovAberto && (vencido || rv.renovValida) && (
        <Box sx={{ p: '12px 14px', bgcolor: '#fff', border: '1px solid #BCC6DA', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: COR.marinho }}>Laudo renovado do {g.modelo}</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField label="Validade final do novo laudo (dd/mm/aaaa)" placeholder="dd/mm/aaaa" value={rv.renov.validade} onChange={(e) => rv.mudarRenov({ validade: e.target.value })}
              error={erro} helperText={msg || undefined} sx={{ width: 320 }} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
            <Box sx={{ pt: 0.5 }}>
              {rv.renov.arquivo ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 14, minHeight: 48 }}>
                  <InsertDriveFileOutlined sx={{ color: COR.marinho }} />
                  <span><b>{rv.renov.pdf?.name ?? arquivoLaudoRenovado(g)}</b> · anexado</span>
                  <Button variant="outlined" onClick={() => rv.mudarRenov({ arquivo: false, pdf: null })} sx={{ minHeight: 34, fontSize: 13, borderColor: COR.bordaCampo, color: COR.sec }}>Remover</Button>
                </Box>
              ) : (
                <Button variant="outlined" onClick={() => void selecionarLaudo(rv)} sx={{ minHeight: 44, fontSize: 13, borderColor: COR.marinho }}>Selecionar arquivo (PDF)</Button>
              )}
            </Box>
          </Box>
          <Nota>O laudo renovado passa a valer neste plano quando a nova validade cobre a data da operação ({data}) e o PDF está anexado. Ao emitir, ele é gravado no cadastro do guindaste.</Nota>
        </Box>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Guindastes adicionais
// ---------------------------------------------------------------------------------------------

const colAdic = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) 88px 88px 110px minmax(0, 1.3fr) minmax(0, 1fr) 36px', gap: 1.25, alignItems: 'start' } as const;
const inputTabela = { '& .MuiInputBase-input': { py: '7px', fontSize: 14 } };

function GuindastesAdicionais({ p, ativos }: { p: PropsEtapa; ativos: Guindaste[] }) {
  const { f, r, set } = p;
  const usados = (exceto: number) => [f.guindasteId, ...f.guindastesAdicionais.filter((_, j) => j !== exceto).map((a) => a.guindasteId)];
  const mudar = (k: number, patch: Partial<FormGuindasteAdicional>) => set('guindastesAdicionais', f.guindastesAdicionais.map((a, j) => (j === k ? { ...a, ...patch } : a)));
  const remover = (k: number, nome: string) => p.confirmar({ titulo: 'Remover guindaste adicional?', texto: `${nome} sai desta operação e a carga volta para os demais guindastes.`, acao: 'Remover' },
    () => set('guindastesAdicionais', f.guindastesAdicionais.filter((_, j) => j !== k)));
  const laudoP = r.laudo;
  return (
    <Box sx={{ border: `1px solid ${COR.borda}`, borderRadius: '3px', p: '12px 14px', display: 'flex', flexDirection: 'column', gap: 1.25, bgcolor: COR.cinza, overflowX: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: COR.marinho }}>Operação com mais de um guindaste</Typography>
        <Dica tamanho={16}>Cada guindaste recebe uma parte da carga bruta (Pb), é verificado no próprio gráfico de carga e precisa de laudo válido na data da operação. Não repita o mesmo modelo.</Dica>
      </Box>
      <Box sx={{ minWidth: 640, display: 'flex', flexDirection: 'column', gap: 0.75 }} role="table" aria-label="Guindastes da operação">
        <Box role="row" sx={{ ...colAdic, fontSize: 12, fontWeight: 600, letterSpacing: '0.6px', color: '#3A465E' }}>
          {['GUINDASTE', 'RAIO (M)', '% DA CARGA', 'CARGA', 'TAXA', 'LAUDO'].map((h) => <div role="columnheader" key={h}>{h}</div>)}<div role="columnheader"><Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Remover</Box></div>
        </Box>
        <Box role="row" sx={{ ...colAdic, alignItems: 'center', fontSize: 14 }}>
          <Box role="cell" sx={{ fontWeight: 700, color: COR.marinho }}>{r.guindaste?.modelo ?? '—'} (principal)</Box>
          <div role="cell">{f.raio || '—'}</div>
          <div role="cell">{fmtPct(r.pctPrincipal)}</div>
          <div role="cell">{fmtUn(r.pbPrincipalKg, 2, 'kg')}</div>
          <Box role="cell" sx={{ fontWeight: 700, color: corNivel(r.nivelGuindaste) }}>{taxaTexto(r.taxaGuindaste, r.nivelGuindaste)}</Box>
          <Box role="cell" sx={{ fontWeight: 700, color: laudoP.aprovado ? COR.marinho : COR.alertaTexto }}>{laudoP.texto}</Box>
          <div role="cell" />
        </Box>
        {f.guindastesAdicionais.map((a, k) => {
          const res = r.adicionais[k];
          const raio = ajudaCampo(r.campos[`adicionais.${k}.raio`], true);
          const pct = ajudaCampo(r.campos[`adicionais.${k}.pct`], true);
          const tx = !res ? '—' : res.repetido ? 'Bloqueado · modelo repetido' : res.capacidade.tipo === 'sem-grafico' ? 'Bloqueado · sem gráfico cadastrado'
            : res.capacidade.tipo === 'fora-do-grafico' ? 'Bloqueado · raio fora do gráfico' : Number.isFinite(res.taxaPct) ? `${taxaTexto(res.taxaPct, res.nivel)} de ${fmt(res.capacidadeKg, 2)} kg` : 'Bloqueado · —';
          const nome = res?.guindaste?.modelo ?? `Guindaste adicional ${k + 1}`;
          const ocupados = usados(k);
          return (
            <Box role="row" key={k} sx={{ ...colAdic, fontSize: 14 }}>
              <div role="cell">
                <TextField select size="small" value={a.guindasteId ?? ''} error={!!res?.repetido} sx={inputTabela}
                  onChange={(e) => { const id = Number(e.target.value); const g = ativos.find((x) => x.id === id); mudar(k, { guindasteId: id, tabelaId: g?.tabelas[0]?.id ?? null }); }}
                  slotProps={{ select: { native: true }, htmlInput: { 'aria-label': `Guindaste adicional ${k + 1}` } }}>
                  {ativos.map((g) => <option key={g.id} value={g.id} disabled={ocupados.includes(g.id)}>{g.modelo}{ocupados.includes(g.id) ? ' (já na operação)' : ''}</option>)}
                </TextField>
              </div>
              <div role="cell">
                <TextField size="small" value={a.raio} onChange={(e) => mudar(k, { raio: e.target.value })} error={raio.erro} sx={inputTabela}
                  slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `Raio do guindaste adicional ${k + 1} (m)` } }} />
                {raio.texto && <Typography sx={{ fontSize: 12, color: raio.erro ? COR.alertaTexto : COR.marinho, fontWeight: raio.erro ? 600 : 400 }}>{raio.texto}</Typography>}
              </div>
              <div role="cell">
                <TextField size="small" value={a.pct} onChange={(e) => mudar(k, { pct: e.target.value })} error={pct.erro} sx={inputTabela}
                  slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `Percentual da carga do guindaste adicional ${k + 1}` } }} />
                {pct.texto && <Typography sx={{ fontSize: 12, color: pct.erro ? COR.alertaTexto : COR.marinho, fontWeight: pct.erro ? 600 : 400 }}>{pct.texto}</Typography>}
              </div>
              <Box role="cell" sx={{ pt: 1 }}>{fmtUn(res?.cargaKg ?? NaN, 2, 'kg')}</Box>
              <Box role="cell" sx={{ pt: 1, fontWeight: 700, color: !res || res.repetido || !Number.isFinite(res.taxaPct) ? COR.alertaTexto : corNivel(res.nivel) }}>{tx}</Box>
              <Box role="cell" sx={{ pt: 1, fontWeight: 600, color: res?.laudo.aprovado ? COR.marinho : COR.alertaTexto }}>{res?.laudo.texto ?? '—'}</Box>
              <div role="cell"><IconButton aria-label={`Remover ${nome}`} onClick={() => remover(k, nome)} size="small" sx={{ color: COR.fraco }}><Close fontSize="small" /></IconButton></div>
            </Box>
          );
        })}
        {r.divisaoInvalida && <Typography sx={{ fontSize: 13, color: COR.alertaTexto, fontWeight: 600 }}>Bloqueado · a divisão passa de 100%. Ajuste os percentuais.</Typography>}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------
// Etapa 4
// ---------------------------------------------------------------------------------------------

export function EtapaGuindaste(p: PropsEtapa & PropsRenovacao) {
  const { f, set, patch, r, cad, tentou } = p;
  const ativos = cad.guindastes.filter((g) => g.ativo || g.id === f.guindasteId);
  const g = cad.guindastes.find((x) => x.id === f.guindasteId) ?? null;
  const l = laudoAtual(g);
  const pend = (v: string | number | null | undefined, marcador: string) => (v == null || v === '' ? marcador : String(v));
  const temCap = r.capacidade.tipo === 'exato' || r.capacidade.tipo === 'interpolado';
  const txt = textosCapacidade(r.capacidade, r.raioM, g?.modelo ?? 'guindaste');
  const ref = r.referenciaConservadora;
  const faltaGeometria = !!g && (g.aM == null || g.bM == null || g.pgKgf == null);
  const multi = f.guindastesAdicionais.length > 0;

  const escolher = (v: string) => {
    const novo = cad.guindastes.find((x) => x.id === Number(v));
    if (!novo) return;
    if (f.guindastesAdicionais.some((a) => a.guindasteId === novo.id)) { p.notificar(`${novo.modelo} já está como guindaste adicional. Remova-o antes.`, 'warning'); return; }
    patch({ guindasteId: novo.id, tabelaId: novo.tabelas[0]?.id ?? null, lanca: numParaTexto(novo.comprimentoLancaM, 1) });
  };
  const adicionar = () => {
    const ocupados = [f.guindasteId, ...f.guindastesAdicionais.map((a) => a.guindasteId)];
    const livre = ativos.find((x) => !ocupados.includes(x.id));
    if (!livre) { p.notificar('Todos os guindastes cadastrados já estão nesta operação.', 'warning'); return; }
    set('guindastesAdicionais', [...f.guindastesAdicionais, { guindasteId: livre.id, tabelaId: livre.tabelas[0]?.id ?? null, raio: '5,0', pct: '50' }]);
  };

  const laudoNaOperacao = p.renovValida ? `renovado · válido até ${dataBR(isoDeBR(p.renov.validade))}` : r.laudo.texto;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TituloEtapa titulo="Guindaste, capacidade e patolamento" texto="Os dados do veículo, o gráfico de carga, o laudo e a geometria vêm do cadastro do guindaste." />
      <TextField select label="Guindaste *" value={f.guindasteId ?? ''} onChange={(e) => escolher(e.target.value)}
        error={tentou && !g} helperText={tentou && !g ? 'Escolha o guindaste.' : undefined}
        slotProps={{ select: { renderValue: (v) => { const x = cad.guindastes.find((y) => y.id === v); return x ? `${x.modelo}${x.placa ? ` · ${x.placa}` : ''}` : 'Escolha o guindaste'; }, displayEmpty: true } }}
        sx={{ '& .MuiSelect-select': { fontWeight: 600, fontSize: 16 } }}>
        {ativos.map((x) => (
          <MenuItem key={x.id} value={x.id} disabled={f.guindastesAdicionais.some((a) => a.guindasteId === x.id)}>
            {x.modelo}{x.placa ? ` · ${x.placa}` : ''}{x.dadosPendentes ? ' · dados pendentes no cadastro' : ''}
          </MenuItem>
        ))}
      </TextField>

      {g ? (
        <>
          <AlertaLaudo p={p} g={g} rv={p} />
          <GradeValores itens={[
            { k: 'CAMINHÃO', v: pend(g.veiculo, '[VEÍCULO]') }, { k: 'PLACA', v: pend(g.placa, '[PLACA]') }, { k: 'CHASSI', v: pend(g.chassi, '[CHASSI]') }, { k: 'ANO', v: pend(g.ano, '[ANO]') },
            { k: 'CAPACIDADE NOMINAL', v: g.capacidadeNominalT != null ? `${fmt(g.capacidadeNominalT, 1)} t` : '[CAPACIDADE]' },
            { k: 'LAUDO TÉCNICO', v: l?.fim ? `${dataBR(l.inicio)} a ${dataBR(l.fim)}` : '[VALIDADE]' },
            { k: 'ART DO LAUDO', v: pend(l?.art, '[ART DO LAUDO]') },
            { k: 'LAUDO NA DATA DA OPERAÇÃO', v: laudoNaOperacao, alerta: !r.laudo.aprovado },
          ]} />
          <Box sx={linhaGrade('minmax(0, 2fr) minmax(0, 1fr)')}>
            {g.tabelas.length ? (
              <TextField select label="Gráfico de carga *" value={r.tabela?.id ?? ''} onChange={(e) => set('tabelaId', e.target.value)}>
                {g.tabelas.map((t) => <MenuItem key={t.id} value={t.id}>{nomeGrafico(t)}</MenuItem>)}
              </TextField>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 12px', border: `1.5px solid ${COR.alerta}`, borderRadius: '3px', bgcolor: COR.alertaFundo, color: COR.alertaTexto, fontSize: 14 }}>
                <Box sx={{ flexGrow: 1 }}><Typography sx={{ fontSize: 12 }}>Gráfico de carga *</Typography><b>Bloqueado · sem gráfico cadastrado</b></Box>
                <Link component={RouterLink} to="/guindastes" sx={{ fontSize: 13, fontWeight: 600, color: COR.marinho }}>Cadastrar gráfico</Link>
              </Box>
            )}
            <CampoNum label="Comprimento da lança (m) — sai na ficha" valor={f.lanca} mudar={(v) => set('lanca', v)} campo={r.campos.lanca} tentou={tentou}
              helperText="Informativo; o cálculo usa o gráfico." />
          </Box>
        </>
      ) : (
        <Box sx={{ p: '12px 14px', border: `1px dashed ${COR.bordaCampo}`, borderRadius: '3px', bgcolor: COR.cinza, fontSize: 14, color: '#3A465E' }}>
          Escolha o guindaste para ver o laudo, o gráfico de carga e a geometria das sapatas, que vêm do cadastro.
        </Box>
      )}

      <Secao nota={<>O raio de isolamento é a área sinalizada em volta do guindaste e sai na ficha, nos desenhos e no procedimento. O vento máximo vem das Configurações (padrão {fmt(cad.config.ventoPadraoMs, 1)} m/s) e pode ser alterado conforme o local.</>}>Raio, giro e isolamento</Secao>
      <Box sx={linhaGrade('minmax(0, 1.25fr) 120px 120px minmax(0, 0.9fr) minmax(0, 1.25fr)')}>
        <CampoNum label="Raio de operação (m)" valor={f.raio} mudar={(v) => set('raio', v)} campo={r.campos.raio} tentou={tentou} destaque />
        <TextField select label="Quadrante inicial" value={f.quadranteInicial} onChange={(e) => set('quadranteInicial', e.target.value)}>
          <MenuItem value=""><em>Escolha</em></MenuItem>
          {QUADRANTES.map((q) => <MenuItem key={q} value={q}>{q}</MenuItem>)}
        </TextField>
        <TextField select label="Quadrante final" value={f.quadranteFinal} onChange={(e) => set('quadranteFinal', e.target.value)}>
          <MenuItem value=""><em>Escolha</em></MenuItem>
          {QUADRANTES.map((q) => <MenuItem key={q} value={q}>{q}</MenuItem>)}
        </TextField>
        <CampoNum label="Vento máx. (m/s)" valor={f.vento} mudar={(v) => set('vento', v)} campo={r.campos.vento} tentou={tentou} />
        <CampoNum label="Raio de isolamento (m)" valor={f.isolamento} mudar={(v) => set('isolamento', v)} campo={r.campos.isolamento} tentou={tentou} />
      </Box>
      {!r.isolamentoOk && r.campos.isolamento?.erro?.startsWith('Menor') && (
        <Aviso><b>Bloqueado · raio de isolamento menor que o raio de operação.</b> A área isolada precisa cobrir todo o giro da carga. Ele vai nos desenhos e no procedimento (item 1 · Isolamento da área).</Aviso>
      )}

      <Secao>Capacidade de carga — interpolação no gráfico de carga</Secao>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: '12px 14px', borderRadius: '3px', flexWrap: { xs: 'wrap', md: 'nowrap' },
        ...(temCap ? { bgcolor: COR.okFundo, color: COR.marinho } : { bgcolor: COR.alertaFundo, color: COR.alertaTexto, border: `1.5px solid ${COR.alerta}` }) }}>
        <GraficoCarga tabela={r.tabela} raio={r.raioM} capacidade={r.capacidade} />
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{g ? nomeGrafico(r.tabela) : 'Guindaste não escolhido'}</Typography>
          <Typography sx={{ fontSize: 14 }}>{g ? txt.nota : 'Bloqueado · escolha o guindaste.'}</Typography>
          {g && txt.formula && <Typography sx={{ fontSize: 13, color: temCap ? '#3A465E' : COR.alertaTexto }}>{txt.formula}</Typography>}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.8px' }}>CAPACIDADE NO RAIO</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700 }}>{temCap ? `${fmt(r.capacidadeKg, 2)} kg` : '—'}</Typography>
            {temCap && <Typography sx={{ fontSize: 14 }}>({fmt(r.capacidadeKg / 1000, 2)} t)</Typography>}
          </Box>
          {ref && <Typography sx={{ fontSize: 13, color: '#3A465E' }}>Extensão que alcança {lido1(r.raioM)} m: {fmt(ref.capacidadeKg, 0)} kg · taxa {fmtPct(ref.taxaPct)} (referência conservadora)</Typography>}
        </Box>
      </Box>

      <Box sx={{ p: '12px 14px', border: `1px solid ${COR.borda}`, borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: COR.marinho }}>Taxa do guindaste</Typography>
          <Dica tamanho={16}>Abaixo de {fmt(cad.config.avisoAtencaoPct, 0)}%: dentro do limite · de {fmt(cad.config.avisoAtencaoPct, 0)}% a {LIMITE_PCT}%: atenção · acima de {LIMITE_PCT}%: bloqueado ({LIMITE_PCT}% exatos é permitido).</Dica>
          <Typography sx={{ fontSize: 13, color: COR.sec, flexGrow: 1 }}>
            {multi ? `Pb do principal (${fmtPct(r.pctPrincipal)})` : 'Pb'} {fmtUn(r.pbPrincipalKg, 2, 'kg')} ÷ capacidade {temCap ? fmtUn(r.capacidadeKg, 2, 'kg') : '—'}
          </Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: corNivel(r.nivelGuindaste) }}>{fmtPct(r.taxaGuindaste)}</Typography>
          <ChipSituacao nivel={r.nivelGuindaste} />
        </Box>
        <BarraTaxa taxa={r.taxaGuindaste} nivel={r.nivelGuindaste} rotulo="Taxa de utilização do guindaste principal" />
      </Box>

      {multi ? <GuindastesAdicionais p={p} ativos={ativos} /> : null}
      <Button onClick={adicionar} sx={{ alignSelf: 'flex-start', p: 0, minHeight: 0, color: COR.azul, fontSize: 14, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>+ Adicionar outro guindaste</Button>

      <Secao>Esforço nas sapatas e resistência do terreno</Secao>
      {faltaGeometria && <Aviso>Faltam dados do {g?.modelo} no cadastro (a, b ou Pg): o esforço nas sapatas e a RMET ficam sem resultado. <Link component={RouterLink} to="/guindastes" sx={{ color: COR.marinho, fontWeight: 600 }}>Completar no cadastro</Link></Aviso>}
      <Box sx={linhaGrade('repeat(3, minmax(0, 1fr))')}>
        <CampoNum label="Largura do dormente (cm)" valor={f.dormenteLargura} mudar={(v) => set('dormenteLargura', v)} campo={r.campos.dormenteLargura} tentou={tentou} />
        <CampoNum label="Comprimento do dormente (cm)" valor={f.dormenteComprimento} mudar={(v) => set('dormenteComprimento', v)} campo={r.campos.dormenteComprimento} tentou={tentou} />
        <CampoNum label="Dormentes por sapata" inteiro valor={f.dormenteQtd} mudar={(v) => set('dormenteQtd', v)} campo={r.campos.dormenteQtd} tentou={tentou} />
      </Box>
      <GradeValores itens={[
        { k: 'MOMENTO (Pb × Ro)', v: fmtUn(r.sapatas.momentoKgfm, 2, 'kgf·m') },
        { k: 'F = M ÷ (a + b)', v: fmtUn(r.sapatas.forcaKgf, 2, 'kgf') },
        { k: 'ESFORÇO NA SAPATA', v: fmtUn(r.sapatas.esforcoKgf, 2, 'kgf') },
        { k: 'RMET', v: fmtUn(r.sapatas.rmet, 2, 'kgf/cm²') },
      ]} />
      <Typography sx={{ fontSize: 12, color: COR.fraco }}>
        ES = Pg ÷ 2 + F, com Pg = {fmtUn(g?.pgKgf, 0, 'kgf')}, a = {fmtUn(g?.aM, 2, 'm')} e b = {fmtUn(g?.bM, 2, 'm')} do cadastro · RMET = ES ÷ (LD × CD × ND)
      </Typography>
    </Box>
  );
}
