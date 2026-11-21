import { useState } from 'react';
import { Alert, Box, Button, Link, Paper, Typography } from '@mui/material';
import Check from '@mui/icons-material/Check';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { BarraPlano } from '../components/Cabecalho';
import { Dica } from '../components/Dica';
import { useNotificacao } from '../components/Notificacao';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { dataBR } from '../domain/formatacao';
import { caminhoPlano, nomeArquivoPlano, pastaDe, rotuloDocumento } from '../domain/plano';
import type { Revisao } from '../domain/types';
import { usePlanoCalculado, type PlanoCalculado } from '../usePlanoCalculado';
import { EstadoCarga } from './visualizacao/EstadoCarga';
import { api, MODO_API } from '../services/api';
import { abrirDoPlano, desktop, guardarNaPastaDoPlano, ondeFicou } from '../services/arquivos';
import { SECOES_DOCUMENTO } from './visualizacao/vistas';
import logoCompleto from '../assets/logo-ribas-completo.png';

const rotuloColuna = { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'secondary.main', mb: 0.75 } as const;
/** No PDF a seção de desenhos leva o nome da origem. */
const NOME_NO_PDF: Record<string, string> = { Desenhos: 'Desenhos (SolidWorks)' };

export default function GerarPdf() {
  const numero = useParams().numero ?? '';
  const { dados, carregando, erro, recarregar } = usePlanoCalculado(numero);
  if (carregando || erro || !dados || dados.plano.numero !== numero) return <EstadoCarga numero={numero} erro={erro} recarregar={recarregar} voltar={`/planos/${numero}`} />;
  return <Conteudo d={dados} />;
}

function Conteudo({ d }: { d: PlanoCalculado }) {
  const { plano } = d;
  const [params] = useSearchParams();
  const pedida = params.get('rev');
  const revisao = pedida ? plano.revisoes.find((r) => String(r.numero) === pedida) ?? null
    : plano.situacaoDocumento === 'emitido' ? plano.revisoes[plano.revisoes.length - 1] ?? null : null;
  const caminhoBase = <><Link component={RouterLink} to="/">Planos de Rigging</Link> / <Link component={RouterLink} to={`/planos/${plano.numero}`}>{plano.numero}</Link></>;

  if (!revisao) {
    return (
      <Box>
        <BarraPlano voltar={`/planos/${plano.numero}`} caminho={<>{caminhoBase} / PDF</>} titulo={`Plano de Rigging nº ${plano.numero}`} />
        <SemPdf d={d} pedida={pedida} />
      </Box>
    );
  }
  return (
    <Box>
      <BarraPlano voltar={`/planos/${plano.numero}`} caminho={<>{caminhoBase} / PDF da Rev. {revisao.numero}</>} titulo={`Plano de Rigging nº ${plano.numero} · Rev. ${revisao.numero}`} />
      <CartaoPdf d={d} revisao={revisao} />
    </Box>
  );
}

/** Rascunho não tem PDF: só a emissão gera. Mostra as revisões já emitidas, se houver. */
function SemPdf({ d, pedida }: { d: PlanoCalculado; pedida: string | null }) {
  const { plano } = d;
  const { usuario } = useAuth();
  return (
    <Paper sx={{ maxWidth: 620, mx: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" variant="h2">{pedida ? `A Rev. ${pedida} não existe neste plano` : `${rotuloDocumento(plano)}: ainda não tem PDF`}</Typography>
      <Typography color="text.secondary">
        O PDF do cliente só é gerado e salvo na emissão, depois do checklist da etapa 6. Enquanto o plano é rascunho, a visualização mostra uma prévia.
      </Typography>
      {plano.revisoes.length > 0 && (
        <Alert severity="info">
          Revisões já emitidas:{' '}
          {[...plano.revisoes].reverse().map((r, i) => (
            <span key={r.numero}>{i > 0 && ' · '}<Link component={RouterLink} to={`/planos/${plano.numero}/pdf?rev=${r.numero}`}>PDF da Rev. {r.numero}</Link></span>
          ))}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
        <Button variant="outlined" component={RouterLink} to={`/planos/${plano.numero}`}>Ver prévia</Button>
        {plano.situacaoDocumento === 'rascunho' && pode(usuario?.perfil, 'editarRascunhos') && (
          <Button variant="contained" component={RouterLink} to={`/planos/${plano.numero}/editar`}>Continuar editando</Button>
        )}
      </Box>
    </Paper>
  );
}

/** PDF salvo: ordem das páginas, nome do arquivo e pasta do cliente. Com o servidor, o PDF é o gerado na emissão;
 * no aplicativo ele vai para a pasta do cliente. No mock (e na revisão do Excel) as ações dizem o que fariam. */
function CartaoPdf({ d, revisao }: { d: PlanoCalculado; revisao: Revisao }) {
  const { plano, cliente, config } = d;
  const notificar = useNotificacao();
  const { usuario } = useAuth();
  const excel = revisao.origem === 'excel';
  const arquivo = nomeArquivoPlano(config.nomeArquivo, plano.numero, revisao.numero);
  const caminho = caminhoPlano(config, cliente?.nomePasta ?? 'Cliente', plano.numero, revisao.numero);
  const pasta = pastaDe(caminho);
  const ultima = plano.revisoes[plano.revisoes.length - 1];
  const [ocupado, setOcupado] = useState(false);
  const real = MODO_API === 'http' && !excel;
  const ponte = desktop();
  const destino = { pastaRaiz: config.pastaRaiz, pastaCliente: cliente?.nomePasta ?? 'Cliente', numero: plano.numero };
  const comPdf = async (acao: (pdf: Blob) => Promise<void>) => {
    setOcupado(true);
    try { await acao(await api.baixarPdfRevisao(plano.numero, revisao.numero)); }
    catch (e) { notificar(e instanceof Error ? e.message : 'Não foi possível obter o PDF.', 'error'); }
    finally { setOcupado(false); }
  };
  const abrirPdf = () => comPdf(async (pdf) => { await abrirDoPlano(pdf, revisao.arquivoPdf, destino, 'Relatório'); });
  const abrirPasta = () => comPdf(async (pdf) => {
    const salvo = await guardarNaPastaDoPlano(pdf, revisao.arquivoPdf, destino, 'Relatório');
    if (salvo && ponte) await ponte.mostrarNaPasta(salvo);
    notificar(ondeFicou(salvo, revisao.arquivoPdf));
  });
  const emitido = excel
    ? `emitido no Excel em ${dataBR(revisao.emitidaEm)} · cadastrado no sistema em ${dataBR(revisao.cadastradaEm)}`
    : `emitido em ${dataBR(revisao.emitidaEm)}`;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', minHeight: 640 }}>
      <Box aria-hidden sx={{ position: 'absolute', top: 0, width: 520, maxWidth: '100%', height: 700, bgcolor: '#FFFFFF', boxShadow: '0 6px 24px rgba(31, 42, 64, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logoCompleto} alt="" style={{ width: 160, opacity: 0.25 }} />
      </Box>
      <Paper component="section" aria-labelledby="pdf-titulo" aria-describedby="pdf-arquivo" sx={{ position: 'relative', mt: 10, width: 620, maxWidth: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)', alignSelf: 'flex-start' }}>
        <Box sx={{ px: 2.75, py: 2, bgcolor: 'primary.main', color: '#FFFFFF' }}>
          <Typography id="pdf-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>
            {excel ? 'PDF original' : 'PDF salvo'} · Plano de Rigging nº {plano.numero} · Rev. {revisao.numero}
          </Typography>
          <Typography id="pdf-arquivo" sx={{ fontSize: 13, color: '#DDE2EC', mt: 0.25 }}>{arquivo} · {emitido}</Typography>
        </Box>
        <Box sx={{ p: '20px 22px', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.75 }}>
          <Box>
            <Typography component="h3" sx={rotuloColuna}>MONTADO NESTA ORDEM</Typography>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {SECOES_DOCUMENTO.map((s) => (
                <Box component="li" key={s.rotulo} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75, fontSize: 14 }}>
                  <Check sx={{ fontSize: 18, color: 'secondary.main' }} aria-hidden />
                  <Box component="span" sx={{ flexGrow: 1 }}>{NOME_NO_PDF[s.rotulo] ?? s.rotulo}</Box>
                  {/* As páginas do protótipo valem só para o original do Excel e para a demonstração: no PDF do servidor
                      elas dependem dos anexos (desenhos e laudo podem ter qualquer número de páginas) */}
                  {!real && <Box component="span" sx={{ fontSize: 12, color: '#566075', whiteSpace: 'nowrap' }}>{s.paginas.toLowerCase()}</Box>}
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>
              {real ? 'Páginas conforme os anexos · gerado pelo servidor na emissão' : '10 páginas · sem enviar nada para a internet'}
            </Typography>
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography component="h3" sx={rotuloColuna}>SALVO NA PASTA DO CLIENTE</Typography>
              <Dica tamanho={16}>A pasta raiz é escolhida uma vez nas {pode(usuario?.perfil, 'alterarConfiguracoes') ? <Link component={RouterLink} to="/configuracoes">configurações</Link> : 'configurações'}.</Dica>
            </Box>
            <Box sx={{ p: '10px 12px', border: '1px solid #D5DAE3', borderRadius: '3px', bgcolor: '#F7F8FA', display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, wordBreak: 'break-all' }}>
              <InsertDriveFileOutlined sx={{ fontSize: 16, color: 'primary.main' }} aria-hidden />{arquivo}
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1, wordBreak: 'break-all' }}>
              <b>Caminho:</b> <Box component="code" sx={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>{caminho}</Box>
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end', px: 2.75, pb: 2.5 }}>
          {real ? (
            <>
              <Button variant="outlined" onClick={abrirPasta} disabled={ocupado}>{ponte ? 'Abrir pasta' : 'Baixar PDF'}</Button>
              <Button variant="contained" onClick={abrirPdf} disabled={ocupado}>{ocupado ? 'Gerando…' : 'Abrir PDF'}</Button>
            </>
          ) : (
            <>
              <Button variant="outlined" onClick={() => notificar(`A pasta fica em ${pasta}. Abrir o Explorador de Arquivos só funciona no aplicativo instalado no computador.`, 'info')}>Abrir pasta</Button>
              <Button variant="contained" component={RouterLink} to={`/planos/${plano.numero}${revisao === ultima && plano.situacaoDocumento === 'emitido' ? '' : `?rev=${revisao.numero}`}`}>Abrir PDF</Button>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
