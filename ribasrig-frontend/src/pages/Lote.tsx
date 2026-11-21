import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, LinearProgress, MenuItem, TextField, Typography } from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCarregar } from '../hooks';
import { BarraPlano } from '../components/Cabecalho';
import { Dica } from '../components/Dica';
import { HOJE, casasDe, dataBR, dataIsoValida, fmt } from '../domain/formatacao';
import { FAIXAS, validarCampo, validarFaixa, type CampoValidado } from '../domain/validacao';
import { numerosParaLote } from '../domain/numeracao';
import { dadosVazios } from '../domain/plano';
import type { Cliente, DadosPlano, PlanoRigging } from '../domain/types';
import { cores } from '../theme';
import { dadosNovos } from './NovoPlano/carregar';

// =============================================================================================
// Lógica pura
// =============================================================================================

export interface FormLote {
  dataOperacao: string; descricao: string; clienteId: number | null; local: string;
  obraNome: string; obraEndereco: string; obraCidade: string; obraUf: string; obraCep: string;
  carga: string; peso: string; comprimento: string; largura: string; altura: string; quantidade: string;
}

/** Valor do seletor "Local da obra": índice do local cadastrado, endereço do contratante ou outro. */
export const LOCAL_CONTRATANTE = 'contratante';
export const LOCAL_OUTRO = 'outro';

const FAIXA_QTD = { ...FAIXAS.quantidade, unidade: '' };
export const validarQuantidade = (t: string): CampoValidado => validarFaixa(FAIXA_QTD, t);

/** Dimensão é opcional: vazio vale (fica sem valor no plano). */
const validarDimensao = (t: string): CampoValidado => (t.trim() === '' ? { valor: NaN, erro: null, lidoComo: null } : validarCampo('dimensao', t));

export function erroDataOperacao(iso: string): string | null {
  if (!iso) return 'Informe a data da operação.';
  if (!dataIsoValida(iso)) return 'Data inválida.';
  if (iso < HOJE) return `A data não pode ser anterior a hoje (${dataBR(HOJE)}).`;
  return null;
}

export interface ValidacaoLote {
  data: string | null; cliente: string | null; obraEndereco: string | null; obraCidade: string | null;
  peso: CampoValidado; comprimento: CampoValidado; largura: CampoValidado; altura: CampoValidado; quantidade: CampoValidado;
  total: number;
}

export function validarLote(f: FormLote): ValidacaoLote {
  const v = {
    data: erroDataOperacao(f.dataOperacao),
    cliente: f.clienteId == null ? 'Escolha o contratante.' : null,
    obraEndereco: f.obraEndereco.trim() ? null : 'Informe o endereço da obra.',
    obraCidade: f.obraCidade.trim() ? null : 'Informe a cidade.',
    peso: validarCampo('pesoCarga', f.peso),
    comprimento: validarDimensao(f.comprimento), largura: validarDimensao(f.largura), altura: validarDimensao(f.altura),
    quantidade: validarQuantidade(f.quantidade),
  };
  const total = [v.data, v.cliente, v.obraEndereco, v.obraCidade].filter(Boolean).length
    + [v.peso, v.comprimento, v.largura, v.altura, v.quantidade].filter((c) => c.erro).length;
  return { ...v, total };
}

/** "Injetora 3 de 10 · nº de série INJ-003" */
export const descricaoDoItem = (carga: string, i: number, total: number, serie: string) =>
  `${carga.trim() || 'Carga'} ${i + 1} de ${total}${serie.trim() ? ` · nº de série ${serie.trim()}` : ''}`;

/** Dados comuns do lote (o que é igual em todos os rascunhos). */
export function dadosDoLote(f: FormLote, v: ValidacaoLote, ventoPadraoMs: number | null): DadosPlano {
  const base = dadosVazios(ventoPadraoMs);
  const num = (c: CampoValidado) => (Number.isFinite(c.valor) ? c.valor : null);
  return {
    ...base,
    clienteId: f.clienteId, dataOperacao: f.dataOperacao, descricaoOperacao: f.descricao.trim(),
    obra: { mesmoEnderecoContratante: f.local === LOCAL_CONTRATANTE, nome: f.obraNome.trim(), endereco: f.obraEndereco.trim(), cidade: f.obraCidade.trim(), uf: f.obraUf.trim().toUpperCase(), cep: f.obraCep.trim() },
    carga: { descricao: f.carga.trim(), pesoKg: num(v.peso), comprimentoM: num(v.comprimento), larguraM: num(v.largura), alturaM: num(v.altura) },
    etapaAtual: 1,
  };
}

function obraDoLocal(cliente: Cliente | undefined, local: string): Pick<FormLote, 'obraNome' | 'obraEndereco' | 'obraCidade' | 'obraUf' | 'obraCep'> {
  if (cliente && local === LOCAL_CONTRATANTE) return { obraNome: cliente.nomePasta, obraEndereco: cliente.endereco, obraCidade: cliente.cidade, obraUf: cliente.uf, obraCep: cliente.cep };
  const l = cliente?.locaisObra[Number(local)];
  if (l) return { obraNome: l.nome, obraEndereco: l.endereco, obraCidade: l.cidade, obraUf: l.uf, obraCep: l.cep };
  return { obraNome: '', obraEndereco: '', obraCidade: '', obraUf: '', obraCep: '' };
}

const FORM_INICIAL: FormLote = {
  dataOperacao: '', descricao: 'Içamento de injetoras', clienteId: 1, local: '0',
  obraNome: 'Bosch', obraEndereco: 'Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial', obraCidade: 'Curitiba', obraUf: 'PR', obraCep: '81460-000',
  carga: 'Injetora', peso: '3.200', comprimento: '3,8', largura: '1,6', altura: '2,1', quantidade: '10',
};

// =============================================================================================
// Tela
// =============================================================================================

async function carregar() {
  const [planos, clientes, configuracoes] = await Promise.all([api.listarPlanos(), api.listarClientes(), api.obterConfiguracoes()]);
  return { planos, clientes, configuracoes };
}

const secao = { bgcolor: '#fff', border: `1px solid ${cores.borda}`, borderRadius: '3px' } as const;
/** Erro de campo em laranja, borda de 2 px, como no protótipo. */
const ERRO_LARANJA = {
  '& .MuiFormHelperText-root.Mui-error, & .MuiInputLabel-root.Mui-error': { color: '#8A3F04' },
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: cores.alerta, borderWidth: 2 },
  '& .MuiFormHelperText-root': { mx: 0.5 },
} as const;

function Grupo({ titulo, nota, exemplo }: { titulo: string; nota: string; exemplo?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
      <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: cores.azul }}>{titulo}</Typography>
      {exemplo && <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '2px', border: '1px dashed #8F9AB0', bgcolor: '#F3F5F8', color: '#3C4A5E', fontSize: 12, fontWeight: 600 }}>Exemplo</Box>}
      <Dica tamanho={16}>{nota}</Dica>
    </Box>
  );
}

export default function Lote() {
  const navegar = useNavigate();
  const dados = useCarregar(carregar, null);
  const [f, setF] = useState<FormLote>(FORM_INICIAL);
  const [series, setSeries] = useState<Record<number, string>>({});
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [criados, setCriados] = useState<PlanoRigging[] | null>(null);

  const v = useMemo(() => validarLote(f), [f]);
  const qtd = v.quantidade.erro ? 0 : v.quantidade.valor;
  const existentes = useMemo(() => dados.dados?.planos.map((p) => p.numero) ?? [], [dados.dados]);
  const numeracao = useMemo(() => {
    if (!dados.dados) return { numeros: [] as string[], primeiro: '', erro: null as string | null };
    try {
      const primeiro = numerosParaLote(HOJE, existentes, 1)[0];
      return { numeros: qtd ? numerosParaLote(HOJE, existentes, qtd) : [], primeiro, erro: null };
    } catch (e) { return { numeros: [], primeiro: '', erro: (e as Error).message }; }
  }, [dados.dados, existentes, qtd]);
  const { numeros, primeiro } = numeracao;
  const faixa = numeros.length > 1 ? `${numeros[0]} a ${numeros[numeros.length - 1]}` : numeros[0] ?? (primeiro ? `a partir de ${primeiro}` : '—');
  const clientes = dados.dados?.clientes ?? [];
  const cliente = clientes.find((c) => c.id === f.clienteId);

  const set = (k: keyof FormLote) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const escolherCliente = (id: number) => {
    const c = clientes.find((x) => x.id === id);
    const local = c?.locaisObra.length ? '0' : c?.endereco ? LOCAL_CONTRATANTE : LOCAL_OUTRO;
    setF((x) => ({ ...x, clienteId: id, local, ...obraDoLocal(c, local) }));
  };
  const escolherLocal = (local: string) => setF((x) => ({ ...x, local, ...obraDoLocal(cliente, local) }));

  const criar = async () => {
    setTentou(true);
    if (v.total || numeracao.erro || !dados.dados) return;
    setSalvando(true); setErroApi(null);
    try {
      const config = dados.dados.configuracoes;
      // Mesmo rigger/supervisor de um plano criado pelo formulário (o responsável técnico)
      const base = { ...dadosDoLote(f, v, config.ventoPadraoMs), rigger: dadosNovos(config).rigger };
      const lote = await api.criarLote(base, qtd);
      // Os rascunhos já existem: falha ao gravar o nº de série não pode levar a criar o lote de novo
      const series2 = await Promise.allSettled(lote.map((p, i) => api.salvarRascunho({ ...p, carga: { ...p.carga, descricao: descricaoDoItem(f.carga, i, lote.length, series[i] ?? '') } })));
      const falhas = series2.filter((s) => s.status === 'rejected').length;
      setCriados(series2.map((s, i) => (s.status === 'fulfilled' ? s.value : lote[i])));
      if (falhas) setErroApi(`Rascunhos criados, mas a descrição com o nº de série não foi gravada em ${falhas === 1 ? '1 plano' : `${falhas} planos`}. Ajuste no próprio plano.`);
    } catch (e) {
      setErroApi(e instanceof Error ? e.message : 'Não foi possível criar os rascunhos.');
    } finally { setSalvando(false); }
  };

  const mostra = (erro: string | null, preenchido: boolean) => (erro && (tentou || preenchido) ? erro : null);
  const campoNum = (c: CampoValidado, texto: string): { error: boolean; helperText: ReactNode } => {
    const erro = mostra(c.erro, texto.trim() !== '');
    return { error: !!erro, helperText: erro ?? c.lidoComo };
  };
  const erroData = mostra(v.data, f.dataOperacao !== '');
  const erroQtd = mostra(v.quantidade.erro, f.quantidade.trim() !== '');
  const rotuloCriar = !qtd ? 'Criar rascunhos' : qtd === 1 ? 'Criar 1 rascunho' : `Criar ${qtd} rascunhos`;
  const subtitulo = !qtd ? `nº a partir de ${primeiro || '—'}` : qtd === 1 ? `1 rascunho · nº ${faixa}` : `${qtd} rascunhos · nº ${faixa}`;

  return (
    <Box sx={ERRO_LARANJA}>
      <BarraPlano voltar="/planos/novo"
        caminho={<><RouterLink to="/">Planos de Rigging</RouterLink> / <RouterLink to="/planos/novo">Novo plano</RouterLink> / Lote</>}
        titulo="Planos em lote" selo={<Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{subtitulo}</Typography>} />

      {dados.erro && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={dados.recarregar}>Tentar de novo</Button>}>Não foi possível carregar os dados: {dados.erro}</Alert>}
      {dados.carregando && <LinearProgress sx={{ mb: 2 }} aria-label="Carregando" />}

      {/* Lista de números ao lado só a partir de 1400 px; em 1280 ela desce e o formulário usa a largura toda */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', '@media (min-width: 1400px)': { gridTemplateColumns: 'minmax(0, 1fr) 440px' }, gap: 2.5, alignItems: 'start' }}>
        <Box component="section" aria-labelledby="comuns" sx={{ ...secao, p: '18px 24px', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography id="comuns" component="h2" sx={{ fontSize: 20, fontWeight: 600, color: cores.marinho }}>Dados comuns a todos os planos</Typography>
            <Dica tamanho={20}>Vão para o cabeçalho, os desenhos, o procedimento e a ART de cada plano. Ex.: 10 injetoras idênticas.</Dica>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '210px 190px minmax(0, 1fr)', gap: 2, alignItems: 'start', mt: 0.75 }}>
            <TextField label="Nº dos planos (automático)" value={faixa} helperText="Gerados pelo sistema; não editáveis."
              slotProps={{ input: { readOnly: true, startAdornment: <LockOutlined sx={{ fontSize: 16, color: cores.marinho, mr: 0.75 }} />, sx: { bgcolor: '#F3F5F8', fontWeight: 700, color: cores.marinho } } }} />
            <TextField label="Data da operação" type="date" required value={f.dataOperacao} onChange={set('dataOperacao')} error={!!erroData} helperText={erroData}
              slotProps={{ htmlInput: { min: HOJE } }} />
            <TextField label="Descrição da operação" value={f.descricao} onChange={set('descricao')} />
          </Box>

          <Grupo titulo="CONTRATANTE" nota="Quem contrata o serviço e assina a ART." />
          <TextField select label="Contratante (razão social)" required value={clientes.length ? f.clienteId ?? '' : ''} onChange={(e) => escolherCliente(Number(e.target.value))}
            error={!!mostra(v.cliente, false)} helperText={mostra(v.cliente, false)}>
            {clientes.map((c) => <MenuItem key={c.id} value={c.id}>{c.razaoSocial}{c.exemplo ? ' (exemplo)' : ''}</MenuItem>)}
          </TextField>

          <Grupo titulo="LOCAL DA OBRA" nota="Onde o guindaste vai operar (pode ser outra empresa)." />
          <Box sx={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr) 130px', gap: 2, alignItems: 'start' }}>
            <TextField select label="Local" value={cliente ? f.local : ''} onChange={(e) => escolherLocal(e.target.value)}>
              {(cliente?.locaisObra ?? []).map((l, i) => <MenuItem key={`${i}-${l.nome}`} value={String(i)}>{l.nome}</MenuItem>)}
              {cliente?.endereco && <MenuItem value={LOCAL_CONTRATANTE}>Endereço do contratante</MenuItem>}
              <MenuItem value={LOCAL_OUTRO}>Outro local</MenuItem>
            </TextField>
            <TextField label="Empresa / planta" value={f.obraNome} onChange={set('obraNome')} />
            <TextField label="CEP" value={f.obraCep} onChange={set('obraCep')} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px 72px', gap: 2, alignItems: 'start' }}>
            <TextField label="Endereço da obra" required value={f.obraEndereco} onChange={set('obraEndereco')} error={!!mostra(v.obraEndereco, false)} helperText={mostra(v.obraEndereco, false)} />
            <TextField label="Cidade" required value={f.obraCidade} onChange={set('obraCidade')} error={!!mostra(v.obraCidade, false)} helperText={mostra(v.obraCidade, false)} />
            <TextField label="UF" value={f.obraUf} onChange={set('obraUf')} slotProps={{ htmlInput: { maxLength: 2 } }} />
          </Box>

          <Grupo titulo="CARGA" exemplo nota="Igual em todos os planos; substitua pelos dados da ficha da carga." />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px 88px 88px 88px', gap: 1.5, alignItems: 'start' }}>
            <TextField label="Descrição da carga" value={f.carga} onChange={set('carga')} />
            <TextField label="Peso unitário (kg)" required value={f.peso} onChange={set('peso')} {...campoNum(v.peso, f.peso)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            <TextField label="Compr. (m)" value={f.comprimento} onChange={set('comprimento')} {...campoNum(v.comprimento, f.comprimento)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            <TextField label="Larg. (m)" value={f.largura} onChange={set('largura')} {...campoNum(v.largura, f.largura)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            <TextField label="Alt. (m)" value={f.altura} onChange={set('altura')} {...campoNum(v.altura, f.altura)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box sx={{ px: 1.75, py: 1.25, bgcolor: '#F3F5F8', borderRadius: '3px', fontSize: 13 }}>
              <Box sx={{ fontWeight: 700, color: cores.marinho, mb: 0.25 }}>Igual em todos</Box>Contratante, local da obra, data e carga (guindaste, raio, lingada e dormentes você completa no plano)
            </Box>
            <Box sx={{ px: 1.75, py: 1.25, bgcolor: cores.alertaFundo, borderRadius: '3px', fontSize: 13, color: '#8A3F04' }}>
              <Box sx={{ fontWeight: 700, mb: 0.25 }}>Pedido em cada um</Box>Nº de série da carga (ao lado) e nº da ART
            </Box>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="planos-lote" sx={{ ...secao, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 230px)', minHeight: 420 }}>
          <Typography id="planos-lote" component="h2" sx={{ px: 2, py: 1.25, bgcolor: cores.marinho, color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '1px' }}>PLANOS DO LOTE</Typography>
          <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start', px: 2, pt: 2, pb: 0.5 }}>
            <TextField label="Quantidade" required value={f.quantidade} onChange={set('quantidade')} sx={{ width: 150, flexShrink: 0 }}
              error={!!erroQtd} slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-describedby': 'qtd-info', style: { fontWeight: 700 } } }} />
            <Typography id="qtd-info" sx={{ pt: 1.25, fontSize: 13, color: '#3A465E' }}>
              {numeracao.erro ?? (qtd ? `Números ${faixa}, na sequência de ${rotuloMesCurto(HOJE)}.` : 'Máximo de 50 planos por lote.')}
            </Typography>
          </Box>
          <Typography role={erroQtd ? 'alert' : undefined} sx={{ px: 2, pb: 1, minHeight: 20, fontSize: 12, color: '#8A3F04' }}>{erroQtd ?? ''}</Typography>
          <Box role="table" aria-label="Planos do lote" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flexGrow: 1 }}>
            <Box role="row" sx={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) 150px', gap: 1.25, px: 2, py: 1, bgcolor: '#EEF0F4', fontSize: 12, fontWeight: 600, letterSpacing: '0.8px', color: '#3A465E', borderTop: `1px solid ${cores.borda}` }}>
              <div role="columnheader">Nº PLANO</div><div role="columnheader">CARGA</div><div role="columnheader">Nº DE SÉRIE</div>
            </Box>
            <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
              {numeros.map((n, i) => (
                <Box role="row" key={n} sx={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) 150px', gap: 1.25, px: 2, height: 46, alignItems: 'center', borderTop: '1px solid #E6EBF1', fontSize: 14 }}>
                  <Box role="cell" sx={{ fontWeight: 700, color: cores.marinho }}>{n}</Box>
                  <Box role="cell" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${f.carga.trim() || 'Carga'} ${i + 1} de ${numeros.length}`}</Box>
                  <Box role="cell">
                    <Box component="input" aria-label={`Nº de série da carga do plano ${n}`} placeholder={`Ex.: INJ-${String(i + 1).padStart(3, '0')}`} value={series[i] ?? ''}
                      onChange={(e: { target: { value: string } }) => setSeries((s) => ({ ...s, [i]: e.target.value }))}
                      sx={{ width: '100%', height: 34, boxSizing: 'border-box', px: 1, border: '1px solid #8F9AB0', borderRadius: '3px', font: 'inherit', fontSize: 14, color: cores.texto, bgcolor: '#fff', '&::placeholder': { color: '#566075', opacity: 1 }, '&:focus': { outline: `2px solid ${cores.azul}`, outlineOffset: 0, borderColor: cores.azul } }} />
                  </Box>
                </Box>
              ))}
              {!numeros.length && <Typography sx={{ p: 2, fontSize: 14, color: '#566075' }}>Informe a quantidade para ver os números.</Typography>}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ ...secao, display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, px: 3, py: 1.25, position: 'sticky', bottom: 8, boxShadow: '0 -4px 12px rgba(31, 42, 64, 0.06)' }}>
        <Typography role="status" sx={{ flexGrow: 1, fontSize: 13, fontWeight: 600, color: '#8A3F04' }}>
          {erroApi ?? (tentou && v.total ? (v.total === 1 ? 'Corrija 1 campo marcado para criar os rascunhos.' : `Corrija ${v.total} campos marcados para criar os rascunhos.`) : '')}
        </Typography>
        <Button component={RouterLink} to="/planos/novo" variant="outlined" sx={{ borderColor: '#8F9AB0' }}>Cancelar</Button>
        <Button variant="contained" onClick={criar} disabled={salvando || !dados.dados || !!numeracao.erro}>{salvando ? 'Criando…' : rotuloCriar}</Button>
      </Box>

      {criados && <DialogoCriados criados={criados} form={f} cliente={cliente} v={v} comSerie={numeros.every((_, i) => (series[i] ?? '').trim() !== '')} irParaInicio={() => navegar('/')} />}
    </Box>
  );
}

/** '2026-10-07' → 'outubro/2026' */
function rotuloMesCurto(iso: string): string {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${meses[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

function DialogoCriados({ criados, form, cliente, v, comSerie, irParaInicio }: { criados: PlanoRigging[]; form: FormLote; cliente?: Cliente; v: ValidacaoLote; comSerie: boolean; irParaInicio: () => void }) {
  const n = criados.length;
  const primeiro = criados[0]?.numero ?? '';
  const ultimo = criados[n - 1]?.numero ?? '';
  const titulo = n === 1 ? `1 rascunho criado: ${primeiro}` : `${n} rascunhos criados: ${primeiro} a ${ultimo}`;
  const local = [form.obraNome.trim(), form.obraCidade.trim()].filter(Boolean).join(', ');
  const peso = v.peso.valor;
  const resumo = `${cliente?.razaoSocial ?? '—'} · ${local} · operação em ${dataBR(form.dataOperacao)} · ${form.carga.trim() || 'Carga'} de ${fmt(peso, casasDe(peso))} kg cada.`;
  return (
    <Dialog open onClose={irParaInicio} maxWidth={false} slotProps={{ paper: { sx: { width: 560 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, bgcolor: 'primary.main', color: '#fff', fontSize: 18, fontWeight: 600, py: 2, px: 2.75 }}>
        <CheckCircleOutline sx={{ color: cores.claro }} aria-hidden />{titulo}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, px: 2.75, pt: '18px !important', pb: 2.75, fontSize: 14, color: '#3A465E' }}>
        <Typography sx={{ fontSize: 14 }}>{resumo}</Typography>
        <Typography sx={{ fontSize: 14 }}>{comSerie ? 'Complete em cada rascunho o nº da ART.' : 'Complete em cada rascunho o que for diferente: nº de série da carga e nº da ART.'}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" component={RouterLink} to="/" sx={{ px: 2.75 }} autoFocus>Ir para a tela inicial</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
