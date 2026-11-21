// Seção "Laudo técnico" do cadastro de guindastes: situação em HOJE, campos do laudo, PDF simulado e histórico.
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import { HOJE, dataBR, isoDeBR } from '../../domain/formatacao';
import { situacaoLaudo } from '../../domain/calculos';
import type { Guindaste, Laudo } from '../../domain/types';
import { GUINDASTE_VAZIO, textoLaudo, validarLaudo, type FormLaudo } from './guindaste';
import { Aviso, BotaoLeve, COR, Campo, Selo, TituloGrupo, type Tom } from './ui';

const ICONE: Record<Tom, ReactNode> = {
  alertaForte: <WarningAmberOutlined />, alerta: <ScheduleOutlined />, neutro: <InfoOutlined />, ok: <CheckOutlined />,
};

interface Props {
  salvo: Guindaste | null;
  laudo: FormLaudo;
  alterar: (l: FormLaudo) => void;
  tentou: boolean;
  placeholderArt: string;
  anexarPdf: () => void;
}

const periodo = (l: Pick<Laudo, 'inicio' | 'fim'>) => `${dataBR(l.inicio)} a ${dataBR(l.fim)}`;

export function SecaoLaudo({ salvo, laudo, alterar, tentou, placeholderArt, anexarPdf }: Props) {
  const situacao = situacaoLaudo(salvo, HOJE);
  const sit = textoLaudo(situacao);
  const atual = situacao.laudo;
  const erros = validarLaudo(laudo, !!atual, tentou);
  const set = (k: keyof FormLaudo) => (v: string) => alterar({ ...laudo, [k]: v });

  // Prévia: como fica a situação ao salvar o laudo digitado
  const ini = isoDeBR(laudo.inicio), fim = isoDeBR(laudo.fim);
  const mudou = !atual ? !!fim : (fim !== atual.fim || laudo.novo);
  const previa = mudou && ini && fim && !erros.fim
    ? textoLaudo(situacaoLaudo({ ...(salvo ?? GUINDASTE_VAZIO), laudos: [{ inicio: ini, fim, art: '', arquivo: null, atual: true }] }, HOJE)).curto
    : null;

  const historico = (salvo?.laudos ?? []).map((l) => ({ l, atualDele: l === atual })).reverse();

  return (
    <>
      <TituloGrupo acao={atual && !laudo.novo
        ? <BotaoLeve tracejado onClick={() => alterar({ inicio: '', fim: '', art: '', arquivo: '', novo: true })}>+ Registrar novo laudo</BotaoLeve>
        : laudo.novo && atual
          ? <BotaoLeve onClick={() => alterar({ inicio: dataBR(atual.inicio), fim: dataBR(atual.fim), art: atual.art, arquivo: atual.arquivo ?? '', novo: false })}>Cancelar novo laudo</BotaoLeve>
          : null}>
        Laudo técnico
      </TituloGrupo>
      <Aviso tom={sit.tom} titulo={sit.titulo} icone={ICONE[sit.tom]}>
        {sit.texto}{previa ? ` Ao salvar: ${previa}.` : ''}
      </Aviso>
      {laudo.novo && atual && (
        <Typography sx={{ fontSize: 13, color: COR.neutroTexto }}>
          Novo laudo: preencha os dados abaixo. Ao salvar, o laudo atual ({periodo(atual)}) vai para o histórico.
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.75 }}>
        <Campo id="g_lIni" label="Validade · início" placeholder="dd/mm/aaaa" modo="numeric" value={laudo.inicio} onValor={set('inicio')} erro={erros.inicio} />
        <Campo id="g_lFim" label="Validade · fim" placeholder="dd/mm/aaaa" modo="numeric" value={laudo.fim} onValor={set('fim')} erro={erros.fim} />
        <Campo id="g_lArt" label="ART do laudo" placeholder={placeholderArt} modo="numeric" value={laudo.art} onValor={set('art')} erro={erros.art} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, border: `1px solid ${COR.borda}`, borderRadius: '3px' }}>
        <DescriptionOutlined sx={{ color: COR.azul }} aria-hidden />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, color: COR.fraco }}>Arquivo PDF do laudo</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: laudo.arquivo ? COR.marinho : COR.fraco }}>{laudo.arquivo || 'Nenhum arquivo anexado'}</Typography>
        </Box>
        {laudo.arquivo && <BotaoLeve perigo onClick={() => alterar({ ...laudo, arquivo: '' })}>Remover arquivo</BotaoLeve>}
        <BotaoLeve onClick={anexarPdf}>{laudo.arquivo ? 'Trocar PDF' : 'Anexar PDF'}</BotaoLeve>
      </Box>
      <Typography component="h4" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.8, color: COR.fraco }}>HISTÓRICO DE LAUDOS</Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden', mt: -1 }}>
        {historico.map(({ l, atualDele }, i) => {
          const s = atualDele ? textoLaudo(situacao) : null;
          return (
            <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, borderTop: i ? '1px solid #EEF0F4' : 'none', fontSize: 13 }}>
              <Box component="span" sx={{ flexGrow: 1 }}>{periodo(l)} · ART {l.art || 'não informada'} · {l.arquivo || 'sem PDF'}</Box>
              {s ? <Selo tom={s.tom}>{situacao.situacao === 'vencido' ? 'Atual · vencido' : 'Atual'}</Selo> : <Selo tom="neutro">Anterior</Selo>}
            </Box>
          );
        })}
        {!historico.length && <Box component="li" sx={{ px: 1.5, py: 1.25, fontSize: 13, color: COR.fraco }}>Nenhum laudo cadastrado ainda.</Box>}
      </Box>
    </>
  );
}
