// Plano de Rigging em 6 etapas: novo, editar (continua um rascunho), duplicar e nova revisão.
// Cálculo sempre pelo domínio (calcularPlano), salvamento automático na api e rascunho local.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Link, Skeleton, Typography } from '@mui/material';
import Check from '@mui/icons-material/Check';
import { ThemeProvider, createTheme, type Theme } from '@mui/material/styles';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, agora, MODO_API } from '../../services/api';
import { useCarregar } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { pode } from '../../auth/permissoes';
import { BarraPlano } from '../../components/Cabecalho';
import { useNotificacao } from '../../components/Notificacao';
import { camposArt, entradaArtDoPlano } from '../../domain/art';
import { laudoAtual } from '../../domain/calculos';
import { dataHoraBR, dataIsoValida, HOJE, isoDeBR } from '../../domain/formatacao';
import {
  ETAPAS, artsEmUso, calcularPlano, caminhoPlano, dadosVazios, pastaDe, formVazio, gravarRascunho, planoDoForm, revisaoAtual, rotuloDocumento,
  type Etapa, type FormPlano, type ResultadoPlano,
} from '../../domain/plano';
import type { DadosPlano, Guindaste, Laudo, PlanoRigging } from '../../domain/types';
import { abrirPlano, modoDaRota, preenchimentoDaRota } from './carregar';
import { DialogoArt } from './DialogoArt';
import { Emitido } from './Emitido';
import { EtapaAnexos } from './EtapaAnexos';
import { EtapaGuindaste, arquivoLaudoRenovado } from './EtapaGuindaste';
import { EtapaCarga, EtapaDados, EtapaLingada, EtapaRevisao } from './Etapas';
import { Resumo, resumoDaRevisao, resumoDoCalculo } from './Resumo';
import type { Cadastros, Mudar, PropsEtapa, Renovacao } from './tipos';
import { desktop, guardarNaPastaDoPlano, ondeFicou } from '../../services/arquivos';
import { COR, Info } from './ui';

/** Erros de campo em laranja (borda #C2610C, texto #8A3F04), como no protótipo. Só nesta tela. */
const temaErros = (t: Theme) => createTheme(t, {
  palette: { error: { main: COR.alerta, dark: COR.alertaTexto, contrastText: '#fff' } },
  components: {
    MuiFormHelperText: { styleOverrides: { root: { '&.Mui-error': { color: COR.alertaTexto, fontWeight: 600 } } } },
    MuiInputLabel: { styleOverrides: { root: { '&.Mui-error': { color: COR.alertaTexto } } } },
  },
});

const SEM_RENOVACAO: Renovacao = { validade: '', arquivo: false };
const mensagem = (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.');

async function buscarCadastros(): Promise<Cadastros> {
  const [guindastes, acessorios, clientes, tipos, config, planos] = await Promise.all([
    api.listarGuindastes(), api.listarAcessorios(), api.listarClientes(), api.listarTiposIcamento(), api.obterConfiguracoes(), api.listarPlanos(),
  ]);
  return { guindastes, acessorios, clientes, tipos, config, planos };
}

/** Laudo renovado anexado no plano, no formato do cadastro (fica atual). A ART do laudo continua a do cadastro até ser atualizada lá. */
function laudoRenovado(g: Guindaste, fimIso: string): Laudo {
  return { inicio: HOJE, fim: fimIso, art: laudoAtual(g)?.art ?? '', arquivo: arquivoLaudoRenovado(g), atual: true };
}
const comLaudo = (g: Guindaste, l: Laudo): Guindaste => ({ ...g, laudos: [...g.laudos.map((x) => ({ ...x, atual: false })), l] });

/** Etapa sem pendência (indicador na navegação). */
function etapaOk(r: ResultadoPlano, n: Etapa): boolean {
  if (n === 6) return r.podeEmitir;
  if (r.camposInvalidos.some((c) => c.etapa === n)) return false;
  const itens = r.checklist.filter((c) => c.etapa === n && c.id !== 'campos' && c.id !== 'art');
  if (!itens.every((c) => c.ok)) return false;
  if (n === 1) return !r.art.erro;
  if (n === 4) return Number.isFinite(r.sapatas.rmet) && !!r.guindaste;
  return true;
}

type EstadoSalvo = { estado: 'nunca' | 'salvando' | 'salvo' | 'erro'; quando?: string; erro?: string };
interface Pergunta { titulo: string; texto: string; acao: string; ok: () => void }

export default function NovoPlano() {
  return <ThemeProvider theme={temaErros}><Formulario /></ThemeProvider>;
}

function Formulario() {
  const { numero: numeroRota } = useParams();
  const { pathname, search, state: estadoRota } = useLocation();
  const modo = modoDaRota(pathname);
  const navegar = useNavigate();
  const notificar = useNotificacao();
  const { usuario } = useAuth();
  const login = usuario?.usuario;
  const cadastros = useCarregar<Cadastros | null>(buscarCadastros, null);
  const cad = cadastros.dados;

  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [plano, setPlano] = useState<PlanoRigging | null>(null);
  const [base, setBase] = useState<DadosPlano>(() => dadosVazios());
  const [f, setF] = useState<FormPlano>(() => formVazio());
  const [etapa, setEtapa] = useState<Etapa>(1);
  /** Maior etapa já aberta (as anteriores mostram ✓ ou ! na navegação) */
  const [vista, setVista] = useState<number>(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tentou, setTentou] = useState<Partial<Record<Etapa, boolean>>>({});
  const [versao, setVersao] = useState(0);
  const [versaoSalva, setVersaoSalva] = useState(0);
  const [salvo, setSalvo] = useState<EstadoSalvo>({ estado: 'nunca' });
  const [criadoAqui, setCriadoAqui] = useState(false);
  const [renovacoes, setRenovacoes] = useState<Record<number, Renovacao>>({});
  const [renovAberto, setRenovAberto] = useState(false);
  const [artAberto, setArtAberto] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [recemEmitido, setRecemEmitido] = useState(false);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);

  const planoRef = useRef<PlanoRigging | null>(null);
  const baseRef = useRef<DadosPlano>(base);
  const fRef = useRef<FormPlano>(f);
  const etapaRef = useRef<Etapa>(etapa);
  const versaoRef = useRef(0);
  const emAndamento = useRef(false);
  /** false depois que a tela fecha: um salvamento que termina tarde não navega mais */
  const vivo = useRef(true);
  useEffect(() => { fRef.current = f; etapaRef.current = etapa; baseRef.current = base; }, [f, etapa, base]);

  // ---------- abrir o plano conforme a rota ----------
  const cadPronto = !!cad;
  const recuperar = new URLSearchParams(search).has('rascunho');
  useEffect(() => {
    if (!cad) return;
    // Plano acabou de ser criado nesta tela e a rota passou para /editar: não recarrega
    if (modo === 'editar' && planoRef.current && planoRef.current.numero === numeroRota) return;
    let ativo = true;
    setEstado('carregando'); setErroCarga(null);
    abrirPlano(modo, numeroRota, cad.config, recuperar, modo === 'novo' ? preenchimentoDaRota(estadoRota) : undefined)
      .then((x) => {
        if (!ativo) return;
        if ('redirecionar' in x) { navegar(x.redirecionar, { replace: true }); return; }
        planoRef.current = x.plano;
        setPlano(x.plano); setBase(x.base); setF(x.form); setEtapa(x.etapa); setVista(x.etapa); setAviso(x.aviso);
        setTentou({}); setRecemEmitido(false); setRenovacoes({}); setRenovAberto(false); setCriadoAqui(false);
        versaoRef.current = x.sujo ? 1 : 0;
        setVersao(versaoRef.current); setVersaoSalva(0);
        setSalvo(x.plano ? { estado: 'salvo', quando: x.plano.atualizadoEm } : { estado: 'nunca' });
        setEstado('pronto');
        // A revisão foi aberta: a rota vira /editar, para Voltar ou F5 não abrirem outra revisão
        if (modo === 'revisao' && x.plano) navegar(`/planos/${x.plano.numero}/editar`, { replace: true });
      })
      .catch((e: unknown) => { if (ativo) { setErroCarga(mensagem(e)); setEstado('erro'); } });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadPronto, modo, numeroRota, tentativa]);

  const somenteLeitura = plano?.situacaoDocumento === 'emitido';

  // ---------- alterações ----------
  const tocar = () => { versaoRef.current += 1; setVersao(versaoRef.current); };
  const set: Mudar = (campo, valor) => { setF((a) => ({ ...a, [campo]: valor })); tocar(); };
  const patch = (p: Partial<FormPlano>) => { setF((a) => ({ ...a, ...p })); tocar(); };
  const irPara = (n: Etapa) => {
    setEtapa(n); setVista((v) => Math.max(v, n));
    if (planoRef.current) tocar(); // guarda a etapa onde parou (plano novo só é criado quando algo é digitado)
    window.scrollTo({ top: 0 });
  };

  // ---------- salvamento automático (api) + rascunho local ----------
  const salvar = useCallback(async () => {
    if (emAndamento.current) return; // quando terminar, o efeito abaixo agenda de novo
    emAndamento.current = true;
    const v = versaoRef.current;
    setSalvo({ estado: 'salvando' });
    try {
      const atual = planoRef.current;
      const dados: DadosPlano = { ...planoDoForm(fRef.current, atual ?? baseRef.current), etapaAtual: etapaRef.current };
      const p = atual ? await api.salvarRascunho({ ...atual, ...dados }) : await api.criarPlano(dados);
      planoRef.current = p;
      setPlano(p); setVersaoSalva(v);
      setSalvo({ estado: 'salvo', quando: p.atualizadoEm });
      // Tudo salvo na api: a cópia local deixa de ser necessária (se houve edição no meio, o efeito grava de novo)
      if (versaoRef.current === v) gravarRascunho(null);
      if (!atual) {
        setCriadoAqui(true);
        notificar(`Rascunho criado: plano nº ${p.numero}, gerado pelo sistema.`, 'info');
        if (vivo.current) navegar(`/planos/${p.numero}/editar`, { replace: true });
      }
    } catch (e) {
      setSalvo({ estado: 'erro', erro: mensagem(e) });
    } finally {
      emAndamento.current = false;
    }
  }, [navegar, notificar]);

  const sujo = versao !== versaoSalva;
  useEffect(() => {
    if (estado !== 'pronto' || somenteLeitura || !sujo || emitindo) return;
    gravarRascunho({ numero: planoRef.current?.numero ?? null, form: fRef.current, etapa: etapaRef.current, salvoEm: agora(), usuario: login });
    const t = setTimeout(() => { void salvar(); }, 800);
    return () => clearTimeout(t);
  }, [versao, versaoSalva, estado, somenteLeitura, sujo, emitindo, salvar, login]);

  // Ao sair da tela com edição pendente (menos de 0,8 s), salva na hora em vez de perder
  const pendenteRef = useRef(false);
  pendenteRef.current = estado === 'pronto' && !somenteLeitura && sujo && !emitindo;
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      if (pendenteRef.current) void salvarRef.current();
    };
  }, []);

  // ---------- cálculo ----------
  const gPrincipal = cad?.guindastes.find((g) => g.id === f.guindasteId) ?? null;
  const renov = (f.guindasteId != null ? renovacoes[f.guindasteId] : undefined) ?? SEM_RENOVACAO;
  const fimRenov = isoDeBR(renov.validade);
  const renovValida = !!gPrincipal && renov.arquivo && !!fimRenov && dataIsoValida(f.dataOperacao) && fimRenov >= f.dataOperacao;

  const r = useMemo(() => {
    if (!cad) return null;
    const guindastes = renovValida && gPrincipal && fimRenov
      ? cad.guindastes.map((g) => (g.id === gPrincipal.id ? comLaudo(g, laudoRenovado(g, fimRenov)) : g)) : cad.guindastes;
    return calcularPlano({
      form: f, numero: plano?.numero ?? '', acessorios: cad.acessorios, guindastes, tipos: cad.tipos, clientes: cad.clientes,
      configuracoes: cad.config, hoje: HOJE, artsEmUso: artsEmUso(cad.planos.filter((p) => p.numero !== plano?.numero)),
    });
  }, [cad, f, plano?.numero, renovValida, gPrincipal, fimRenov]);

  // ---------- emissão ----------
  const emitir = async () => {
    const atual = planoRef.current;
    if (!atual || !r?.podeEmitir || !cad) return;
    if (emAndamento.current) { notificar('Aguarde o salvamento do rascunho terminar e emita de novo.', 'info'); return; }
    // Com o servidor, o laudo renovado só vale com o PDF guardado (o nome sozinho não aprova o checklist lá)
    if (MODO_API === 'http' && renovValida && !renov.pdf) { notificar('Anexe de novo o PDF do laudo renovado antes de emitir.', 'warning'); return; }
    setEmitindo(true);
    try {
      const salvoAgora = await api.salvarRascunho({ ...atual, ...planoDoForm(f, atual), etapaAtual: 6 });
      if (renovValida && gPrincipal && fimRenov) {
        await api.salvarGuindaste(comLaudo(gPrincipal, laudoRenovado(gPrincipal, fimRenov)));
        if (renov.pdf) await api.enviarLaudoGuindaste(gPrincipal.id, renov.pdf);
        notificar(`Laudo renovado do ${gPrincipal.modelo} gravado no cadastro (válido até ${fimRenov.split('-').reverse().join('/')}).`, 'info');
      }
      const p = await api.emitirPlano(salvoAgora.numero);
      planoRef.current = p;
      setPlano(p); setVersaoSalva(versaoRef.current); setRecemEmitido(true); setRenovacoes({}); setRenovAberto(false); setArtAberto(false);
      gravarRascunho(null);
      cadastros.recarregar();
      const rev = revisaoAtual(p);
      const cliente = cad.clientes.find((c) => c.id === p.clienteId);
      const caminho = caminhoPlano(cad.config, cliente?.nomePasta ?? 'Sem cliente', p.numero, rev?.numero ?? 1);
      if (MODO_API === 'http' && rev) {
        // O servidor gerou o PDF na emissão; no aplicativo ele vai já para a pasta do cliente
        if (desktop()) {
          // Daqui em diante o plano JÁ está emitido: falha ao baixar ou gravar o PDF é aviso, nunca "erro na emissão"
          const salvo = await api.baixarPdfRevisao(p.numero, rev.numero)
            .then((pdf) => guardarNaPastaDoPlano(pdf, rev.arquivoPdf, { pastaRaiz: cad.config.pastaRaiz, pastaCliente: cliente?.nomePasta ?? 'Sem cliente', numero: p.numero }, 'Relatório'))
            .catch((e: unknown) => { notificar(`Plano emitido, mas o PDF não foi salvo na pasta: ${mensagem(e)} Use "Abrir PDF" para tentar de novo.`, 'warning'); return null; });
          if (salvo) notificar(`Plano emitido: ${ondeFicou(salvo, rev.arquivoPdf)}`);
        } else {
          notificar(`Plano emitido: ${rev.arquivoPdf} gerado. Use "Abrir PDF" para baixar.`);
        }
      } else {
        notificar(`Plano emitido: ${rev?.arquivoPdf} salvo em ${pastaDe(caminho)}`);
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      notificar(mensagem(e), 'error');
    } finally {
      setEmitindo(false);
    }
  };

  const criarNovaRevisao = () => {
    if (!plano) return;
    navegar(`/planos/${plano.numero}/revisao`);
  };

  // ---------- atalhos da tela do plano (a lista fica em components/Atalhos.tsx) ----------
  const teclas = useRef<((e: KeyboardEvent) => void) | null>(null);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => teclas.current?.(e);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);
  teclas.current = null;

  // ---------- carregando / erro ----------
  const voltar = '/';
  if (cadastros.erro && !cad) {
    return (
      <Box>
        <BarraPlano voltar={voltar} caminho="Planos de Rigging" titulo="Plano de Rigging" />
        <Alert severity="error" action={<Button color="inherit" onClick={cadastros.recarregar}>Tentar de novo</Button>}>Não foi possível carregar os cadastros: {cadastros.erro}</Alert>
      </Box>
    );
  }
  if (estado === 'erro') {
    return (
      <Box>
        <BarraPlano voltar={voltar} caminho={<><Link component={RouterLink} to="/">Planos de Rigging</Link>{numeroRota ? ` / nº ${numeroRota}` : ''}</>} titulo={numeroRota ? `Plano nº ${numeroRota}` : 'Plano de Rigging'} />
        <Alert severity="error" action={<Button color="inherit" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</Button>}>{erroCarga}</Alert>
      </Box>
    );
  }
  if (!cad || !r || estado !== 'pronto') {
    return (
      <Box>
        <BarraPlano voltar={voltar} caminho="Planos de Rigging" titulo={modo === 'novo' ? 'Novo Plano de Rigging' : `Plano nº ${numeroRota ?? ''}`} />
        <LinearProgress aria-label="Carregando o plano" sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' }, gap: 2.5 }}>
          <Skeleton variant="rectangular" height={520} />
          <Skeleton variant="rectangular" height={520} />
        </Box>
      </Box>
    );
  }

  // ---------- tela ----------
  const numero = plano?.numero ?? null;
  const cliente = cad.clientes.find((c) => c.id === f.clienteId) ?? null;
  const camposDaArt = camposArt(entradaArtDoPlano(numero ?? '—', planoDoForm(f, plano ?? base), cliente));
  const valida = Object.fromEntries(ETAPAS.map((e) => [e.n, etapaOk(r, e.n)])) as Record<Etapa, boolean>;
  const rev = plano ? revisaoAtual(plano) : null;
  const clientePlano = plano ? cad.clientes.find((c) => c.id === plano.clienteId) : null;
  const caminhoPdf = plano && rev ? caminhoPlano(cad.config, clientePlano?.nomePasta ?? 'Sem cliente', plano.numero, rev.numero) : '';
  const resumo = somenteLeitura && rev ? resumoDaRevisao(rev.resultados, cad.acessorios, rev.avisoAtencaoPct ?? cad.config.avisoAtencaoPct, rev.limitePct ?? undefined) : resumoDoCalculo(r, cad.config.avisoAtencaoPct);
  const titulo = (modo === 'novo' || modo === 'duplicar' || criadoAqui) && !somenteLeitura ? 'Novo Plano de Rigging' : `Plano nº ${numero ?? ''}`;

  const confirmar: PropsEtapa['confirmar'] = (q, ok) => setPergunta({ ...q, ok });
  const props: PropsEtapa = {
    f, set, patch, r, cad, numero, tentou: !!tentou[etapa], irPara, abrirArt: () => setArtAberto(true), notificar, confirmar,
  };
  const mudarRenov = (p: Partial<Renovacao>) => {
    if (f.guindasteId == null) return;
    const id = f.guindasteId;
    setRenovacoes((a) => ({ ...a, [id]: { ...(a[id] ?? SEM_RENOVACAO), ...p } }));
  };

  const proxima = () => {
    setTentou((t) => ({ ...t, [etapa]: true }));
    if ((etapa === 1 || etapa === 2) && !valida[etapa]) { notificar('Corrija os campos marcados antes de seguir.', 'warning'); return; }
    irPara(Math.min(6, etapa + 1) as Etapa);
  };

  // Ctrl+Enter próxima etapa · Alt+← etapa anterior · Ctrl+S salvar rascunho · Ctrl+P visualizar o plano (prévia / PDF)
  teclas.current = (e) => {
    if (document.querySelector('[role="dialog"]')) return; // janela aberta: as teclas são dela
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.altKey && e.key === 'Enter') {
      e.preventDefault();
      if (!somenteLeitura && etapa < 6) proxima();
    } else if (e.altKey && !ctrl && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!somenteLeitura && etapa > 1) irPara((etapa - 1) as Etapa);
    } else if (ctrl && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (somenteLeitura) notificar('Plano emitido: não há rascunho para salvar.', 'info');
      else if (sujo) void salvar();
      else notificar(plano ? 'O rascunho já está salvo.' : 'Nada para salvar ainda: o plano é criado quando você preenche o primeiro campo.', 'info');
    } else if (ctrl && !e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (plano) navegar(`/planos/${plano.numero}`);
      else notificar('Preencha o primeiro campo para o plano ganhar número; depois é possível visualizar.', 'info');
    }
  };

  const indicador = somenteLeitura
    ? <>Emitido em {dataHoraBR(rev?.emitidaEm)} · somente leitura</>
    : salvo.estado === 'salvando' ? <>Salvando rascunho…</>
    : salvo.estado === 'erro' ? <>Não foi possível salvar · <Link component="button" onClick={() => void salvar()} sx={{ fontSize: 13, fontWeight: 600, color: COR.alertaTexto, verticalAlign: 'baseline' }}>Tentar de novo</Link></>
    : salvo.estado === 'salvo' ? <>Rascunho salvo automaticamente{salvo.quando?.includes('T') ? ` às ${salvo.quando.slice(11, 13)}h${salvo.quando.slice(14, 16)}` : ''}</>
    : <>O rascunho é salvo automaticamente ao editar</>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: { xs: 'calc(100vh - 32px)', md: 'calc(100vh - 56px)' } }}>
      <BarraPlano
        voltar={voltar}
        caminho={<><Link component={RouterLink} to="/" sx={{ color: COR.marinho }}>Planos de Rigging</Link> / {numero ? `nº ${numero}` : 'Novo plano'}</>}
        titulo={titulo}
        selo={<Box component="span" sx={{ px: 1, py: '2px', borderRadius: '3px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          ...(somenteLeitura ? { bgcolor: COR.okFundo, color: COR.marinho, border: '1px solid #BCC6DA' } : { bgcolor: '#ECEFF3', color: '#3C4A5E', border: `1px solid ${COR.borda}` }) }}>
          {plano ? rotuloDocumento(plano) : 'Rascunho'}</Box>}
        acoes={
          <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: salvo.estado === 'erro' && !somenteLeitura ? COR.alertaTexto : COR.sec, flexShrink: 0 }}>
            {(somenteLeitura || salvo.estado === 'salvo' || salvo.estado === 'salvando') && <Check sx={{ fontSize: 16, color: COR.azul }} />}{indicador}
          </Box>
        }
      />

      {/* Navegação das etapas */}
      <Box component="nav" aria-label="Etapas do plano" sx={{ display: 'flex', bgcolor: '#fff', borderBottom: `1px solid ${COR.borda}`, mx: { xs: -2, md: '-36px' }, mt: -3, mb: 2.25, overflowX: 'auto' }}>
        {ETAPAS.map(({ n, rotulo }) => {
          const atual = !somenteLeitura && n === etapa;
          const visitada = n !== etapa && (n < etapa || n <= vista);
          const feita = somenteLeitura || (visitada && valida[n]);
          const pendente = !somenteLeitura && visitada && !valida[n];
          return (
            <Box component="button" type="button" key={n} onClick={() => irPara(n)} disabled={somenteLeitura} aria-current={atual ? 'step' : undefined}
              aria-label={`Etapa ${n}: ${rotulo}${feita ? ' (ok)' : pendente ? ' (com pendência)' : ''}`}
              sx={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.4, border: 0, borderBottom: `3px solid ${atual ? COR.marinho : 'transparent'}`, bgcolor: 'transparent', font: 'inherit', color: COR.texto, textAlign: 'left', cursor: somenteLeitura ? 'default' : 'pointer', '&:hover:not(:disabled)': { bgcolor: '#F3F5F8' } }}>
              <Box component="span" aria-hidden="true" sx={{ width: 30, height: 30, borderRadius: '15px', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0,
                bgcolor: atual ? COR.marinho : feita ? COR.azul : pendente ? COR.alertaFundo : '#E6E9F0', color: atual || feita ? '#fff' : pendente ? COR.alertaTexto : COR.sec }}>
                {feita ? '✓' : pendente ? '!' : n}
              </Box>
              <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box component="span" sx={{ fontSize: 12, letterSpacing: '0.8px', color: COR.fraco }}>ETAPA {n}</Box>
                <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{rotulo}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Conteúdo + resumo */}
      <Box sx={{ flexGrow: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' }, gap: 2.5, alignItems: 'start', mb: 2.5 }}>
        <Box component="section" aria-label={somenteLeitura ? 'Plano emitido' : `Etapa ${etapa}`} sx={{ bgcolor: '#fff', border: `1px solid ${COR.borda}`, borderRadius: '3px', p: { xs: 2, md: '20px 24px' }, minWidth: 0 }}>
          {aviso && !somenteLeitura && <Info sx={{ mb: 2 }}>{aviso}</Info>}
          {somenteLeitura && plano ? (
            <Emitido plano={plano} cad={cad} caminho={caminhoPdf} recemEmitido={recemEmitido} novaRevisao={criarNovaRevisao} />
          ) : (
            <>
              {etapa === 1 && <EtapaDados {...props} criadoEm={plano?.criadoEm ?? null} />}
              {etapa === 2 && <EtapaCarga {...props} />}
              {etapa === 3 && <EtapaLingada {...props} />}
              {etapa === 4 && <EtapaGuindaste {...props} renov={renov} mudarRenov={mudarRenov} renovAberto={renovAberto} setRenovAberto={setRenovAberto} renovValida={renovValida} />}
              {etapa === 5 && <EtapaAnexos {...props} renov={renov} renovValida={renovValida} />}
              {etapa === 6 && <EtapaRevisao r={r} irPara={irPara} podeMemorial={pode(usuario?.perfil, 'verMemorial')} />}
            </>
          )}
        </Box>
        <Resumo d={resumo} />
      </Box>

      {/* Rodapé */}
      <Box component="footer" sx={{ position: 'sticky', bottom: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 68, px: { xs: 2, md: 3.5 }, mx: { xs: -2, md: '-36px' }, mb: { xs: -2, md: '-28px' }, bgcolor: '#fff', borderTop: `1px solid ${COR.borda}`, flexWrap: 'wrap' }}>
        {!somenteLeitura && etapa > 1 && <Button variant="outlined" onClick={() => irPara((etapa - 1) as Etapa)} sx={{ borderColor: COR.bordaCampo }}>← Etapa anterior</Button>}
        <Typography sx={{ flexGrow: 1, fontSize: 13, color: COR.fraco }}>
          {somenteLeitura ? `Plano emitido · somente leitura` : `Etapa ${etapa} de 6 · ${ETAPAS[etapa - 1].rotulo}`}
        </Typography>
        {!somenteLeitura && etapa < 6 && <Button variant="contained" onClick={proxima} sx={{ px: 3.25, fontSize: 15 }}>Próximo →</Button>}
        {!somenteLeitura && etapa === 6 && (r.podeEmitir && plano ? (
          <Button variant="contained" onClick={() => void emitir()} disabled={emitindo} sx={{ px: 3, fontSize: 15 }}>{emitindo ? 'Emitindo…' : `Emitir Rev. ${rev ? rev.numero + 1 : 1} e gerar o PDF`}</Button>
        ) : (
          <>
            <Typography sx={{ fontSize: 13, color: COR.alertaTexto, fontWeight: 600 }}>{r.podeEmitir ? 'Aguarde o salvamento do rascunho' : 'Resolva os itens da revisão para emitir'}</Typography>
            <Button variant="contained" disabled sx={{ px: 3, fontSize: 15, '&.Mui-disabled': { bgcolor: '#C9D0DC', color: '#3A465E' } }}>Emitir e gerar o PDF</Button>
          </>
        ))}
      </Box>

      <DialogoArt aberto={artAberto} fechar={() => setArtAberto(false)} numero={numero} campos={camposDaArt} f={f} set={set} erroArt={r.art.erro} />

      <Dialog open={!!pergunta} onClose={() => setPergunta(null)} aria-labelledby="titulo-confirmar" maxWidth="xs" fullWidth>
        <DialogTitle id="titulo-confirmar">{pergunta?.titulo}</DialogTitle>
        <DialogContent><DialogContentText>{pergunta?.texto}</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setPergunta(null)} sx={{ borderColor: COR.bordaCampo }}>Cancelar</Button>
          <Button variant="contained" onClick={() => { pergunta?.ok(); setPergunta(null); }}>{pergunta?.acao}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
