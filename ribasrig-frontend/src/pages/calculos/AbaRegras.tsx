import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, InputAdornment, MenuItem, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Search from '@mui/icons-material/Search';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { useNotificacao } from '../../components/Notificacao';
import { api } from '../../services/api';
import { LIMITE_PCT } from '../../domain/calculos';
import { casasDe, dataHoraBR, fmt } from '../../domain/formatacao';
import { MAX_FORMULA, RESULTADOS_REGRA, rotuloOrigem, testarRegra, type TesteRegra } from '../../domain/regras';
import type { CategoriaRegra, RegraCalculo, TipoIcamento, VariavelRegra } from '../../domain/types';
import { useAvisoSaida } from './avisoSaida';
import { Confirmacao, erroLaranja, FaixaInfo, ItemLista, PainelEditor, SeloOrigem, TituloSecao, TopoCalculos, somenteLeitura } from './comum';
import { AreaRolavel } from '../cadastros/ui';
import {
  CATEGORIAS, NOVA, ORIGENS_CAP, ORIGENS_ESCOLHA, duplicarRegra, erroDoTeste, erroSalvarRegra, novaRegra, textoUsoRegra, tiposQueUsam,
  trocarOrigem, trocarOrigemCapacidade,
} from './logica';

type Filtro = 'todas' | 'sistema' | 'minhas';

interface Props {
  regras: RegraCalculo[];
  setRegras: Dispatch<SetStateAction<RegraCalculo[]>>;
  tipos: TipoIcamento[];
  aviso: number;
  podeEditar: boolean;
  autor: string;
}

const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const mono = { fontFamily: "Consolas, 'Courier New', monospace" } as const;

export function AbaRegras({ regras, setRegras, tipos, aviso, podeEditar, autor }: Props) {
  const notificar = useNotificacao();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState<RegraCalculo | null>(() => copia(regras.find((r) => r.id === 'r3') ?? regras[0] ?? null));
  const [sujo, setSujo] = useState(false);
  const [pendente, setPendente] = useState<(() => void) | null>(null);
  const [excluir, setExcluir] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const dialogoSaida = useAvisoSaida(sujo, 'A regra em edição tem alterações que ainda não foram salvas.');

  /** Executa a ação; se houver alterações, pede para descartar antes. */
  const seguro = (acao: () => void) => { if (sujo) setPendente(() => acao); else acao(); };
  const abrir = (r: RegraCalculo, marcarSujo = false) => { setRascunho(copia(r)); setSujo(marcarSujo); };

  const termo = busca.trim().toLowerCase();
  const contar = (f: Filtro) => regras.filter((r) => f === 'todas' || (f === 'sistema' ? r.origem === 'sistema' : r.origem !== 'sistema')).length;
  const lista = regras.filter((r) => {
    if (filtro === 'sistema' && r.origem !== 'sistema') return false;
    if (filtro === 'minhas' && r.origem === 'sistema') return false;
    return !termo || `${r.nome} ${r.categoria} ${r.formula}`.toLowerCase().includes(termo);
  });

  const nova = () => seguro(() => { setFiltro('todas'); abrir(novaRegra(autor), true); });

  return (
    // A tela ocupa exatamente a altura da janela: a lista e o editor rolam cada um por dentro
    <Box sx={{ ...erroLaranja, display: { lg: 'flex' }, flexDirection: 'column', height: { lg: 'calc(100vh - 56px)' }, minHeight: { lg: 520 } }}>
      {dialogoSaida}
      <TopoCalculos aba="regras" descricao="Fórmulas salvas uma vez e reutilizadas em todos os planos. Crie, teste com dados reais, edite ou apague."
        acao={podeEditar ? <Button variant="contained" onClick={nova} sx={{ height: 46, whiteSpace: 'nowrap', flexShrink: 0 }}>+ Nova regra</Button> : undefined} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '370px minmax(0, 1fr)' }, gridTemplateRows: { lg: 'minmax(0, 1fr)' }, flex: { lg: 1 }, minHeight: 0, gap: 2.25, alignItems: 'start' }}>
        <Paper component="section" aria-label="Lista de regras" sx={{ display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden' }}>
          <Box sx={{ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: 1.25, flexShrink: 0 }}>
            <TextField size="small" type="search" placeholder="Buscar regra ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)}
              slotProps={{ htmlInput: { 'aria-label': 'Buscar regra' }, input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }} />
            <ToggleButtonGroup exclusive size="small" value={filtro} onChange={(_, v: Filtro | null) => v && setFiltro(v)} aria-label="Filtrar regras"
              sx={{ gap: 0.75, '& .MuiToggleButton-root': { border: 'none !important', borderRadius: '3px !important', textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1.25, py: 0.6, bgcolor: '#EEF2F7', color: 'primary.main' },
                '& .Mui-selected, & .Mui-selected:hover': { bgcolor: '#34446A !important', color: '#fff !important' } }}>
              <ToggleButton value="todas">Todas · {contar('todas')}</ToggleButton>
              <ToggleButton value="sistema">Do sistema · {contar('sistema')}</ToggleButton>
              <ToggleButton value="minhas">Exemplos e criadas · {contar('minhas')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <AreaRolavel>
            {lista.map((r) => (
              <ItemLista key={r.id} titulo={r.nome} atual={rascunho?.id === r.id}
                selo={<SeloOrigem origem={r.origem} texto={r.origem === 'exemplo' ? 'Exemplo (fictício)' : rotuloOrigem(r.origem)} />}
                linhas={[<Box component="span" sx={mono}>{`${r.resultadoNome} = ${r.formula}`}</Box>, `${r.categoria} · ${textoUsoRegra(r)}`]}
                onClick={() => seguro(() => abrir(r))} />
            ))}
            {lista.length === 0 && <Typography sx={{ p: '18px 14px', fontSize: 14, color: '#5A6478', borderTop: '1px solid #E4E8EE' }}>Nenhuma regra encontrada.</Typography>}
          </AreaRolavel>
        </Paper>

        {rascunho ? (
          <EditorRegra key={rascunho.id} regra={rascunho} catalogo={regras} tipos={tipos} aviso={aviso} podeEditar={podeEditar} sujo={sujo} salvando={salvando}
            onMudar={(r) => { setRascunho(r); setSujo(true); }}
            onTeste={(r) => setRascunho(r)}
            onDuplicar={() => seguro(() => { abrir(duplicarRegra(rascunho, autor), true); notificar('Cópia criada. Edite e salve para usar nos planos.', 'info'); })}
            onExcluir={() => setExcluir(true)}
            onSalvar={async () => {
              const erro = erroSalvarRegra(rascunho, regras);
              if (erro) { notificar(`Não foi possível salvar: ${erro}`, 'warning'); return; }
              setSalvando(true);
              try {
                const eraNova = rascunho.id === NOVA;
                const salva = await api.salvarRegra({ ...rascunho, nome: rascunho.nome.trim() });
                setRegras((l) => (eraNova ? [...l, salva] : l.map((x) => (x.id === salva.id ? salva : x))));
                abrir(salva);
                if (filtro === 'sistema') setFiltro('minhas');
                notificar(eraNova ? 'Regra criada. Ela já pode ser usada em qualquer plano.' : `Regra salva como versão ${salva.versao}. Planos emitidos mantêm a versão usada.`);
              } catch (e) {
                notificar(e instanceof Error ? e.message : 'Não foi possível salvar a regra.', 'warning');
              } finally {
                setSalvando(false);
              }
            }} />
        ) : (
          <Paper sx={{ p: 3 }}><Typography color="text.secondary">Escolha uma regra na lista.</Typography></Paper>
        )}
      </Box>

      <Confirmacao aberto={pendente != null} titulo="Descartar alterações?" confirmar="Descartar"
        texto="A regra em edição tem alterações que ainda não foram salvas. Se continuar, elas se perdem."
        onCancelar={() => setPendente(null)} onConfirmar={() => { const a = pendente; setPendente(null); setSujo(false); a?.(); }} />

      {rascunho && <DialogoExcluir aberto={excluir} regra={rascunho} tipos={tipos} onCancelar={() => setExcluir(false)}
        onConfirmar={async () => {
          setExcluir(false);
          try {
            await api.excluirRegra(rascunho.id);
            const resto = regras.filter((x) => x.id !== rascunho.id);
            setRegras(resto);
            setRascunho(resto[0] ? copia(resto[0]) : null);
            setSujo(false);
            notificar('Regra excluída. Planos já emitidos mantêm o resultado gravado.');
          } catch (e) {
            notificar(e instanceof Error ? e.message : 'Não foi possível excluir a regra.', 'warning');
          }
        }} />}
    </Box>
  );
}

function DialogoExcluir({ aberto, regra, tipos, onCancelar, onConfirmar }: { aberto: boolean; regra: RegraCalculo; tipos: TipoIcamento[]; onCancelar: () => void; onConfirmar: () => void }) {
  const usam = tiposQueUsam(regra.id, tipos);
  const texto = usam.length
    ? <>A regra é usada nos tipos de içamento <b>{usam.map((t) => t.nome).join(', ')}</b>. Retire-a desses tipos antes de excluir.</>
    : regra.planos.length
      ? `Esta regra foi usada em ${regra.planos.length} ${regra.planos.length === 1 ? 'plano' : 'planos'}. Os planos já emitidos mantêm o resultado gravado; ela só deixa de aparecer nos próximos planos.`
      : 'A regra ainda não foi usada em nenhum plano. Esta ação não pode ser desfeita.';
  return <Confirmacao aberto={aberto} titulo={`Excluir a regra "${regra.nome}"?`} texto={texto} confirmar="Excluir regra" perigo bloqueado={usam.length > 0} onCancelar={onCancelar} onConfirmar={onConfirmar} />;
}

interface EditorProps {
  regra: RegraCalculo; catalogo: RegraCalculo[]; tipos: TipoIcamento[]; aviso: number; podeEditar: boolean; sujo: boolean; salvando: boolean;
  onMudar: (r: RegraCalculo) => void; onTeste: (r: RegraCalculo) => void; onDuplicar: () => void; onExcluir: () => void; onSalvar: () => void;
}

function EditorRegra({ regra: d, catalogo, aviso, podeEditar, sujo, salvando, onMudar, onTeste, onDuplicar, onExcluir, onSalvar }: EditorProps) {
  const sistema = d.origem === 'sistema';
  const ro = sistema || !podeEditar;
  const nova = d.id === NOVA;
  const teste = useMemo(() => testarRegra(d, catalogo, aviso), [d, catalogo, aviso]);
  const erroTeste = erroDoTeste(teste);

  const mudar = (patch: Partial<RegraCalculo>) => { if (!ro) onMudar({ ...d, ...patch }); };
  const mudarVar = (i: number, v: VariavelRegra) => mudar({ variaveis: d.variaveis.map((x, j) => (j === i ? v : x)) });
  const leitura = ro ? { input: { readOnly: true } } : undefined;
  const sxCampo = ro ? somenteLeitura : undefined;

  const titulo = nova ? 'Nova regra de cálculo' : d.nome || 'Sem nome';
  const subtitulo = sistema ? 'Regra do sistema · somente leitura' : nova ? 'Ainda não salva'
    : `${d.origem === 'exemplo' ? 'Exemplo (fictício) · ' : ''}${d.autor} · versão ${d.versao}`;
  const info = sistema ? 'Usada no plano 2607036 (Rev. 2), o primeiro emitido pelo sistema. Regra fixa do sistema: os valores conferem com o memorial de cálculo.'
    : nova ? 'Depois de salva, a regra aparece no formulário do plano e pode ser reutilizada em qualquer plano novo, sem digitar a conta de novo.'
    : `${d.origem === 'exemplo' ? 'Exemplo (fictício) · ' : ''}Versão ${d.versao} · criada por ${d.autor} · ${textoUsoRegra(d)}. Planos já emitidos guardam a versão usada; as alterações valem para os próximos planos.`;

  return (
    <PainelEditor titulo={titulo} subtitulo={subtitulo} sujo={sujo}
      acoes={podeEditar && <>
        {!ro && !nova && <Button variant="outlined" color="warning" onClick={onExcluir} sx={{ color: '#8A3F04', borderColor: '#C2610C' }}>Excluir</Button>}
        <Box sx={{ flexGrow: 1 }} />
        {podeEditar && !nova && <Button variant="outlined" onClick={onDuplicar}>Duplicar</Button>}
        {!ro && <Button variant="contained" onClick={onSalvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar regra'}</Button>}
      </>}>
      {sistema && (
        <FaixaInfo acao={podeEditar ? <Button size="small" variant="outlined" onClick={onDuplicar} sx={{ bgcolor: '#fff', minHeight: 34, flexShrink: 0 }}>Duplicar para editar</Button> : undefined}>
          <b>Regra do sistema</b>, conferida com o memorial de cálculo da Ribas.{podeEditar ? ' Para mudar, duplique e edite a cópia.' : ''}
        </FaixaInfo>
      )}
      {!podeEditar && !sistema && <FaixaInfo>Seu perfil pode consultar e testar as regras, mas não alterá-las.</FaixaInfo>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 210px' }, gap: 1.75 }}>
        <TextField label="Nome da regra" required value={d.nome} onChange={(e) => mudar({ nome: e.target.value })} slotProps={leitura} sx={sxCampo} />
        <TextField select label="Categoria" value={d.categoria} onChange={(e) => mudar({ categoria: e.target.value as CategoriaRegra })} slotProps={leitura} sx={sxCampo}>
          {CATEGORIAS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
      </Box>
      <TextField label="Para que serve" value={d.descricao} onChange={(e) => mudar({ descricao: e.target.value })} slotProps={leitura} sx={sxCampo} />

      <TituloSecao dica='A origem puxa o valor sozinho em cada plano. O valor de teste usa o plano 2607036 só para conferir a fórmula. "Resultado: …" vem calculado por outra regra do sistema, sem arredondar.'>1. VARIÁVEIS · DE ONDE VEM CADA VALOR</TituloSecao>
      <TabelaVariaveis d={d} teste={teste} ro={ro}
        onVar={mudarVar}
        onTeste={(i, texto) => onTeste({ ...d, variaveis: d.variaveis.map((x, j) => (j === i ? { ...x, teste: texto } : x)) })}
        onRemover={(i) => mudar({ variaveis: d.variaveis.filter((_, j) => j !== i) })}
        onAdicionar={() => mudar({ variaveis: [...d.variaveis, { simbolo: '', nome: '', unidade: '', origem: 'Valor fixo', teste: '' }] })} />

      <TituloSecao dica='Use + − * / ^ e parênteses. Funções: cos(), sen(), tg() com ângulo em graus, raiz(), min(), max(), abs(). Vírgula decimal (ex.: 0,5); ";" separa argumentos: min(a; b).'>2. FÓRMULA</TituloSecao>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 150px 110px' }, gap: 1.75 }}>
        <TextField label="Fórmula" required value={d.formula} onChange={(e) => mudar({ formula: e.target.value })}
          error={!!d.formula && !!erroTeste && !teste.variaveis.some((v) => v.erro)} slotProps={{ ...leitura, htmlInput: { spellCheck: false, maxLength: MAX_FORMULA } }}
          sx={{ ...sxCampo, '& input': { ...mono, fontWeight: 600 } }} />
        <TextField label="Nome do resultado" value={d.resultadoNome} onChange={(e) => mudar({ resultadoNome: e.target.value })} slotProps={leitura} sx={sxCampo} />
        <TextField label="Unidade" value={d.resultadoUnidade} onChange={(e) => mudar({ resultadoUnidade: e.target.value })} slotProps={leitura} sx={sxCampo} />
      </Box>
      <CaixaTeste d={d} teste={teste} erro={erroTeste} />

      <TituloSecao dica='A capacidade não fica gravada na regra: em cada plano ela vem do acessório ou do guindaste escolhido. No teste aparece o valor do plano 2607036.'>3. LIMITE DE SEGURANÇA E ONDE A REGRA APARECE</TituloSecao>
      <FormControlLabel control={<Checkbox checked={d.limite} onChange={() => mudar({ limite: !d.limite })} disabled={ro} />}
        label={`Comparar o resultado com uma capacidade (taxa de utilização, limite de ${LIMITE_PCT}%)`} sx={{ mt: -0.5, '& .Mui-disabled': { color: '#3A465E !important' } }} />
      {d.limite && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 1.75, border: '1px solid #D5DAE3', borderRadius: '3px', bgcolor: '#FAFBFC' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 210px' }, gap: 1.75 }}>
            <TextField select label="Capacidade de comparação · vem do plano" value={d.origemCapacidade ?? ''} onChange={(e) => mudar(trocarOrigemCapacidade(d, e.target.value))}
              slotProps={leitura} sx={sxCampo} error={!d.origemCapacidade} helperText={!d.origemCapacidade ? 'Escolha de onde vem a capacidade.' : undefined}>
              <MenuItem value="">Escolha…</MenuItem>
              {ORIGENS_CAP.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
            <CampoTesteCapacidade d={d} teste={teste} onTexto={(t) => onTeste({ ...d, capacidadeTeste: t })} />
          </Box>
          <CaixaTaxa d={d} teste={teste} aviso={aviso} />
        </Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2.5, '& .Mui-disabled': { color: '#3A465E !important' } }}>
        <FormControlLabel control={<Checkbox checked={d.noResumo} onChange={() => mudar({ noResumo: !d.noResumo })} disabled={ro} />} label="Mostrar no resumo dos cálculos do formulário" />
        <FormControlLabel control={<Checkbox checked={d.noMemorial} onChange={() => mudar({ noMemorial: !d.noMemorial })} disabled={ro} />} label="Incluir no memorial interno" />
        <FormControlLabel control={<Checkbox checked={d.automatica} onChange={() => mudar({ automatica: !d.automatica })} disabled={ro} />} label="Aplicar automaticamente em novos planos" />
      </Box>
      <Typography sx={{ fontSize: 13, color: '#5A6478' }}>{info}</Typography>

      {d.versoes.length > 0 && (
        <>
          <TituloSecao>VERSÕES</TituloSecao>
          <Box component="ol" aria-label="Versões da regra" sx={{ listStyle: 'none', m: 0, p: 0, border: '1px solid #D5DAE3', borderRadius: '3px' }}>
            {[...d.versoes].reverse().map((v, i) => (
              <Box component="li" key={v.versao} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderTop: i ? '1px solid #E4E8EE' : 'none' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'primary.main', width: 104, flexShrink: 0 }}>Versão {v.versao}{i === 0 ? ' · atual' : ''}</Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ ...mono, fontSize: 13 }}>{`${d.resultadoNome} = ${v.formula}`}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#566075' }}>{dataHoraBR(v.salvaEm)} · {v.autor}</Typography>
                </Box>
                {!ro && i > 0 && (
                  <Button size="small" variant="outlined" sx={{ minHeight: 30, fontSize: 12 }}
                    onClick={() => mudar({ formula: v.formula, variaveis: copia(v.variaveis) })}>Usar esta fórmula</Button>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}
    </PainelEditor>
  );
}

const COLUNAS_VAR = '68px minmax(0, 1.2fr) 64px minmax(0, 1.5fr) 140px 36px';

function TabelaVariaveis({ d, teste, ro, onVar, onTeste, onRemover, onAdicionar }: {
  d: RegraCalculo; teste: TesteRegra; ro: boolean;
  onVar: (i: number, v: VariavelRegra) => void; onTeste: (i: number, t: string) => void; onRemover: (i: number) => void; onAdicionar: () => void;
}) {
  const pequeno = { '& .MuiInputBase-input': { fontSize: 14, py: '8px' }, ...(ro ? somenteLeitura : {}) };
  const leitura = ro ? { input: { readOnly: true } } : undefined;
  return (
    <Box sx={{ border: '1px solid #D5DAE3', borderRadius: '3px', overflowX: 'auto' }}>
      {/* Dentro do role="table" só linhas e células (leitor de tela); o botão de adicionar fica fora */}
      <Box role="table" aria-label="Variáveis da fórmula">
      <Box role="row" sx={{ display: 'grid', gridTemplateColumns: COLUNAS_VAR, gap: 1, px: 1.25, py: 1, bgcolor: '#EEF0F4', fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#3A465E', minWidth: 640 }}>
        <span role="columnheader">SÍMBOLO</span><span role="columnheader">DESCRIÇÃO</span><span role="columnheader">UNIDADE</span>
        <span role="columnheader">ORIGEM DO VALOR</span><span role="columnheader">TESTE (2607036)</span><span role="columnheader"><Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Ações</Box></span>
      </Box>
      {d.variaveis.map((v, i) => {
        const t = teste.variaveis[i];
        const calculada = !!RESULTADOS_REGRA[v.origem];
        const rotulo = v.simbolo.trim() || `${i + 1}`;
        return (
          <Box role="row" key={i} sx={{ display: 'grid', gridTemplateColumns: COLUNAS_VAR, gap: 1, px: 1.25, py: 0.75, alignItems: 'start', borderTop: '1px solid #E4E8EE', minWidth: 640 }}>
            <TextField role="cell" size="small" value={v.simbolo} onChange={(e) => onVar(i, { ...v, simbolo: e.target.value })} slotProps={{ ...leitura, htmlInput: { 'aria-label': `Símbolo da variável ${i + 1}`, spellCheck: false } }}
              sx={{ ...pequeno, '& input': { fontFamily: 'Consolas, monospace', fontWeight: 700 } }} />
            <TextField role="cell" size="small" value={v.nome} onChange={(e) => onVar(i, { ...v, nome: e.target.value })} slotProps={{ ...leitura, htmlInput: { 'aria-label': `Descrição de ${rotulo}` } }} sx={pequeno} />
            <TextField role="cell" size="small" value={v.unidade} onChange={(e) => onVar(i, { ...v, unidade: e.target.value })} slotProps={{ ...leitura, htmlInput: { 'aria-label': `Unidade de ${rotulo}` } }} sx={pequeno} />
            <TextField role="cell" size="small" select value={v.origem} onChange={(e) => onVar(i, trocarOrigem(v, e.target.value))} slotProps={{ ...leitura, htmlInput: { 'aria-label': `Origem do valor de ${rotulo}` } }} sx={pequeno}>
              {ORIGENS_ESCOLHA.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 14 }}>{o}</MenuItem>)}
              {!ORIGENS_ESCOLHA.includes(v.origem) && <MenuItem value={v.origem}>{v.origem}</MenuItem>}
            </TextField>
            <Box role="cell" sx={{ minWidth: 0 }}>
              {calculada ? (
                <Box title="Calculado pela regra do sistema, sem arredondar" sx={{ height: 37, display: 'flex', alignItems: 'center', gap: 0.5, px: 1, border: '1px dashed #8F9AB0', borderRadius: '3px', bgcolor: '#F3F5F8', fontSize: 14, fontWeight: 600, color: 'primary.main' }}>
                  {fmt(t?.valor, 2)} <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: '#5A6478' }}>calculado</Box>
                </Box>
              ) : (
                <TextField size="small" value={v.teste} onChange={(e) => onTeste(i, e.target.value)} error={!!t?.erro}
                  helperText={t?.erro ?? t?.lidoComo ?? undefined}
                  slotProps={{ htmlInput: { 'aria-label': `Valor de teste de ${rotulo}`, inputMode: 'decimal' }, formHelperText: { sx: { mx: 0, fontSize: 12, fontWeight: t?.erro ? 600 : 400, color: t?.erro ? '#8A3F04 !important' : '#3A465E' } } }}
                  sx={{ '& .MuiInputBase-input': { fontSize: 14, py: '8px' }, ...(t?.erro ? { '& .MuiOutlinedInput-root': { bgcolor: '#FFF8F1' } } : {}) }} />
              )}
            </Box>
            <Box role="cell">
              {!ro && <IconButton aria-label={`Remover variável ${rotulo}`} onClick={() => onRemover(i)} size="small" sx={{ mt: 0.25 }}><DeleteOutlined fontSize="small" /></IconButton>}
            </Box>
          </Box>
        );
      })}
      </Box>
      {!ro && (
        <Box sx={{ px: 1.25, py: 1, borderTop: '1px solid #E4E8EE' }}>
          <Button size="small" variant="outlined" onClick={onAdicionar} sx={{ minHeight: 32 }}>+ Adicionar variável</Button>
        </Box>
      )}
    </Box>
  );
}

function CaixaTeste({ d, teste, erro }: { d: RegraCalculo; teste: TesteRegra; erro: string | null }) {
  const ok = teste.resultado.ok;
  const invalido = !ok && teste.resultado.valor !== undefined;
  return (
    <Box role="group" aria-label="Teste com o plano 2607036" sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderRadius: '3px',
      ...(ok ? { bgcolor: '#E6E9F0', color: 'primary.main' } : { bgcolor: '#FBE1C6', color: '#8A3F04', border: '1.5px solid #C2610C' }) }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8 }}>TESTE COM O PLANO 2607036</Typography>
        <Typography sx={{ ...mono, fontSize: 14, wordBreak: 'break-word' }}>{teste.substituicao || '—'}</Typography>
        {erro && <Typography role="alert" sx={{ fontSize: 13, fontWeight: 600, mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}><WarningAmberOutlined sx={{ fontSize: 16 }} />{erro}</Typography>}
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 12 }}>{d.resultadoNome || 'Resultado'}</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{ok ? `${fmt(teste.resultado.valor, 2)} ${d.resultadoUnidade}`.trim() : invalido ? 'Resultado inválido' : '—'}</Typography>
      </Box>
    </Box>
  );
}

function CampoTesteCapacidade({ d, teste, onTexto }: { d: RegraCalculo; teste: TesteRegra; onTexto: (t: string) => void }) {
  const erro = d.origemCapacidade ? teste.erroCapacidade : null;
  const lido = /\./.test(d.capacidadeTeste) && Number.isFinite(teste.capacidade) ? `lido como ${fmt(teste.capacidade, casasDe(teste.capacidade))}` : null;
  return (
    <TextField label="Valor de teste (2607036)" value={d.capacidadeTeste} onChange={(e) => onTexto(e.target.value)} error={!!erro}
      helperText={erro ?? lido ?? undefined}
      slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': 'Capacidade de teste do plano 2607036' }, formHelperText: erro ? { role: 'alert' } : undefined }}
      sx={erro ? { '& .MuiOutlinedInput-root': { bgcolor: '#FFF8F1' } } : undefined} />
  );
}

function CaixaTaxa({ d, teste, aviso }: { d: RegraCalculo; teste: TesteRegra; aviso: number }) {
  const base = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, px: 1.75, py: 1.25, borderRadius: '3px' } as const;
  const alerta = { bgcolor: '#FBE1C6', color: '#8A3F04', border: '1.5px solid #C2610C' };
  let estilo: object = { bgcolor: '#F3F5F8', color: '#3A465E' };
  let texto = 'Escolha de onde vem a capacidade';
  let valor = '—';
  let conta = '';
  if (!teste.resultado.ok) { estilo = alerta; texto = 'Resultado inválido: não há taxa. O plano fica bloqueado.'; }
  else if (!d.origemCapacidade) { /* mantém o neutro */ }
  else if (!Number.isFinite(teste.taxaPct)) { estilo = alerta; texto = 'Corrija o valor de teste da capacidade'; }
  else {
    valor = `${fmt(teste.taxaPct, 2)}%`;
    conta = `= ${fmt(teste.resultado.valor, 2)} ÷ ${fmt(teste.capacidade, casasDe(teste.capacidade))}`;
    if (teste.nivel === 'bloqueado') { estilo = { ...alerta, border: '2px solid #8A3F04', fontWeight: 600 }; texto = `Bloqueado: acima de ${LIMITE_PCT}%, o plano não pode ser emitido`; }
    else if (teste.nivel === 'atencao') { estilo = alerta; texto = `Atenção: entre ${fmt(aviso, 0)}% e ${LIMITE_PCT}%, perto do limite`; }
    else { estilo = { bgcolor: '#E6E9F0', color: 'primary.main', border: '1.5px solid #4A6192' }; texto = `Dentro do limite (abaixo de ${fmt(aviso, 0)}%)`; }
  }
  return (
    <Box role="status" sx={{ ...base, ...estilo }}>
      <Typography component="span" sx={{ fontSize: 13, fontWeight: 600 }}>Taxa de utilização</Typography>
      <Typography component="span" sx={{ fontSize: 20, fontWeight: 700 }}>{valor}</Typography>
      {conta && <Typography component="span" sx={{ ...mono, fontSize: 13 }}>{conta}</Typography>}
      <Typography component="span" sx={{ fontSize: 13, fontWeight: 600 }}>{texto}</Typography>
    </Box>
  );
}

