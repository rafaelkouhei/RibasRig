import { api } from './services/api';
import { useCarregar } from './hooks';
import { HOJE } from './domain/formatacao';
import { tabelaDoGuindaste } from './domain/calculos';
import { artsEmUso, calcularPlano, formDoPlano, type ResultadoPlano } from './domain/plano';
import type { Acessorio, Cliente, Configuracoes, Guindaste, PlanoRigging, TabelaCapacidade, TipoIcamento } from './domain/types';

/** Plano com os cadastros que a Visualização e o Memorial usam, e o cálculo atual dos dados do plano. */
export interface PlanoCalculado {
  plano: PlanoRigging;
  cliente: Cliente | null;
  guindaste: Guindaste | null;
  tabela: TabelaCapacidade | null;
  acessorios: Acessorio[];
  tipos: TipoIcamento[];
  config: Configuracoes;
  /** Cálculo dos dados atuais do plano (é o que vale para um rascunho; um emitido mostra a revisão gravada). */
  calculo: ResultadoPlano;
}

export async function carregarPlanoCalculado(numero: string): Promise<PlanoCalculado> {
  const [plano, planos, clientes, guindastes, acessorios, tipos, config] = await Promise.all([
    api.obterPlano(numero), api.listarPlanos(), api.listarClientes(), api.listarGuindastes(),
    api.listarAcessorios(), api.listarTiposIcamento(), api.obterConfiguracoes(),
  ]);
  const calculo = calcularPlano({
    form: formDoPlano(plano), numero: plano.numero, acessorios, guindastes, tipos, clientes, configuracoes: config, hoje: HOJE,
    artsEmUso: artsEmUso(planos.filter((p) => p.numero !== plano.numero)),
  });
  const guindaste = guindastes.find((g) => g.id === plano.guindasteId) ?? null;
  return {
    plano, cliente: clientes.find((c) => c.id === plano.clienteId) ?? null, guindaste, tabela: tabelaDoGuindaste(guindaste, plano.tabelaId),
    acessorios, tipos, config, calculo,
  };
}

/** Carrega o plano da rota (pelo número) com os cadastros e calcula. Recarrega quando o número muda. */
export function usePlanoCalculado(numero: string) {
  return useCarregar<PlanoCalculado | null>(() => carregarPlanoCalculado(numero), null, numero);
}
