// Etapa 5 · Anexos externos (desenhos, ART do plano) + laudo e ART do guindaste vindos do cadastro.
import { useRef, useState, type DragEvent } from 'react';
import { Box, Button, Typography } from '@mui/material';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import { laudoAtual, situacaoLaudo } from '../../domain/calculos';
import { dataBR, isoDeBR } from '../../domain/formatacao';
import type { AnexosPlano, Guindaste } from '../../domain/types';
import type { PropsEtapa, Renovacao } from './tipos';
import { arquivoLaudoRenovado } from './EtapaGuindaste';
import { COR, TituloEtapa } from './ui';
import { Dica } from '../../components/Dica';
import { api, MODO_API, type TipoAnexoPlano } from '../../services/api';
import { guardarNaPastaDoPlano, ondeFicou } from '../../services/arquivos';

interface LinhaAnexo { rotulo: string; req: string; status: string; tem: boolean; alerta: boolean; remover?: () => void }
interface Identificado { texto: string; alerta: boolean }

const DO_CADASTRO = '(vem do cadastro do guindaste · não pode ser removido aqui)';

export function EtapaAnexos(p: PropsEtapa & { renovValida: boolean; renov: Renovacao }) {
  const { f, set, r, cad, numero } = p;
  const [identificados, setIdentificados] = useState<Identificado[] | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const comServidor = MODO_API === 'http';
  const artNum = r.art.numero, artErro = r.art.erro, artOk = !!artNum && !artErro;
  const arquivoArt = f.anexos.artPlano ? f.anexos.arquivoArt : null;
  const artArquivoOk = !!arquivoArt && artOk && arquivoArt === `ART_${artNum}.pdf`;
  const cliente = cad.clientes.find((c) => c.id === f.clienteId) ?? null;

  const statusArt = !arquivoArt
    ? artOk ? `Não anexado. Clique na área acima para anexar ART_${artNum}.pdf.` : artNum ? `Não anexado: ${artErro}` : 'Não anexado. Informe o nº da ART na etapa 1 e depois clique na área acima.'
    : artArquivoOk ? `${arquivoArt} · anexado · nº confere com a etapa 1`
    : artErro ? `Bloqueado · ${arquivoArt}: ${artErro}`
    : `Bloqueado · ${arquivoArt} não bate com o nº informado (${artNum || 'vazio'}). Remova e anexe o PDF certo.`;

  const removerAnexo = (rotulo: string, patch: Partial<AnexosPlano>, tipo: TipoAnexoPlano) => p.confirmar({ titulo: 'Remover anexo?', texto: `${rotulo} sai deste plano. Você pode anexar de novo depois.`, acao: 'Remover' },
    () => {
      if (!comServidor || !numero) { set('anexos', { ...f.anexos, ...patch }); return; }
      api.removerAnexoPlano(numero, tipo).then((pl) => set('anexos', pl.anexos)).catch((e: unknown) => p.notificar(e instanceof Error ? e.message : 'Não foi possível remover o anexo.', 'error'));
    });

  const linhas: LinhaAnexo[] = [
    { rotulo: 'Desenhos de posicionamento (SolidWorks)', req: '(obrigatório)', tem: !!f.anexos.desenhos, alerta: false,
      status: f.anexos.desenhos ? `${f.anexos.desenhos} · anexado` : 'Não anexado. Clique na área acima para anexar.',
      remover: f.anexos.desenhos ? () => removerAnexo(f.anexos.desenhos ?? 'Desenhos', { desenhos: null }, 'desenhos') : undefined },
    { rotulo: 'ART do plano de rigging', req: '(obrigatório)', tem: !!arquivoArt, alerta: !!arquivoArt && !artArquivoOk, status: statusArt,
      remover: arquivoArt ? () => removerAnexo(arquivoArt, { artPlano: false, arquivoArt: null }, 'art') : undefined },
  ];
  const guindastes = [cad.guindastes.find((g) => g.id === f.guindasteId), ...f.guindastesAdicionais.map((a) => cad.guindastes.find((g) => g.id === a.guindasteId))]
    .filter((g): g is Guindaste => !!g);
  guindastes.forEach((g, i) => {
    const renovado = i === 0 && p.renovValida;
    const l = laudoAtual(g);
    const s = situacaoLaudo(g, r.dataOperacao.iso);
    linhas.push({
      rotulo: `Laudo técnico · ${g.modelo}`, req: DO_CADASTRO, tem: renovado || !!l?.arquivo,
      alerta: renovado ? false : !l?.arquivo || !s.aprovado,
      status: renovado ? `${arquivoLaudoRenovado(g)} · renovado, válido até ${dataBR(isoDeBR(p.renov.validade))}` : l?.arquivo ? `${l.arquivo} · ${s.texto}` : 'não cadastrado',
    });
    linhas.push({
      rotulo: `ART do laudo · ${g.modelo}`, req: DO_CADASTRO, tem: !!l?.art, alerta: !l?.art,
      status: l?.art ? `ART_${l.art}.pdf · do cadastro${renovado ? ' (refere-se ao laudo anterior; atualize no cadastro)' : ''}` : 'não cadastrado',
    });
  });

  const anexarSimulado = () => {
    const desenhos = `Desenhos_${numero ?? 'novo'}.pdf`;
    const novo: AnexosPlano = { ...f.anexos, desenhos };
    const lista: Identificado[] = [{ texto: `✓ ${desenhos} → desenhos de posicionamento`, alerta: false }];
    if (artOk) {
      novo.artPlano = true; novo.arquivoArt = `ART_${artNum}.pdf`;
      lista.push({ texto: `✓ ART_${artNum}.pdf → ART do plano (nº confere com a etapa 1)`, alerta: false });
    } else {
      lista.push({ texto: `! ART do plano não anexada: ${artNum ? artErro : 'informe o nº da ART na etapa 1 primeiro.'}`, alerta: true });
    }
    set('anexos', novo);
    setIdentificados(lista);
    p.notificar(artOk ? `Anexados: ${desenhos} e ART_${artNum}.pdf` : 'Desenhos anexados. Para anexar a ART, informe antes um nº válido na etapa 1.', artOk ? 'success' : 'warning');
  };

  /** Com o servidor: cada PDF sobe para a api (que confere os bytes); o nome mostrado é o que o servidor guardou. */
  const enviarAoServidor = async (arquivos: File[]) => {
    if (!numero) { p.notificar('Aguarde o rascunho ser salvo (o nº do plano aparece no topo) e anexe de novo.', 'warning'); return; }
    let anexos = f.anexos;
    const lista: Identificado[] = [];
    for (const a of arquivos) {
      const tipo: TipoAnexoPlano = /^ART/i.test(a.name) ? 'art' : 'desenhos';
      try {
        anexos = (await api.enviarAnexoPlano(numero, tipo, a)).anexos;
        const confere = tipo === 'desenhos' || (artOk && anexos.arquivoArt === `ART_${artNum}.pdf`);
        lista.push(tipo === 'desenhos' ? { texto: `✓ ${a.name} → desenhos de posicionamento`, alerta: false }
          : { texto: confere ? `✓ ${a.name} → ART do plano (nº confere com a etapa 1)` : `! ${a.name} → ART do plano, mas não bate com o nº informado (${artNum || 'vazio'}). Bloqueado.`, alerta: !confere });
      } catch (e) {
        lista.push({ texto: `! ${a.name}: ${e instanceof Error ? e.message : 'não foi enviado'}`, alerta: true });
      }
    }
    set('anexos', anexos);
    setIdentificados(lista);
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault(); setArrastando(false);
    const arquivos = Array.from(e.dataTransfer.files).filter((x) => /\.pdf$/i.test(x.name));
    if (!arquivos.length) { p.notificar('Solte arquivos PDF (desenhos do SolidWorks e ART do CREA).', 'warning'); return; }
    if (comServidor) { void enviarAoServidor(arquivos); return; }
    const novo: AnexosPlano = { ...f.anexos };
    const lista: Identificado[] = [];
    for (const a of arquivos) {
      if (/^ART/i.test(a.name)) {
        novo.artPlano = true; novo.arquivoArt = a.name;
        const confere = artOk && a.name === `ART_${artNum}.pdf`;
        lista.push({ texto: confere ? `✓ ${a.name} → ART do plano (nº confere com a etapa 1)` : `! ${a.name} → ART do plano, mas não bate com o nº informado (${artNum || 'vazio'}). Bloqueado.`, alerta: !confere });
      } else {
        novo.desenhos = a.name;
        lista.push({ texto: `✓ ${a.name} → desenhos de posicionamento`, alerta: false });
      }
    }
    set('anexos', novo);
    setIdentificados(lista);
  };

  const carimbo = () => {
    if (!numero || !cliente) { p.notificar('Escolha o contratante na etapa 1 (o plano precisa estar salvo) para gerar a planilha do carimbo.', 'warning'); return; }
    if (!comServidor) {
      p.notificar(`Carimbo_${numero}.xlsx salvo em ${cad.config.pastaRaiz}\\${cliente.nomePasta}\\${numero}\\Desenhos\\. No SolidWorks, vincule as propriedades do carimbo a esta planilha.`, 'info');
      return;
    }
    const nome = `Carimbo_${numero}.xlsx`;
    api.baixarCarimbo(numero)
      .then((xlsx) => guardarNaPastaDoPlano(xlsx, nome, { pastaRaiz: cad.config.pastaRaiz, pastaCliente: cliente.nomePasta, numero }, 'Desenhos'))
      .then((salvo) => p.notificar(`${ondeFicou(salvo, nome)} No SolidWorks, vincule as propriedades do carimbo aos nomes da planilha (ex.: NUMERO_PLANO, ART).`, 'info'))
      .catch((e: unknown) => p.notificar(e instanceof Error ? e.message : 'Não foi possível gerar a planilha do carimbo.', 'error'));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TituloEtapa titulo="Anexos externos" texto="Desenhos do SolidWorks e documentos do CREA entram no PDF final na ordem abaixo. Laudo e ART do guindaste vêm do cadastro." />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '12px 16px', border: `1px solid ${COR.borda}`, borderRadius: '3px', bgcolor: COR.cinza, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 700, color: COR.marinho }}>Documentos auxiliares</Typography>
          <Dica tamanho={16}>Dados prontos para colar no portal do CREA-PR e planilha com os dados do carimbo para vincular no SolidWorks.</Dica>
        </Box>
        <Button variant="outlined" onClick={p.abrirArt} sx={{ minHeight: 40, flexShrink: 0, borderColor: COR.marinho }}>Dados para a ART</Button>
        <Button variant="outlined" onClick={carimbo} sx={{ minHeight: 40, flexShrink: 0, borderColor: COR.marinho }}>Planilha do carimbo (.xlsx)</Button>
      </Box>

      <input ref={inputArquivo} type="file" accept=".pdf,application/pdf" multiple hidden aria-label="Selecionar PDFs dos anexos"
        onChange={(e) => { const arquivos = Array.from(e.target.files ?? []); e.target.value = ''; if (arquivos.length) void enviarAoServidor(arquivos); }} />
      <Box component="button" type="button" onClick={comServidor ? () => inputArquivo.current?.click() : anexarSimulado} onDragOver={(e: DragEvent) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
        sx={{ width: '100%', height: 130, border: `2.5px dashed ${COR.azul}`, borderRadius: '3px', bgcolor: arrastando ? '#DCE4F2' : '#EEF2F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75, color: COR.marinho, font: 'inherit', cursor: 'pointer', '&:hover': { borderColor: COR.marinho } }}>
        <UploadFileOutlined sx={{ fontSize: 30 }} />
        <Box component="span" sx={{ fontSize: 16, fontWeight: 600 }}>Arraste aqui os PDFs do SolidWorks e do CREA</Box>
        <Box component="span" sx={{ fontSize: 13, color: '#3A465E' }}>ou clique nesta área para selecionar os arquivos</Box>
      </Box>
      {identificados && (
        <Box role="status" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: '12px 14px', border: `1px solid ${COR.borda}`, borderRadius: '3px', bgcolor: '#fff', fontSize: 14 }}>
          <Typography sx={{ fontWeight: 700, color: COR.marinho }}>O sistema identificou os arquivos</Typography>
          {identificados.map((x) => <Box key={x.texto} sx={{ color: x.alerta ? COR.alertaTexto : COR.texto, fontWeight: x.alerta ? 600 : 400 }}>{x.texto}</Box>)}
        </Box>
      )}

      {linhas.map((l) => (
        <Box key={l.rotulo} sx={{ display: 'flex', alignItems: 'center', gap: 1.75, p: '12px 16px', borderRadius: '3px',
          ...(l.alerta ? { border: `1.5px solid ${COR.alerta}`, bgcolor: COR.alertaFundo } : l.tem ? { border: `1px solid ${COR.borda}`, bgcolor: '#fff' } : { border: `1.5px dashed ${COR.bordaCampo}`, bgcolor: COR.cinza }) }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '3px', bgcolor: COR.okFundo, color: COR.marinho, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <InsertDriveFileOutlined />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: COR.texto }}>{l.rotulo} <Box component="span" sx={{ fontWeight: 400, fontSize: 13, color: COR.sec }}>{l.req}</Box></Typography>
            <Typography sx={{ fontSize: 13, color: l.alerta ? COR.alertaTexto : COR.sec, fontWeight: l.alerta ? 600 : 400, overflowWrap: 'anywhere' }}>{l.status}</Typography>
          </Box>
          {l.remover && <Button variant="outlined" onClick={l.remover} sx={{ minHeight: 40, flexShrink: 0, borderColor: COR.bordaCampo, color: COR.sec, fontSize: 13 }}>Remover</Button>}
        </Box>
      ))}
    </Box>
  );
}
