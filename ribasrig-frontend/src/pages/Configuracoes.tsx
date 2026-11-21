import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, LinearProgress, Link,
  Paper, Radio, RadioGroup, Skeleton, TextField, Typography,
} from '@mui/material';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { Cabecalho } from '../components/Cabecalho';
import { Dica } from '../components/Dica';
import { useNotificacao } from '../components/Notificacao';
import { useCarregar } from '../hooks';
import { api, MODO_API } from '../services/api';
import { desktop } from '../services/arquivos';
import { useAvisoSaida } from './calculos/avisoSaida';
import { erroLaranja } from './calculos/comum';
import { cnpjValido, HOJE, numParaTexto, somenteDigitos } from '../domain/formatacao';
import { erroNomeArquivo, validarCampo } from '../domain/validacao';
import { caminhoPlano, nomeArquivoPlano } from '../domain/plano';
import { proximoNumero } from '../domain/numeracao';
import { LIMITE_PADRAO_PCT, definirLimite } from '../domain/calculos';
import type { Configuracoes as Config } from '../domain/types';
import logoCompleto from '../assets/logo-ribas-completo.png';

/** Formulário em texto (números também). */
interface Form {
  pastaRaiz: string; nomeArquivo: string;
  razaoSocial: string; cnpj: string; ie: string; endereco: string; cep: string;
  nomeCompleto: string; nomeAssinatura: string; titulo: string; crea: string; rnp: string; rpp: string;
  limite: string; aviso: string; vento: string;
}

const formDe = (c: Config): Form => ({
  pastaRaiz: c.pastaRaiz, nomeArquivo: c.nomeArquivo,
  razaoSocial: c.empresa.razaoSocial, cnpj: c.empresa.cnpj, ie: c.empresa.ie, endereco: c.empresa.endereco, cep: c.empresa.cep,
  nomeCompleto: c.responsavel.nomeCompleto, nomeAssinatura: c.responsavel.nomeAssinatura, titulo: c.responsavel.titulo,
  crea: c.responsavel.crea, rnp: c.responsavel.rnp, rpp: c.responsavel.rpp,
  limite: numParaTexto(c.limitePct), aviso: numParaTexto(c.avisoAtencaoPct), vento: numParaTexto(c.ventoPadraoMs, 1),
});

type Erros = Partial<Record<keyof Form, string>>;

function validar(f: Form) {
  const limite = validarCampo('limitePct', f.limite);
  const aviso = validarCampo('avisoAtencaoPct', f.aviso);
  const vento = validarCampo('ventoPadrao', f.vento);
  const erros: Erros = {};
  if (!f.pastaRaiz.trim()) erros.pastaRaiz = 'Informe a pasta raiz.';
  const nome = erroNomeArquivo(f.nomeArquivo);
  if (nome) erros.nomeArquivo = nome;
  if (limite.erro) erros.limite = limite.erro;
  if (aviso.erro) erros.aviso = aviso.erro;
  else if (!limite.erro && aviso.valor >= limite.valor) erros.aviso = `Use um valor menor que o limite (${numParaTexto(limite.valor)}%).`;
  if (vento.erro) erros.vento = vento.erro;
  if (f.cnpj.trim() && !cnpjValido(f.cnpj)) erros.cnpj = 'CNPJ inválido. Confira os dígitos.';
  if (f.cep.trim() && somenteDigitos(f.cep).length !== 8) erros.cep = 'CEP com 8 dígitos, ex.: 82.410-540.';
  if (!f.razaoSocial.trim()) erros.razaoSocial = 'Informe a razão social.';
  if (!f.nomeCompleto.trim()) erros.nomeCompleto = 'Informe o nome completo.';
  if (!f.nomeAssinatura.trim()) erros.nomeAssinatura = 'Informe o nome que sai nas assinaturas.';
  if (!f.crea.trim()) erros.crea = 'Informe o registro no CREA.';
  return { erros, limite, aviso, vento };
}

/** Cartão com faixa marinho; `sub` (para que serve) fica no ícone "i" ao lado do título. */
function Cartao({ titulo, sub, children }: { titulo: string; sub: ReactNode; children: ReactNode }) {
  return (
    <Paper component="section" sx={{ overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2.25, py: 1.5, bgcolor: 'primary.main', color: '#fff' }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>{titulo}</Typography>
        <Dica claro>{sub}</Dica>
      </Box>
      <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
    </Paper>
  );
}

/** Valor fixo (somente leitura) com cadeado. */
function Fixo({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <TextField label={rotulo} value={valor} helperText={nota}
      slotProps={{ input: { readOnly: true, startAdornment: <LockOutlined fontSize="small" sx={{ mr: 0.75, color: 'primary.main' }} /> } }}
      sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#F3F5F8' }, '& .MuiInputBase-input': { fontWeight: 600, color: 'primary.main' } }} />
  );
}

function Pasta({ nivel, forte, arquivo, children }: { nivel: number; forte?: boolean; arquivo?: boolean; children: ReactNode }) {
  const Icone = arquivo ? PictureAsPdfOutlined : FolderOutlined;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: nivel * 2.25, py: 0.25, fontSize: 13, fontWeight: forte ? 700 : 400, color: forte ? 'primary.main' : 'inherit' }}>
      <Icone sx={{ fontSize: 16, color: arquivo ? '#8A3F04' : '#4A6192' }} aria-hidden />{children}
    </Box>
  );
}

export default function Configuracoes() {
  const carga = useCarregar(async () => {
    const [config, planos] = await Promise.all([api.obterConfiguracoes(), api.listarPlanos()]);
    return { config, proximo: proximoNumero(HOJE, planos.map((p) => p.numero)) };
  }, null as { config: Config; proximo: string } | null);

  if (carga.erro) {
    return (
      <Box>
        <Cabecalho secao="ADMINISTRAÇÃO" titulo="Configurações" voltar="/" />
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={carga.recarregar}>Tentar de novo</Button>}>{carga.erro}</Alert>
      </Box>
    );
  }
  if (!carga.dados) {
    return (
      <Box>
        <Cabecalho secao="ADMINISTRAÇÃO" titulo="Configurações" voltar="/" descricao="Definidas uma vez. Todo plano novo usa estes dados sem precisar digitar de novo." />
        <LinearProgress aria-label="Carregando configurações" sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5 }}>
          <Skeleton variant="rectangular" height={420} /><Skeleton variant="rectangular" height={420} />
        </Box>
      </Box>
    );
  }
  return <Editor inicial={carga.dados.config} proximo={carga.dados.proximo} />;
}

function Editor({ inicial, proximo }: { inicial: Config; proximo: string }) {
  const notificar = useNotificacao();
  const [base, setBase] = useState(inicial);
  const [f, setF] = useState<Form>(() => formDe(inicial));
  const [sujo, setSujo] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const entradaLogo = useRef<HTMLInputElement>(null);
  const entradaAssinatura = useRef<HTMLInputElement>(null);
  const dialogoSaida = useAvisoSaida(sujo, 'As configurações alteradas ainda não foram salvas.');

  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo); }, [logo]);
  useEffect(() => () => { if (assinatura) URL.revokeObjectURL(assinatura); }, [assinatura]);

  const { erros, limite, aviso, vento } = validar(f);
  /** Novo limite esperando a confirmação do administrador (null = sem diálogo aberto) */
  const [confirmarLimite, setConfirmarLimite] = useState<number | null>(null);
  // Erros de formato aparecem já ao digitar; campos obrigatórios vazios, depois de tentar salvar.
  const sempre: (keyof Form)[] = ['nomeArquivo', 'limite', 'aviso', 'vento', 'cnpj', 'cep', 'pastaRaiz'];
  const erro = (k: keyof Form) => (tentou || sempre.includes(k) ? erros[k] : undefined);

  const mudar = (k: keyof Form) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setSujo(true); };
  const campo = (k: keyof Form, rotulo: string, extra?: { ajuda?: string | null; numerico?: boolean }) => (
    <TextField label={rotulo} value={f[k]} onChange={mudar(k)} error={!!erro(k)}
      helperText={erro(k) ?? extra?.ajuda ?? undefined}
      slotProps={{ htmlInput: { inputMode: extra?.numerico ? 'decimal' : undefined }, formHelperText: erro(k) ? { role: 'alert' } : undefined }}
      sx={erro(k) ? { '& .MuiOutlinedInput-root': { bgcolor: '#FFF8F1' } } : undefined} />
  );

  const arquivo = nomeArquivoPlano(f.nomeArquivo, '2607036', 2);
  const raiz = f.pastaRaiz.trim() || '[pasta raiz]';

  const salvar = async (limiteConfirmado = false) => {
    setTentou(true);
    const lista = Object.values(erros);
    if (lista.length) { notificar(`Não foi possível salvar: ${lista[0]}`, 'warning'); return; }
    // Mudar o limite de segurança muda o que bloqueia um plano: pede confirmação antes de gravar
    if (limite.valor !== base.limitePct && !limiteConfirmado) { setConfirmarLimite(limite.valor); return; }
    setConfirmarLimite(null);
    const c: Config = {
      ...base, pastaRaiz: f.pastaRaiz.trim(), nomeArquivo: f.nomeArquivo.trim(),
      empresa: { razaoSocial: f.razaoSocial.trim(), cnpj: f.cnpj.trim(), ie: f.ie.trim(), endereco: f.endereco.trim(), cep: f.cep.trim() },
      responsavel: { ...base.responsavel, nomeCompleto: f.nomeCompleto.trim(), nomeAssinatura: f.nomeAssinatura.trim(), titulo: f.titulo.trim(), crea: f.crea.trim(), rnp: f.rnp.trim(), rpp: f.rpp.trim(), assinatura: 'digitalizada' },
      limitePct: limite.valor, avisoAtencaoPct: aviso.valor, ventoPadraoMs: vento.valor,
    };
    setSalvando(true);
    try {
      const salvo = await api.salvarConfiguracoes(c);
      setBase(salvo); setSujo(false); setTentou(false);
      definirLimite(salvo.limitePct);
      notificar(salvo.limitePct !== base.limitePct
        ? `Configurações salvas. O limite da taxa de utilização agora é ${numParaTexto(salvo.limitePct)}%.`
        : 'Configurações salvas. Valem para os próximos planos.');
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível salvar as configurações.', 'warning');
    } finally {
      setSalvando(false);
    }
  };

  const escolherImagem = (definir: (url: string) => void, nomeItem: string, qual: 'logo' | 'assinatura') => (e: { target: HTMLInputElement }) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    if (MODO_API !== 'http') {
      if (!/^image\/(png|svg\+xml|jpeg)$/.test(arq.type)) { notificar('Use uma imagem PNG, JPG ou SVG.', 'warning'); return; }
      definir(URL.createObjectURL(arq));
      notificar(`${nomeItem} "${arq.name}" carregada nesta tela. O envio do arquivo ao servidor ainda não está ligado.`, 'info');
      return;
    }
    // Com o servidor: só PNG ou JPEG (SVG pode carregar código); vale para os PDFs emitidos daqui em diante
    if (!/^image\/(png|jpeg)$/.test(arq.type)) { notificar('Use uma imagem PNG ou JPG.', 'warning'); return; }
    api.enviarImagemConfiguracao(qual, arq)
      .then(() => { definir(URL.createObjectURL(arq)); notificar(`${nomeItem} "${arq.name}" enviada. Vale para os planos emitidos daqui em diante.`); })
      .catch((err: unknown) => notificar(err instanceof Error ? err.message : `Não foi possível enviar a ${nomeItem.toLowerCase()}.`, 'error'));
  };

  const escolherPasta = async () => {
    const ponte = desktop();
    if (!ponte) { notificar('O seletor de pastas abre só no aplicativo instalado no computador. Aqui, digite o caminho.', 'info'); return; }
    const pasta = await ponte.escolherPasta(f.pastaRaiz);
    if (pasta) { setF((x) => ({ ...x, pastaRaiz: pasta })); setSujo(true); }
  };

  return (
    <Box sx={erroLaranja}>
      {dialogoSaida}
      <Dialog open={confirmarLimite != null} onClose={() => setConfirmarLimite(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Alterar o limite da taxa de utilização?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            O limite passa de <b>{numParaTexto(base.limitePct)}%</b> para <b>{numParaTexto(confirmarLimite ?? base.limitePct)}%</b>.
            Acima dele, o guindaste ou o acessório fica bloqueado e o plano não pode ser emitido.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5 }}>
            Vale para os rascunhos e as próximas emissões. As revisões já emitidas continuam com o limite usado na emissão.
            {(confirmarLimite ?? 0) > LIMITE_PADRAO_PCT && <> <b>Acima de {LIMITE_PADRAO_PCT}%, a margem de segurança fica menor que a padrão.</b></>}
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5 }}>Tem certeza de que quer alterar o limite?</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setConfirmarLimite(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void salvar(true)}>Sim, alterar o limite</Button>
        </DialogActions>
      </Dialog>
      <Cabecalho secao="ADMINISTRAÇÃO" titulo="Configurações" voltar="/"
        descricao="Definidas uma vez. Todo plano novo usa estes dados sem precisar digitar de novo."
        acao={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {sujo && <Typography role="status" sx={{ fontSize: 14, fontWeight: 600, color: '#8A3F04' }}>Alterações não salvas</Typography>}
            <Button variant="contained" onClick={() => void salvar()} disabled={salvando} sx={{ height: 46 }}>{salvando ? 'Salvando…' : 'Salvar configurações'}</Button>
          </Box>
        } />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Cartao titulo="Pasta dos planos" sub={<>
            <p>Onde o sistema salva cada PDF gerado.</p>
            <p>Mesma organização que o engenheiro já usa hoje: ART, cálculo, desenhos e relatório separados por cliente. O PDF do plano vai para a subpasta Relatório.</p>
          </>}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              {campo('pastaRaiz', 'Pasta raiz (no computador onde o sistema está instalado)', { ajuda: 'É uma pasta no computador onde o sistema está instalado (não fica na internet).' })}
              <Button variant="outlined" sx={{ flexShrink: 0, height: 56 }} onClick={() => void escolherPasta()}>Escolher pasta</Button>
            </Box>
            {campo('nomeArquivo', 'Nome do arquivo do plano', { ajuda: null })}
            <Typography sx={{ fontSize: 13, color: '#3A465E', mt: -1 }}>
              Use {'{nº}'} para o número do plano e {'{rev}'} para a revisão. Exemplo: <b>{erros.nomeArquivo ? '—' : arquivo}</b>
            </Typography>
            <Box aria-label="Organização das pastas" role="group" sx={{ px: 1.5, py: 1.25, border: '1px solid #D5DAE3', borderRadius: '3px', bgcolor: '#F7F8FA' }}>
              <Pasta nivel={0} forte>{raiz}</Pasta>
              <Pasta nivel={1}>Kaefer Rip <Box component="span" sx={{ color: '#566075' }}>(uma pasta por cliente)</Box></Pasta>
              <Pasta nivel={2} forte>2607036 <Box component="span" sx={{ color: '#566075', fontWeight: 400 }}>(uma pasta por plano)</Box></Pasta>
              <Pasta nivel={3}>ART</Pasta>
              <Pasta nivel={3}>Cálculo <Box component="span" sx={{ color: '#566075' }}>· memorial interno</Box></Pasta>
              <Pasta nivel={3}>Desenhos</Pasta>
              <Pasta nivel={3}>Relatório</Pasta>
              <Pasta nivel={4} forte arquivo>{erros.nomeArquivo ? '—' : arquivo}</Pasta>
            </Box>
            <Typography sx={{ fontSize: 12, color: '#3A465E', fontFamily: 'Consolas, monospace', wordBreak: 'break-all', mt: -1 }}>
              {erros.nomeArquivo ? '—' : caminhoPlano({ pastaRaiz: raiz, nomeArquivo: f.nomeArquivo }, 'Kaefer Rip', '2607036', 2)}
            </Typography>
          </Cartao>

          <Cartao titulo="Parâmetros gerais" sub={<>Limites, unidades e numeração. As fórmulas ficam em <Link component={RouterLink} to="/calculos/regras">Cálculos</Link>.</>}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {campo('limite', 'Limite da taxa de utilização (%)', { numerico: true, ajuda: limite.lidoComo ? `${limite.lidoComo}. Entre 50 e 100.` : `Regra de segurança: acima disso o plano é bloqueado (o valor exato é permitido). Padrão ${LIMITE_PADRAO_PCT}%. Entre 50 e 100.` })}
              {campo('aviso', 'Aviso de atenção a partir de (%)', { numerico: true, ajuda: aviso.lidoComo ? `${aviso.lidoComo}. A partir de 50 e menor que o limite.` : 'A partir deste valor a taxa fica em Atenção (laranja), antes do limite. A partir de 50 e menor que o limite.' })}
              <Fixo rotulo="Casas decimais nos cálculos" valor="2" nota="Nada é arredondado antes do cálculo. Só a apresentação usa 2 casas." />
              <Fixo rotulo="Unidades" valor="kg · t · kgf" nota="Convertidas automaticamente em cada seção." />
              {campo('vento', 'Vento máximo padrão (m/s)', { numerico: true, ajuda: vento.lidoComo ? `${vento.lidoComo}. De 0 a 20 m/s.` : 'Vem preenchido em todo plano novo (0 a 20 m/s). É editável em cada plano e a mudança fica no histórico.' })}
              <Fixo rotulo="Numeração dos planos" valor="AAMM + 3 dígitos"
                nota={`Pela data de criação; zera todo mês; revisões mantêm o número; gerada pelo sistema. Ex.: 2607036 = 26 · 07 · 036. Próximo livre: ${proximo}.`} />
            </Box>
          </Cartao>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Cartao titulo="Dados da empresa" sub="Saem no cabeçalho, no rodapé do procedimento e no carimbo.">
            {campo('razaoSocial', 'Razão social')}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {campo('cnpj', 'CNPJ', { numerico: true })}
              {campo('ie', 'Inscrição estadual (IE)', { numerico: true })}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 170px' }, gap: 2 }}>
              {campo('endereco', 'Endereço')}
              {campo('cep', 'CEP', { numerico: true })}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 150, height: 64, border: '1px solid #D5DAE3', borderRadius: '3px', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, flexShrink: 0 }}>
                <Box component="img" src={logo ?? logoCompleto} alt="Logo atual da Guindastes Ribas" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </Box>
              {/* O servidor só aceita PNG ou JPEG (SVG pode carregar código); o SVG ficou só na demonstração */}
              <Typography sx={{ flexGrow: 1, fontSize: 13, color: '#5A6478' }}>
                Logo usada na ficha de dados e no procedimento. {MODO_API === 'http' ? 'PNG (de preferência com fundo transparente) ou JPG.' : 'PNG ou SVG com fundo transparente.'}
              </Typography>
              <Button variant="outlined" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => entradaLogo.current?.click()}>Trocar logo</Button>
              <input ref={entradaLogo} type="file" accept={MODO_API === 'http' ? 'image/png,image/jpeg' : 'image/png,image/svg+xml,image/jpeg'} hidden aria-label="Arquivo da logo" onChange={escolherImagem(setLogo, 'Logo', 'logo')} />
            </Box>
          </Cartao>

          <Cartao titulo="Responsável técnico" sub="Nome e registros que saem nas assinaturas e no carimbo dos desenhos.">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {campo('nomeCompleto', 'Nome completo')}
              {campo('nomeAssinatura', 'Nome nas assinaturas')}
              {campo('titulo', 'Título profissional')}
              {campo('crea', 'Registro no CREA')}
              {campo('rnp', 'RNP (registro nacional)', { numerico: true })}
              {campo('rpp', 'Registro de rigger (RPP)')}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'secondary.main' }}>ASSINATURA</Typography>
              <Dica tamanho={16}>O responsável técnico também assina como supervisor responsável. A assinatura pelo GOV.BR fica como recurso futuro e será ligada aqui, sem mudar o resto do sistema.</Dica>
            </Box>
            <RadioGroup value="digitalizada" aria-label="Tipo de assinatura">
              <FormControlLabel value="digitalizada" control={<Radio />} label="Assinatura digitalizada (imagem)" />
              <FormControlLabel value="govbr" disabled control={<Radio />}
                label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>Assinatura eletrônica GOV.BR <Chip label="EM BREVE" size="small" sx={{ fontWeight: 700, fontSize: 11, height: 20, bgcolor: '#E6E9F0', color: 'primary.main' }} /></Box>} />
            </RadioGroup>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 180, height: 56, border: '1px dashed #8F9AB0', borderRadius: '3px', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0.75, flexShrink: 0 }}>
                {assinatura
                  ? <Box component="img" src={assinatura} alt={`Assinatura de ${f.nomeAssinatura}`} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <Typography sx={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive", fontSize: 20, color: 'primary.main' }}>{f.nomeAssinatura || '—'}</Typography>}
              </Box>
              <Typography sx={{ flexGrow: 1, fontSize: 13, color: '#5A6478' }}>
                {MODO_API === 'http'
                  ? 'Imagem guardada no servidor (PNG ou JPG). Por enquanto o PDF mostra o nome e o registro nas linhas de assinatura.'
                  : 'Imagem da assinatura usada nos planos emitidos.'}
              </Typography>
              <Button variant="outlined" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => entradaAssinatura.current?.click()}>Trocar assinatura</Button>
              <input ref={entradaAssinatura} type="file" accept={MODO_API === 'http' ? 'image/png,image/jpeg' : 'image/png,image/svg+xml,image/jpeg'} hidden aria-label="Arquivo da assinatura" onChange={escolherImagem(setAssinatura, 'Assinatura', 'assinatura')} />
            </Box>
          </Cartao>
        </Box>
      </Box>
    </Box>
  );
}
