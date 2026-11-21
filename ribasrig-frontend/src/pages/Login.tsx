import { useState, type FormEvent } from 'react';
import { Box, Button, IconButton, InputAdornment, Link, TextField, Typography } from '@mui/material';
import Visibility from '@mui/icons-material/VisibilityOutlined';
import VisibilityOff from '@mui/icons-material/VisibilityOffOutlined';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CartaoAcesso, campoAcesso, botaoAcesso, rodapeAcesso } from '../components/CartaoAcesso';

export default function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const destino = (useLocation().state as { de?: string } | null)?.de ?? '/';
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha) { setErro('Informe usuário e senha para entrar.'); return; }
    setErro('');
    setEnviando(true);
    try {
      const r = await entrar(usuario, senha);
      if (r === 'trocar-senha') navegar('/redefinir-senha', { replace: true });
      else navegar(destino, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <CartaoAcesso saudacao="Bem-vindo ao" topo={76}>
      <Box component="form" onSubmit={enviar} noValidate sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Typography component="h1" sx={{ fontWeight: 500, fontSize: 32, lineHeight: 1, color: 'primary.main' }}>Login</Typography>
        <TextField label="Usuário" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} sx={{ ...campoAcesso, mt: 3.25 }} />
        <TextField label="Senha" type={mostrar ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} sx={{ ...campoAcesso, mt: 5 }}
          slotProps={{ input: { endAdornment: (
            <InputAdornment position="end">
              <IconButton aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setMostrar(!mostrar)} edge="end" size="small">
                {mostrar ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>) } }} />
        {erro && <Typography role="alert" sx={{ mt: 1, fontSize: 13, color: '#8A3F04' }}>{erro}</Typography>}
        <Button type="submit" variant="contained" disabled={enviando} sx={{ ...botaoAcesso, mt: erro ? 1.5 : 3.75 }}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
        <Box sx={rodapeAcesso}>
          <Link component={RouterLink} to="/redefinir-senha" sx={{ fontSize: 14, color: '#2E3A55', alignSelf: 'flex-start' }}>Esqueci a senha</Link>
          <Typography sx={{ fontSize: 12, lineHeight: 1.35, color: '#2E3A55', mt: 0.75 }}>Problemas para entrar? Fale com o administrador do sistema.</Typography>
        </Box>
      </Box>
    </CartaoAcesso>
  );
}
