import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, MenuItem, Paper, Skeleton,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LockResetOutlined from '@mui/icons-material/LockResetOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import { Cabecalho } from '../components/Cabecalho';
import { useNotificacao } from '../components/Notificacao';
import { useCarregar } from '../hooks';
import { erroLaranja } from './calculos/comum';
import { api } from '../services/api';
import { PERFIS, PERMISSOES, ROTULO_PERFIL, SIGLA_PERFIL, pode } from '../auth/permissoes';
import { erroLogin } from '../domain/validacao';
import { HOJE, dataBR } from '../domain/formatacao';
import type { Perfil, Usuario } from '../domain/types';

const iniciais = (nome: string) =>
  nome.replace(/[[\]()]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const textoAcesso = (iso: string | null) => (!iso ? 'nunca acessou' : iso.slice(0, 10) === HOJE ? 'hoje' : dataBR(iso));

const mensagem = (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.');

/** Senha provisória mostrada uma única vez. */
interface SenhaMostrada { titulo: string; nome: string; login: string; senha: string }

export default function Usuarios() {
  const notificar = useNotificacao();
  const { dados: usuarios, setDados, carregando, erro, recarregar } = useCarregar(api.listarUsuarios, [] as Usuario[]);
  const principal = usuarios.find((u) => u.principal)?.usuario;
  const [novoAberto, setNovoAberto] = useState(false);
  const [confirmar, setConfirmar] = useState<Usuario | null>(null);
  const [desativar, setDesativar] = useState<Usuario | null>(null);
  const [senha, setSenha] = useState<SenhaMostrada | null>(null);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  const atualizar = async (u: Usuario, patch: Partial<Usuario>, aviso: string) => {
    setSalvandoId(u.id);
    try {
      const salvo = await api.salvarUsuario({ ...u, ...patch });
      setDados((lista) => lista.map((x) => (x.id === salvo.id ? salvo : x)));
      notificar(aviso);
    } catch (e) {
      notificar(mensagem(e), 'warning');
    } finally {
      setSalvandoId(null);
    }
  };

  const gerarSenha = async () => {
    if (!confirmar) return;
    const alvo = confirmar;
    setConfirmar(null);
    try {
      const r = await api.gerarSenhaProvisoria(alvo.id);
      const obs = 'Senha provisória gerada hoje · troca no próximo acesso';
      setDados((lista) => lista.map((x) => (x.id === r.usuario.id ? { ...r.usuario, observacao: obs } : x)));
      setSenha({ titulo: 'Nova senha provisória', nome: r.usuario.nome, login: r.usuario.usuario, senha: r.senhaProvisoria });
    } catch (e) {
      notificar(mensagem(e), 'warning');
    }
  };

  return (
    <Box>
      <Cabecalho secao="ADMINISTRAÇÃO" titulo="Usuários e perfis" voltar="/"
        descricao={<>
          <p>Sistema local: o administrador cria cada usuário e entrega uma senha provisória, que o usuário troca no primeiro acesso.</p>
          <p>Esqueceu a senha? O administrador gera uma senha provisória nova.</p>
          <p>O administrador principal{principal ? ` (${principal})` : ''} não pode ser desativado nem perder o perfil, para ninguém ficar sem acesso ao sistema.</p>
        </>}
        acao={<Button variant="contained" onClick={() => setNovoAberto(true)} sx={{ height: 46 }}>+ Novo usuário</Button>} />

      {/* Matriz ao lado só a partir de 1800 px (abaixo disso ela espremia a coluna do nome); senão desce e a tabela usa a largura toda */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', '@media (min-width: 1800px)': { gridTemplateColumns: 'minmax(0, 1fr) 400px' }, gap: 2.5, alignItems: 'start' }}>
        <Paper sx={{ overflow: 'hidden' }}>
          {carregando && <LinearProgress aria-label="Carregando usuários" />}
          {erro ? (
            <Alert severity="warning" sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={recarregar}>Tentar de novo</Button>}>{erro}</Alert>
          ) : (
            <Table aria-label="Usuários do sistema" sx={{ tableLayout: 'fixed', '& td, & th': { px: 1.5, py: 1.75 }, '& th': { py: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.25 }, '& td:last-of-type, & th:last-of-type': { pr: 2.25 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>USUÁRIO</TableCell>
                  <TableCell sx={{ width: 220 }}>PERFIL</TableCell>
                  <TableCell sx={{ width: 136 }}>ÚLTIMO ACESSO</TableCell>
                  <TableCell sx={{ width: 92 }}>ATIVO</TableCell>
                  <TableCell sx={{ width: 176 }}>SENHA PROVISÓRIA</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {carregando && usuarios.length === 0 && [0, 1].map((i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton height={36} /></TableCell></TableRow>
                ))}
                {usuarios.map((u) => (
                  <LinhaUsuario key={u.id} u={u} ocupado={salvandoId === u.id}
                    onPerfil={(perfil) => atualizar(u, { perfil }, `Perfil de ${u.nome} atualizado.`)}
                    onAtivo={() => (u.ativo ? setDesativar(u) : atualizar(u, { ativo: true }, `${u.nome} ativado.`))}
                    onSenha={() => setConfirmar(u)} />
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>

        <MatrizPermissoes />
      </Box>

      <DialogoNovoUsuario aberto={novoAberto} existentes={usuarios.map((u) => u.usuario)} onFechar={() => setNovoAberto(false)}
        onCriado={(r) => {
          setDados((lista) => [...lista, r.usuario]);
          setNovoAberto(false);
          setSenha({ titulo: 'Usuário criado', nome: r.usuario.nome, login: r.usuario.usuario, senha: r.senhaProvisoria });
        }} />

      <Dialog open={!!desativar} onClose={() => setDesativar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Desativar {desativar?.nome}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <b>{desativar?.usuario}</b> deixa de conseguir entrar no sistema. Os planos e o histórico feitos por ele continuam guardados. Dá para ativar de novo depois.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setDesativar(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => { const u = desativar; setDesativar(null); if (u) void atualizar(u, { ativo: false }, `${u.nome} desativado.`); }}>Desativar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmar} onClose={() => setConfirmar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Gerar senha provisória para {confirmar?.nome}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A senha atual de <b>{confirmar?.usuario}</b> deixa de valer. O usuário entra com a senha provisória e cria uma nova no primeiro acesso.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setConfirmar(null)}>Cancelar</Button>
          <Button variant="contained" onClick={gerarSenha}>Gerar senha</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!senha} onClose={() => setSenha(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{senha?.titulo}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', rowGap: 1, alignItems: 'baseline', p: 2, bgcolor: '#F3F5F8', border: '1px solid #D5DAE3', borderRadius: '3px' }}>
            <Typography sx={{ fontSize: 13, color: '#5A6478' }}>Nome</Typography><Typography sx={{ fontWeight: 600 }}>{senha?.nome}</Typography>
            <Typography sx={{ fontSize: 13, color: '#5A6478' }}>Usuário</Typography><Typography sx={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{senha?.login}</Typography>
            <Typography sx={{ fontSize: 13, color: '#5A6478' }}>Senha provisória</Typography>
            <Typography sx={{ fontFamily: "Consolas, 'Courier New', monospace", fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{senha?.senha}</Typography>
          </Box>
          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, fontSize: 14, color: 'primary.main', fontWeight: 600 }}>
            <DescriptionOutlined fontSize="small" /> Anote e entregue ao usuário; ele troca no primeiro acesso.
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 13, color: '#5A6478' }}>A senha não fica visível depois que esta janela for fechada. Se perder, gere outra.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setSenha(null)}>Concluir</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function LinhaUsuario({ u, ocupado, onPerfil, onAtivo, onSenha }: {
  u: Usuario; ocupado: boolean; onPerfil: (p: Perfil) => void; onAtivo: () => void; onSenha: () => void;
}) {
  const travado = u.principal;
  return (
    <TableRow hover sx={{ opacity: u.ativo ? 1 : 0.7 }}>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box aria-hidden sx={{ width: 40, height: 40, borderRadius: '20px', bgcolor: '#BCC6DA', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {iniciais(u.nome)}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{u.nome}</Typography>
            <Typography sx={{ fontFamily: 'Consolas, monospace', fontSize: 13, color: '#3A465E', lineHeight: 1.5 }}>{u.usuario}</Typography>
            {u.observacao && <Typography sx={{ fontSize: 12, color: '#5A6478', lineHeight: 1.4 }}>{u.observacao}</Typography>}
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        {travado ? (
          <Box title="O administrador principal não pode perder o perfil" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 14, fontWeight: 600, color: 'primary.main' }}>
            <LockOutlined sx={{ fontSize: 16 }} />{ROTULO_PERFIL[u.perfil]}
          </Box>
        ) : (
          <TextField select size="small" fullWidth value={u.perfil} disabled={ocupado} onChange={(e) => onPerfil(e.target.value as Perfil)}
            slotProps={{ htmlInput: { 'aria-label': `Perfil de ${u.nome}` } }} sx={{ '& .MuiInputBase-input': { fontSize: 14 } }}>
            {PERFIS.map((p) => <MenuItem key={p} value={p}>{ROTULO_PERFIL[p]}</MenuItem>)}
          </TextField>
        )}
      </TableCell>
      <TableCell sx={{ fontSize: 14, whiteSpace: 'nowrap' }}>{textoAcesso(u.ultimoAcesso)}</TableCell>
      <TableCell>
        {travado ? (
          <Box title="O administrador principal não pode ser desativado" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 13, fontWeight: 600, color: 'primary.main' }}>
            <LockOutlined sx={{ fontSize: 15 }} />Ativo
          </Box>
        ) : (
          <Switch checked={u.ativo} disabled={ocupado} onChange={onAtivo} slotProps={{ input: { 'aria-label': `Usuário ${u.nome} ativo` } }} sx={{ ml: -1.5 }} />
        )}
      </TableCell>
      <TableCell>
        {!travado && (
          <Button size="small" variant="outlined" startIcon={<LockResetOutlined />} onClick={onSenha} aria-label={`Gerar senha provisória para ${u.nome}`}
            sx={{ height: 36, px: 1.5, fontSize: 13, whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#8F9AB0', color: 'primary.main' }}>
            Gerar senha
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Matriz gerada do mapa único `pode()`. */
function MatrizPermissoes() {
  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Typography component="h2" sx={{ px: 2.25, py: 1.5, bgcolor: 'primary.main', color: '#fff', fontSize: 15, fontWeight: 600 }}>O que cada perfil pode fazer</Typography>
      <Table size="small" aria-label="Permissões por perfil">
        <TableHead>
          <TableRow>
            <TableCell>PERMISSÃO</TableCell>
            {PERFIS.map((p) => <TableCell key={p} align="center" sx={{ width: 64 }} title={ROTULO_PERFIL[p]}>{SIGLA_PERFIL[p]}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {PERMISSOES.map((perm) => (
            <TableRow key={perm.acao}>
              <TableCell component="th" scope="row" sx={{ fontSize: 13 }}>{perm.rotulo}</TableCell>
              {PERFIS.map((p) => {
                const sim = pode(p, perm.acao);
                return (
                  <TableCell key={p} align="center" aria-label={sim ? 'pode' : 'não pode'} sx={{ fontWeight: sim ? 700 : 400, color: sim ? 'primary.main' : '#566075' }}>
                    {sim ? '✓' : '—'}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography sx={{ px: 2.25, py: 1.25, fontSize: 12, color: '#5A6478' }}>✓ = pode · — = não pode. Administrador inclui tudo do Engenheiro.</Typography>
    </Paper>
  );
}

function DialogoNovoUsuario({ aberto, existentes, onFechar, onCriado }: {
  aberto: boolean; existentes: string[]; onFechar: () => void; onCriado: (r: { usuario: Usuario; senhaProvisoria: string }) => void;
}) {
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('operacao');
  const [tentou, setTentou] = useState(false);
  const [erroApi, setErroApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  const limpo = login.trim();
  const erroNome = !nome.trim() ? 'Informe o nome.' : null;
  const erroUsuario = !limpo ? 'Informe o usuário.' : existentes.includes(limpo) ? `Já existe o usuário "${limpo}". Escolha outro.` : erroLogin(limpo);

  const reiniciar = () => { setNome(''); setLogin(''); setPerfil('operacao'); setTentou(false); setErroApi(''); };
  const criar = async () => {
    if (erroNome || erroUsuario) { setTentou(true); return; }
    setEnviando(true); setErroApi('');
    try {
      const r = await api.criarUsuario({ nome: nome.trim(), usuario: limpo, perfil });
      onCriado(r);
      reiniciar();
    } catch (e) {
      setErroApi(mensagem(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onClose={() => { onFechar(); reiniciar(); }} maxWidth="sm" fullWidth>
      <DialogTitle>Novo usuário</DialogTitle>
      <DialogContent sx={erroLaranja}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 1 }}>
          <TextField label="Nome completo" required value={nome} onChange={(e) => setNome(e.target.value)} autoFocus
            error={tentou && !!erroNome} helperText={tentou && erroNome ? erroNome : ' '} />
          <TextField label="Usuário (para entrar)" required value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} autoComplete="off"
            error={tentou && !!erroUsuario}
            helperText={tentou && erroUsuario ? erroUsuario : 'Letras minúsculas, números, ponto ou hífen (3 a 30). Ex.: joao.silva'} />
          <TextField select label="Perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            {(['operacao', 'engenheiro', 'admin'] as const).map((p) => <MenuItem key={p} value={p}>{ROTULO_PERFIL[p]}</MenuItem>)}
          </TextField>
          {erroApi && <Alert severity="warning">{erroApi}</Alert>}
          <Typography sx={{ fontSize: 13, color: '#5A6478' }}>Ao criar, o sistema mostra uma senha provisória para você entregar ao usuário.</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={() => { onFechar(); reiniciar(); }}>Cancelar</Button>
        <Button variant="contained" onClick={criar} disabled={enviando}>{enviando ? 'Criando…' : 'Criar usuário'}</Button>
      </DialogActions>
    </Dialog>
  );
}
