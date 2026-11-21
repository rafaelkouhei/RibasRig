// Dados para preencher a ART no portal do CREA-PR, prontos para copiar campo a campo.
import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography } from '@mui/material';
import Close from '@mui/icons-material/Close';
import OpenInNew from '@mui/icons-material/OpenInNew';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Check from '@mui/icons-material/Check';
import { textoArt, type CampoArt } from '../../domain/art';
import { useNotificacao } from '../../components/Notificacao';
import type { FormPlano } from '../../domain/plano';
import type { Mudar } from './tipos';
import { COR } from './ui';

interface Props {
  aberto: boolean;
  fechar: () => void;
  numero: string | null;
  campos: CampoArt[];
  f: FormPlano;
  set: Mudar;
  /** Erro do nº da ART (13 dígitos, ART já usada em outro plano) */
  erroArt: string | null;
}

async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

export function DialogoArt({ aberto, fechar, numero, campos, f, set, erroArt }: Props) {
  const notificar = useNotificacao();
  const [copiado, setCopiado] = useState('');

  const fecharTudo = () => { setCopiado(''); fechar(); };
  const copiarCampo = async (rotulo: string, texto: string) => {
    const ok = await copiar(texto);
    setCopiado(rotulo);
    notificar(ok ? (rotulo === 'tudo' ? 'Todos os campos copiados.' : `Copiado: ${rotulo.toLowerCase()}.`) : 'Não foi possível copiar. Selecione o texto e use Ctrl + C.', ok ? 'success' : 'warning');
  };
  const salvar = () => {
    if (!f.art.trim()) { notificar('Cole o nº da ART gerada no CREA-PR antes de salvar.', 'warning'); return; }
    if (erroArt) { notificar(erroArt, 'warning'); return; }
    notificar(`ART ${f.art.trim()} vinculada ao plano ${numero ?? 'novo'}. Ela vai no cabeçalho, no procedimento e nos desenhos.`);
    fecharTudo();
  };
  const campoData = (rotulo: string, chave: 'artCelebracao' | 'artTermino') => (
    <TextField label={rotulo} type="date" value={f[chave]} onChange={(e) => set(chave, e.target.value)} />
  );

  return (
    <Dialog open={aberto} onClose={fecharTudo} maxWidth="md" fullWidth aria-labelledby="titulo-art">
      <DialogTitle id="titulo-art" component="div" sx={{ bgcolor: COR.marinho, color: '#fff', display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Dados para a ART · CREA-PR</Typography>
          <Typography sx={{ fontSize: 13, color: '#DDE2EC' }}>Plano nº {numero ?? '(gerado ao salvar)'} · abra o portal em outra aba e copie campo a campo</Typography>
        </Box>
        <Button variant="outlined" href="https://www.crea-pr.org.br" target="_blank" rel="noopener" endIcon={<OpenInNew fontSize="small" />}
          sx={{ color: '#fff', borderColor: '#BCC6DA', minHeight: 40, '&:hover': { borderColor: '#fff' } }}>Abrir portal do CREA-PR</Button>
        <IconButton aria-label="Fechar" onClick={fecharTudo} sx={{ color: '#fff' }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: COR.azul }}>CAMPOS QUE SÓ A ART PEDE</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.75 }}>
          <TextField label="Nº do contrato" placeholder="Sem número" value={f.artContrato} onChange={(e) => set('artContrato', e.target.value)} />
          {campoData('Celebrado em', 'artCelebracao')}
          <TextField label="Valor do contrato (R$)" value={f.artValor} onChange={(e) => set('artValor', e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          {campoData('Previsão de término', 'artTermino')}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.25 }}>
          <Typography sx={{ flexGrow: 1, fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: COR.azul }}>DADOS DO PLANO, NA ORDEM DO FORMULÁRIO DA ART</Typography>
          <Button variant="outlined" startIcon={<ContentCopy fontSize="small" />} onClick={() => copiarCampo('tudo', textoArt(campos))} sx={{ minHeight: 36, borderColor: COR.marinho }}>Copiar tudo</Button>
        </Box>
        <Box sx={{ border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
          {campos.map((c, i) => (
            <Box key={c.campo} sx={{ display: 'grid', gridTemplateColumns: '190px minmax(0, 1fr) 112px', gap: 1.75, alignItems: 'center', px: 1.75, py: 1, borderTop: i ? '1px solid #E4E8EE' : 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', color: COR.fraco, textTransform: 'uppercase' }}>{c.campo}</Typography>
              <Typography sx={{ fontSize: 14, color: c.pendente ? COR.alertaTexto : COR.texto, fontWeight: c.pendente ? 600 : 400, overflowWrap: 'anywhere' }}>{c.pendente ? '— não informado' : c.valor}</Typography>
              <Button size="small" variant="outlined" disabled={c.pendente} aria-label={`Copiar ${c.campo.toLowerCase()}`}
                startIcon={copiado === c.campo ? <Check fontSize="small" /> : undefined} onClick={() => copiarCampo(c.campo, c.valor)}
                sx={{ minHeight: 34, borderColor: copiado === c.campo ? COR.azul : COR.bordaCampo, ...(copiado === c.campo ? { bgcolor: COR.okFundo } : {}) }}>
                {copiado === c.campo ? 'Copiado' : 'Copiar'}
              </Button>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#FAFBFC', borderTop: `1px solid ${COR.borda}`, alignItems: 'flex-end', gap: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{ fontSize: 13, color: '#3A465E', mb: 1 }}>Depois de registrar no CREA-PR, cole aqui o número gerado:</Typography>
          <TextField label="Nº da ART gerada" placeholder="13 dígitos" value={f.art} onChange={(e) => set('art', e.target.value)} sx={{ maxWidth: 320 }}
            error={!!erroArt} helperText={erroArt ?? undefined} slotProps={{ htmlInput: { inputMode: 'numeric', style: { fontWeight: 600, fontSize: 16 } } }} />
        </Box>
        <Button variant="outlined" onClick={fecharTudo} sx={{ borderColor: COR.bordaCampo }}>Fechar</Button>
        <Button variant="contained" onClick={salvar}>Salvar nº da ART</Button>
      </DialogActions>
    </Dialog>
  );
}
