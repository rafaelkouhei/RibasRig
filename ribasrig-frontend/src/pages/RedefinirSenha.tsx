import { useState, type FormEvent } from 'react';
import { Box, Button, Link, TextField, Typography } from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import { CartaoAcesso, botaoAcesso, campoAcesso, rodapeAcesso } from '../components/CartaoAcesso';

type Etapa = 'provisoria' | 'nova' | 'pronto';

/** Regras da senha nova (as mesmas do protótipo). */
function regrasSenha(nova: string, confirmacao: string, provisoria: string) {
  return [
    { texto: 'Pelo menos 8 caracteres', ok: nova.length >= 8 },
    { texto: 'Letras e números', ok: /\d/.test(nova) && /[A-Za-zÀ-ÿ]/.test(nova) },
    { texto: 'As duas senhas iguais', ok: nova !== '' && nova === confirmacao },
    { texto: 'Diferente da senha provisória', ok: nova !== '' && nova !== provisoria },
  ];
}

function erroProvisoria(usuario: string, provisoria: string): string {
  if (!usuario.trim() && !provisoria) return 'Informe o usuário e a senha provisória.';
  if (!usuario.trim()) return 'Informe o usuário.';
  if (!provisoria) return 'Informe a senha provisória recebida do administrador.';
  return '';
}

const linkRodape = { fontSize: 14, color: '#2E3A55' } as const;

export default function RedefinirSenha() {
  const { trocaPendente, concluirTroca } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>(trocaPendente ? 'nova' : 'provisoria');
  const [usuario, setUsuario] = useState(trocaPendente?.usuario ?? '');
  const [provisoria, setProvisoria] = useState(trocaPendente?.provisoria ?? '');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [tentou, setTentou] = useState(false);

  const regras = regrasSenha(nova, confirmacao, provisoria);
  const erroProv = tentou && etapa === 'provisoria' ? erroProvisoria(usuario, provisoria) : '';

  const continuar = (e: FormEvent) => {
    e.preventDefault();
    if (erroProvisoria(usuario, provisoria)) { setTentou(true); return; }
    setTentou(false);
    setEtapa('nova');
  };
  const [erroApi, setErroApi] = useState('');
  const [enviando, setEnviando] = useState(false);
  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!regras.every((r) => r.ok)) { setTentou(true); return; }
    setEnviando(true);
    try {
      await api.trocarSenha(usuario, provisoria, nova);
      concluirTroca(usuario);
      setTentou(false); setErroApi('');
      setEtapa('pronto');
    } catch (err) {
      setErroApi(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setEnviando(false);
    }
  };
  const trocarUsuario = () => { setEtapa('provisoria'); setNova(''); setConfirmacao(''); setTentou(false); };

  const titulo = { provisoria: 'Redefinir senha', nova: 'Nova senha', pronto: 'Senha criada' }[etapa];
  const subtitulo = {
    provisoria: 'Informe seu usuário e a senha provisória.',
    nova: trocaPendente ? `Usuário ${usuario.trim()}. Sua senha é provisória: crie uma senha nova.` : `Usuário ${usuario.trim()}. Crie sua senha nova.`,
    pronto: 'Use a nova senha para entrar.',
  }[etapa];

  return (
    <CartaoAcesso saudacao={trocaPendente ? 'Primeiro acesso' : 'Esqueceu a senha?'}
      texto={trocaPendente ? 'Você entrou com uma senha provisória. Crie uma senha nova para continuar.' : 'Peça ao administrador uma senha provisória. Com ela você cria uma senha nova.'}>
      <Typography component="h1" sx={{ fontWeight: 500, fontSize: 28, lineHeight: 1.1, color: 'primary.main' }}>{titulo}</Typography>
      <Typography sx={{ fontSize: 13, color: '#3A465E', mt: 0.75 }}>{subtitulo}</Typography>

      {etapa === 'provisoria' && (
        <Box component="form" onSubmit={continuar} noValidate sx={{ display: 'flex', flexDirection: 'column' }}>
          <TextField label="Usuário" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} sx={{ ...campoAcesso, mt: 2.75 }} />
          <TextField label="Senha provisória (recebida do administrador)" type="password" autoComplete="one-time-code" value={provisoria}
            onChange={(e) => setProvisoria(e.target.value)} sx={{ ...campoAcesso, mt: 2.25 }} />
          {erroProv && <Typography role="alert" sx={{ mt: 1, fontSize: 13, color: '#8A3F04' }}>{erroProv}</Typography>}
          <Button type="submit" variant="contained" sx={{ ...botaoAcesso, mt: 2.75 }}>Continuar</Button>
          <Typography sx={{ mt: 1.75, fontSize: 12, lineHeight: 1.4, color: '#3A465E' }}>
            Não tem a senha provisória? Peça ao administrador do sistema: ele gera uma em Usuários e perfis.
          </Typography>
        </Box>
      )}

      {etapa === 'nova' && (
        <Box component="form" onSubmit={salvar} noValidate sx={{ display: 'flex', flexDirection: 'column' }}>
          <TextField label="Nova senha" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} sx={{ ...campoAcesso, mt: 2.5 }} />
          <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} sx={{ ...campoAcesso, mt: 2.25 }} />
          <Box component="ul" aria-label="Regras da senha" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
            {regras.map((r) => {
              const ruim = tentou && !r.ok;
              return (
                <Typography component="li" key={r.texto} sx={{ fontSize: 12, fontWeight: r.ok || ruim ? 600 : 400, color: r.ok ? 'primary.main' : ruim ? '#8A3F04' : '#4A5568' }}>
                  {r.ok ? '✓' : '•'} {r.texto}{ruim ? ' (falta)' : ''}
                </Typography>
              );
            })}
          </Box>
          {erroApi && <Typography role="alert" sx={{ fontSize: 13, color: '#8A3F04', mt: 1 }}>{erroApi}</Typography>}
          <Button type="submit" variant="contained" disabled={enviando} sx={{ ...botaoAcesso, mt: 1.5 }}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</Button>
        </Box>
      )}

      {etapa === 'pronto' && (
        <Box sx={{ mt: 3.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Typography role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'primary.main', fontSize: 15 }}>
            <CheckCircleOutline sx={{ fontSize: 28 }} /> Senha alterada com sucesso.
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained" sx={botaoAcesso}>Ir para o login</Button>
        </Box>
      )}

      <Box sx={{ ...rodapeAcesso, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Link component={RouterLink} to="/login" sx={linkRodape}>Voltar ao login</Link>
        {etapa === 'nova' && <Link component="button" type="button" onClick={trocarUsuario} sx={linkRodape}>Trocar usuário</Link>}
      </Box>
    </CartaoAcesso>
  );
}
