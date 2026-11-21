// Janela "Registrar inspeção": o inspetor confere cada item do padrão do tipo do acessório.
// Aprovado volta (ou continua) "Em uso" com a próxima inspeção; reprovado é descartado com motivo ou fica "Em inspeção".
import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { api } from '../../services/api';
import { Dica } from '../../components/Dica';
import { useNotificacao } from '../../components/Notificacao';
import {
  formInspecao, motivoSugerido, registroDoForm, resultadoDasMarcas, validarInspecao, type DestinoReprovado, type FormInspecao,
} from '../../domain/inspecao';
import type { Acessorio, PadraoInspecao } from '../../domain/types';
import { ROTULO_TIPO } from './acessorio';
import { Aviso, BotaoLeve, COR, Campo } from './ui';

interface Props {
  acessorio: Acessorio | null;
  padrao: PadraoInspecao | null;
  responsavel: string;
  fechar: () => void;
  registrado: (a: Acessorio) => void;
}

export function RegistrarInspecao({ acessorio, padrao, responsavel, fechar, registrado }: Props) {
  const notificar = useNotificacao();
  const itens = padrao?.itens ?? [];
  const [form, setForm] = useState<FormInspecao>(() => formInspecao(itens, responsavel));
  const [tentou, setTentou] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Cada abertura começa do zero, com os itens do padrão daquele momento
  useEffect(() => {
    if (acessorio) { setForm(formInspecao(padrao?.itens ?? [], responsavel)); setTentou(false); }
  }, [acessorio, padrao, responsavel]);

  if (!acessorio) return null;
  const resultado = resultadoDasMarcas(form.marcas);
  const erros = validarInspecao(form, acessorio.ultimaInspecao);
  const set = (k: keyof FormInspecao) => (v: string) => setForm({ ...form, [k]: v });

  /** Marca um item e mantém o motivo sugerido em dia enquanto o usuário não escreveu o próprio. */
  const marcar = (i: number, v: boolean | null) => {
    const marcas = form.marcas.map((m, j) => (j === i ? v : m));
    const sugeridoAntes = motivoSugerido(itens, form.marcas);
    const motivo = !form.motivo.trim() || form.motivo === sugeridoAntes ? motivoSugerido(itens, marcas) : form.motivo;
    setForm({ ...form, marcas, motivo });
  };
  const todosConformes = () => setForm({ ...form, marcas: itens.map(() => true), motivo: form.motivo === motivoSugerido(itens, form.marcas) ? '' : form.motivo });

  const registrar = async () => {
    if (erros.total) { setTentou(true); return; }
    setOcupado(true);
    try {
      const a = await api.registrarInspecao(acessorio.id, registroDoForm(itens, form), form.destino, form.motivo);
      notificar(resultado === 'aprovado' ? 'Inspeção registrada: aprovada.' : form.destino === 'descartado' ? 'Inspeção registrada: reprovada e acessório descartado.' : 'Inspeção registrada: reprovada, acessório em inspeção para reparo.');
      registrado(a);
    } catch (err) { notificar(err instanceof Error ? err.message : 'Não foi possível registrar a inspeção.', 'error'); } finally { setOcupado(false); }
  };

  const conferidos = form.marcas.filter((m) => m !== null).length;
  return (
    <Dialog open onClose={ocupado ? undefined : fechar} maxWidth="md" fullWidth aria-labelledby="titulo-inspecao">
      <DialogTitle id="titulo-inspecao" sx={{ bgcolor: COR.marinho, color: '#fff', fontSize: 17, fontWeight: 600, py: 1.75 }}>
        Registrar inspeção · {acessorio.descricao}
      </DialogTitle>
      <DialogContent sx={{ pt: '18px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 14, color: COR.sec }}>
          Padrão de inspeção: <b style={{ color: COR.marinho }}>{ROTULO_TIPO[acessorio.tipo]}</b> · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          {padrao?.referencia && <Dica tamanho={17} texto="Referência do padrão"><p>{padrao.referencia}</p><p>Limites numéricos (desgaste, arames rompidos etc.) ficam na norma e no manual do fabricante.</p></Dica>}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: 1.75 }}>
          <Campo id="insp_data" type="date" label="Data da inspeção *" value={form.data} onValor={set('data')} erro={tentou ? erros.data : null} slotProps={{ inputLabel: { shrink: true } }} />
          <Campo id="insp_resp" label="Responsável pela inspeção" value={form.responsavel} onValor={set('responsavel')} />
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: COR.fraco, flexGrow: 1 }}>
              ITENS CONFERIDOS ({conferidos} DE {itens.length})
            </Typography>
            {itens.length > 0 && <BotaoLeve onClick={todosConformes}>Marcar todos como conformes</BotaoLeve>}
          </Box>
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', border: `1px solid ${COR.borda}`, borderRadius: '3px' }}>
            {itens.map((texto, i) => {
              const m = form.marcas[i];
              return (
                <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderTop: i ? '1px solid #EEF0F4' : 'none', bgcolor: m === false ? COR.alertaFundo : 'transparent' }}>
                  <Box component="span" sx={{ width: 22, flexShrink: 0, fontSize: 13, fontWeight: 600, color: COR.fraco }}>{i + 1}.</Box>
                  <Box component="span" sx={{ flexGrow: 1, fontSize: 14, color: COR.marinho }}>{texto}</Box>
                  <ToggleButtonGroup exclusive size="small" value={m === null ? '' : m ? 'sim' : 'nao'} aria-label={`Item ${i + 1}: ${texto}`}
                    onChange={(_, v: string | null) => marcar(i, v === 'sim' ? true : v === 'nao' ? false : null)}
                    sx={{ flexShrink: 0, '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 13, fontWeight: 600, px: 1.25, py: 0.5, whiteSpace: 'nowrap' },
                      '& .MuiToggleButton-root.Mui-selected[value="sim"]': { bgcolor: COR.marinho, color: '#fff' },
                      '& .MuiToggleButton-root.Mui-selected[value="nao"]': { bgcolor: COR.alertaTexto, color: '#fff' } }}>
                    <ToggleButton value="sim">Conforme</ToggleButton>
                    <ToggleButton value="nao">Não conforme</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              );
            })}
          </Box>
          {tentou && erros.marcas && <Typography role="alert" sx={{ mt: 0.75, fontSize: 12, fontWeight: 600, color: COR.alertaTexto }}>{erros.marcas}</Typography>}
        </Box>

        {resultado === 'aprovado' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 1.75, alignItems: 'start' }}>
            <Aviso tom="ok" titulo="Aprovado">Todos os itens conformes. O acessório fica "Em uso" até a próxima inspeção.</Aviso>
            <Campo id="insp_prox" type="date" label="Próxima inspeção *" value={form.proxima} onValor={set('proxima')} erro={tentou ? erros.proxima : null} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
        )}
        {resultado === 'reprovado' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Aviso tom="alertaForte" titulo="Reprovado">Pelo menos um item não conforme. O acessório sai de uso.</Aviso>
            <RadioGroup row value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value as DestinoReprovado })} aria-label="O que fazer com o acessório reprovado">
              <FormControlLabel value="descartado" control={<Radio />} label="Descartar" />
              <FormControlLabel value="inspecao" control={<Radio />} label='Deixar "Em inspeção" (reparo)' />
            </RadioGroup>
            {form.destino === 'descartado' && (
              <Campo id="insp_motivo" label="Motivo do descarte *" multiline minRows={2} value={form.motivo} onValor={set('motivo')} erro={tentou ? erros.motivo : null} ajuda="Já vem com os itens não conformes. Dá para completar." />
            )}
          </Box>
        )}
        <Campo id="insp_obs" label="Observação" multiline minRows={2} value={form.observacao} onValor={set('observacao')} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.25 }}>
        <Typography sx={{ flexGrow: 1, fontSize: 12, color: COR.fraco }}>A inspeção guarda a cópia dos itens: mudar o padrão depois não altera este registro.</Typography>
        <Button variant="outlined" onClick={fechar} disabled={ocupado} sx={{ borderColor: '#8F9AB0' }}>Cancelar</Button>
        <Button variant="contained" onClick={registrar} disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar inspeção'}</Button>
      </DialogActions>
    </Dialog>
  );
}
