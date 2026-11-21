import { useState, type KeyboardEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { api } from '../services/api';
import { useCarregar } from '../hooks';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { Cabecalho } from '../components/Cabecalho';
import { Dica } from '../components/Dica';
import { ATENCAO_PADRAO_PCT, LIMITE_PCT } from '../domain/calculos';
import { HOJE, dataBR, fmt, fmtPct, lidoComo } from '../domain/formatacao';
import type { Guindaste } from '../domain/types';
import { linhasConsulta, validarConsulta, type Consulta, type FormConsulta, type LinhaConsulta } from './cadastros/consulta';
import { COR, Campo, EstadoCarga } from './cadastros/ui';

const ROTULOS: Record<keyof FormConsulta, { label: string; faixa: string }> = {
  peso: { label: 'Peso da carga (kg)', faixa: 'Faixa: 1 a 100.000 kg' },
  lingada: { label: 'Lingada + dispositivos (kg)', faixa: 'Pode ser 0 · até 100.000 kg' },
  raio: { label: 'Raio de operação (m)', faixa: 'Faixa: 0,50 a 30,00 m' },
};
const NOME_ERRO: Record<keyof FormConsulta, string> = { peso: 'Peso da carga', lingada: 'Lingada + dispositivos', raio: 'Raio de operação' };

const carregar = async () => {
  const [guindastes, config] = await Promise.all([api.listarGuindastes(), api.obterConfiguracoes()]);
  return { guindastes, aviso: config.avisoAtencaoPct };
};

export default function ConsultaRapida() {
  const perfil = useAuth().usuario?.perfil;
  const criaPlano = pode(perfil, 'editarRascunhos');
  const editaCadastro = pode(perfil, 'editarCadastros');
  const { dados, carregando, erro, recarregar } = useCarregar(carregar, { guindastes: [] as Guindaste[], aviso: ATENCAO_PADRAO_PCT });
  const [form, setForm] = useState<FormConsulta>({ peso: '3450', lingada: '296,62', raio: '5,0' });
  const [consulta, setConsulta] = useState<Consulta>({ pesoKg: 3450, lingadaKg: 296.62, raioM: 5 });
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);

  const v = validarConsulta(form);
  const pbDigitado = v.peso.erro || v.lingada.erro ? NaN : v.peso.valor + v.lingada.valor;
  const consultar = () => {
    setTentou(true);
    const k = (Object.keys(v) as (keyof FormConsulta)[]).find((c) => v[c].erro);
    if (k) { setErroConsulta(`${NOME_ERRO[k]}: ${v[k].erro}`); return; }
    setErroConsulta(null);
    setConsulta({ pesoKg: v.peso.valor, lingadaKg: v.lingada.valor, raioM: v.raio.valor });
  };
  const enter = (e: KeyboardEvent) => { if (e.key === 'Enter') consultar(); };
  const linhas = linhasConsulta(dados.guindastes, consulta, dados.aviso);
  const pb = consulta.pesoKg + consulta.lingadaKg;

  return (
    <Box>
      <Cabecalho secao="CONSULTA RÁPIDA" titulo="Capacidade da frota" voltar="/"
        descricao={`Informe a carga e o raio: a lista mostra quais guindastes da frota atendem hoje (${dataBR(HOJE)}), considerando o laudo. Nada é salvo.`} />
      <Paper component="section" aria-label="Dados da consulta" sx={{ p: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr)) 180px' }, gap: 2, alignItems: 'start', mb: 2.5 }}>
        {(Object.keys(ROTULOS) as (keyof FormConsulta)[]).map((k) => {
          const mostrar = !!v[k].erro && (tentou || form[k].trim() !== '');
          return (
            <Campo key={k} id={`c_${k}`} label={ROTULOS[k].label} value={form[k]} modo="decimal" onKeyDown={enter}
              onValor={(x) => setForm({ ...form, [k]: x })} erro={mostrar ? v[k].erro : null} lido={k === 'raio' ? lidoComo(form.raio, 2, 'm') : v[k].lidoComo} ajuda={ROTULOS[k].faixa} />
          );
        })}
        <Box sx={{ border: '1.5px solid #8F9AB0', borderRadius: '3px', bgcolor: '#F3F5F8', px: 1.5, pt: 0.75, pb: 1.25, position: 'relative', minHeight: 56, boxSizing: 'border-box' }}>
          <Typography component="span" sx={{ position: 'absolute', top: -9, left: 10, px: 0.5, bgcolor: '#fff', fontSize: 12, color: COR.marinho, lineHeight: '16px' }}>Carga bruta Pb</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, pt: 1 }} aria-live="polite">{Number.isFinite(pbDigitado) ? `${fmt(pbDigitado, 2)} kg` : '—'}</Typography>
        </Box>
        <Button variant="contained" onClick={consultar} sx={{ height: 56 }}>Consultar</Button>
      </Paper>
      {erroConsulta && <Alert severity="warning" sx={{ mb: 2.5, fontWeight: 600, bgcolor: COR.alertaFundo, color: COR.alertaTexto, '& .MuiAlert-icon': { color: COR.alertaTexto } }} role="alert">{erroConsulta}</Alert>}
      <EstadoCarga carregando={carregando} erro={erro} recarregar={recarregar} />
      {!carregando && !erro && (
        <Paper sx={{ overflow: 'hidden' }}>
          <Table aria-label="Guindastes da frota para a carga consultada">
            <TableHead>
              <TableRow sx={{ '& th': { letterSpacing: 0.8, textTransform: 'uppercase', py: 1.25 } }}>
                <TableCell sx={{ width: '22%' }}>Guindaste</TableCell>
                <TableCell sx={{ width: '17%' }}>Capacidade no raio</TableCell>
                <TableCell sx={{ width: '10%' }}>Taxa</TableCell>
                <TableCell>Limite {LIMITE_PCT}% · situação</TableCell>
                <TableCell sx={{ width: 230, textTransform: 'none !important', letterSpacing: '0.3px !important', whiteSpace: 'nowrap' }}>Raio {fmt(consulta.raioM, 2)} m · Pb {fmt(pb, 2)} kg</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.map((l) => <LinhaGuindaste key={l.chave} l={l} consulta={consulta} criaPlano={criaPlano} editaCadastro={editaCadastro} />)}
              {!linhas.length && (
                <TableRow><TableCell colSpan={5} sx={{ py: 2.5, color: COR.sec }}>Nenhum guindaste ativo na frota. Cadastre um em Cadastros › Guindastes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
      {/* Aviso de que o resultado é indicativo fica visível; a explicação, no ícone */}
      <Box sx={{ mt: 1.5 }}>
        <Dica texto="Resultado indicativo">Capacidade interpolada entre os pontos do gráfico de carga; "extensão" é a referência conservadora (capacidade da primeira extensão que alcança o raio). O plano oficial continua passando por todas as etapas, acessórios e sapatas, e confere o laudo na data da operação.</Dica>
      </Box>
    </Box>
  );
}

function LinhaGuindaste({ l, consulta, criaPlano, editaCadastro }: { l: LinhaConsulta; consulta: Consulta; criaPlano: boolean; editaCadastro: boolean }) {
  const alerta = l.nivel === 'bloqueado' || l.nivel === 'atencao';
  const corTexto = l.nivel === null ? COR.fraco : alerta ? COR.alertaTexto : COR.marinho;
  const linkGuindaste = { component: RouterLink, to: '/guindastes', state: { guindasteId: l.guindaste.id } };
  return (
    <TableRow sx={{ '& td': { fontSize: 15, py: 1.5, verticalAlign: 'middle' } }}>
      <TableCell>
        <Typography sx={{ fontWeight: 700, color: COR.marinho }}>{l.nome}</Typography>
        <Typography sx={{ fontSize: 12, color: COR.sec }}>{l.sub}</Typography>
      </TableCell>
      <TableCell>
        <div>{l.capacidade}</div>
        {l.referencia && <Typography sx={{ fontSize: 12, color: COR.sec }}>{l.referencia}</Typography>}
      </TableCell>
      <TableCell sx={{ fontWeight: 700, color: corTexto }}>{fmtPct(l.taxa)}</TableCell>
      <TableCell>
        {l.nivel ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box role="img" aria-label={`Taxa ${fmtPct(l.taxa)} de ${LIMITE_PCT}%`} sx={{ position: 'relative', flexGrow: 1, height: 12, bgcolor: '#E4E8EE' }}>
              <Box sx={{ width: `${Math.min(l.taxa, 100)}%`, height: 12, bgcolor: alerta ? COR.alerta : COR.azul }} />
              <Box sx={{ position: 'absolute', left: `${LIMITE_PCT}%`, top: -4, width: 3, height: 20, bgcolor: COR.alerta }} />
            </Box>
            <Box component="span" sx={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: corTexto, ...(l.nivel === 'bloqueado' ? { px: 0.75, py: 0.25, borderRadius: '2px', bgcolor: COR.alertaFundo } : {}) }}>{l.status}</Box>
          </Box>
        ) : (
          <Box component="span" sx={{ fontSize: 13, fontWeight: l.situacao === 'fora' ? 700 : 400, color: l.situacao === 'fora' ? COR.alertaTexto : COR.fraco }}>{l.status}</Box>
        )}
        {l.laudo && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mt: 0.75, px: 1, py: 0.375, borderRadius: '2px', bgcolor: COR.alertaFundo, color: COR.alertaTexto, fontSize: 12, fontWeight: 700 }}>
            <WarningAmberOutlined sx={{ fontSize: 14 }} aria-hidden />{l.laudo}
          </Box>
        )}
        {l.avisoLaudo && <Typography sx={{ mt: 0.5, fontSize: 12, color: COR.alertaTexto }}>{l.avisoLaudo}</Typography>}
      </TableCell>
      <TableCell>
        {l.podeCriarPlano && criaPlano && (
          <Button variant="contained" component={RouterLink} to="/planos/novo" fullWidth
            state={{ guindasteId: l.guindaste.id, tabelaId: l.tabelaId, raioM: consulta.raioM, pesoKg: consulta.pesoKg }}
            sx={{ minHeight: 40, height: 40, fontSize: 13 }}>
            Criar plano com ele
          </Button>
        )}
        {editaCadastro && !l.podeCriarPlano && l.laudo && l.situacao !== 'sem-grafico' && <Link {...linkGuindaste} sx={{ fontSize: 13, fontWeight: 600 }}>Atualizar laudo</Link>}
        {editaCadastro && l.situacao === 'sem-grafico' && <Link {...linkGuindaste} sx={{ fontSize: 13, fontWeight: 600 }}>Cadastrar gráfico de carga</Link>}
      </TableCell>
    </TableRow>
  );
}
