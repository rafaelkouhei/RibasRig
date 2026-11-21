import type { MouseEvent, ReactNode } from 'react';
import { Avatar, Box, GlobalStyles, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Tooltip, Typography } from '@mui/material';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DialogoAtalhos, useAtalhosGlobais } from './Atalhos';
import { Icone } from './Icone';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import type { Perfil } from '../domain/types';
import { cores } from '../theme';
import logo from '../assets/logo-ribas-branca.png';

const LARGURA = 232;
const FOCO_MENU = '#BCC6DA';
export const ROTULO_PERFIL: Record<Perfil, string> = { admin: 'Administrador', engenheiro: 'Engenheiro', operacao: 'Operação' };

/** Telas de edição do plano (formulário): ficam com "Novo plano" ativo. */
const EDICAO_PLANO = /^\/planos\/(novo|lote|[^/]+\/(editar|duplicar|revisao))$/;

/** Qual item do menu fica ativo em cada rota. Visualização, PDF, memorial e histórico de um plano pertencem ao Início. */
export function itemAtivo(pathname: string): string {
  if (EDICAO_PLANO.test(pathname)) return '/planos/novo';
  if (pathname === '/' || pathname.startsWith('/planos/')) return '/';
  if (pathname.startsWith('/calculos')) return '/calculos/regras';
  return pathname;
}

/** Janela baixa (notebook, projetor): o menu fica mais compacto para caber inteiro, sem rolar. */
const BAIXA = '@media (max-height: 860px)';
const MUITO_BAIXA = '@media (max-height: 720px)';

function Item({ para, texto, icone }: { para: string; texto: string; icone: ReactNode }) {
  const { pathname } = useLocation();
  const ativo = itemAtivo(pathname) === para;
  return (
    <ListItem disablePadding>
      <ListItemButton component={RouterLink} to={para} aria-current={ativo ? 'page' : undefined} selected={ativo}
        sx={{
          borderRadius: '3px', color: '#DDE2EC', mb: 0.25, py: 1.25, px: 1.5,
          '&:hover': { bgcolor: '#415176', color: '#fff' },
          '&.Mui-selected, &.Mui-selected:hover': { bgcolor: cores.azul, color: '#fff', fontWeight: 600 },
          '&.Mui-focusVisible': { outline: `3px solid ${FOCO_MENU}`, outlineOffset: -3, bgcolor: ativo ? cores.azul : '#415176' },
          [BAIXA]: { py: 0.75, '& .MuiListItemText-root': { my: 0.25 } },
          [MUITO_BAIXA]: { py: 0.5, '& .MuiListItemText-root': { my: 0 } },
        }}>
        <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>{icone}</ListItemIcon>
        <ListItemText primary={texto} slotProps={{ primary: { sx: { fontSize: 15, fontWeight: 'inherit' } } }} />
      </ListItemButton>
    </ListItem>
  );
}

const subtitulo = {
  bgcolor: 'transparent', color: '#A9B4C9', fontSize: 12, fontWeight: 600, letterSpacing: '1.4px', lineHeight: '20px', mt: 2.5, mb: 0.75, px: 1.5, textTransform: 'uppercase',
  [BAIXA]: { mt: 1.5, mb: 0.5 }, [MUITO_BAIXA]: { mt: 1, mb: 0.25 },
} as const;
const focoClaro = { '&:focus-visible': { outline: `3px solid ${FOCO_MENU}`, outlineOffset: -3 } } as const;

function Rodape({ abrirAtalhos }: { abrirAtalhos: () => void }) {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const iniciais = (usuario?.nome ?? '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  return (
    <>
      <Box sx={{ mt: 'auto', height: 10, flexShrink: 0, background: `repeating-linear-gradient(135deg, ${cores.azul} 0 14px, ${cores.marinho} 14px 28px)` }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '16px 8px 12px 16px', bgcolor: '#2A3857', flexShrink: 0, [BAIXA]: { p: '10px 8px 6px 16px' } }}>
        <Avatar aria-hidden sx={{ bgcolor: cores.claro, color: cores.marinho, width: 36, height: 36, fontSize: 13, fontWeight: 600 }}>{iniciais}</Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography title={usuario?.nome} sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{usuario?.nome ?? '—'}</Typography>
          <Typography noWrap sx={{ fontSize: 12, color: '#BAC3D4' }}>{usuario ? ROTULO_PERFIL[usuario.perfil] : ''}</Typography>
        </Box>
        <Tooltip title="Sair">
          <IconButton aria-label="Sair" onClick={() => { sair(); navegar('/login'); }} sx={{ color: '#DDE2EC', width: 44, height: 44, borderRadius: '3px', '&:hover': { bgcolor: '#415176' }, '&.Mui-focusVisible': { outline: `3px solid ${FOCO_MENU}`, outlineOffset: -3 } }}>
            <LogoutOutlined />
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="button" type="button" onClick={abrirAtalhos} aria-haspopup="dialog"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.25, pt: 1, pb: 1.5, bgcolor: '#2A3857', flexShrink: 0, color: '#BAC3D4', border: 0, font: 'inherit', fontSize: 12, cursor: 'pointer', textAlign: 'left', '&:hover': { color: '#fff', bgcolor: '#33426A' }, ...focoClaro, [BAIXA]: { pt: 0.75, pb: 1 } }}>
        <KeyboardOutlined sx={{ fontSize: 16 }} />Atalhos de teclado<Box component="span" sx={{ ml: 'auto' }}>Ctrl + /</Box>
      </Box>
    </>
  );
}

export function AppLayout() {
  const perfil = useAuth().usuario?.perfil;
  const atalhos = useAtalhosGlobais();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Foco visível no conteúdo (contraste ≥ 3:1 sobre o fundo claro) */}
      <GlobalStyles styles={{ 'main a:focus-visible, main button:focus-visible, main .Mui-focusVisible': { outline: `3px solid ${cores.marinho}`, outlineOffset: 2 } }} />
      <Box component="a" href="#conteudo" onClick={(e: MouseEvent) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}
        sx={{ position: 'absolute', left: 8, top: -60, zIndex: 2000, px: 2, py: 1.25, bgcolor: '#fff', color: cores.marinho, fontWeight: 600, borderRadius: '3px', '&:focus': { top: 8, outline: `3px solid ${cores.marinho}` } }}>
        Pular para o conteúdo
      </Box>
      {/* Em janela baixa o menu compacta (BAIXA / MUITO_BAIXA) para caber inteiro; só abaixo disso a lista rola,
          com logo e usuário/Sair sempre visíveis */}
      <Box component="nav" aria-label="Menu principal" sx={{ width: LARGURA, flexShrink: 0, bgcolor: cores.marinho, color: '#fff', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Marca em um bloco só: a logo na altura das duas linhas, o nome do sistema em destaque e a empresa embaixo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '24px 20px 22px', borderBottom: '1px solid #475777', flexShrink: 0, [BAIXA]: { p: '16px 20px 14px' } }}>
          <Box component="img" src={logo} alt="Logo Guindastes Ribas" sx={{ width: 52, height: 34, objectFit: 'contain', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 23, lineHeight: 1.05 }}>RibasRig</Typography>
            <Typography sx={{ fontWeight: 500, fontSize: 10, letterSpacing: '1.3px', color: '#A9B4C9', mt: 0.5, whiteSpace: 'nowrap' }}>GUINDASTES RIBAS</Typography>
          </Box>
        </Box>
        <List sx={{ px: 1.75, py: 2.5, flex: 1, minHeight: 0, overflowY: 'auto', [BAIXA]: { py: 1.25 } }}>
          <Item para="/" texto="Início" icone={<Icone nome="inicio" />} />
          {pode(perfil, 'editarRascunhos') && <Item para="/planos/novo" texto="Novo plano" icone={<Icone nome="novo-plano" />} />}
          <Item para="/consulta" texto="Consulta rápida" icone={<Icone nome="consulta" />} />
          <ListSubheader disableSticky sx={subtitulo}>Cadastros</ListSubheader>
          <Item para="/guindastes" texto="Guindastes" icone={<Icone nome="guindastes" />} />
          <Item para="/clientes" texto="Clientes" icone={<Icone nome="clientes" />} />
          <Item para="/acessorios" texto="Acessórios de lingada" icone={<Icone nome="acessorios" />} />
          <Item para="/calculos/regras" texto="Cálculos" icone={<Icone nome="calculos" />} />
          {(pode(perfil, 'gerenciarUsuarios') || pode(perfil, 'alterarConfiguracoes')) && (
            <>
              <ListSubheader disableSticky sx={subtitulo}>Administração</ListSubheader>
              {pode(perfil, 'gerenciarUsuarios') && <Item para="/usuarios" texto="Usuários e perfis" icone={<Icone nome="usuarios" />} />}
              {pode(perfil, 'alterarConfiguracoes') && <Item para="/configuracoes" texto="Configurações" icone={<Icone nome="configuracoes" />} />}
            </>
          )}
        </List>
        <Rodape abrirAtalhos={atalhos.abrir} />
      </Box>
      <DialogoAtalhos aberto={atalhos.aberto} fechar={atalhos.fechar} />
      <Box component="main" id="conteudo" tabIndex={-1} sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: '28px 36px' }, outline: 'none' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
