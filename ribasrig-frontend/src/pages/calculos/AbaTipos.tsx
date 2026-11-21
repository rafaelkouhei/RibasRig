import { useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Link, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useNotificacao } from '../../components/Notificacao';
import { api } from '../../services/api';
import { erroRegrasDoTipo, rotuloOrigemTipo } from '../../domain/regras';
import type { Acessorio, CamposTipoIcamento, RegraCalculo, TipoIcamento } from '../../domain/types';
import { useAvisoSaida } from './avisoSaida';
import { EsquemaLingada } from './EsquemaLingada';
import { Confirmacao, erroLaranja, FaixaInfo, ItemLista, PainelEditor, SeloOrigem, TituloSecao, TopoCalculos, somenteLeitura } from './comum';
import { AreaRolavel } from '../cadastros/ui';
import {
  NOVO, alternarBalancim, avisoAcessorioFaltando, duplicarTipo, erroSalvarTipo, novoTipo, textoUsoTipo, tipoParaSalvar,
} from './logica';

interface Props {
  tipos: TipoIcamento[];
  setTipos: Dispatch<SetStateAction<TipoIcamento[]>>;
  regras: RegraCalculo[];
  acessorios: Acessorio[];
  podeEditar: boolean;
  autor: string;
  /** A API não tem exclusão de tipo: a tela remove localmente e avisa (ver relatório). */
  onExcluido: (id: string) => void;
}

const CAMPOS: readonly [keyof CamposTipoIcamento, string][] = [
  ['anguloInferior', 'Ângulo das pernas inferiores'], ['anguloSuperior', 'Ângulo das pernas superiores'], ['anguloUnico', 'Ângulo das pernas (único)'],
  ['pesoBalancim', 'Peso do balancim / dispositivos'], ['capacidadeLaco', 'Capacidade de trabalho do laço'],
];

const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function AbaTipos({ tipos, setTipos, regras, acessorios, podeEditar, autor, onExcluido }: Props) {
  const notificar = useNotificacao();
  const [rascunho, setRascunho] = useState<TipoIcamento | null>(() => (tipos[0] ? copia(tipos[0]) : null));
  const [sujo, setSujo] = useState(false);
  const [pendente, setPendente] = useState<(() => void) | null>(null);
  const [excluir, setExcluir] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const dialogoSaida = useAvisoSaida(sujo, 'O tipo de içamento em edição tem alterações que ainda não foram salvas.');

  const seguro = (acao: () => void) => { if (sujo) setPendente(() => acao); else acao(); };
  const abrir = (t: TipoIcamento, marcarSujo = false) => { setRascunho(copia(t)); setSujo(marcarSujo); };

  const salvar = async () => {
    if (!rascunho) return;
    const erro = erroSalvarTipo(rascunho, regras, tipos);
    if (erro) { notificar(`Não foi possível salvar: ${erro}`, 'warning'); return; }
    setSalvando(true);
    try {
      const eraNovo = rascunho.id === NOVO;
      const salvo = await api.salvarTipoIcamento(tipoParaSalvar(rascunho));
      setTipos((l) => (eraNovo ? [...l, salvo] : l.map((x) => (x.id === salvo.id ? salvo : x))));
      abrir(salvo);
      notificar(eraNovo ? 'Tipo criado. Ele já aparece na etapa Lingada do formulário.' : `Tipo salvo como versão ${salvo.versao}. Planos emitidos não mudam.`);
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível salvar o tipo.', 'warning');
    } finally {
      setSalvando(false);
    }
  };

  return (
    // A tela ocupa exatamente a altura da janela: a lista e o editor rolam cada um por dentro
    <Box sx={{ ...erroLaranja, display: { lg: 'flex' }, flexDirection: 'column', height: { lg: 'calc(100vh - 56px)' }, minHeight: { lg: 520 } }}>
      {dialogoSaida}
      <TopoCalculos aba="tipos" descricao="Cada tipo junta a montagem da lingada, os campos pedidos no formulário e as regras de cálculo. O engenheiro escolhe o tipo na etapa Lingada."
        acao={podeEditar ? <Button variant="contained" onClick={() => seguro(() => abrir(novoTipo(autor), true))} sx={{ height: 46, whiteSpace: 'nowrap', flexShrink: 0 }}>+ Novo tipo</Button> : undefined} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' }, gridTemplateRows: { lg: 'minmax(0, 1fr)' }, flex: { lg: 1 }, minHeight: 0, gap: 2.25, alignItems: 'start' }}>
        <Paper component="section" aria-label="Lista de tipos de içamento" sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
          <AreaRolavel sx={{ '& > :first-of-type': { borderTop: 'none' } }}>
            {tipos.map((t) => (
              <ItemLista key={t.id} titulo={t.nome} atual={rascunho?.id === t.id}
                selo={<SeloOrigem origem={t.origem} texto={rotuloOrigemTipo(t.origem)} />}
                linhas={[`${t.balancim ? 'Com balancim' : 'Sem balancim'} · ${t.pernas} pernas · ${t.regras.length} regras · ${textoUsoTipo(t)}`]}
                onClick={() => seguro(() => abrir(t))} />
            ))}
            {tipos.length === 0 && <Typography sx={{ p: 2, fontSize: 14, color: '#5A6478' }}>Nenhum tipo cadastrado.</Typography>}
          </AreaRolavel>
        </Paper>

        {rascunho ? (
          <EditorTipo t={rascunho} regras={regras} acessorios={acessorios} podeEditar={podeEditar} sujo={sujo} salvando={salvando}
            onMudar={(t) => { setRascunho(t); setSujo(true); }}
            onDuplicar={() => seguro(() => { abrir(duplicarTipo(rascunho, autor), true); notificar('Cópia criada. Ajuste e salve.', 'info'); })}
            onExcluir={() => setExcluir(true)} onSalvar={salvar} />
        ) : (
          <Paper sx={{ p: 3 }}><Typography color="text.secondary">Escolha um tipo na lista.</Typography></Paper>
        )}
      </Box>

      <Confirmacao aberto={pendente != null} titulo="Descartar alterações?" confirmar="Descartar"
        texto="O tipo em edição tem alterações que ainda não foram salvas. Se continuar, elas se perdem."
        onCancelar={() => setPendente(null)} onConfirmar={() => { const a = pendente; setPendente(null); setSujo(false); a?.(); }} />

      {rascunho && (
        <Confirmacao aberto={excluir} titulo={`Excluir o tipo "${rascunho.nome}"?`} confirmar="Excluir tipo" perigo
          texto={rascunho.planos.length
            ? `Este tipo foi usado em ${rascunho.planos.length} ${rascunho.planos.length === 1 ? 'plano' : 'planos'}. Os planos já emitidos não mudam; ele só deixa de aparecer na etapa Lingada dos próximos planos.`
            : 'O tipo ainda não foi usado em nenhum plano. Esta ação não pode ser desfeita.'}
          onCancelar={() => setExcluir(false)}
          onConfirmar={() => {
            setExcluir(false);
            const id = rascunho.id;
            api.excluirTipoIcamento(id).then(() => {
              onExcluido(id);
              const resto = tipos.filter((x) => x.id !== id);
              setRascunho(resto[0] ? copia(resto[0]) : null);
              setSujo(false);
              notificar('Tipo excluído. Planos já emitidos não mudam.');
            }).catch((err: unknown) => notificar(err instanceof Error ? err.message : 'Não foi possível excluir o tipo.', 'error'));
          }} />
      )}
    </Box>
  );
}

interface EditorProps {
  t: TipoIcamento; regras: RegraCalculo[]; acessorios: Acessorio[]; podeEditar: boolean; sujo: boolean; salvando: boolean;
  onMudar: (t: TipoIcamento) => void; onDuplicar: () => void; onExcluir: () => void; onSalvar: () => void;
}

function EditorTipo({ t, regras, acessorios, podeEditar, sujo, salvando, onMudar, onDuplicar, onExcluir, onSalvar }: EditorProps) {
  const sistema = t.origem === 'sistema';
  const ro = sistema || !podeEditar;
  const novo = t.id === NOVO;
  const mudar = (patch: Partial<TipoIcamento>) => { if (!ro) onMudar({ ...t, ...patch }); };
  const leitura = ro ? { input: { readOnly: true } } : undefined;
  const sxCampo = ro ? somenteLeitura : undefined;
  const faltaRegra = ro ? null : erroRegrasDoTipo(t.regras, regras);
  const faltaAcessorio = avisoAcessorioFaltando(t, acessorios);
  const desmarcavel = { '& .Mui-disabled': { color: '#3A465E !important' } };

  const subtitulo = sistema ? 'Tipo padrão · somente leitura' : novo ? 'Ainda não salvo'
    : `${t.origem === 'exemplo' ? 'Exemplo da equipe (fictício) · ' : 'Criado por '}${t.autor} · versão ${t.versao}`;
  const info = sistema
    ? `${textoUsoTipo(t).replace(/^u/, 'U')}. Na etapa Lingada do formulário, este tipo pede os ângulos inferior e superior e calcula as cintas, as manilhas da carga e do gancho e a taxa do guindaste.`
    : `${t.balancim ? '' : 'Sem balancim: o formulário não pede peso de balancim nem dispositivos. '}Na etapa Lingada, o formulário pede só os campos marcados e calcula as regras escolhidas. ${t.origem === 'exemplo' ? `Exemplo da equipe (fictício), ${textoUsoTipo(t)}.` : 'Planos já emitidos guardam a versão usada.'}`;

  return (
    <PainelEditor titulo={novo ? 'Novo tipo de içamento' : t.nome || 'Sem nome'} subtitulo={subtitulo} sujo={sujo}
      acoes={podeEditar && <>
        {!ro && !novo && <Button variant="outlined" onClick={onExcluir} sx={{ color: '#8A3F04', borderColor: '#C2610C' }}>Excluir</Button>}
        <Box sx={{ flexGrow: 1 }} />
        {podeEditar && !novo && <Button variant="outlined" onClick={onDuplicar}>Duplicar</Button>}
        {!ro && <Button variant="contained" onClick={onSalvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar tipo'}</Button>}
      </>}>
      {sistema && (
        <FaixaInfo acao={podeEditar ? <Button size="small" variant="outlined" onClick={onDuplicar} sx={{ bgcolor: '#fff', minHeight: 34, flexShrink: 0 }}>Duplicar para editar</Button> : undefined}>
          <b>Tipo padrão do sistema</b>, {textoUsoTipo(t)}.{podeEditar ? ' Para outra variação, duplique.' : ''}
        </FaixaInfo>
      )}
      {!podeEditar && !sistema && <FaixaInfo>Seu perfil pode consultar os tipos, mas não alterá-los.</FaixaInfo>}
      {faltaAcessorio && (
        <Alert severity="warning" action={<Link component={RouterLink} to="/acessorios" sx={{ color: '#8A3F04', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center' }}>Abrir Acessórios</Link>}
          sx={{ bgcolor: '#FBE1C6', color: '#8A3F04', border: '1.5px solid #C2610C', '& .MuiAlert-icon': { color: '#8A3F04' } }}>
          {faltaAcessorio}
        </Alert>
      )}
      <TextField label="Nome do tipo" required value={t.nome} onChange={(e) => mudar({ nome: e.target.value })} slotProps={leitura} sx={sxCampo} />
      <TextField label="Quando usar" value={t.descricao} onChange={(e) => mudar({ descricao: e.target.value })} slotProps={leitura} sx={sxCampo} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' }, gap: 2.5, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <TituloSecao>MONTAGEM DA LINGADA</TituloSecao>
          <FormControlLabel control={<Checkbox checked={t.balancim} onChange={() => !ro && onMudar(alternarBalancim(t))} disabled={ro} />} label="Usa balancim" sx={{ ...desmarcavel, mt: -0.75, mb: -0.5 }} />
          {/* Lado a lado só quando cabe; no editor estreito (1280 px) um embaixo do outro, sem cortar o rótulo */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.75 }}>
            <TextField select label="Pernas até a carga" value={t.pernas} onChange={(e) => mudar({ pernas: Number(e.target.value) })} slotProps={leitura} sx={sxCampo}>
              <MenuItem value={2}>2 pernas</MenuItem><MenuItem value={4}>4 pernas</MenuItem>
            </TextField>
            {t.balancim && (
              <TextField select label="Pernas balancim → gancho" value={t.pernasSuperiores || 2} onChange={(e) => mudar({ pernasSuperiores: Number(e.target.value) })} slotProps={leitura} sx={sxCampo}>
                <MenuItem value={1}>1 perna</MenuItem><MenuItem value={2}>2 pernas</MenuItem>
              </TextField>
            )}
          </Box>
          <TituloSecao>CAMPOS PEDIDOS NO FORMULÁRIO</TituloSecao>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', mt: -0.75, ...desmarcavel, '& .MuiFormControlLabel-label': { fontSize: 14 } }}>
            {CAMPOS.map(([k, rotulo]) => (
              <FormControlLabel key={k} label={rotulo} sx={{ mr: 1 }} control={<Checkbox size="small" checked={t.campos[k]} disabled={ro} onChange={() => mudar({ campos: { ...t.campos, [k]: !t.campos[k] } })} />} />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TituloSecao>ESQUEMA</TituloSecao>
          <EsquemaLingada tipo={t} />
        </Box>
      </Box>

      <TituloSecao acao={<Link component={RouterLink} to="/calculos/regras" sx={{ fontSize: 13, fontWeight: 600 }}>Gerenciar regras →</Link>}>REGRAS DE CÁLCULO APLICADAS</TituloSecao>
      <Box role="group" aria-label="Regras de cálculo aplicadas" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, border: '1px solid #D5DAE3', borderRadius: '3px', px: 1, py: 0.5, ...desmarcavel }}>
        {regras.map((r) => {
          const marcada = t.regras.includes(r.id);
          return (
            <FormControlLabel key={r.id} sx={{ mr: 0 }}
              control={<Checkbox size="small" checked={marcada} disabled={ro} onChange={() => mudar({ regras: marcada ? t.regras.filter((x) => x !== r.id) : [...t.regras, r.id] })} />}
              label={<Box component="span" sx={{ fontSize: 14 }}>{r.nome} <Box component="span" sx={{ fontSize: 12, color: '#566075' }}>· {r.origem === 'sistema' ? 'sistema' : r.origem === 'exemplo' ? 'exemplo (fictício)' : 'criada'}</Box></Box>} />
          );
        })}
      </Box>
      {faltaRegra && <Alert severity="warning" role="alert" sx={{ bgcolor: '#FBE1C6', color: '#8A3F04', border: '1.5px solid #C2610C', '& .MuiAlert-icon': { color: '#8A3F04' } }}>{faltaRegra}</Alert>}
      <Typography sx={{ fontSize: 12, color: '#5A6478', mt: -0.75 }}>Obrigatório: pelo menos uma regra de tração e a regra "Taxa de utilização do guindaste".</Typography>
      <TextField label="Acessórios típicos (separados por vírgula)" value={t.acessoriosSugeridos} onChange={(e) => mudar({ acessoriosSugeridos: e.target.value })} slotProps={leitura} sx={sxCampo} />
      <Typography sx={{ fontSize: 13, color: '#5A6478' }}>{info}</Typography>
    </PainelEditor>
  );
}
