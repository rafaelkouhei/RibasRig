import { useState } from 'react';
import { Alert, Box, Button, Link, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { BarraPlano } from '../components/Cabecalho';
import { LIMITE_PCT } from '../domain/calculos';
import { Dica } from '../components/Dica';
import { useNotificacao } from '../components/Notificacao';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { usePlanoCalculado, type PlanoCalculado } from '../usePlanoCalculado';
import { EstadoCarga } from './visualizacao/EstadoCarga';
import { SeletorRevisao } from './visualizacao/Lateral';
import { secoesMemorial, type SecaoMemorial } from './visualizacao/memorial';
import { escolherVista, vistasDoPlano, type IdVista, type VistaPlano } from './visualizacao/vistas';
import logoCompleto from '../assets/logo-ribas-completo.png';
import { api, MODO_API } from '../services/api';
import { abrirDoPlano, ondeFicou } from '../services/arquivos';

export default function Memorial() {
  const numero = useParams().numero ?? '';
  const { dados, carregando, erro, recarregar } = usePlanoCalculado(numero);
  if (carregando || erro || !dados || dados.plano.numero !== numero) return <EstadoCarga numero={numero} erro={erro} recarregar={recarregar} voltar={`/planos/${numero}`} />;
  return <Conteudo d={dados} />;
}

const rotuloSecao = { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#566075' } as const;
const textoLateral = { fontSize: 13, color: '#3A465E', lineHeight: 1.45 } as const;

function Conteudo({ d }: { d: PlanoCalculado }) {
  const { plano, calculo } = d;
  const notificar = useNotificacao();
  const [params, setParams] = useSearchParams();
  const vistas = vistasDoPlano(plano, calculo);
  const vista = escolherVista(vistas, params.get('rev'));
  const escolher = (id: IdVista) => setParams(id === vistas[0].id ? {} : { rev: String(id) }, { replace: true });
  const rev = vista.revisao;
  const nomeRev = rev ? `Rev. ${rev.numero}` : 'prévia do rascunho';
  const arquivo = rev?.origem === 'sistema' ? `Memorial_${plano.numero}_Rev${rev.numero}.pdf` : null;
  const semArquivo = rev ? 'sem memorial (revisão do Excel)' : 'gerado na emissão';
  const voltar = `/planos/${plano.numero}${rev ? `?rev=${rev.numero}` : ''}`;
  const selo = (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: '2px', bgcolor: '#FBE1C6', color: '#8A3F04', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <LockOutlined sx={{ fontSize: 14 }} aria-hidden /> DOCUMENTO INTERNO
    </Box>
  );
  const [gerando, setGerando] = useState(false);
  const gerar = async () => {
    if (!arquivo || !rev) return;
    if (MODO_API !== 'http') { notificar(`${arquivo} salvo na pasta Cálculo do plano. Ele não vai no PDF do cliente.`); return; }
    setGerando(true);
    try {
      const pdf = await api.baixarMemorial(plano.numero, rev.numero);
      const salvo = await abrirDoPlano(pdf, arquivo, { pastaRaiz: d.config.pastaRaiz, pastaCliente: d.cliente?.nomePasta ?? 'Cliente', numero: plano.numero }, 'Cálculo');
      notificar(`${ondeFicou(salvo, arquivo)} Ele não vai no PDF do cliente.`);
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível gerar o memorial.', 'error');
    } finally { setGerando(false); }
  };
  const acao = arquivo
    ? <Button variant="contained" onClick={() => void gerar()} disabled={gerando}>{gerando ? 'Gerando…' : 'Gerar memorial (PDF interno)'}</Button>
    : undefined;
  return (
    <Box>
      <BarraPlano
        voltar={voltar}
        caminho={<><Link component={RouterLink} to="/">Planos de Rigging</Link> / <Link component={RouterLink} to={voltar}>{plano.numero}</Link> / Memorial de cálculo ({rev ? `Rev. ${rev.numero}` : 'rascunho'})</>}
        titulo={`Memorial de cálculo · Plano ${plano.numero}${rev ? ` · Rev. ${rev.numero}` : ''}`}
        selo={selo}
        acoes={acao}
      />
      <Box sx={{ display: { xs: 'block', lg: 'flex' }, mx: { xs: -2, md: '-36px' }, mt: -3, mb: { xs: -2, md: '-28px' }, minHeight: 'calc(100vh - 77px)' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: '22px', px: 2, overflowX: 'auto' }}>
          {!rev && (
            <Box role="note" sx={{ width: 600, maxWidth: '100%', boxSizing: 'border-box', px: 1.5, py: 1, bgcolor: '#FBE1C6', color: '#8A3F04', borderLeft: '4px solid #C2610C', borderRadius: '3px', fontSize: 13 }}>
              <b>Prévia — rascunho.</b> Calculado agora com os dados atuais. O memorial definitivo é gravado na emissão.
            </Box>
          )}
          {rev?.origem === 'excel'
            ? <SemMemorialExcel vista={vista} numero={plano.numero} />
            : <Folha d={d} vista={vista} secoes={secoesMemorial({
                resultados: vista.resultados, guindaste: d.guindaste, tabela: d.tabela, acessorios: d.acessorios, dormente: plano.dormente,
                // Revisão emitida: limite e aviso gravados nela (as Configurações podem ter mudado depois)
                balancim: calculo.balancim, avisoAtencaoPct: rev?.avisoAtencaoPct ?? d.config.avisoAtencaoPct, limitePct: rev?.limitePct ?? undefined,
              })} />}
        </Box>
        <Box component="aside" aria-label="Sobre o memorial" sx={{ width: { lg: 330 }, flexShrink: 0, bgcolor: '#FFFFFF', borderLeft: { lg: '1px solid #D5DAE3' }, borderTop: { xs: '1px solid #D5DAE3', lg: 0 } }}>
          <Box sx={{ p: '16px 18px', borderBottom: '1px solid #E4E8EE', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>Por que fica separado</Typography>
            <Typography sx={textoLateral}>O memorial mostra todo o raciocínio de cálculo. É um documento interno: não vai no PDF do cliente, mas fica guardado junto do plano para consulta e auditoria.</Typography>
          </Box>
          <OndeSalvo d={d} arquivo={arquivo ?? semArquivo} />
          <Box sx={{ p: '14px 18px', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="h2" sx={rotuloSecao}>REVISÃO</Typography>
            {vistas.length > 1 && <SeletorRevisao vistas={vistas} atual={vista.id} escolher={escolher} />}
            <Typography sx={textoLateral}><TextoRevisao d={d} vista={vista} nomeRev={nomeRev} /></Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function TextoRevisao({ d, vista, nomeRev }: { d: PlanoCalculado; vista: VistaPlano; nomeRev: string }) {
  const excel = d.plano.revisoes.filter((r) => r.origem === 'excel').map((r) => `Rev. ${r.numero}`);
  if (!vista.revisao) return <>Memorial da <b>prévia do rascunho</b>: os números mudam enquanto o plano é editado.</>;
  if (vista.revisao.origem === 'excel') return <>A <b>{nomeRev}</b> foi emitida no Excel, antes do sistema, e continua guardada como foi entregue.</>;
  const outras = excel.length ? ` A ${excel.join(', ')} foi emitida no Excel, antes do sistema, e continua guardada como foi entregue.` : '';
  return <>Memorial da <b>{nomeRev}</b>, calculada pelo sistema.{outras}</>;
}

function OndeSalvo({ d, arquivo }: { d: PlanoCalculado; arquivo: string }) {
  const { usuario } = useAuth();
  const partes = [d.config.pastaRaiz, d.cliente?.nomePasta ?? 'Cliente', d.plano.numero];
  return (
    <Box sx={{ p: '14px 18px', borderBottom: '1px solid #E4E8EE', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography component="h2" sx={rotuloSecao}>ONDE É SALVO</Typography>
        <Dica tamanho={16}>
          Só os perfis Administrador e Engenheiro abrem este documento. O sistema grava o PDF na pasta Cálculo do plano. A pasta raiz é definida em{' '}
          {pode(usuario?.perfil, 'alterarConfiguracoes') ? <Link component={RouterLink} to="/configuracoes">Configurações</Link> : 'Configurações'}.
        </Dica>
      </Box>
      <Box sx={{ p: '10px 12px', border: '1px solid #D5DAE3', borderRadius: '3px', bgcolor: '#F7F8FA', fontSize: 13, color: '#3A465E', lineHeight: 1.6, wordBreak: 'break-word' }}>
        {partes.join(' \\ ')} \ <b>Cálculo</b> \<br />
        <Box component="b" sx={{ color: 'primary.main' }}>{arquivo}</Box>
      </Box>
    </Box>
  );
}

function SemMemorialExcel({ vista, numero }: { vista: VistaPlano; numero: string }) {
  return (
    <Box sx={{ width: 600, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Alert severity="info">A {vista.rotulo.replace(' · Excel', '')} foi emitida no Excel, antes do sistema. Não existe memorial do sistema para ela: o PDF original continua guardado como foi entregue.</Alert>
      <Box sx={{ p: '10px 12px', borderRadius: '3px', fontSize: 13, lineHeight: 1.45, bgcolor: '#FBE1C6', color: '#8A3F04' }}>{vista.nota}</Box>
      <Link component={RouterLink} to={`/planos/${numero}/memorial`} sx={{ fontWeight: 600, fontSize: 14 }}>Ver o memorial da revisão atual</Link>
    </Box>
  );
}

function Secao({ s }: { s: SecaoMemorial }) {
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: '4px', py: '10px', borderTop: '1px solid #D1D5DB' }}>
      <Box component="h3" sx={{ m: 0, fontWeight: 700, fontSize: 12 }}>{s.titulo}</Box>
      {s.linhas.map((l, i) => <Box key={i} sx={{ py: '2px', color: l.nota ? '#374151' : undefined }}>{l.texto}</Box>)}
      <Box sx={{ alignSelf: 'flex-start', mt: '2px', px: 1, py: '3px', border: '1px solid #111827', fontWeight: 700 }}>{s.resultado}</Box>
    </Box>
  );
}

/** Folha do memorial (A4 em tela), com cabeçalho, seções numeradas e rodapé interno. */
function Folha({ d, vista, secoes }: { d: PlanoCalculado; vista: VistaPlano; secoes: SecaoMemorial[] }) {
  const { plano, guindaste, config } = d;
  const rev = vista.revisao;
  return (
    <Box component="article" aria-label="Memorial de cálculo" sx={{ width: 600, minHeight: 1100, flexShrink: 0, bgcolor: '#FFFFFF', boxSizing: 'border-box', p: '26px 32px', fontSize: 11, color: '#111827', boxShadow: '0 6px 24px rgba(31, 42, 64, 0.18)', display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1.5px solid #111827', pb: 1, mb: 0.5 }}>
        <img src={logoCompleto} alt="Guindastes Ribas" style={{ width: 100, height: 56, objectFit: 'contain' }} />
        <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
          <Box sx={{ fontSize: 16, fontWeight: 700 }}>MEMORIAL DE CÁLCULO</Box>
          <Box sx={{ fontWeight: 700 }}>Lingada {guindaste?.codigo ?? '—'} · Içamento de {plano.carga.descricao.toLowerCase() || '—'} · {rev ? `Rev. ${rev.numero}` : 'Rascunho'}</Box>
        </Box>
        <Box sx={{ textAlign: 'center', fontSize: 10 }}>ART<br /><b>{plano.art || '—'}</b><br />RIGGING<br /><b>{plano.numero}</b><br />REV.<br /><b>{rev ? rev.numero : '—'}</b></Box>
      </Box>
      <Box sx={{ fontSize: 10, color: '#374151', pb: 0.75 }}>
        Considerando, no máximo, {LIMITE_PCT}% de taxa de utilização (TU) em todos os itens. Ângulos das pernas medidos a partir da vertical. Valores intermediários com 4 casas; nada é arredondado antes do cálculo, só o resultado é apresentado com 2 casas.
      </Box>
      {secoes.map((s) => <Secao key={s.titulo} s={s} />)}
      <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', gap: 2, borderTop: '1px solid #9CA3AF', pt: 0.5, fontSize: 9, color: '#4B5563' }}>
        <span>Uso interno da {config.empresa.razaoSocial.replace(' Ltda.', '')} · não anexar ao plano enviado ao cliente</span>
        <span>{config.responsavel.nomeAssinatura} · {config.responsavel.crea}</span>
      </Box>
    </Box>
  );
}
