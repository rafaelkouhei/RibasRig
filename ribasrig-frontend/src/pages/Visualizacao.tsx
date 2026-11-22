import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Link, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { BarraPlano } from '../components/Cabecalho';
import { situacaoLaudo } from '../domain/calculos';
import { dataBR } from '../domain/formatacao';
import { usePlanoCalculado, type PlanoCalculado } from '../usePlanoCalculado';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { MODO_API } from '../services/api';
import { DestaqueCtx, FichaDados, PaginaAnexo, Procedimento } from './visualizacao/Documento';
import { EstadoCarga } from './visualizacao/EstadoCarga';
import { Lateral } from './visualizacao/Lateral';
import { escolherVista, SECOES_DOCUMENTO, valoresFicha, vistasDoPlano, type IdVista, type VistaPlano } from './visualizacao/vistas';


export default function Visualizacao() {
  const numero = useParams().numero ?? '';
  const { dados, carregando, erro, recarregar } = usePlanoCalculado(numero);
  if (carregando || erro || !dados || dados.plano.numero !== numero) return <EstadoCarga numero={numero} erro={erro} recarregar={recarregar} />;
  return <Conteudo d={dados} />;
}

function Selo({ texto, emitido }: { texto: string; emitido: boolean }) {
  return <Box component="span" sx={{ px: 1.25, py: 0.5, borderRadius: '2px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', ...(emitido ? { bgcolor: '#DDE3EE', color: '#34446A' } : { bgcolor: '#E6E9F0', color: '#3A465E', border: '1px solid #C5CCDA' }) }}>{texto}</Box>;
}

function Conteudo({ d }: { d: PlanoCalculado }) {
  const { plano, calculo } = d;
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const [secao, setSecao] = useState(0);
  const [destacar, setDestacar] = useState(true);
  const vistas = vistasDoPlano(plano, calculo);
  const vista = escolherVista(vistas, params.get('rev'));
  const emitido = plano.situacaoDocumento === 'emitido';
  const escolher = (id: IdVista) => setParams(id === vistas[0].id ? {} : { rev: String(id) }, { replace: true });
  const rev = vista.revisao;
  const ultima = plano.revisoes[plano.revisoes.length - 1];

  const acoes = (
    <>
      <FormControlLabel control={<Checkbox size="small" checked={destacar} onChange={(e) => setDestacar(e.target.checked)} sx={{ p: 0.5 }} />} label="Destacar dados preenchidos pelo sistema" sx={{ mr: 0, ml: 0, gap: 0.5, '& .MuiFormControlLabel-label': { fontSize: 14, color: 'primary.main', whiteSpace: 'nowrap' } }} />
      {rev && (
        <Button variant="contained" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} component={RouterLink} to={`/planos/${plano.numero}/pdf${rev === ultima && emitido ? '' : `?rev=${rev.numero}`}`}>
          {rev.origem === 'excel' ? `Abrir PDF original (Rev. ${rev.numero})` : `Abrir PDF da Rev. ${rev.numero}`}
        </Button>
      )}
      {!emitido && pode(usuario?.perfil, 'editarRascunhos') && <Button variant="contained" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} component={RouterLink} to={`/planos/${plano.numero}/editar`}>Continuar editando</Button>}
    </>
  );

  return (
    <Box>
      <BarraPlano
        voltar="/"
        caminho={<><Link component={RouterLink} to="/">Planos de Rigging</Link> / {plano.numero}</>}
        titulo={<Box component="span" sx={{ whiteSpace: 'nowrap' }}>Plano de Rigging nº {plano.numero}</Box>}
        selo={<>
          <Selo texto={vista.selo} emitido={!!rev} />
          {emitido && <Typography component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}><LockOutlined sx={{ fontSize: 15 }} aria-hidden />Somente leitura</Typography>}
        </>}
        acoes={acoes}
      />
      <Box sx={{ display: { xs: 'block', lg: 'flex' }, mx: { xs: -2, md: '-36px' }, mt: -3, mb: { xs: -2, md: '-28px' }, minHeight: 'calc(100vh - 77px)' }}>
        <Miniaturas secao={secao} setSecao={setSecao} />
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: '22px', px: 2, overflowX: 'auto' }}>
          {!rev && (
            <Box role="note" sx={{ width: 540, maxWidth: '100%', boxSizing: 'border-box', px: 1.5, py: 1, bgcolor: '#FBE1C6', color: '#8A3F04', borderLeft: '4px solid #C2610C', borderRadius: '3px', fontSize: 13 }}>
              <b>Prévia — rascunho.</b> Calculado agora com os dados atuais; não é um documento emitido.
            </Box>
          )}
          <DestaqueCtx.Provider value={destacar}>
            <Pagina secao={secao} d={d} vista={vista} />
          </DestaqueCtx.Provider>
        </Box>
        <Lateral plano={plano} calculo={calculo} vistas={vistas} vista={vista} escolher={escolher} avisoAtencaoPct={d.config.avisoAtencaoPct} />
      </Box>
    </Box>
  );
}

function Miniaturas({ secao, setSecao }: { secao: number; setSecao: (i: number) => void }) {
  return (
    <Box component="nav" aria-label="Seções do documento" sx={{ width: { lg: 176 }, flexShrink: 0, p: '16px 14px', display: 'flex', flexDirection: { xs: 'row', lg: 'column' }, flexWrap: 'wrap', gap: 1.25, borderRight: { lg: '1px solid #D5DAE3' }, bgcolor: '#F4F5F8' }}>
      <Typography component="h2" sx={{ width: '100%', fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#566075' }}>SEÇÕES DO PDF</Typography>
      {SECOES_DOCUMENTO.map((s, i) => {
        const on = secao === i;
        return (
          <Box key={s.rotulo} component="button" type="button" onClick={() => setSecao(i)} aria-current={on ? 'page' : undefined}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', p: '10px 12px', borderRadius: '3px', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#1F2A40', bgcolor: '#FFFFFF', border: on ? '2px solid #34446A' : '1px solid #D5DAE3', '&:hover': { borderColor: '#4A6192' } }}>
            {/* Com o servidor as páginas dependem dos anexos: só a ordem das seções é fixa */}
            <Box component="span" sx={{ fontSize: 12, color: '#566075' }}>{MODO_API === 'http' ? `${i + 1}ª seção` : s.paginas}</Box>
            <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>{s.rotulo}</Box>
            <Box component="span" sx={{ fontSize: 12, color: '#566075' }}>{s.origem}</Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** Página do documento escolhida nas miniaturas, com os valores da revisão exibida. */
function Pagina({ secao, d, vista }: { secao: number; d: PlanoCalculado; vista: VistaPlano }) {
  const { plano, cliente, guindaste, acessorios, config, calculo } = d;
  const lingadaItensKg = calculo.lingadaKg;
  const valores = valoresFicha(vista, plano, acessorios, lingadaItensKg);
  const anexos = plano.anexos;
  const falta = vista.revisao ? null : 'Ainda não anexado: necessário para emitir.';
  switch (secao) {
    case 1:
      return <PaginaAnexo titulo="Desenhos de posicionamento" linhas={anexos.desenhos ? [`Anexo inserido sem alteração: ${anexos.desenhos}`] : []} pendente={anexos.desenhos ? null : falta ?? 'Desenhos não anexados.'}
        nota="Gerados no SolidWorks pelo engenheiro. O carimbo das folhas usa os mesmos dados do plano." />;
    case 2:
      return <PaginaAnexo titulo="ART do plano de rigging" linhas={anexos.artPlano && anexos.arquivoArt ? [`Anexo inserido sem alteração: ${anexos.arquivoArt}`] : []} pendente={anexos.artPlano && anexos.arquivoArt ? null : falta ?? 'ART não anexada.'}
        nota="Emitida no portal do CREA-PR e anexada ao plano." />;
    case 3:
      return <Procedimento plano={plano} cliente={cliente} guindaste={guindaste} config={config} isolamento={valores.isolamento} />;
    case 4: {
      const data = vista.resultados.dataOperacao ?? plano.dataOperacao;
      const laudo = situacaoLaudo(guindaste, data);
      const arquivo = laudo.laudo?.arquivo ?? 'Laudo sem arquivo no cadastro';
      const linhas = laudo.aprovado ? [`${arquivo} · válido na data da operação (${dataBR(data)})`] : [arquivo];
      if (laudo.laudo?.art) linhas.push(`ART do laudo: ART_${laudo.laudo.art}.pdf · inseridos sem alteração`);
      const pendente = laudo.aprovado ? null
        : laudo.situacao === 'vencido' ? `Laudo ${laudo.texto}: reprovado para a operação de ${dataBR(data)}.`
        : `${laudo.texto.charAt(0).toUpperCase()}${laudo.texto.slice(1)}: o laudo não aprova a operação.`;
      return <PaginaAnexo titulo="Laudo técnico e ART do guindaste" linhas={linhas} pendente={pendente}
        nota="Vêm do cadastro do guindaste. O laudo é conferido contra a data da operação, não contra a data de hoje." />;
    }
    default:
      return <FichaDados plano={plano} cliente={cliente} guindaste={guindaste} acessorios={acessorios} config={config} valores={valores} />;
  }
}
