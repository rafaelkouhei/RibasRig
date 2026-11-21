import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, MenuItem, Skeleton, TextField, Tooltip, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Search from '@mui/icons-material/Search';
import Close from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import ChevronRight from '@mui/icons-material/ChevronRight';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCarregar } from '../hooks';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { EsquemaIcamento } from '../components/EsquemaIcamento';
import { Icone } from '../components/Icone';
import { useNotificacao } from '../components/Notificacao';
import { ID_BUSCA_PLANOS } from '../components/Atalhos';
import { HOJE, casasDe, dataBR, fmt, fmtPct } from '../domain/formatacao';
import { LIMITE_PCT, nivelTaxa, situacaoInspecao, situacaoLaudo } from '../domain/calculos';
import { ETAPAS, ROTULO_SEGURANCA, artsEmUso, calcularPlano, formDoPlano, gravarRascunho, lerRascunho, revisaoAtual, rotuloDocumento, type RascunhoLocal } from '../domain/plano';
import type { Acessorio, Cliente, Configuracoes, Guindaste, PlanoRigging, Revisao, SituacaoSeguranca, TipoIcamento } from '../domain/types';
import { cores } from '../theme';

// =============================================================================================
// Lógica pura (testada em Inicio.test.tsx)
// =============================================================================================

export interface Painel { planos: PlanoRigging[]; clientes: Cliente[]; guindastes: Guindaste[]; acessorios: Acessorio[]; tipos: TipoIcamento[]; configuracoes: Configuracoes }

async function carregarPainel(): Promise<Painel> {
  const [planos, clientes, guindastes, acessorios, tipos, configuracoes] = await Promise.all([
    api.listarPlanos(), api.listarClientes(), api.listarGuindastes(), api.listarAcessorios(), api.listarTiposIcamento(), api.obterConfiguracoes(),
  ]);
  return { planos, clientes, guindastes, acessorios, tipos, configuracoes };
}

/** minúsculas e sem acento, para a busca */
export const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const curtoGuindaste = (modelo: string) => modelo.replace(/^Palfinger\s+/, '');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** '2026-10' → 'Outubro de 2026' */
export const rotuloMes = (aaaamm: string) => { const m = MESES[Number(aaaamm.slice(5, 7)) - 1] ?? ''; return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${aaaamm.slice(0, 4)}`; };

/** Situação de segurança e motivos: emitido = o que foi gravado na revisão; rascunho = calcularPlano agora. */
export function segurancaDoPlano(p: PlanoRigging, painel: Painel): { situacao: SituacaoSeguranca; motivos: string[] } {
  if (p.situacaoDocumento === 'emitido') return { situacao: revisaoAtual(p)?.resultados.situacaoSeguranca ?? 'ok', motivos: [] };
  const outros = painel.planos.filter((x) => x.numero !== p.numero);
  const r = calcularPlano({ form: formDoPlano(p), numero: p.numero, acessorios: painel.acessorios, guindastes: painel.guindastes, tipos: painel.tipos,
    clientes: painel.clientes, configuracoes: painel.configuracoes, hoje: HOJE, artsEmUso: artsEmUso(outros) });
  return { situacao: r.situacaoSeguranca, motivos: r.motivosBloqueio };
}

/** Motivo curto para a linha da tabela: "taxa > 85%" (o limite em uso), "laudo vencido"… */
export function motivoCurto(motivo: string): string {
  if (motivo.startsWith('taxa acima')) return `taxa > ${LIMITE_PCT}%`;
  if (/^laudo .*vencido/.test(motivo)) return 'laudo vencido';
  if (motivo.includes('sem laudo')) return 'sem laudo';
  if (!motivoDeSeguranca(motivo)) return 'dados incompletos';
  return motivo;
}

/** Motivo de segurança (taxa, laudo, inspeção, gráfico, isolamento, divisão da carga). Os outros dizem que o rascunho está incompleto. */
export const motivoDeSeguranca = (m: string) =>
  m.startsWith('taxa acima') || /^laudo .*vencido/.test(m) || m.startsWith('acessório com inspeção') || m.startsWith('raio fora')
  || m.startsWith('raio de isolamento') || m.startsWith('sem gráfico') || m.startsWith('divisão da carga') || /^guindaste adicional .* repetido$/.test(m)
  || (m.endsWith(' sem laudo cadastrado') && !m.startsWith('guindaste não escolhido'));
export const motivoDeIncompleto = (m: string) => !motivoDeSeguranca(m);

/** Motivo para a lista "Precisa da sua atenção": laudo vencido fica "laudo vencido na data da operação (15/10/2026)". */
export function motivoAtencao(motivo: string, dataOperacao: string | null): string {
  if (/^laudo .*vencido/.test(motivo) && dataOperacao) return `laudo vencido na data da operação (${dataBR(dataOperacao)})`;
  return motivo;
}

export type TipoAcao = 'abrir' | 'continuar' | 'revisar';
export interface LinhaPlano {
  numero: string; cliente: string; exemplo: boolean; carga: string; guindaste: string;
  data: string; dataTipo: string; criadoMes: string; documento: string; emitido: boolean;
  bloqueado: boolean; motivos: string[]; acao: { tipo: TipoAcao; rotulo: string; para: string }; arquivoPdf: string | null;
}

export function linhaDoPlano(p: PlanoRigging, painel: Painel): LinhaPlano {
  const cliente = painel.clientes.find((c) => c.id === p.clienteId);
  const guindaste = painel.guindastes.find((g) => g.id === p.guindasteId);
  const { situacao, motivos } = segurancaDoPlano(p, painel);
  const emitido = p.situacaoDocumento === 'emitido';
  const bloqueado = !emitido && situacao === 'bloqueado';
  const peso = p.carga.pesoKg;
  const acao: LinhaPlano['acao'] = emitido ? { tipo: 'abrir', rotulo: 'Abrir', para: `/planos/${p.numero}` }
    : bloqueado && motivos[0]?.startsWith('taxa acima') ? { tipo: 'revisar', rotulo: 'Revisar cálculo', para: `/planos/${p.numero}/editar` }
      : { tipo: 'continuar', rotulo: 'Continuar', para: `/planos/${p.numero}/editar` };
  return {
    numero: p.numero, cliente: cliente?.razaoSocial ?? 'Contratante não informado', exemplo: !!(p.exemplo || cliente?.exemplo),
    carga: [p.carga.descricao || 'Carga não informada', peso != null ? `${fmt(peso, casasDe(peso))} kg` : ''].filter(Boolean).join(' · '),
    guindaste: guindaste ? curtoGuindaste(guindaste.modelo) : '—',
    data: emitido ? dataBR(p.dataOperacao ?? '') : dataBR(p.criadoEm.slice(0, 10)), dataTipo: emitido ? 'operação' : 'criado',
    criadoMes: p.criadoEm.slice(0, 7), documento: rotuloDocumento(p), emitido, bloqueado, motivos, acao,
    arquivoPdf: emitido ? revisaoAtual(p)?.arquivoPdf ?? null : null,
  };
}

/** A cópia local ainda vale? Sem número, sim. Com número: o plano existe, está em rascunho e não foi salvo depois dela. */
export function rascunhoPendente(r: RascunhoLocal, planos: PlanoRigging[]): boolean {
  if (!r.numero) return true;
  const p = planos.find((x) => x.numero === r.numero);
  return !!p && p.situacaoDocumento === 'rascunho' && r.salvoEm >= p.atualizadoEm;
}

export type Aba = 'todos' | 'rascunho' | 'bloqueado' | 'emitido';
export const ABAS: { id: Aba; rotulo: string }[] = [{ id: 'todos', rotulo: 'Todos' }, { id: 'rascunho', rotulo: 'Rascunhos' }, { id: 'bloqueado', rotulo: 'Bloqueados' }, { id: 'emitido', rotulo: 'Emitidos' }];
export const naAba = (l: LinhaPlano, a: Aba) => a === 'todos' || (a === 'rascunho' && !l.emitido) || (a === 'bloqueado' && l.bloqueado) || (a === 'emitido' && l.emitido);

/** Busca (nº, contratante, carga, guindaste; sem diferenciar acento) e período (mês de criação, 'todos' = sem filtro). */
export function filtrarLinhas(linhas: LinhaPlano[], busca: string, periodo: string): LinhaPlano[] {
  const q = semAcento(busca.trim());
  return linhas.filter((l) => (!q || [l.numero, l.cliente, l.carga, l.guindaste].some((c) => semAcento(c).includes(q))) && (periodo === 'todos' || l.criadoMes === periodo));
}

export interface ItemAtencao { id: string; tipo: 'laudo' | 'plano' | 'inspecao' | 'incompletos'; titulo: string; texto: string; numero?: string; para?: string; acao?: string }

/**
 * "Precisa da sua atenção": laudos vencidos/vencendo (HOJE), rascunhos bloqueados por motivo de segurança (motivo do cálculo),
 * inspeções vencidas/vencendo e, num item só, os rascunhos que estão bloqueados só por estarem incompletos.
 */
export function itensAtencao(painel: Painel, linhas: LinhaPlano[]): ItemAtencao[] {
  const itens: ItemAtencao[] = [];
  for (const g of painel.guindastes.filter((x) => x.ativo)) {
    const l = situacaoLaudo(g, HOJE);
    if (l.situacao === 'vencido') itens.push({ id: `laudo-${g.id}`, tipo: 'laudo', titulo: `Laudo do ${curtoGuindaste(g.modelo)}`, texto: `venceu em ${dataBR(l.fim ?? '')}`, para: '/guindastes', acao: 'Atualizar laudo' });
    else if (l.situacao === 'vence-em-breve') itens.push({ id: `laudo-${g.id}`, tipo: 'laudo', titulo: `Laudo do ${curtoGuindaste(g.modelo)}`, texto: l.texto, para: '/guindastes', acao: 'Atualizar laudo' });
  }
  const bloqueados = linhas.filter((x) => x.bloqueado);
  const incompletos = bloqueados.filter((x) => x.motivos.every(motivoDeIncompleto));
  for (const l of bloqueados.filter((x) => !incompletos.includes(x))) {
    const motivo0 = l.motivos.find((m) => !motivoDeIncompleto(m)) ?? l.motivos[0];
    const plano = painel.planos.find((p) => p.numero === l.numero);
    const motivo = motivo0 ?? 'bloqueado';
    itens.push({ id: `plano-${l.numero}`, tipo: 'plano', titulo: `${l.numero} bloqueado:`, texto: `${motivoAtencao(motivo, plano?.dataOperacao ?? null)}${l.exemplo ? ' (exemplo)' : ''}`, numero: l.numero });
  }
  for (const a of painel.acessorios.filter((x) => x.situacao === 'uso')) {
    const s = situacaoInspecao(a, HOJE);
    if (s.situacao !== 'vence-em-breve' && s.situacao !== 'vencida') continue;
    const nome = a.nomeCurto.charAt(0).toUpperCase() + a.nomeCurto.slice(1);
    itens.push({ id: `insp-${a.id}`, tipo: 'inspecao', titulo: nome, texto: `· ${s.motivo === 'validade' ? 'validade' : 'inspeção'} ${s.situacao === 'vencida' ? 'venceu' : 'vence'} em ${dataBR(s.proxima ?? '')}`, para: '/acessorios' });
  }
  if (incompletos.length) {
    const n = incompletos.length;
    itens.push({ id: 'incompletos', tipo: 'incompletos', titulo: n === 1 ? `Rascunho ${incompletos[0].numero}` : `${n} rascunhos`, texto: n === 1 ? 'incompleto: faltam dados para calcular' : `incompletos (${incompletos[0].numero} a ${incompletos[n - 1].numero}): faltam dados para calcular`, numero: n === 1 ? incompletos[0].numero : undefined });
  }
  return itens;
}

/** Último plano emitido = maior data de emissão da revisão atual. */
export function ultimoEmitido(planos: PlanoRigging[]): PlanoRigging | null {
  const emitidos = planos.filter((p) => p.situacaoDocumento === 'emitido' && revisaoAtual(p));
  emitidos.sort((a, b) => (revisaoAtual(b)?.emitidaEm ?? '').localeCompare(revisaoAtual(a)?.emitidaEm ?? ''));
  return emitidos[0] ?? null;
}

/** "Rev. 1 emitida no Excel, antes do sistema. Rev. 2 recalculada pelo sistema." */
export function historicoRevisoes(revisoes: Revisao[]): string {
  return revisoes.map((r, i) => r.origem === 'excel' ? `Rev. ${r.numero} emitida no Excel, antes do sistema.`
    : i > 0 ? `Rev. ${r.numero} recalculada pelo sistema.` : `Rev. ${r.numero} emitida pelo sistema.`).join(' ');
}

/** Barras do cartão: guindaste, maior taxa das cintas (pernas) e maior taxa das manilhas (carga e gancho). */
export function barrasDaRevisao(r: Revisao['resultados']): { rotulo: string; taxa: number }[] {
  const maior = (pos: string[]) => r.posicoes.filter((p) => pos.includes(p.posicao) && p.taxaPct != null).reduce((m, p) => Math.max(m, p.taxaPct ?? NaN), -Infinity);
  const valor = (v: number | null) => (v == null || !Number.isFinite(v) ? NaN : v);
  return [
    { rotulo: 'Guindaste', taxa: valor(r.taxaGuindastePct) },
    { rotulo: 'Cinta plana', taxa: valor(maior(['pernasInferiores', 'pernasSuperiores'])) },
    { rotulo: 'Manilha', taxa: valor(maior(['carga', 'gancho'])) },
  ];
}

// =============================================================================================
// Estilos
// =============================================================================================

const card = { bgcolor: '#fff', border: `1px solid ${cores.borda}`, borderRadius: '3px', overflow: 'hidden' } as const;
const rotuloPequeno = { fontSize: 12, fontWeight: 600, letterSpacing: '0.8px', color: '#4A5668' } as const;
const COLUNAS = '92px minmax(0, 1.3fr) minmax(0, 1fr) 96px 96px 176px 220px';
const botaoIcone = { width: 44, height: 40, borderRadius: '3px', border: `1px solid ${cores.borda}`, color: cores.marinho, '&:hover': { bgcolor: '#E6E9F0', borderColor: '#A9B4C9' } } as const;
const chip = { display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.5, borderRadius: '2px', fontSize: 12, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap' } as const;
const CHIP_ALERTA = { ...chip, bgcolor: cores.alertaFundo, color: '#8A3F04' } as const;
const CHIP_AZUL = { ...chip, bgcolor: '#DDE3EE', color: cores.marinho } as const;
const CHIP_CINZA = { ...chip, bgcolor: '#ECEFF3', color: '#3C4A5E' } as const;

// =============================================================================================
// Tela
// =============================================================================================

export default function Inicio() {
  const navegar = useNavigate();
  const local = useLocation();
  const { usuario } = useAuth();
  const podeEditar = pode(usuario?.perfil, 'editarRascunhos');
  const painel = useCarregar<Painel | null>(carregarPainel, null);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<Aba>('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [rascunho, setRascunho] = useState<RascunhoLocal | null>(() => lerRascunho());
  const campoBusca = useRef<HTMLInputElement>(null);

  // Atalho "/" ou Ctrl + K vindo de outra tela: foca a busca ao chegar
  const focarAoChegar = (local.state as { focarBusca?: boolean } | null)?.focarBusca;
  useEffect(() => {
    if (!focarAoChegar) return;
    campoBusca.current?.focus();
    navegar('.', { replace: true, state: null });
  }, [focarAoChegar, navegar]);

  const dados = painel.dados;
  const linhas = useMemo(() => (dados ? [...dados.planos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.numero.localeCompare(a.numero)).map((p) => linhaDoPlano(p, dados)) : []), [dados]);
  const filtradas = useMemo(() => filtrarLinhas(linhas, busca, periodo), [linhas, busca, periodo]);
  const visiveis = filtradas.filter((l) => naAba(l, aba));
  const meses = useMemo(() => [...new Set(linhas.map((l) => l.criadoMes))].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().reverse(), [linhas]);
  const atencao = useMemo(() => (dados ? itensAtencao(dados, linhas) : []), [dados, linhas]);
  const ultimo = dados ? ultimoEmitido(dados.planos) : null;

  const limparFiltros = () => { setBusca(''); setAba('todos'); setPeriodo('todos'); };
  const verPlano = (numero: string) => { setAba('todos'); setPeriodo('todos'); setBusca(numero); };

  // Cópia local velha (plano salvo depois, emitido ou apagado) sai sem perguntar
  useEffect(() => {
    if (dados && rascunho && !rascunhoPendente(rascunho, dados.planos)) { gravarRascunho(null); setRascunho(null); }
  }, [dados, rascunho]);
  const oferecerRascunho = !!dados && !!rascunho && podeEditar && (!rascunho.usuario || rascunho.usuario === usuario?.usuario) && rascunhoPendente(rascunho, dados.planos);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      {oferecerRascunho && dados && rascunho && <DialogoRecuperar rascunho={rascunho} painel={dados} fechar={() => setRascunho(null)} />}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.4px', color: cores.azul }}>PAINEL</Typography>
          <Typography variant="h1" sx={{ fontSize: 34, lineHeight: 1.1 }}>Planos de Rigging</Typography>
        </Box>
        <TextField id={ID_BUSCA_PLANOS} inputRef={campoBusca} label="Buscar plano" type="search" placeholder="Nº do plano, contratante ou carga" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ width: 380 }}
          slotProps={{ htmlInput: { autoComplete: 'off', 'aria-keyshortcuts': '/ Control+K' }, input: {
            sx: { height: 44 },
            startAdornment: <InputAdornment position="start"><Search sx={{ color: '#4A5668' }} /></InputAdornment>,
            endAdornment: busca ? <InputAdornment position="end"><IconButton aria-label="Limpar busca" onClick={() => { setBusca(''); campoBusca.current?.focus(); }} size="small"><Close fontSize="small" /></IconButton></InputAdornment> : undefined,
          } }} />
        {podeEditar && <Button variant="contained" startIcon={<Add />} component={RouterLink} to="/planos/novo" aria-keyshortcuts="Alt+N" sx={{ height: 44, px: 2.75, fontSize: 15, whiteSpace: 'nowrap' }}>Novo Plano de Rigging</Button>}
      </Box>

      {painel.erro && (
        <Alert severity="error" action={<Button color="inherit" onClick={painel.recarregar}>Tentar de novo</Button>}>Não foi possível carregar o painel: {painel.erro}</Alert>
      )}
      {painel.carregando && !dados && <Carregando />}

      {dados && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.75fr) minmax(0, 1fr)' }, gap: 2.25 }}>
            {ultimo ? <UltimoPlano plano={ultimo} painel={dados} podeEditar={podeEditar} /> :<Box sx={{ ...card, p: 2.5 }}><Typography color="text.secondary">Nenhum plano emitido ainda.</Typography></Box>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <PrecisaAtencao itens={atencao} verPlano={verPlano} verRascunhos={() => { setBusca(''); setPeriodo('todos'); setAba('rascunho'); }} />
              <Frota guindastes={dados.guindastes} />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="recentes" sx={card}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.25, borderBottom: `1px solid ${cores.borda}` }}>
              <Typography id="recentes" component="h2" sx={{ fontWeight: 600, fontSize: 16, color: cores.marinho, mr: 1.5 }}>Planos recentes</Typography>
              <Box role="tablist" aria-label="Filtrar por situação" sx={{ display: 'flex', gap: 0.75, flexGrow: 1 }}>
                {ABAS.map((a) => {
                  const on = aba === a.id;
                  return (
                    <Button key={a.id} role="tab" aria-selected={on} onClick={() => setAba(a.id)}
                      sx={{ minHeight: 40, height: 40, px: 1.75, fontSize: 13, bgcolor: on ? cores.marinho : '#EEF2F7', color: on ? '#fff' : cores.marinho, '&:hover': { bgcolor: on ? cores.marinho : '#E3E8F0' } }}>
                      {a.rotulo}&nbsp;<Box component="span" sx={{ opacity: 0.85 }}>{filtradas.filter((l) => naAba(l, a.id)).length}</Box>
                    </Button>
                  );
                })}
              </Box>
              <TextField select size="small" label="Criados em" value={periodo} onChange={(e) => setPeriodo(e.target.value)} sx={{ width: 200 }} slotProps={{ input: { sx: { height: 40, fontSize: 13 } } }}>
                <MenuItem value="todos">Todos</MenuItem>
                {meses.map((m) => <MenuItem key={m} value={m}>{rotuloMes(m)}</MenuItem>)}
              </TextField>
            </Box>
            <Box role="table" aria-label="Planos recentes" aria-rowcount={visiveis.length + 1}>
              <Box role="row" sx={{ display: 'grid', gridTemplateColumns: COLUNAS, gap: 1.5, px: 2.5, py: 1.1, bgcolor: '#EEF2F7', ...rotuloPequeno, color: '#3C4A5E' }}>
                {['Nº PLANO', 'CONTRATANTE', 'CARGA', 'GUINDASTE', 'DATA', 'SITUAÇÃO', 'AÇÕES'].map((c) => <div key={c} role="columnheader">{c}</div>)}
              </Box>
              {visiveis.map((l) => <LinhaTabela key={l.numero} l={l} podeEditar={podeEditar} />)}
            </Box>
            {visiveis.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2, borderTop: '1px solid #E6EBF1' }}>
                <Typography role="status" sx={{ flexGrow: 1, fontSize: 14, color: '#3C4A5E' }}>{mensagemVazia(busca, periodo, aba)}</Typography>
                <Button onClick={limparFiltros} sx={{ minHeight: 40, bgcolor: '#E6E9F0', color: cores.marinho, '&:hover': { bgcolor: '#D9DEE8' } }}>Limpar filtros</Button>
                {podeEditar && <Button variant="contained" component={RouterLink} to="/planos/novo" sx={{ minHeight: 40 }}>Novo Plano de Rigging</Button>}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

function mensagemVazia(busca: string, periodo: string, aba: Aba): string {
  const filtros: string[] = [];
  if (busca.trim()) filtros.push(`busca “${busca.trim()}”`);
  if (periodo !== 'todos') filtros.push(`criados em ${rotuloMes(periodo).toLowerCase()}`);
  if (aba !== 'todos') filtros.push(`situação “${ABAS.find((a) => a.id === aba)?.rotulo}”`);
  return `Nenhum plano encontrado${filtros.length ? ` com ${filtros.join(', ')}` : ''}. Confira o número ou crie um novo plano.`;
}

function Carregando() {
  return (
    <Box aria-busy="true" aria-label="Carregando o painel">
      <LinearProgress sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)', gap: 2.25, mb: 2.25 }}>
        <Skeleton variant="rectangular" height={330} />
        <Skeleton variant="rectangular" height={330} />
      </Box>
      <Skeleton variant="rectangular" height={220} />
    </Box>
  );
}

function LinhaTabela({ l, podeEditar }: { l: LinhaPlano; podeEditar: boolean }) {
  // Quem só consulta abre a prévia do rascunho em vez de editar
  const acao: LinhaPlano['acao'] = podeEditar || l.emitido ? l.acao : { tipo: 'abrir', rotulo: 'Ver', para: `/planos/${l.numero}` };
  const base = { width: 120, minHeight: 40, height: 40, px: 1, fontSize: 13, whiteSpace: 'nowrap' } as const;
  const estilo = acao.tipo === 'abrir' ? { ...base, bgcolor: cores.botao, color: '#fff', '&:hover': { bgcolor: cores.marinho } }
    : acao.tipo === 'revisar' ? { ...base, bgcolor: '#9A4A08', color: '#fff', '&:hover': { bgcolor: '#7E3C06' } }
      : { ...base, border: `1px solid ${cores.marinho}`, color: cores.marinho, bgcolor: '#fff' };
  return (
    <Box role="row" sx={{ display: 'grid', gridTemplateColumns: COLUNAS, gap: 1.5, px: 2.5, minHeight: 56, py: 0.75, alignItems: 'center', borderTop: '1px solid #E6EBF1', fontSize: 14, '&:hover': { bgcolor: '#F6F9FC' } }}>
      <Box role="cell" sx={{ fontWeight: 600, color: cores.marinho }}>{l.numero}</Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box component="span" title={l.cliente} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.cliente}</Box>
        {l.exemplo && <Box component="span" sx={{ flexShrink: 0, px: 1, py: 0.25, borderRadius: '2px', border: '1px dashed #8F9AB0', bgcolor: '#F3F5F8', color: '#3C4A5E', fontSize: 12, fontWeight: 600 }}>Exemplo</Box>}
      </Box>
      <Box role="cell" title={l.carga} sx={{ color: '#3C4A5E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.carga}</Box>
      <Box role="cell">{l.guindaste}</Box>
      <Box role="cell" sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span>{l.data}</span><Box component="span" sx={{ fontSize: 12, color: '#5A6478' }}>{l.dataTipo}</Box>
      </Box>
      <Box role="cell" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.4 }}>
        <Box component="span" sx={l.emitido ? CHIP_AZUL : CHIP_CINZA}>{l.documento}</Box>
        {l.bloqueado && (
          <Box component="span" title={l.motivos.join('; ')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, color: '#8A3F04' }}>
            <LockOutlined sx={{ fontSize: 13 }} />Bloqueado: {motivoCurto(l.motivos.find((m) => !motivoDeIncompleto(m)) ?? l.motivos[0] ?? '')}
          </Box>
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', gap: 0.75 }}>
        <Button component={RouterLink} to={acao.para} sx={estilo} aria-label={`${acao.rotulo} o plano ${l.numero}`}>{acao.rotulo}</Button>
        {podeEditar && (
          <Tooltip title={`Duplicar o plano ${l.numero} para nova operação`}>
            <IconButton component={RouterLink} to={`/planos/${l.numero}/duplicar`} aria-label={`Duplicar o plano ${l.numero} para nova operação`} sx={botaoIcone}><ContentCopy sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        )}
        {l.emitido && (
          <Tooltip title={l.arquivoPdf ? `PDF do plano ${l.numero}: ${l.arquivoPdf}` : `PDF do plano ${l.numero}`}>
            <IconButton component={RouterLink} to={`/planos/${l.numero}/pdf`} aria-label={`Ver o PDF do plano ${l.numero}`} sx={botaoIcone}><FileDownloadOutlined sx={{ fontSize: 19 }} /></IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

function PrecisaAtencao({ itens, verPlano, verRascunhos }: { itens: ItemAtencao[]; verPlano: (n: string) => void; verRascunhos: () => void }) {
  return (
    <Box component="section" aria-labelledby="atencao" sx={card}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.25, py: 1.5, borderBottom: `1px solid ${cores.borda}` }}>
        <Typography id="atencao" component="h2" sx={{ fontWeight: 600, fontSize: 15, color: cores.marinho, flexGrow: 1 }}>Precisa da sua atenção</Typography>
        {itens.length > 0 && <Box component="span" aria-label={`${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`} sx={{ minWidth: 24, height: 24, px: 0.75, boxSizing: 'border-box', borderRadius: '3px', bgcolor: '#9A4A08', color: '#fff', fontSize: 12, fontWeight: 600, display: 'grid', placeItems: 'center' }}>{itens.length}</Box>}
      </Box>
      {itens.length === 0 && <Typography sx={{ px: 2.25, py: 1.5, fontSize: 14 }} color="text.secondary">Nada pendente.</Typography>}
      {itens.map((it, i) => <LinhaAtencao key={it.id} item={it} primeira={i === 0} verPlano={(n) => (n ? verPlano(n) : verRascunhos())} />)}
    </Box>
  );
}

function LinhaAtencao({ item, primeira, verPlano }: { item: ItemAtencao; primeira: boolean; verPlano: (n: string | undefined) => void }) {
  const laudo = item.tipo === 'laudo';
  const icone: ReactNode = laudo ? <WarningAmberRounded sx={{ fontSize: 19, color: '#8A3F04' }} />
    : item.tipo === 'plano' ? <LockOutlined sx={{ fontSize: 17, color: '#8A3F04' }} />
      : item.tipo === 'incompletos' ? <EditNoteOutlined sx={{ fontSize: 18, color: '#4A5668' }} /> : <ScheduleOutlined sx={{ fontSize: 17, color: cores.alerta }} />;
  const sx = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, py: 1.25, pr: 2.25, pl: laudo ? 1.75 : 2.25, border: 0,
    borderTop: primeira ? 0 : '1px solid #E6EBF1', borderLeft: laudo ? `4px solid ${cores.alerta}` : 0,
    bgcolor: laudo ? cores.alertaFundo : '#fff', font: 'inherit', textAlign: 'left', textDecoration: 'none', cursor: 'pointer',
    '&:hover': { bgcolor: laudo ? '#F8D6B3' : '#F6F9FC' },
  } as const;
  const conteudo = (
    <>
      <Box sx={{ display: 'flex', flexShrink: 0 }}>{icone}</Box>
      <Box component="span" sx={{ flexGrow: 1, fontSize: 13, color: laudo ? '#8A3F04' : cores.texto }}><strong>{item.titulo}</strong> {item.texto}</Box>
      {item.acao ? <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: '#8A3F04', textDecoration: 'underline', whiteSpace: 'nowrap' }}>{item.acao}</Box>
        : <ChevronRight sx={{ fontSize: 18, color: '#4A5668', flexShrink: 0 }} />}
    </>
  );
  if (item.para) return <Box component={RouterLink} to={item.para} sx={sx}>{conteudo}</Box>;
  return <Box component="button" type="button" onClick={() => verPlano(item.numero)} aria-label={`${item.titulo} ${item.texto}. Mostrar na lista`} sx={sx}>{conteudo}</Box>;
}

function Frota({ guindastes }: { guindastes: Guindaste[] }) {
  const ativos = guindastes.filter((g) => g.ativo);
  return (
    <Box component="section" aria-labelledby="frota" sx={{ ...card, flexGrow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2.25, py: 1.5, borderBottom: `1px solid ${cores.borda}` }}>
        <Typography id="frota" component="h2" sx={{ fontWeight: 600, fontSize: 15, color: cores.marinho, flexGrow: 1 }}>Frota</Typography>
        <Box component={RouterLink} to="/guindastes" sx={{ fontSize: 13, fontWeight: 600, color: cores.marinho }}>Ver todos ({ativos.length})</Box>
      </Box>
      {ativos.slice(0, 2).map((g, i) => {
        const l = situacaoLaudo(g, HOJE);
        const descricao = g.dadosPendentes && !g.veiculo && !g.placa ? '[VEÍCULO] · [PLACA]'
          : [g.veiculo, g.placa, g.capacidadeNominalT != null ? `${fmt(g.capacidadeNominalT, 1)} t` : ''].filter(Boolean).join(' · ');
        const selo = g.dadosPendentes ? <Box component="span" sx={CHIP_AZUL}>Dados incompletos</Box>
          : l.situacao === 'vencido' ? <Box component="span" sx={CHIP_ALERTA}><WarningAmberRounded sx={{ fontSize: 14 }} />Laudo vencido</Box>
            : l.situacao === 'vence-em-breve' ? <Box component="span" sx={CHIP_ALERTA}><ScheduleOutlined sx={{ fontSize: 14 }} />Laudo vence em {l.dias} {l.dias === 1 ? 'dia' : 'dias'}</Box>
              : l.situacao === 'em-dia' ? <Box component="span" sx={CHIP_CINZA}>Laudo em dia</Box>
                : <Box component="span" sx={CHIP_ALERTA}>Sem laudo</Box>;
        return (
          <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.25, py: 1.25, borderTop: i ? '1px solid #E6EBF1' : 0 }}>
            <Box sx={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '3px', bgcolor: cores.fundo, color: cores.marinho }}>
              <Icone nome="guindastes" />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: cores.marinho }}>{g.modelo}</Typography>
              <Typography noWrap sx={{ fontSize: 12, color: '#4A5668' }}>{descricao || '—'}</Typography>
            </Box>
            {selo}
          </Box>
        );
      })}
    </Box>
  );
}

function UltimoPlano({ plano, painel, podeEditar }: { plano: PlanoRigging; painel: Painel; podeEditar: boolean }) {
  const rev = revisaoAtual(plano);
  if (!rev) return null;
  const r = rev.resultados;
  const cliente = painel.clientes.find((c) => c.id === plano.clienteId);
  const guindaste = painel.guindastes.find((g) => g.id === plano.guindasteId);
  const aviso = painel.configuracoes.avisoAtencaoPct;
  const titulo = `Içamento ${plano.carga.descricao} · ${cliente?.nomePasta ?? cliente?.razaoSocial ?? '—'}${plano.obra.nome ? ` (${plano.obra.nome})` : ''}`;
  const lanca = plano.comprimentoLancaM ?? guindaste?.comprimentoLancaM ?? null;
  const dados: [string, string][] = [
    ['GUINDASTE', guindaste ? curtoGuindaste(guindaste.modelo) : '—'],
    ['CARGA BRUTA (Pb)', r.pbKg != null ? `${fmt(r.pbKg)} kg` : '—'],
    ['CAPACIDADE NO RAIO', r.capacidadeKg != null ? `${fmt(r.capacidadeKg / 1000)} t` : '—'],
    ['RMET', r.sapatas.rmet != null ? `${fmt(r.sapatas.rmet)} kgf/cm²` : '—'],
  ];
  return (
    <Box component="section" aria-labelledby="ultimo" sx={{ ...card, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, px: 2.5, py: 1.6, bgcolor: cores.marinho, color: '#fff' }}>
        <Typography id="ultimo" component="h2" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.4px', color: cores.claro }}>ÚLTIMO PLANO EMITIDO</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: 17 }}>Nº {plano.numero} <Box component="span" sx={{ fontWeight: 400, color: '#DDE2EC' }}>· Rev. {rev.numero}</Box></Typography>
        <Box sx={{ flexGrow: 1 }} />
        {plano.art && <Typography sx={{ fontSize: 13, color: '#DDE2EC' }}>ART {plano.art}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', gap: 2.5, px: 2.5, pt: 2, pb: 1.5 }}>
        <Box sx={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{titulo}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{historicoRevisoes(plano.revisoes)}</Typography>
          <EsquemaIcamento lanca={lanca != null ? `${fmt(lanca, 1)} m` : '—'} raio={plano.raioM != null ? `${fmt(plano.raioM, 1)} m` : '—'} />
        </Box>
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1px', bgcolor: cores.borda, border: `1px solid ${cores.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
            {dados.map(([k, v]) => (
              <Box key={k} sx={{ px: 1.5, py: 1, bgcolor: '#fff' }}><Typography sx={rotuloPequeno}>{k}</Typography><Typography sx={{ fontWeight: 600, fontSize: 15, color: cores.marinho }}>{v}</Typography></Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: cores.marinho }}>Taxas de utilização</Typography>
            <Typography sx={{ fontSize: 12, color: '#8A3F04', display: 'flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 3, height: 14, bgcolor: cores.alerta }} />limite de segurança {LIMITE_PCT}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {barrasDaRevisao(r).map((b) => <Barra key={b.rotulo} rotulo={b.rotulo} taxa={b.taxa} aviso={aviso} />)}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, px: 2.5, pb: 2, mt: 'auto' }}>
        <Button component={RouterLink} to={`/planos/${plano.numero}`} sx={{ bgcolor: '#E6E9F0', color: cores.marinho, '&:hover': { bgcolor: '#D9DEE8' } }}>Abrir plano</Button>
        <Button component={RouterLink} to={`/planos/${plano.numero}/pdf`} variant="outlined" startIcon={<FileDownloadOutlined />} sx={{ borderColor: '#8F9AB0', bgcolor: '#fff' }}>Baixar PDF</Button>
        {podeEditar && <Button component={RouterLink} to={`/planos/${plano.numero}/duplicar`} variant="outlined" startIcon={<ContentCopy />} sx={{ borderColor: '#8F9AB0', bgcolor: '#fff' }}>Duplicar para nova operação</Button>}
      </Box>
    </Box>
  );
}

function Barra({ rotulo, taxa, aviso }: { rotulo: string; taxa: number; aviso: number }) {
  const nivel = nivelTaxa(taxa, aviso);
  const situacao = ROTULO_SEGURANCA[nivel];
  const cor = nivel === 'ok' ? cores.azul : nivel === 'atencao' ? cores.alerta : '#8A3F04';
  const largura = Number.isFinite(taxa) ? Math.max(0, Math.min(100, taxa)) : 0;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, fontSize: 13 }}>
        <Box component="span" sx={{ flexGrow: 1, color: '#3C4A5E' }}>{rotulo}</Box>
        <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: cores.texto }}>{fmtPct(taxa)}</Box>
        <Box component="span" sx={{ width: 112, textAlign: 'right', fontSize: 12, fontWeight: 600, color: nivel === 'ok' ? cores.marinho : '#8A3F04' }}>{situacao}</Box>
      </Box>
      <Box role="meter" aria-label={`Taxa de utilização: ${rotulo.toLowerCase()}`} aria-valuenow={Number.isFinite(taxa) ? Math.round(taxa * 100) / 100 : 0} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${fmtPct(taxa)} · ${situacao}`}
        sx={{ position: 'relative', height: 12, bgcolor: '#E4EAF1', borderRadius: '1px' }}>
        <Box sx={{ width: `${largura}%`, height: 12, bgcolor: cor, borderRadius: '1px' }} />
        <Box sx={{ position: 'absolute', left: `${LIMITE_PCT}%`, top: -4, width: 3, height: 20, bgcolor: cores.alerta }} />
      </Box>
    </Box>
  );
}

// =============================================================================================
// Rascunho recuperado (o programa fechou com um plano em edição)
// =============================================================================================

function DialogoRecuperar({ rascunho, painel, fechar }: { rascunho: RascunhoLocal; painel: Painel; fechar: () => void }) {
  const navegar = useNavigate();
  const notificar = useNotificacao();
  const [confirmando, setConfirmando] = useState(false);
  const f = rascunho.form;
  const cliente = painel.clientes.find((c) => c.id === f.clienteId);
  const guindaste = painel.guindastes.find((g) => String(g.id) === String(f.guindasteId));
  const etapa = ETAPAS.find((e) => e.n === rascunho.etapa);
  const quando = rascunho.salvoEm.slice(0, 10) === HOJE ? 'hoje' : `em ${dataBR(rascunho.salvoEm.slice(0, 10))}`;
  const hora = rascunho.salvoEm.slice(11, 16).replace(':', 'h');
  const calculo = calcularPlano({ form: f, numero: rascunho.numero ?? '', acessorios: painel.acessorios, guindastes: painel.guindastes, tipos: painel.tipos,
    clientes: painel.clientes, configuracoes: painel.configuracoes, hoje: HOJE, artsEmUso: artsEmUso(painel.planos.filter((p) => p.numero !== rascunho.numero)) });
  const motivo = calculo.situacaoSeguranca === 'bloqueado' ? calculo.motivosBloqueio[0] : null;
  const motivoTexto = motivo ? motivoAtencao(motivo, f.dataOperacao || null).replace(/^laudo vencido/, `laudo do ${guindaste ? curtoGuindaste(guindaste.modelo) : 'guindaste'} vencido`) : '';
  const nome = rascunho.numero ? `Rascunho ${rascunho.numero}` : 'Plano novo (ainda sem número)';
  const carga = [f.cargaDescricao, f.peso ? `${f.peso} kg` : ''].filter(Boolean).join(' ');
  const continuar = () => { fechar(); navegar(rascunho.numero ? `/planos/${rascunho.numero}/editar` : '/planos/novo?rascunho'); };
  const descartar = () => { gravarRascunho(null); fechar(); notificar(`${rascunho.numero ? `Rascunho ${rascunho.numero}` : 'Plano novo'} recuperado foi descartado.`); };

  return (
    <Dialog open onClose={fechar} maxWidth={false} slotProps={{ paper: { sx: { width: 560 } } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: '#fff', fontSize: 18, fontWeight: 600, py: 2, px: 2.75 }}>Continuar de onde parou?</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, px: 2.75, pt: '20px !important', pb: 2.75, fontSize: 15 }}>
        <Typography>O RibasRig foi fechado com um plano em edição. O rascunho foi recuperado:</Typography>
        <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start', p: 1.75, border: `1px solid ${cores.borda}`, borderRadius: '3px', bgcolor: '#F7F8FA' }}>
          <DescriptionOutlined sx={{ color: cores.marinho, fontSize: 26, flexShrink: 0 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            <Typography sx={{ fontWeight: 700, color: cores.marinho }}>{nome} · {cliente?.nomePasta ?? cliente?.razaoSocial ?? 'contratante não informado'}</Typography>
            <Typography sx={{ fontSize: 14, color: '#3A465E' }}>{[carga || 'Carga não informada', guindaste?.modelo ?? 'guindaste não escolhido'].join(' · ')}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Parou na etapa {rascunho.etapa}{etapa ? ` (${etapa.rotulo})` : ''} {quando}{hora ? ` às ${hora}` : ''} · salvo automaticamente</Typography>
            {motivo && (
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: 13, fontWeight: 600, color: '#8A3F04' }}>
                <LockOutlined sx={{ fontSize: 14 }} />Bloqueado: {motivoTexto}
              </Typography>
            )}
          </Box>
        </Box>
        {!confirmando ? (
          <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => setConfirmando(true)} sx={{ borderColor: '#8F9AB0' }}>Descartar</Button>
            <Button variant="contained" onClick={continuar} sx={{ px: 2.75 }} autoFocus>Continuar</Button>
          </Box>
        ) : (
          <Box role="alert" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: '14px 16px', border: `1.5px solid ${cores.alerta}`, borderRadius: '3px', bgcolor: cores.alertaFundo }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#8A3F04' }}>
              Descartar o {rascunho.numero ? `rascunho ${rascunho.numero}` : 'plano novo'} recuperado? O que foi feito depois do último salvamento será perdido.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => setConfirmando(false)} sx={{ borderColor: '#8F9AB0', bgcolor: '#fff' }} autoFocus>Cancelar</Button>
              <Button onClick={descartar} sx={{ bgcolor: '#9A4A08', color: '#fff', '&:hover': { bgcolor: '#7E3C06' } }}>Descartar</Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
