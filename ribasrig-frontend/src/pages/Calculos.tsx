import { Alert, Box, Button, LinearProgress, Skeleton } from '@mui/material';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { pode } from '../auth/permissoes';
import { useCarregar } from '../hooks';
import { api } from '../services/api';
import { ATENCAO_PADRAO_PCT } from '../domain/calculos';
import type { Acessorio, RegraCalculo, TipoIcamento } from '../domain/types';
import { AbaRegras } from './calculos/AbaRegras';
import { AbaTipos } from './calculos/AbaTipos';
import { TopoCalculos, type AbaCalculos } from './calculos/comum';

interface Dados { regras: RegraCalculo[]; tipos: TipoIcamento[]; acessorios: Acessorio[]; aviso: number }

async function carregar(): Promise<Dados> {
  const [regras, tipos, acessorios, config] = await Promise.all([api.listarRegras(), api.listarTiposIcamento(), api.listarAcessorios(), api.obterConfiguracoes()]);
  return { regras, tipos, acessorios, aviso: config.avisoAtencaoPct };
}

export default function Calculos() {
  const { aba } = useParams();
  const { usuario } = useAuth();
  const { dados, setDados, carregando, erro, recarregar } = useCarregar(carregar, null as Dados | null);
  if (aba !== 'regras' && aba !== 'tipos') return <Navigate to="/calculos/regras" replace />;
  const atual: AbaCalculos = aba;

  if (erro || !dados) {
    return (
      <Box>
        <TopoCalculos aba={atual} descricao={atual === 'regras' ? 'Fórmulas salvas uma vez e reutilizadas em todos os planos.' : 'Montagem da lingada, campos e regras de cada tipo.'} />
        {erro ? (
          <Alert severity="warning" action={<Button color="inherit" size="small" onClick={recarregar}>Tentar de novo</Button>}>{erro}</Alert>
        ) : (
          <>
            {carregando && <LinearProgress aria-label="Carregando cálculos" sx={{ mb: 2 }} />}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '370px 1fr' }, gap: 2.25 }}>
              <Skeleton variant="rectangular" height={520} /><Skeleton variant="rectangular" height={520} />
            </Box>
          </>
        )}
      </Box>
    );
  }

  const podeEditar = pode(usuario?.perfil, 'editarCadastros');
  const autor = usuario?.nome ?? 'Usuário';
  const setRegras = (f: RegraCalculo[] | ((l: RegraCalculo[]) => RegraCalculo[])) =>
    setDados((d) => (d ? { ...d, regras: typeof f === 'function' ? f(d.regras) : f } : d));
  const setTipos = (f: TipoIcamento[] | ((l: TipoIcamento[]) => TipoIcamento[])) =>
    setDados((d) => (d ? { ...d, tipos: typeof f === 'function' ? f(d.tipos) : f } : d));

  return atual === 'regras' ? (
    <AbaRegras regras={dados.regras} setRegras={setRegras} tipos={dados.tipos} aviso={dados.aviso || ATENCAO_PADRAO_PCT} podeEditar={podeEditar} autor={autor} />
  ) : (
    <AbaTipos tipos={dados.tipos} setTipos={setTipos} regras={dados.regras} acessorios={dados.acessorios} podeEditar={podeEditar} autor={autor}
      onExcluido={(id) => setTipos((l) => l.filter((t) => t.id !== id))} />
  );
}
