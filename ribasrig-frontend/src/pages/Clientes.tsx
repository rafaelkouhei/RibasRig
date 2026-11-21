import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase, IconButton, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import Search from '@mui/icons-material/Search';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { api } from '../services/api';
import { useCarregar } from '../hooks';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { Cabecalho } from '../components/Cabecalho';
import { useNotificacao } from '../components/Notificacao';
import { HOJE, dataBR, fmt, normalizarCnpj } from '../domain/formatacao';
import { ROTULO_SEGURANCA, artsEmUso, calcularPlano, formDoPlano, rotuloDocumento } from '../domain/plano';
import type { Cliente, LocalObra, PlanoRigging } from '../domain/types';
import {
  LOCAL_VAZIO, clienteDoForm, enderecoLocal, errosCliente, errosLocal, formDoCliente, type FormCliente,
} from './cadastros/cliente';
import { AreaRolavel, BotaoLeve, COR, Campo, Cartao, Confirmacao, EstadoCarga, FaixaConsulta, SomenteLeitura, TituloGrupo } from './cadastros/ui';
import { useAvisoSaida } from './calculos/avisoSaida';

type Selecao = number | 'novo';
interface PlanoResumo { numero: string; clienteId: number | null; descricao: string; situacao: string }

/** Planos com a situação do documento e, nos rascunhos, a de segurança (calculada como no plano). */
async function carregar() {
  const [clientes, planos, guindastes, acessorios, tipos, configuracoes] = await Promise.all([
    api.listarClientes(), api.listarPlanos(), api.listarGuindastes(), api.listarAcessorios(), api.listarTiposIcamento(), api.obterConfiguracoes(),
  ]);
  const resumo = (p: PlanoRigging): PlanoResumo => {
    const carga = [p.carga.descricao, p.carga.pesoKg != null ? `${fmt(p.carga.pesoKg, 0)} kg` : ''].filter(Boolean).join(' ');
    const descricao = [carga || 'Carga não informada', p.obra.nome, p.copiaDe ? `cópia do ${p.copiaDe}` : '', p.dataOperacao ? `operação ${p.dataOperacao < HOJE ? '' : 'prevista '}${dataBR(p.dataOperacao)}` : ''].filter(Boolean).join(' · ');
    let situacao = rotuloDocumento(p);
    if (p.situacaoDocumento === 'rascunho') {
      const r = calcularPlano({ form: formDoPlano(p), numero: p.numero, acessorios, guindastes, tipos, clientes, configuracoes, hoje: HOJE, artsEmUso: artsEmUso(planos.filter((x) => x.numero !== p.numero)) });
      situacao += ` · ${ROTULO_SEGURANCA[r.situacaoSeguranca].toLowerCase()}${r.situacaoSeguranca === 'bloqueado' && r.motivosBloqueio[0] ? ` (${r.motivosBloqueio[0]})` : ''}`;
    }
    return { numero: p.numero, clienteId: p.clienteId, descricao, situacao };
  };
  return { clientes, planos: planos.map(resumo) };
}

export default function Clientes() {
  const notificar = useNotificacao();
  const perfil = useAuth().usuario?.perfil;
  const podeEditar = pode(perfil, 'editarCadastros');
  const { dados, setDados, carregando, erro, recarregar } = useCarregar(carregar, { clientes: [] as Cliente[], planos: [] as PlanoResumo[] });
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Selecao | null>(null);
  const [form, setForm] = useState<FormCliente>(formDoCliente(null));
  const [tentou, setTentou] = useState(false);
  const [novoLocal, setNovoLocal] = useState<LocalObra>(LOCAL_VAZIO);
  const [tentouLocal, setTentouLocal] = useState(false);
  const [removerIdx, setRemoverIdx] = useState<number | null>(null);
  const [pendente, setPendente] = useState<Selecao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { clientes, planos } = dados;
  useEffect(() => { if (sel === null && clientes.length) { setSel(clientes[0].id); setForm(formDoCliente(clientes[0])); } }, [clientes, sel]);

  const atual = typeof sel === 'number' ? clientes.find((c) => c.id === sel) ?? null : null;
  const alterado = JSON.stringify(form) !== JSON.stringify(formDoCliente(atual));
  const avisoSaida = useAvisoSaida(alterado, 'As alterações neste cliente ainda não foram salvas.');
  const erros = errosCliente(form, tentou);
  const eLocal = errosLocal(novoLocal, tentouLocal);
  const planosDoCliente = planos.filter((p) => atual && p.clienteId === atual.id);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase(), qc = normalizarCnpj(busca);
    return clientes.filter((c) => !q || c.razaoSocial.toLowerCase().includes(q) || (qc.length >= 2 && normalizarCnpj(c.cnpj).includes(qc)));
  }, [clientes, busca]);

  const abrir = (s: Selecao) => {
    const c = s === 'novo' ? null : clientes.find((x) => x.id === s) ?? null;
    setSel(s); setForm(formDoCliente(c)); setTentou(false); setNovoLocal(LOCAL_VAZIO); setTentouLocal(false); setPendente(null);
  };
  const pedirAbrir = (s: Selecao) => { if (s === sel) return; if (alterado) setPendente(s); else abrir(s); };

  const adicionarLocal = () => {
    const e = errosLocal(novoLocal, true);
    if (Object.values(e).some(Boolean)) { setTentouLocal(true); return; }
    setForm({ ...form, locais: [...form.locais, novoLocal] });
    setNovoLocal(LOCAL_VAZIO); setTentouLocal(false);
    notificar('Local de obra adicionado. Clique em Salvar para confirmar.', 'info');
  };
  const removerLocal = () => {
    if (removerIdx === null) return;
    setForm({ ...form, locais: form.locais.filter((_, i) => i !== removerIdx) });
    setRemoverIdx(null);
    notificar('Local removido da lista. A remoção só vale ao clicar em Salvar.', 'info');
  };

  const salvar = async () => {
    const e = errosCliente(form, true);
    if (e.total) { setTentou(true); notificar('Não salvo: corrija os campos destacados.', 'warning'); return; }
    setSalvando(true);
    try {
      const c = await api.salvarCliente(clienteDoForm(form, atual));
      setDados((d) => ({ ...d, clientes: d.clientes.some((x) => x.id === c.id) ? d.clientes.map((x) => (x.id === c.id ? c : x)) : [...d.clientes, c] }));
      setSel(c.id); setForm(formDoCliente(c)); setTentou(false);
      notificar('Cliente salvo. Ele já aparece na lista do formulário de plano.');
    } catch (err) { notificar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error'); } finally { setSalvando(false); }
  };

  const set = (k: keyof Omit<FormCliente, 'locais'>) => (v: string) => setForm({ ...form, [k]: v });
  const setLocal = (k: keyof LocalObra) => (v: string) => setNovoLocal({ ...novoLocal, [k]: v });
  const localRemover = removerIdx !== null ? form.locais[removerIdx] : null;

  return (
    <SomenteLeitura.Provider value={!podeEditar}>
      {/* A tela ocupa exatamente a altura da janela: a página não rola; a lista e os dados do cliente rolam cada um por dentro */}
      <Box sx={{ display: { lg: 'flex' }, flexDirection: 'column', height: { lg: 'calc(100vh - 56px)' }, minHeight: { lg: 520 } }}>
        <Cabecalho secao="CADASTROS" titulo="Clientes" voltar="/" acao={podeEditar ? <Button variant="contained" onClick={() => pedirAbrir('novo')} sx={{ height: 46 }}>+ Novo cliente</Button> : undefined} />
        {!podeEditar && <FaixaConsulta />}
        <EstadoCarga carregando={carregando && !clientes.length} erro={erro} recarregar={recarregar} />
        {!carregando && !erro && !clientes.length && sel === null && (
          <Typography sx={{ py: 3, fontSize: 14, color: COR.sec }}>Nenhum cliente cadastrado.{podeEditar ? ' Clique em "+ Novo cliente" para começar.' : ''}</Typography>
        )}
        {sel !== null && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 480px' }, gridTemplateRows: { lg: 'minmax(0, 1fr)' }, flex: { lg: 1 }, minHeight: 0, gap: 2.5, alignItems: 'start' }}>
            <Paper component="section" aria-label="Clientes cadastrados" sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              <Box sx={{ p: '14px 16px', borderBottom: `1px solid ${COR.borda}`, flexShrink: 0 }}>
                <TextField type="search" placeholder="Buscar por razão social ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)}
                  slotProps={{ htmlInput: { 'aria-label': 'Buscar por razão social ou CNPJ' }, input: { startAdornment: <InputAdornment position="start"><Search sx={{ color: '#4A5668' }} /></InputAdornment> } }}
                  sx={{ '& .MuiOutlinedInput-root': { height: 44 } }} />
              </Box>
              {/* Cabeçalho só visual; para o leitor de tela é uma lista de botões (cada um abre o cliente) */}
              <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) 200px 80px', gap: 1.5, px: 2, py: 1.125, bgcolor: COR.cabecalhoTabela, fontSize: 12, fontWeight: 600, letterSpacing: 0.8, color: COR.neutroTexto, flexShrink: 0 }}>
                <div>RAZÃO SOCIAL</div><div>CNPJ</div><div>PLANOS</div>
              </Box>
              <AreaRolavel>
                <Box component="ul" aria-label="Clientes" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {filtrados.map((c) => {
                    const on = c.id === sel;
                    const n = planos.filter((p) => p.clienteId === c.id).length;
                    return (
                      <li key={c.id}>
                        <ButtonBase onClick={() => pedirAbrir(c.id)} aria-current={on ? 'true' : undefined}
                          sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) 200px 80px', gap: 1.5, alignItems: 'center', px: 2, py: 1.375, borderTop: '1px solid #E4E8EE', textAlign: 'left', bgcolor: on ? '#E6E9F0' : '#fff', boxShadow: on ? `inset 4px 0 0 ${COR.marinho}` : 'none', '&:hover': { bgcolor: on ? '#E6E9F0' : '#F7F8FA' }, '&.Mui-focusVisible': { outline: `3px solid ${COR.azul}`, outlineOffset: -3 } }}>
                          <Box component="span" sx={{ minWidth: 0 }}>
                            <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{c.razaoSocial}{c.exemplo ? ' (exemplo)' : ''}</Typography>
                            <Typography component="span" sx={{ display: 'block', fontSize: 12, color: COR.fraco }}>{c.cidade ? `${c.cidade} / ${c.uf}` : 'Endereço não informado'}</Typography>
                          </Box>
                          <Typography component="span" sx={{ fontSize: 14, color: c.cnpj ? COR.neutroTexto : COR.fraco }}>{c.cnpj || 'CNPJ não informado'}</Typography>
                          <Typography component="span" aria-label={`${n} ${n === 1 ? 'plano' : 'planos'}`} sx={{ fontSize: 14, fontWeight: 600, color: COR.marinho }}>{fmt(n, 0)}</Typography>
                        </ButtonBase>
                      </li>
                    );
                  })}
                </Box>
              </AreaRolavel>
              {!filtrados.length && <Typography sx={{ px: 2, py: 2.5, fontSize: 14, color: COR.sec }}>{busca.trim() ? `Nenhum cliente encontrado para "${busca}".` : 'Nenhum cliente cadastrado ainda.'}</Typography>}
            </Paper>

            <Cartao rolar titulo={sel === 'novo' ? 'Novo cliente' : alterado ? 'Editando · alterações não salvas' : 'Dados do cliente'}
              rodape={(podeEditar || pode(perfil, 'editarRascunhos')) && <>
                {pode(perfil, 'editarRascunhos') && <Button variant="outlined" component={RouterLink} to="/planos/novo" state={{ clienteId: atual?.id }} disabled={!atual} sx={{ borderColor: '#8F9AB0' }}>Novo plano para este cliente</Button>}
                {podeEditar && alterado && <Button variant="outlined" onClick={() => setPendente(sel)} sx={{ borderColor: '#C9D0DC' }}>Descartar alterações</Button>}
                <Box sx={{ flexGrow: 1 }} />
                {podeEditar && <Button variant="contained" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>}
              </>}>
              <TituloGrupo sx={{ mt: 0 }} dica='Quem contrata o serviço. Estes dados vão para o cabeçalho do plano e para os campos "Contratante" da ART.'>Dados do contratante</TituloGrupo>
              <Campo id="razao" label="Razão social *" value={form.razaoSocial} onValor={set('razaoSocial')} erro={erros.razaoSocial} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, alignItems: 'start' }}>
                <Campo id="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" value={form.cnpj} onValor={set('cnpj')} erro={erros.cnpj}
                  ajuda={form.cnpj.trim() ? 'Aceita CNPJ alfanumérico.' : 'CNPJ não informado (a ART fica com o campo pendente).'} />
                <Campo id="pasta" label="Nome da pasta" placeholder="Ex.: Kaefer Rip" value={form.nomePasta} onValor={set('nomePasta')}
                  ajuda={`Planos salvos em …\\${form.nomePasta.trim() || 'pasta do cliente'}\\<nº>`} />
              </Box>
              <Campo id="endereco" label="Endereço do contratante" value={form.endereco} onValor={set('endereco')} />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 76px 130px', gap: 1.75, alignItems: 'start' }}>
                <Campo id="cidade" label="Cidade" value={form.cidade} onValor={set('cidade')} />
                <Campo id="uf" label="UF" value={form.uf} onValor={set('uf')} erro={erros.uf} slotProps={{ htmlInput: { maxLength: 2 } }} />
                <Campo id="cep" label="CEP" modo="numeric" value={form.cep} onValor={set('cep')} erro={erros.cep} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, alignItems: 'start' }}>
                <Campo id="contato" label="Contato" value={form.contato} onValor={set('contato')} />
                <Campo id="telefone" label="Telefone" modo="tel" value={form.telefone} onValor={set('telefone')} />
              </Box>
              <Campo id="email" label="E-mail" type="email" modo="email" value={form.email} onValor={set('email')} erro={erros.email} />

              <TituloGrupo dica='Onde o guindaste opera. Pode ser outra empresa (ex.: a Kaefer contrata, a operação é na Bosch). Vai para o "Endereço da obra" da ART.'>Locais de obra deste contratante</TituloGrupo>
              {form.locais.map((l, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, border: `1px solid ${COR.borda}`, borderRadius: '3px' }}>
                  <PlaceOutlined sx={{ color: COR.azul }} aria-hidden />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{l.nome}</Typography>
                    <Typography sx={{ fontSize: 12, color: COR.sec }}>{enderecoLocal(l)}</Typography>
                  </Box>
                  {podeEditar && <IconButton aria-label={`Remover local de obra ${l.nome}`} title="Remover" onClick={() => setRemoverIdx(i)} sx={{ color: COR.fraco }}><DeleteOutlineOutlined fontSize="small" /></IconButton>}
                </Box>
              ))}
              {!form.locais.length && <Typography sx={{ fontSize: 13, color: COR.sec }}>Nenhum local cadastrado. Se a obra for no endereço do contratante, não precisa cadastrar.</Typography>}
              {podeEditar && <Box component="fieldset" sx={{ m: 0, p: 1.5, pt: 1, border: '1px dashed #8F9AB0', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography component="legend" sx={{ px: 0.5, fontSize: 12, fontWeight: 600, color: COR.marinho }}>Novo local de obra</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)', gap: 1.25, alignItems: 'start' }}>
                  <Campo id="obNome" size="small" label="Empresa / planta" placeholder="Ex.: Bosch" value={novoLocal.nome} onValor={setLocal('nome')} erro={eLocal.nome} />
                  <Campo id="obEnd" size="small" label="Endereço" placeholder="Rua, nº · bairro" value={novoLocal.endereco} onValor={setLocal('endereco')} erro={eLocal.endereco} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 70px 120px auto', gap: 1.25, alignItems: 'start' }}>
                  <Campo id="obCidade" size="small" label="Cidade" value={novoLocal.cidade} onValor={setLocal('cidade')} erro={eLocal.cidade} />
                  <Campo id="obUf" size="small" label="UF" value={novoLocal.uf} onValor={setLocal('uf')} erro={eLocal.uf} slotProps={{ htmlInput: { maxLength: 2 } }} />
                  <Campo id="obCep" size="small" label="CEP" modo="numeric" value={novoLocal.cep} onValor={setLocal('cep')} erro={eLocal.cep} />
                  <BotaoLeve tracejado onClick={adicionarLocal} sx={{ height: 40, minHeight: 40 }}>+ Adicionar</BotaoLeve>
                </Box>
              </Box>}

              <TituloGrupo>Planos deste cliente</TituloGrupo>
              {planosDoCliente.map((p) => (
                <ButtonBase key={p.numero} component={RouterLink} to={`/planos/${p.numero}`}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.25, px: 1.5, py: 1.25, border: `1px solid ${COR.borda}`, borderRadius: '3px', textAlign: 'left', '&:hover': { bgcolor: '#F7F8FA' } }}>
                  <Typography sx={{ fontWeight: 700, color: COR.marinho }}>{p.numero}</Typography>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14 }}>{p.descricao}</Typography>
                    <Typography sx={{ fontSize: 12, color: /bloqueado/.test(p.situacao) ? COR.alertaTexto : COR.sec, fontWeight: /bloqueado/.test(p.situacao) ? 600 : 400 }}>{p.situacao}</Typography>
                  </Box>
                </ButtonBase>
              ))}
              {!planosDoCliente.length && <Typography sx={{ fontSize: 14, color: COR.sec }}>{sel === 'novo' ? 'Salve o cliente para criar planos para ele.' : 'Nenhum plano para este cliente ainda.'}</Typography>}
            </Cartao>
          </Box>
        )}
      </Box>
      <Confirmacao aberto={localRemover !== null} titulo={`Remover o local de obra "${localRemover?.nome ?? ''}"?`} rotuloConfirmar="Remover local" confirmar={removerLocal} cancelar={() => setRemoverIdx(null)}>
        {localRemover && enderecoLocal(localRemover)}<br /><br />
        O local sai da lista e a remoção só vale quando você clicar em Salvar. Planos já emitidos com este endereço não mudam.
      </Confirmacao>
      <Confirmacao aberto={pendente !== null} titulo="Descartar alterações não salvas?" rotuloConfirmar="Descartar alterações" confirmar={() => pendente !== null && abrir(pendente)} cancelar={() => setPendente(null)}>
        As alterações em {form.razaoSocial.trim() || 'novo cliente'} ainda não foram salvas e serão perdidas.
      </Confirmacao>
      {avisoSaida}
    </SomenteLeitura.Provider>
  );
}
