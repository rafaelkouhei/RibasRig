// Seção "Gráfico de carga" do cadastro de guindastes: configurações, linhas alcance × capacidade e curva.
import { useState } from 'react';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { GraficoCapacidade } from '../../components/GraficoCapacidade';
import { fmt } from '../../domain/formatacao';
import { rotuloConfiguracao, validarLinhas, type FormLinha, type FormTabela } from './guindaste';
import { BotaoLeve, COR, Confirmacao, TituloGrupo, useSomenteLeitura } from './ui';

interface Props {
  tabelas: FormTabela[];
  sel: number;
  setSel: (i: number) => void;
  alterar: (tabelas: FormTabela[]) => void;
  tentou: boolean;
  notificar: (m: string, tipo?: 'success' | 'info' | 'warning') => void;
  importar: () => void;
}

const COLUNAS = '28px minmax(0, 1fr) minmax(0, 1fr) 40px';
let contadorId = 0;

export function GraficoCarga({ tabelas, sel, setSel, alterar, tentou, notificar, importar }: Props) {
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const somenteLeitura = useSomenteLeitura();
  const atual = tabelas[sel] ?? null;
  const validadas = atual ? validarLinhas(atual.linhas) : [];
  const errosTabela = tabelas.reduce((n, t) => n + validarLinhas(t.linhas).filter((v) => !v.ok).length, 0);

  const mudarAtual = (fn: (t: FormTabela) => FormTabela) => alterar(tabelas.map((t, i) => (i === sel ? fn(t) : t)));
  const mudarLinha = (i: number, campo: keyof FormLinha, v: string) =>
    mudarAtual((t) => ({ ...t, linhas: t.linhas.map((l, j) => (j === i ? { ...l, [campo]: v } : l)) }));

  const adicionarConfig = () => {
    contadorId += 1;
    alterar([...tabelas, { id: `nova-${Date.now()}-${contadorId}`, nome: '', linhas: [{ alcance: '', capacidade: '' }] }]);
    setSel(tabelas.length);
    notificar('Dê um nome à configuração e digite o alcance e a capacidade de cada extensão.', 'info');
  };
  const removerConfig = () => {
    alterar(tabelas.filter((_, i) => i !== sel));
    setSel(0);
    setConfirmarRemover(false);
    notificar('Configuração removida. A remoção só vale ao salvar.', 'info');
  };

  return (
    <>
      <TituloGrupo acao={<BotaoLeve onClick={importar}>Importar planilha (.xls)</BotaoLeve>}
        dica='Guindaste articulado: cada linha é o alcance máximo de uma extensão. No plano, o sistema interpola pelo raio e mostra como referência a extensão que alcança o raio.'>Gráfico de carga</TituloGrupo>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        {tabelas.map((t, i) => (
          <Button key={t.id} onClick={() => setSel(i)} aria-pressed={i === sel}
            sx={{ minHeight: 32, height: 32, px: 1.5, fontSize: 12, ...(i === sel ? { bgcolor: COR.marinho, color: '#fff', '&:hover': { bgcolor: COR.marinho } } : { border: '1px solid #C9D0DC', bgcolor: '#fff', color: COR.marinho }) }}>
            {rotuloConfiguracao(t)}
          </Button>
        ))}
        <BotaoLeve tracejado onClick={adicionarConfig} sx={{ minHeight: 32, height: 32, fontSize: 12 }}>+ Configuração</BotaoLeve>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {atual ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <TextField label="Nome da configuração" placeholder="Ex.: lança principal" value={atual.nome} onChange={(e) => mudarAtual((t) => ({ ...t, nome: e.target.value }))}
                  slotProps={{ input: { readOnly: somenteLeitura } }} />
                <BotaoLeve perigo onClick={() => setConfirmarRemover(true)} sx={{ height: 56, minHeight: 56 }}>Remover configuração</BotaoLeve>
              </Box>
              <Box sx={{ border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
                {/* Dentro do role="table" só linhas e células (leitor de tela); o botão de adicionar fica fora */}
                <Box role="table" aria-label={rotuloConfiguracao(atual)}>
                <Box role="row" sx={{ display: 'grid', gridTemplateColumns: COLUNAS, gap: 1, px: 1.5, py: 1, bgcolor: COR.cabecalhoTabela, fontSize: 12, fontWeight: 600, color: COR.neutroTexto }}>
                  <div role="columnheader">#</div><div role="columnheader">Alcance da extensão (m)</div><div role="columnheader">Capacidade (kg)</div><div role="columnheader"><Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Remover</Box></div>
                </Box>
                {atual.linhas.map((l, i) => {
                  const v = validadas[i];
                  return (
                    <Box key={i} role="row" sx={{ px: 1.5, py: 0.5, borderTop: '1px solid #E4E8EE' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: COLUNAS, gap: 1, alignItems: 'center' }}>
                        <Typography role="cell" sx={{ fontSize: 12, color: COR.fraco }}>{i + 1}</Typography>
                        <CelulaNum rotulo={`Alcance da extensão ${i + 1} em metros`} valor={l.alcance} erro={v.erroAlcance} onValor={(x) => mudarLinha(i, 'alcance', x)} />
                        <CelulaNum rotulo={`Capacidade da extensão ${i + 1} em kg`} valor={l.capacidade} erro={v.erroCapacidade} onValor={(x) => mudarLinha(i, 'capacidade', x)} />
                        <Box role="cell">
                          {!somenteLeitura && (
                            <IconButton aria-label={`Remover extensão ${i + 1}`} title="Remover linha" size="small" onClick={() => mudarAtual((t) => ({ ...t, linhas: t.linhas.filter((_, j) => j !== i) }))} sx={{ color: COR.fraco }}>
                              <Close fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                      {(v.erro || v.aviso) && (
                        <Box role="cell" sx={{ pl: 4.5, py: 0.25, fontSize: 12 }}>
                          {v.erro && <Box component="span" sx={{ display: 'block', fontWeight: 600, color: COR.alertaTexto }}>{v.erro}</Box>}
                          {v.aviso && <Box component="span" sx={{ display: 'block', color: COR.sec }}>{v.aviso}</Box>}
                        </Box>
                      )}
                    </Box>
                  );
                })}
                </Box>
                {!somenteLeitura && (
                  <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid #E4E8EE', bgcolor: '#FAFBFC' }}>
                    <BotaoLeve tracejado onClick={() => mudarAtual((t) => ({ ...t, linhas: [...t.linhas, { alcance: '', capacidade: '' }] }))}>+ Adicionar extensão</BotaoLeve>
                  </Box>
                )}
              </Box>
              {tentou && errosTabela > 0 && (
                <Box role="alert" sx={{ px: 1.5, py: 1, borderRadius: '3px', bgcolor: COR.alertaFundo, color: COR.alertaTexto, fontSize: 13, fontWeight: 600 }}>
                  {errosTabela === 1 ? '1 linha do gráfico de carga com problema' : `${errosTabela} linhas do gráfico de carga com problema`}: corrija ou remova antes de salvar.
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ p: 3, border: '1.5px dashed #8F9AB0', borderRadius: '3px', bgcolor: '#F7F8FA', color: COR.neutroTexto, fontSize: 14, textAlign: 'center' }}>
              Nenhum gráfico de carga cadastrado. O próprio engenheiro cadastra: clique em "+ Configuração" e digite, para cada extensão da lança, o alcance máximo e a capacidade do gráfico do fabricante, ou importe a planilha.
            </Box>
          )}
        </Box>
        <Curva linhas={atual?.linhas ?? []} temConfig={!!atual} />
      </Box>
      <Confirmacao aberto={confirmarRemover} titulo={`Remover a configuração "${atual?.nome.trim() || 'sem nome'}"?`} rotuloConfirmar="Remover configuração"
        confirmar={removerConfig} cancelar={() => setConfirmarRemover(false)}>
        As {atual?.linhas.length ?? 0} linhas desta configuração saem do cadastro quando você clicar em Salvar. Planos já emitidos guardam os valores usados e não mudam.
      </Confirmacao>
    </>
  );
}

function CelulaNum({ rotulo, valor, erro, onValor }: { rotulo: string; valor: string; erro: boolean; onValor: (v: string) => void }) {
  const somenteLeitura = useSomenteLeitura();
  return (
    <Box role="cell" sx={{ minWidth: 0 }}>
      <TextField size="small" value={valor} onChange={(e) => onValor(e.target.value)} error={erro}
        slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { 'aria-label': rotulo, inputMode: 'decimal' } }}
        sx={{ '& .MuiOutlinedInput-root': { height: 34, ...(erro ? { bgcolor: COR.campoErro } : {}) }, '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, ...(erro ? { borderColor: `${COR.alerta} !important` } : {}) }, '& input': { fontSize: 14, py: 0.5 } }} />
    </Box>
  );
}

function Curva({ linhas, temConfig }: { linhas: FormLinha[]; temConfig: boolean }) {
  const pontos = validarLinhas(linhas).filter((v) => v.ok).map((v) => ({ alcanceM: v.alcance, capacidadeKg: v.capacidade }));
  const alcances = pontos.map((p) => p.alcanceM);
  const [min, max] = pontos.length ? [Math.min(...alcances), Math.max(...alcances)] : [0, 0];
  const rotulo = pontos.length
    ? `Gráfico de carga: ${pontos.length} extensões, de ${fmt(min, 2)} m a ${fmt(max, 2)} m de alcance`
    : 'Gráfico de carga sem pontos válidos';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {temConfig && <GraficoCapacidade pontos={pontos} rotulo={rotulo} />}
      {pontos.length > 0 && (
        <Typography sx={{ fontSize: 12, color: COR.sec }}>
          Faixa do gráfico: {fmt(min, 2)} a {fmt(max, 2)} m de alcance. Raio fora dela bloqueia o plano.
        </Typography>
      )}
    </Box>
  );
}
