import { lazy, Suspense } from 'react';
import { LinearProgress } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha'));
const Inicio = lazy(() => import('./pages/Inicio'));
const NovoPlano = lazy(() => import('./pages/NovoPlano'));
const Visualizacao = lazy(() => import('./pages/Visualizacao'));
const Guindastes = lazy(() => import('./pages/Guindastes'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Acessorios = lazy(() => import('./pages/Acessorios'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const ConsultaRapida = lazy(() => import('./pages/ConsultaRapida'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Memorial = lazy(() => import('./pages/Memorial'));
const GerarPdf = lazy(() => import('./pages/GerarPdf'));
const Calculos = lazy(() => import('./pages/Calculos'));
const Historico = lazy(() => import('./pages/Historico'));
const Lote = lazy(() => import('./pages/Lote'));

export default function App() {
  return (
    <Suspense fallback={<LinearProgress aria-label="Carregando a tela" />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<Inicio />} />
        <Route path="/planos/novo" element={<NovoPlano />} />
        <Route path="/planos/:numero/editar" element={<NovoPlano />} />
        <Route path="/planos/:numero/duplicar" element={<NovoPlano />} />
        <Route path="/planos/:numero/revisao" element={<NovoPlano />} />
        <Route path="/planos/lote" element={<Lote />} />
        <Route path="/planos/:numero" element={<Visualizacao />} />
        <Route path="/planos/:numero/memorial" element={<RequireAuth perfil={['admin', 'engenheiro']}><Memorial /></RequireAuth>} />
        <Route path="/planos/:numero/pdf" element={<GerarPdf />} />
        <Route path="/planos/:numero/historico" element={<Historico />} />
        <Route path="/consulta" element={<ConsultaRapida />} />
        <Route path="/guindastes" element={<Guindastes />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/acessorios" element={<Acessorios />} />
        <Route path="/calculos" element={<Navigate to="/calculos/regras" replace />} />
        <Route path="/calculos/:aba" element={<Calculos />} />
        <Route path="/usuarios" element={<RequireAuth perfil="admin"><Usuarios /></RequireAuth>} />
        <Route path="/configuracoes" element={<RequireAuth perfil="admin"><Configuracoes /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
