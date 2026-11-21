import type { EventoHistorico, TipoEvento } from '../../domain/types';

export type Filtro = 'tudo' | 'calculos' | 'anexos' | 'emissoes';

/** Nome, filtro e cores de cada tipo de evento. A etiqueta de texto acompanha sempre a cor. */
export const TIPOS_EVENTO: Record<TipoEvento, { nome: string; filtro: Filtro | null; cor: string; etiqueta: Record<string, string> }> = {
  emissao: { nome: 'Emissão', filtro: 'emissoes', cor: '#34446A', etiqueta: { bgcolor: '#DDE3EE', color: '#34446A' } },
  calculo: { nome: 'Cálculo', filtro: 'calculos', cor: '#C2610C', etiqueta: { bgcolor: '#FBE1C6', color: '#8A3F04' } },
  anexo: { nome: 'Anexo', filtro: 'anexos', cor: '#4A6192', etiqueta: { bgcolor: '#EEF1F6', color: '#34446A' } },
  cadastro: { nome: 'Cadastro', filtro: null, cor: '#A9B4C9', etiqueta: { bgcolor: '#F3F5F8', color: '#3A465E', border: '1px solid #C5CCDA' } },
  edicao: { nome: 'Edição', filtro: null, cor: '#566075', etiqueta: { bgcolor: '#F3F5F8', color: '#3A465E', border: '1px solid #C5CCDA' } },
};

export const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'tudo', rotulo: 'Tudo' }, { id: 'calculos', rotulo: 'Cálculos' }, { id: 'anexos', rotulo: 'Anexos' }, { id: 'emissoes', rotulo: 'Emissões' },
];

export const passaFiltro = (e: EventoHistorico, f: Filtro) => f === 'tudo' || TIPOS_EVENTO[e.tipo].filtro === f;
