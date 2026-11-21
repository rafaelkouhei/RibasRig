import { useEffect, useState } from 'react';
import { Box, Button, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import { api, MODO_API } from '../services/api';
import { escolherArquivo } from '../services/arquivos';
import { useCarregar } from '../hooks';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { Cabecalho } from '../components/Cabecalho';
import { Dica } from '../components/Dica';
import { useNotificacao } from '../components/Notificacao';
import { dataBR, fmt } from '../domain/formatacao';
import { padraoDoTipo } from '../domain/inspecao';
import type { Acessorio, PadraoInspecao, TipoAcessorio } from '../domain/types';
import {
  ABAS, ROTULO_TIPO, acessorioDoForm, formDoAcessorio, naAba, nomePdfCertificado, situacaoAcessorio, tempoDeUso, textoCapacidade, textoUso, unidadeDoTipo,
  validarAcessorio, type Aba, type FormAcessorio,
} from './cadastros/acessorio';
import { AreaRolavel, Aviso, BotaoLeve, COR, Campo, Cartao, Confirmacao, EstadoCarga, FaixaConsulta, Selo, SomenteLeitura, TituloGrupo } from './cadastros/ui';
import { RegistrarInspecao } from './cadastros/RegistrarInspecao';
import { PadroesInspecao } from './cadastros/PadroesInspecao';
import { useAvisoSaida } from './calculos/avisoSaida';

type Selecao = number | 'novo';
// Colunas apertadas para a descrição não espremer em 1280 px (tabela ao lado do formulário de 400 px)
const COLUNAS = { cap: 100, peso: 88, ct: 96, sit: 132 };

export default function Acessorios() {
  const notificar = useNotificacao();
  const { usuario } = useAuth();
  const podeEditar = pode(usuario?.perfil, 'editarCadastros');
  const { dados, setDados, carregando, erro, recarregar } = useCarregar(api.listarAcessorios, [] as Acessorio[]);
  const padroes = useCarregar(api.listarPadroesInspecao, [] as PadraoInspecao[]);
  const [inspecionar, setInspecionar] = useState<Acessorio | null>(null);
  const [verPadroes, setVerPadroes] = useState(false);
  const [aba, setAba] = useState<Aba>('todos');
  const [sel, setSel] = useState<Selecao | null>(null);
  const [form, setForm] = useState<FormAcessorio>(formDoAcessorio(null));
  const [original, setOriginal] = useState<FormAcessorio>(form);
  const [tentou, setTentou] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, setPendente] = useState<(() => void) | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const atual = typeof sel === 'number' ? dados.find((a) => a.id === sel) ?? null : null;
  const inativo = atual?.situacao === 'inativo';
  const erros = validarAcessorio(form, tentou);
  const un = unidadeDoTipo(form.tipo);
  const linhas = dados.filter((a) => naAba(a, aba));
  const alterado = JSON.stringify(form) !== JSON.stringify(original);
  const avisoSaida = useAvisoSaida(alterado, 'As alterações neste acessório ainda não foram salvas.');

  /** PDF do certificado escolhido (com o servidor): sobe depois de salvar o acessório */
  const [pdfCertificado, setPdfCertificado] = useState<File | null>(null);
  const mostrar = (s: Selecao, f: FormAcessorio) => { setSel(s); setForm(f); setOriginal(f); setTentou(false); setPdfCertificado(null); };
  const abrir = (a: Acessorio) => mostrar(a.id, formDoAcessorio(a));
  const novo = () => {
    const tipo: TipoAcessorio = aba === 'todos' || aba === 'inativos' ? 'cinta' : aba;
    if (aba === 'inativos') setAba('todos');
    mostrar('novo', formDoAcessorio(null, tipo));
  };
  /** Troca de item ou "+ Novo" com alterações pendentes pede confirmação antes. */
  const seguro = (acao: () => void) => { if (alterado) setPendente(() => acao); else acao(); };

  useEffect(() => {
    if (sel === null && dados.length) mostrar(dados[0].id, formDoAcessorio(dados[0]));
  }, [dados, sel]);
  const trocarLista = (a: Acessorio) => setDados((l) => (l.some((x) => x.id === a.id) ? l.map((x) => (x.id === a.id ? a : x)) : [...l, a]));

  const anexarCertificado = async () => {
    if (MODO_API !== 'http') {
      setForm({ ...form, certificadoArquivo: nomePdfCertificado(form.descricao) });
      notificar('Anexo simulado: no sistema real abre a seleção do arquivo PDF.', 'info');
      return;
    }
    const pdf = await escolherArquivo('.pdf,application/pdf');
    if (!pdf) return;
    setPdfCertificado(pdf);
    setForm((f) => ({ ...f, certificadoArquivo: pdf.name }));
    notificar(`${pdf.name} escolhido. O PDF é enviado ao salvar o acessório.`, 'info');
  };

  const salvar = async () => {
    const e = validarAcessorio(form, true);
    if (e.total) {
      setTentou(true);
      notificar(e.datas ? 'Não salvo: a última inspeção está depois da próxima.' : e.motivoDescarte ? 'Não salvo: informe o motivo do descarte.' : 'Não salvo: corrija os campos destacados.', 'warning');
      return;
    }
    const montado = acessorioDoForm(form, atual);
    setOcupado(true);
    try {
      let salvo = await api.salvarAcessorio(montado);
      // Como no guindaste: se o PDF falhar, o acessório já está salvo e a tela passa a mostrá-lo (sem duplicar no próximo "Salvar")
      let erroPdf: string | null = null;
      if (pdfCertificado && form.certificadoArquivo === pdfCertificado.name) {
        try { salvo = await api.enviarCertificadoAcessorio(salvo.id, pdfCertificado); } catch (err) { erroPdf = err instanceof Error ? err.message : 'erro no envio.'; }
      }
      setPdfCertificado(null);
      trocarLista(salvo); abrir(salvo);
      if (erroPdf) notificar(`Acessório salvo, mas o PDF do certificado não foi enviado: ${erroPdf} Anexe o PDF de novo e salve.`, 'warning');
      else notificar('Acessório salvo no catálogo.');
    } catch (err) { notificar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error'); } finally { setOcupado(false); }
  };
  const desativar = async () => {
    if (!atual) return;
    setConfirmar(false); setOcupado(true);
    try {
      const a = await api.desativarAcessorio(atual.id);
      trocarLista(a); abrir(a);
      notificar('Acessório desativado. Ele fica na aba "Inativos" com o histórico.');
    } catch (err) { notificar(err instanceof Error ? err.message : 'Não foi possível desativar.', 'error'); } finally { setOcupado(false); }
  };
  const reativar = async () => {
    if (!atual) return;
    setOcupado(true);
    try {
      const a = await api.reativarAcessorio(atual.id);
      trocarLista(a); abrir(a); setAba('todos');
      notificar('Acessório reativado.');
    } catch (err) { notificar(err instanceof Error ? err.message : 'Não foi possível reativar.', 'error'); } finally { setOcupado(false); }
  };

  // Situação mostrada no formulário: calculada a partir do que está digitado
  const previa = situacaoAcessorio(acessorioDoForm(form, atual));
  const set = (k: keyof FormAcessorio) => (v: string) => setForm({ ...form, [k]: v });
  const tempo = tempoDeUso(form.entrada);
  // Registrar inspeção pede o acessório salvo, em uso ou em inspeção
  const motivoSemInspecao = !atual ? 'Salve o acessório antes' : alterado ? 'Salve ou descarte as alterações antes'
    : inativo || atual.situacao === 'descartado' ? 'Acessório inativo ou descartado não recebe inspeção' : null;
  const inspecaoRegistrada = (a: Acessorio) => { setInspecionar(null); trocarLista(a); abrir(a); };

  return (
    <SomenteLeitura.Provider value={!podeEditar}>
      {/* A tela ocupa exatamente a altura da janela: a página não rola; a tabela e o formulário rolam cada um por dentro */}
      <Box sx={{ display: { lg: 'flex' }, flexDirection: 'column', height: { lg: 'calc(100vh - 56px)' }, minHeight: { lg: 520 } }}>
        <Cabecalho secao="CADASTROS" titulo="Acessórios de lingada" voltar="/" acao={
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button variant="outlined" onClick={() => setVerPadroes(true)} disabled={!padroes.dados.length} sx={{ height: 46, borderColor: '#8F9AB0', bgcolor: '#fff' }}>Padrões de inspeção</Button>
            {podeEditar && <Button variant="contained" onClick={() => seguro(novo)} sx={{ height: 46 }}>+ Novo acessório</Button>}
          </Box>
        } />
        {!podeEditar && <FaixaConsulta />}
        <Box role="tablist" aria-label="Tipos de acessório" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.25, flexShrink: 0 }}>
          {ABAS.map((t) => {
            const on = aba === t.id;
            return (
              <Button key={t.id} role="tab" aria-selected={on} onClick={() => setAba(t.id)}
                sx={{ minHeight: 40, height: 40, px: 1.75, fontSize: 14, ...(on ? { bgcolor: COR.marinho, color: '#fff', '&:hover': { bgcolor: COR.marinho } } : { bgcolor: '#fff', color: COR.marinho, boxShadow: `inset 0 0 0 1px ${COR.borda}` }) }}>
                {t.rotulo}<Box component="span" sx={{ opacity: 0.75, ml: 0.75 }}>{dados.filter((a) => naAba(a, t.id)).length}</Box>
              </Button>
            );
          })}
        </Box>
        <EstadoCarga carregando={carregando && !dados.length} erro={erro} recarregar={recarregar} />
        {!carregando && !erro && !dados.length && sel === null && (
          <Typography sx={{ py: 3, fontSize: 14, color: COR.sec }}>Nenhum acessório cadastrado.{podeEditar ? ' Clique em "+ Novo acessório" para começar.' : ''}</Typography>
        )}
        {sel !== null && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 400px' }, gridTemplateRows: { lg: 'minmax(0, 1fr)' }, flex: { lg: 1 }, minHeight: 0, gap: 2.5, alignItems: 'start' }}>
            <Paper component="section" aria-label="Acessórios cadastrados" sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Cabeçalho da tabela fica parado enquanto as linhas rolam */}
              <AreaRolavel>
                <Table size="small" stickyHeader sx={{ '& td, & th': { px: 1.25 }, '& td:first-of-type, & th:first-of-type': { pl: 2 }, '& td:last-of-type, & th:last-of-type': { pr: 2 } }}>
                  <TableHead>
                    <TableRow sx={{ '& th': { letterSpacing: 0.6, textTransform: 'uppercase', py: 1.25, whiteSpace: 'nowrap' } }}>
                      <TableCell>Descrição</TableCell>
                      <TableCell sx={{ width: COLUNAS.cap }}>Capacidade</TableCell>
                      <TableCell sx={{ width: COLUNAS.peso }}>Peso (kg)</TableCell>
                      <TableCell sx={{ width: COLUNAS.ct }}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          Cap. trab.
                          <Dica tamanho={15}>
                            <p>Capacidade de trabalho: o valor usado no memorial de cálculo da taxa de utilização (ex.: cinta de 6 t considerada com 4,2 t).</p>
                            <p>Cintas e laços em t; manilhas em tf.</p>
                          </Dica>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ width: COLUNAS.sit }}>Situação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {linhas.map((a) => {
                      const on = a.id === sel, s = situacaoAcessorio(a), u = a.unidadeCapacidade;
                      return (
                        <TableRow key={a.id} hover selected={on} tabIndex={0} aria-selected={on} onClick={() => { if (!on) seguro(() => abrir(a)); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!on) seguro(() => abrir(a)); } }}
                          sx={{ cursor: 'pointer', '& td': { py: 1.25, fontSize: 14 }, '&.Mui-selected': { bgcolor: '#E6E9F0', boxShadow: `inset 4px 0 0 ${COR.marinho}` }, '&:focus-visible': { outline: `3px solid ${COR.azul}`, outlineOffset: -3 } }}>
                          <TableCell>
                            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{a.descricao}</Typography>
                            <Typography sx={{ fontSize: 12, color: COR.fraco }}>{ROTULO_TIPO[a.tipo]}{a.norma ? ` · ${a.norma}` : ''}</Typography>
                            <Typography sx={{ fontSize: 12, color: COR.sec }}>{textoUso(a)}{tempoDeUso(a.dataEntrada) ? ` · em uso há ${tempoDeUso(a.dataEntrada)}` : ''}</Typography>
                          </TableCell>
                          <TableCell>{textoCapacidade(a.capacidadeT, u)}</TableCell>
                          <TableCell>{fmt(a.pesoKg, 2)}</TableCell>
                          <TableCell>{a.capacidadeTrabalhoT != null ? textoCapacidade(a.capacidadeTrabalhoT, u) : a.capacidadeT != null ? `${textoCapacidade(a.capacidadeT, u)} (= capacidade)` : '—'}</TableCell>
                          <TableCell><Selo tom={s.tom}>{s.curto}</Selo></TableCell>
                        </TableRow>
                      );
                    })}
                    {!linhas.length && (
                      <TableRow><TableCell colSpan={5} sx={{ py: 2.5, color: COR.sec }}>{aba === 'inativos' ? 'Nenhum acessório inativo.' : `Nenhum acessório cadastrado neste tipo.${podeEditar ? ' Clique em "+ Novo acessório".' : ''}`}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </AreaRolavel>
            </Paper>

            <Cartao rolar titulo={sel === 'novo' ? 'Novo acessório' : podeEditar ? 'Editar acessório' : 'Acessório'} selo={inativo ? <Selo tom="neutro">Inativo</Selo> : undefined}
              dica='Ao salvar, o acessório aparece na etapa "Lingada" do formulário com peso e capacidade de trabalho já preenchidos. Acessório inativo, descartado, com inspeção vencida ou com a validade vencida na data da operação não pode ser escolhido no plano. O sistema avisa 30 dias antes da próxima inspeção e do vencimento.'
              rodape={podeEditar && <>
                {atual && !inativo && <Button variant="outlined" onClick={() => setConfirmar(true)} disabled={ocupado || alterado} title={alterado ? 'Salve ou descarte as alterações antes' : undefined} sx={{ borderColor: '#C9D0DC', color: COR.alertaTexto }}>Desativar</Button>}
                {inativo && <Button variant="outlined" onClick={reativar} disabled={ocupado} sx={{ borderColor: '#8F9AB0' }}>Reativar</Button>}
                {atual && alterado && <Button variant="outlined" onClick={() => setPendente(() => () => abrir(atual))} sx={{ borderColor: '#C9D0DC' }}>Descartar alterações</Button>}
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" onClick={salvar} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</Button>
              </>}>
              {inativo && (
                <Box sx={{ px: 1.5, py: 1.25, borderRadius: '3px', bgcolor: COR.neutroFundo, color: COR.neutroTexto, fontSize: 13 }}>
                  Acessório inativo: não aparece no formulário do plano. O histórico continua guardado. Use "Reativar" para voltar a usá-lo.
                </Box>
              )}
              <TextField select label="Tipo *" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoAcessorio })} slotProps={{ input: { readOnly: !podeEditar } }}>
                {(Object.keys(ROTULO_TIPO) as TipoAcessorio[]).map((t) => <MenuItem key={t} value={t}>{ROTULO_TIPO[t]}</MenuItem>)}
              </TextField>
              <Campo id="desc" label="Descrição *" value={form.descricao} onValor={set('descricao')} erro={erros.descricao} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
                <Campo id="medida" label="Comprimento / bitola" value={form.medida} onValor={set('medida')} />
                <Campo id="norma" label="Grau / fator de segurança" value={form.norma} onValor={set('norma')} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.75, alignItems: 'start' }}>
                <Campo id="cap" label={`Capacidade (${un})${form.tipo !== 'dispositivo' ? ' *' : ''}`} modo="decimal" value={form.capacidade} onValor={set('capacidade')} erro={erros.capacidade.erro} lido={erros.capacidade.lidoComo} />
                <Campo id="ct" label={`Capacidade de trabalho (${un})`} modo="decimal" value={form.capacidadeTrabalho} onValor={set('capacidadeTrabalho')} erro={erros.capacidadeTrabalho.erro} lido={erros.capacidadeTrabalho.lidoComo} ajuda="Usada no memorial. Vazio = usa a capacidade." />
                <Campo id="peso" label="Peso unit. (kg) *" modo="decimal" value={form.peso} onValor={set('peso')} erro={erros.peso.erro} lido={erros.peso.lidoComo} />
              </Box>
              <TituloGrupo dica="O tempo de uso é calculado a partir da data de entrada (compra).">Compra e certificado</TituloGrupo>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.75, alignItems: 'start' }}>
                <Campo id="entrada" type="date" label="Data de entrada (compra)" value={form.entrada} onValor={set('entrada')} erro={erros.entrada} />
                <TextField label="Tempo de uso" value={tempo ?? '—'} slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }} sx={{ '& .MuiInputBase-root': { bgcolor: '#F4F6F9' } }} />
                <Campo id="certificado" label="Nº do certificado" value={form.certificado} onValor={set('certificado')} sx={{ gridColumn: 'span 2' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, border: `1px solid ${COR.borda}`, borderRadius: '3px' }}>
                <DescriptionOutlined sx={{ color: COR.azul }} aria-hidden />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, color: COR.fraco }}>PDF do certificado</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: form.certificadoArquivo ? COR.marinho : COR.fraco, overflowWrap: 'anywhere' }}>{form.certificadoArquivo || 'Nenhum arquivo anexado'}</Typography>
                </Box>
                {form.certificadoArquivo && <BotaoLeve perigo onClick={() => setForm({ ...form, certificadoArquivo: '' })}>Remover</BotaoLeve>}
                <BotaoLeve onClick={() => void anexarCertificado()}>{form.certificadoArquivo ? 'Trocar' : 'Anexar PDF'}</BotaoLeve>
              </Box>
              <TituloGrupo>Controle e inspeção</TituloGrupo>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, alignItems: 'start' }}>
                <TextField select label="Situação" sx={{ gridColumn: 'span 2' }} value={form.situacao} disabled={inativo} onChange={(e) => setForm({ ...form, situacao: e.target.value as FormAcessorio['situacao'] })} slotProps={{ input: { readOnly: !podeEditar } }}>
                  <MenuItem value="uso">Em uso</MenuItem><MenuItem value="inspecao">Em inspeção</MenuItem><MenuItem value="descartado">Descartado</MenuItem>
                </TextField>
                {form.situacao === 'descartado' && (
                  <Campo id="motivo" label="Motivo do descarte *" multiline minRows={2} sx={{ gridColumn: 'span 2' }} value={form.motivoDescarte} onValor={set('motivoDescarte')} erro={erros.motivoDescarte} />
                )}
                <Campo id="ultima" type="date" label="Última inspeção" value={form.ultima} onValor={set('ultima')} erro={erros.datas ? ' ' : null} />
                <Campo id="proxima" type="date" label="Próxima inspeção" value={form.proxima} onValor={set('proxima')} erro={erros.datas ? ' ' : null} />
                <Campo id="vencimento" type="date" label="Vencimento (validade)" sx={{ gridColumn: 'span 2' }} value={form.vencimento} onValor={set('vencimento')} erro={erros.vencimento}
                  ajuda="Definido pelo engenheiro para este item. O sistema avisa 30 dias antes e, vencido, bloqueia no plano." />
              </Box>
              {erros.datas && <Typography role="alert" sx={{ mt: -1.5, fontSize: 12, fontWeight: 600, color: COR.alertaTexto }}>{erros.datas}</Typography>}
              <Aviso tom={previa.tom} titulo={previa.titulo}>{previa.texto}</Aviso>
              {podeEditar && (
                <Button variant="outlined" onClick={() => atual && setInspecionar(atual)} disabled={!!motivoSemInspecao || !padroes.dados.length} title={motivoSemInspecao ?? undefined}
                  sx={{ borderColor: '#8F9AB0', alignSelf: 'stretch' }}>
                  Registrar inspeção pelo padrão
                </Button>
              )}
              <TituloGrupo>Histórico</TituloGrupo>
              <Box component="ul" sx={{ m: 0, mt: -1, p: 0, listStyle: 'none', border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
                {(atual?.historico ?? []).map((h, i) => (
                  <Box component="li" key={i} sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 1.25, px: 1.5, py: 0.875, borderTop: i ? '1px solid #EEF0F4' : 'none', fontSize: 13 }}>
                    <Box component="span" sx={{ color: COR.fraco }}>{dataBR(h.data)}</Box><span>{h.descricao}</span>
                  </Box>
                ))}
                {!atual?.historico.length && <Box component="li" sx={{ px: 1.5, py: 1.25, fontSize: 13, color: COR.fraco }}>Sem registros ainda. Cada plano emitido e cada inspeção entram aqui.</Box>}
              </Box>
              {atual && (
                <Typography sx={{ fontSize: 13, color: COR.sec }}>
                  {atual.planos.length ? `Acessório ${textoUso(atual)}. Alterações valem apenas para planos novos; planos emitidos não mudam.` : 'Acessório ainda não usado em planos.'}
                </Typography>
              )}
            </Cartao>
          </Box>
        )}
      </Box>
      <Confirmacao aberto={confirmar} titulo={`Desativar "${atual?.descricao ?? ''}"?`} rotuloConfirmar="Desativar acessório" confirmar={desativar} cancelar={() => setConfirmar(false)}>
        O acessório deixa de aparecer no formulário do plano e vai para a aba "Inativos".{' '}
        {atual?.planos.length ? `Ele foi ${textoUso(atual)}: o plano emitido não muda e o histórico fica guardado.` : 'O histórico fica guardado.'} Dá para reativar depois.
      </Confirmacao>
      <Confirmacao aberto={pendente !== null} titulo="Descartar alterações não salvas?" rotuloConfirmar="Descartar alterações"
        confirmar={() => { const acao = pendente; setPendente(null); acao?.(); }} cancelar={() => setPendente(null)}>
        As alterações em {form.descricao.trim() || 'novo acessório'} ainda não foram salvas e serão perdidas.
      </Confirmacao>
      <RegistrarInspecao acessorio={inspecionar} padrao={inspecionar ? padraoDoTipo(padroes.dados, inspecionar.tipo) : null} responsavel={usuario?.nome ?? ''}
        fechar={() => setInspecionar(null)} registrado={inspecaoRegistrada} />
      <PadroesInspecao aberto={verPadroes} padroes={padroes.dados} podeEditar={podeEditar} fechar={() => setVerPadroes(false)} salvos={padroes.setDados} />
      {avisoSaida}
    </SomenteLeitura.Provider>
  );
}
