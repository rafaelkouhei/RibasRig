// Janela "Padrões de inspeção": o engenheiro mantém, por tipo de acessório, os itens que o inspetor confere.
// As NRs mudam, então o padrão é cadastro (não fica no código). Mudanças valem para as próximas inspeções.
import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutlineOutlined';
import { api } from '../../services/api';
import { useNotificacao } from '../../components/Notificacao';
import { dataBR } from '../../domain/formatacao';
import type { PadraoInspecao, TipoAcessorio } from '../../domain/types';
import { ROTULO_TIPO } from './acessorio';
import { BotaoLeve, COR, SomenteLeitura } from './ui';

interface Props {
  aberto: boolean;
  padroes: PadraoInspecao[];
  podeEditar: boolean;
  fechar: () => void;
  salvos: (p: PadraoInspecao[]) => void;
}

const TIPOS = Object.keys(ROTULO_TIPO) as TipoAcessorio[];
const iguais = (a: PadraoInspecao | undefined, b: PadraoInspecao | undefined) => JSON.stringify(a) === JSON.stringify(b);

export function PadroesInspecao({ aberto, padroes, podeEditar, fechar, salvos }: Props) {
  const notificar = useNotificacao();
  const [tipo, setTipo] = useState<TipoAcessorio>('cinta');
  const [rascunho, setRascunho] = useState<PadraoInspecao[]>(padroes);
  const [tentou, setTentou] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { if (aberto) { setRascunho(structuredClone(padroes)); setTentou(false); } }, [aberto, padroes]);

  const atual = rascunho.find((p) => p.tipo === tipo) ?? { tipo, referencia: '', itens: [], atualizadoEm: null };
  const alterados = rascunho.filter((p) => !iguais(p, padroes.find((x) => x.tipo === p.tipo)));
  const semItens = rascunho.filter((p) => !p.itens.some((t) => t.trim()));
  const mudar = (patch: Partial<PadraoInspecao>) => setRascunho((l) => {
    const novo = { ...atual, ...patch };
    return l.some((p) => p.tipo === tipo) ? l.map((p) => (p.tipo === tipo ? novo : p)) : [...l, novo];
  });
  const mudarItem = (i: number, texto: string) => mudar({ itens: atual.itens.map((t, j) => (j === i ? texto : t)) });

  const salvar = async () => {
    if (semItens.length) { setTentou(true); setTipo(semItens[0].tipo); notificar('Não salvo: cada tipo precisa de pelo menos um item.', 'warning'); return; }
    setOcupado(true);
    try {
      const gravados = await Promise.all(alterados.map((p) => api.salvarPadraoInspecao(p)));
      salvos(padroes.map((p) => gravados.find((g) => g.tipo === p.tipo) ?? p));
      notificar(`${gravados.length === 1 ? 'Padrão salvo' : `${gravados.length} padrões salvos`}. Vale para as próximas inspeções.`);
      fechar();
    } catch (err) { notificar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error'); } finally { setOcupado(false); }
  };

  return (
    <Dialog open={aberto} onClose={ocupado ? undefined : fechar} maxWidth="md" fullWidth aria-labelledby="titulo-padroes">
      <DialogTitle id="titulo-padroes" sx={{ bgcolor: COR.marinho, color: '#fff', fontSize: 17, fontWeight: 600, py: 1.75 }}>Padrões de inspeção por tipo de acessório</DialogTitle>
      <SomenteLeitura.Provider value={!podeEditar}>
        <DialogContent sx={{ pt: '18px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: 14, color: COR.sec }}>
            Os itens que o inspetor confere em cada tipo. Não há regra fixa de troca por número de usos ou por meses: o item sai de uso
            quando é reprovado na inspeção ou quando passa do vencimento definido no cadastro.
          </Typography>
          <Box role="tablist" aria-label="Tipo de acessório" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {TIPOS.map((t) => {
              const on = t === tipo;
              const mudou = alterados.some((p) => p.tipo === t);
              return (
                <Button key={t} role="tab" aria-selected={on} onClick={() => setTipo(t)}
                  sx={{ minHeight: 38, height: 38, px: 1.5, fontSize: 14, ...(on ? { bgcolor: COR.marinho, color: '#fff', '&:hover': { bgcolor: COR.marinho } } : { bgcolor: '#fff', color: COR.marinho, boxShadow: `inset 0 0 0 1px ${COR.borda}` }) }}>
                  {ROTULO_TIPO[t]}{mudou ? ' •' : ''}
                </Button>
              );
            })}
          </Box>
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {atual.itens.map((texto, i) => (
              <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="span" sx={{ width: 24, flexShrink: 0, fontSize: 13, fontWeight: 600, color: COR.fraco, textAlign: 'right' }}>{i + 1}.</Box>
                <TextField size="small" fullWidth value={texto} onChange={(e) => mudarItem(i, e.target.value)} slotProps={{ input: { readOnly: !podeEditar }, htmlInput: { 'aria-label': `Item ${i + 1}` } }} />
                {podeEditar && (
                  <IconButton aria-label={`Remover item ${i + 1}`} onClick={() => mudar({ itens: atual.itens.filter((_, j) => j !== i) })} sx={{ color: COR.alertaTexto }}>
                    <DeleteOutline />
                  </IconButton>
                )}
              </Box>
            ))}
            {!atual.itens.length && <Typography sx={{ fontSize: 13, color: tentou ? COR.alertaTexto : COR.fraco, fontWeight: tentou ? 600 : 400 }}>Nenhum item. Cada tipo precisa de pelo menos um.</Typography>}
          </Box>
          <Box><BotaoLeve tracejado onClick={() => mudar({ itens: [...atual.itens, ''] })}>+ Item</BotaoLeve></Box>
          <TextField label="Normas e referências" multiline minRows={2} value={atual.referencia} onChange={(e) => mudar({ referencia: e.target.value })}
            slotProps={{ input: { readOnly: !podeEditar } }} helperText={atual.atualizadoEm ? `Atualizado em ${dataBR(atual.atualizadoEm)}` : 'Padrão inicial do sistema, ainda não revisado.'} />
        </DialogContent>
      </SomenteLeitura.Provider>
      <DialogActions sx={{ px: 3, pb: 2.25 }}>
        <Typography sx={{ flexGrow: 1, fontSize: 12, color: COR.fraco }}>Mudanças valem para as próximas inspeções. As já registradas guardam os itens da época.</Typography>
        <Button variant="outlined" onClick={fechar} disabled={ocupado} sx={{ borderColor: '#8F9AB0' }}>{podeEditar ? 'Cancelar' : 'Fechar'}</Button>
        {podeEditar && <Button variant="contained" onClick={salvar} disabled={ocupado || !alterados.length}>{ocupado ? 'Salvando…' : 'Salvar padrões'}</Button>}
      </DialogActions>
    </Dialog>
  );
}
