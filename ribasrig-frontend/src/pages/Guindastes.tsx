import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import { api, MODO_API } from '../services/api';
import { escolherArquivo } from '../services/arquivos';
import { useCarregar } from '../hooks';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { Cabecalho } from '../components/Cabecalho';
import { useNotificacao } from '../components/Notificacao';
import type { Guindaste } from '../domain/types';
import { useAvisoSaida } from './calculos/avisoSaida';
import {
  contarErros, erroNome, formDoGuindaste, guindasteDoForm, nomePdfLaudo, situacaoNoCadastro, textoLaudo, validarOpcional,
  type CampoNum, type FormGuindaste,
} from './cadastros/guindaste';
import { SecaoLaudo } from './cadastros/SecaoLaudo';
import { GraficoCarga } from './cadastros/GraficoCarga';
import { AreaRolavel, COR, Campo, Cartao, Confirmacao, EstadoCarga, FaixaConsulta, Selo, SomenteLeitura, TituloGrupo } from './cadastros/ui';

type Selecao = number | 'novo';

interface DefCampo { k: keyof FormGuindaste; label: string; span: number; marcador: string; exemplo: string; num?: CampoNum; ajuda?: string; obrig?: boolean }
const DADOS: DefCampo[] = [
  { k: 'modelo', label: 'Nome / modelo', span: 2, marcador: '[GUINDASTE]', exemplo: 'Ex.: Palfinger MD 45.007', obrig: true },
  { k: 'veiculo', label: 'Caminhão', span: 2, marcador: '[VEÍCULO]', exemplo: 'Ex.: Volvo/VM 270 6X2R' },
  { k: 'placa', label: 'Placa', span: 1, marcador: '[PLACA]', exemplo: 'Ex.: IUL8A16' },
  { k: 'chassi', label: 'Chassi', span: 2, marcador: '[CHASSI]', exemplo: 'Ex.: 93KP0R1C7DE141594' },
  { k: 'ano', label: 'Ano', span: 1, marcador: '[ANO]', exemplo: 'Ex.: 2013', num: 'ano' },
  { k: 'nominal', label: 'Capacidade nominal (t)', span: 1, marcador: '[CAPACIDADE]', exemplo: 'Ex.: 45,0', num: 'nominal' },
  { k: 'lanca', label: 'Comprimento da lança (m)', span: 1, marcador: '[LANÇA]', exemplo: 'Ex.: 5,1', num: 'lanca', ajuda: 'Informativo (o da ficha). O cálculo usa o gráfico de carga.' },
];
const GEOMETRIA: DefCampo[] = [
  { k: 'a', label: 'Eixo → sapata a (m)', span: 1, marcador: '[A]', exemplo: 'Ex.: 2,95', num: 'a' },
  { k: 'b', label: 'Abertura entre sapatas b (m)', span: 1, marcador: '[B]', exemplo: 'Ex.: 5,70', num: 'b' },
  { k: 'pg', label: 'Peso guindaste + caminhão Pg (kgf)', span: 1, marcador: '[PESO]', exemplo: 'Ex.: 11.550', num: 'pg' },
];

export default function Guindastes() {
  const notificar = useNotificacao();
  const podeEditar = pode(useAuth().usuario?.perfil, 'editarCadastros');
  const destino = (useLocation().state as { guindasteId?: number } | null)?.guindasteId;
  const { dados, setDados, carregando, erro, recarregar } = useCarregar(api.listarGuindastes, [] as Guindaste[]);
  const [sel, setSel] = useState<Selecao | null>(null);
  const [form, setForm] = useState<FormGuindaste>(formDoGuindaste(null));
  const [tabelaSel, setTabelaSel] = useState(0);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pendente, setPendente] = useState<Selecao | null>(null);
  /** PDF do laudo escolhido (com o servidor): sobe depois de salvar, para o laudo vigente já existir */
  const [pdfLaudo, setPdfLaudo] = useState<File | null>(null);

  const salvo = sel === 'novo' || sel === null ? null : dados.find((g) => g.id === sel) ?? null;

  // Seleção inicial: o guindaste pedido por outra tela (Consulta rápida) ou o primeiro da lista.
  useEffect(() => {
    if (sel !== null || !dados.length) return;
    const inicial = dados.find((g) => g.id === destino) ?? dados[0];
    setSel(inicial.id); setForm(formDoGuindaste(inicial));
  }, [dados, sel, destino]);

  const alterado = JSON.stringify(form) !== JSON.stringify(formDoGuindaste(salvo));
  const avisoSaida = useAvisoSaida(alterado, 'As alterações neste guindaste ainda não foram salvas.');
  const abrir = (s: Selecao) => {
    const g = s === 'novo' ? null : dados.find((x) => x.id === s) ?? null;
    setSel(s); setForm(formDoGuindaste(g)); setTabelaSel(0); setTentou(false); setPendente(null); setPdfLaudo(null);
    if (s === 'novo') notificar('Novo guindaste: informe o nome / modelo (obrigatório) e os dados do caminhão.', 'info');
  };
  const pedirAbrir = (s: Selecao) => { if (s === sel) return; if (alterado) setPendente(s); else abrir(s); };

  const salvar = async () => {
    const erros = contarErros(form, !!salvo && salvo.laudos.length > 0);
    if (erros.total) {
      setTentou(true);
      notificar(erros.tabela && !erros.campos && !erros.laudo ? 'Corrija as linhas destacadas do gráfico de carga antes de salvar.' : 'Corrija os campos destacados antes de salvar.', 'warning');
      return;
    }
    const { guindaste, laudoFoiParaHistorico } = guindasteDoForm(form, salvo);
    setSalvando(true);
    try {
      let novo = await api.salvarGuindaste(guindaste);
      // O PDF sobe depois que o guindaste existe. Se o envio falhar, o guindaste já está salvo: a tela passa a mostrar
      // o salvo (senão um novo "Salvar" criaria outro guindaste igual) e avisa para anexar o PDF de novo.
      let erroPdf: string | null = null;
      if (pdfLaudo && form.laudo.arquivo === pdfLaudo.name) {
        try { novo = await api.enviarLaudoGuindaste(novo.id, pdfLaudo); } catch (e) { erroPdf = e instanceof Error ? e.message : 'erro no envio.'; }
        setPdfLaudo(null);
      }
      setDados((lista) => (lista.some((g) => g.id === novo.id) ? lista.map((g) => (g.id === novo.id ? novo : g)) : [...lista, novo]));
      setSel(novo.id); setForm(formDoGuindaste(novo)); setTentou(false);
      setTabelaSel((i) => Math.min(i, Math.max(0, novo.tabelas.length - 1)));
      if (erroPdf) { notificar(`${novo.modelo} salvo, mas o PDF do laudo não foi enviado: ${erroPdf} Anexe o PDF de novo e salve.`, 'warning'); return; }
      const sit = textoLaudo(situacaoNoCadastro(novo)).curto;
      notificar(`${novo.modelo} salvo. ${laudoFoiParaHistorico ? `Laudo anterior foi para o histórico. Situação: ${sit}. ` : ''}Novos planos já usam estes dados.`);
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível salvar.', 'error');
    } finally { setSalvando(false); }
  };

  const anexarLaudo = async () => {
    if (MODO_API !== 'http') {
      setForm({ ...form, laudo: { ...form.laudo, arquivo: nomePdfLaudo(form.modelo, form.laudo) } });
      notificar('Anexo simulado: no sistema real abre a seleção do arquivo PDF.', 'info');
      return;
    }
    const pdf = await escolherArquivo('.pdf,application/pdf');
    if (!pdf) return;
    setPdfLaudo(pdf);
    setForm((atual) => ({ ...atual, laudo: { ...atual.laudo, arquivo: pdf.name } }));
    notificar(`${pdf.name} escolhido. O PDF é enviado ao salvar o guindaste.`, 'info');
  };

  const marcadores = salvo?.dadosPendentes ?? false;
  const campo = (d: DefCampo) => {
    const valor = form[d.k] as string;
    const v = d.num ? validarOpcional(d.num, valor) : null;
    const erroCampo = d.obrig && tentou ? erroNome(valor) : v?.erro ?? null;
    return (
      <Box key={d.k} sx={{ gridColumn: `span ${d.span}`, minWidth: 0 }}>
        <Campo id={`g_${d.k}`} label={d.label} value={valor} placeholder={marcadores ? d.marcador : d.exemplo} modo={d.num ? (d.num === 'ano' ? 'numeric' : 'decimal') : 'text'}
          onValor={(x) => setForm({ ...form, [d.k]: x })} erro={erroCampo} lido={v?.lidoComo} ajuda={d.ajuda} required={d.obrig} />
      </Box>
    );
  };

  const sitSalvo = textoLaudo(situacaoNoCadastro(salvo));
  const titulo = sel === 'novo' ? `Novo guindaste${form.modelo.trim() ? ` · ${form.modelo.trim()}` : ''}` : salvo?.modelo ?? '';

  return (
    <SomenteLeitura.Provider value={!podeEditar}>
      {/* A tela ocupa exatamente a altura da janela: a página não rola; a lista e o cadastro rolam cada um por dentro */}
      <Box sx={{ display: { lg: 'flex' }, flexDirection: 'column', height: { lg: 'calc(100vh - 56px)' }, minHeight: { lg: 520 } }}>
        <Cabecalho secao="CADASTROS" titulo="Guindastes" voltar="/" acao={podeEditar ? <Button variant="contained" onClick={() => pedirAbrir('novo')} sx={{ height: 46 }}>+ Novo guindaste</Button> : undefined} />
        {!podeEditar && <FaixaConsulta />}
        <EstadoCarga carregando={carregando && !dados.length} erro={erro} recarregar={recarregar} />
        {!carregando && !erro && !dados.length && sel === null && (
          <Typography sx={{ py: 3, fontSize: 14, color: COR.sec }}>Nenhum guindaste cadastrado.{podeEditar ? ' Clique em "+ Novo guindaste" para começar.' : ''}</Typography>
        )}
        {sel !== null && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' }, gridTemplateRows: { lg: 'minmax(0, 1fr)' }, flex: { lg: 1 }, minHeight: 0, gap: 2.5, alignItems: 'start' }}>
            <Box component="nav" aria-label="Guindastes cadastrados" sx={{ display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0 }}>
              <AreaRolavel fundo="#ECEEF2" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, '& > *': { flexShrink: 0 } }}>
                {dados.map((g) => <CartaoGuindaste key={g.id} g={g} atual={sel === g.id} onClick={() => pedirAbrir(g.id)} />)}
                {sel === 'novo' && (
                  <Box aria-current="true" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 2, py: 1.75, borderRadius: '3px', bgcolor: '#fff', border: `2px dashed ${COR.marinho}` }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: COR.marinho }}>{form.modelo.trim() || 'Novo guindaste'}</Typography>
                    <Typography sx={{ fontSize: 13, color: COR.sec }}>Novo · ainda não salvo</Typography>
                  </Box>
                )}
              </AreaRolavel>
            </Box>
            <Cartao rolar titulo={titulo} selo={<Selo tom={sitSalvo.tom} grande>{sitSalvo.curto}</Selo>}
              rodape={podeEditar && <>
                {alterado && <>
                  <Button variant="outlined" onClick={() => setPendente(sel)} sx={{ borderColor: '#C9D0DC' }}>Descartar alterações</Button>
                  <Typography sx={{ fontSize: 13, color: COR.sec }}>Alterações não salvas</Typography>
                </>}
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
              </>}>
              <TituloGrupo>Dados do guindaste e do caminhão</TituloGrupo>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1.75 }}>{DADOS.map(campo)}</Box>
              <TituloGrupo>Geometria para o cálculo das sapatas</TituloGrupo>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.75 }}>{GEOMETRIA.map(campo)}</Box>
              <SecaoLaudo salvo={salvo} laudo={form.laudo} alterar={(l) => setForm({ ...form, laudo: l })} tentou={tentou}
                placeholderArt={marcadores ? '[ART]' : 'Ex.: 1720261926954'}
                anexarPdf={() => void anexarLaudo()} />
              <GraficoCarga tabelas={form.tabelas} sel={tabelaSel} setSel={setTabelaSel} alterar={(t) => setForm({ ...form, tabelas: t })} tentou={tentou} notificar={notificar}
                importar={() => notificar(salvo && !salvo.dadosPendentes && salvo.tabelas.length ? `Gráfico de carga do ${salvo.modelo} já importado do fabricante.` : 'Importação simulada: selecione a planilha do fabricante no sistema real.', 'info')} />
            </Cartao>
          </Box>
        )}
      </Box>
      <Confirmacao aberto={pendente !== null} titulo="Descartar alterações não salvas?" rotuloConfirmar="Descartar alterações"
        confirmar={() => pendente !== null && abrir(pendente)} cancelar={() => setPendente(null)}>
        As alterações em {form.modelo.trim() || 'novo guindaste'} ainda não foram salvas e serão perdidas.
      </Confirmacao>
      {avisoSaida}
    </SomenteLeitura.Provider>
  );
}

function CartaoGuindaste({ g, atual, onClick }: { g: Guindaste; atual: boolean; onClick: () => void }) {
  const s = textoLaudo(situacaoNoCadastro(g));
  const n = g.tabelas.length;
  const placa = g.placa || (g.dadosPendentes ? '[PLACA]' : 'Placa não informada');
  return (
    <ButtonBase onClick={onClick} aria-current={atual ? 'true' : undefined}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, px: 2, py: 1.75, borderRadius: '3px', bgcolor: '#fff', textAlign: 'left', border: atual ? `2px solid ${COR.marinho}` : `1px solid ${COR.borda}`, '&.Mui-focusVisible': { outline: `3px solid ${COR.azul}` } }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: COR.marinho }}>{g.modelo}</Typography>
      <Typography sx={{ fontSize: 13, color: COR.sec }}>{placa} · {n ? (n === 1 ? '1 gráfico de carga' : `${n} gráficos de carga`) : 'sem gráfico de carga'}</Typography>
      <Selo tom={s.tom}>{s.curto}</Selo>
    </ButtonBase>
  );
}
