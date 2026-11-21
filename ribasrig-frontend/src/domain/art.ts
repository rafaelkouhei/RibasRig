// Dados para preencher a ART no portal do CREA-PR. O engenheiro copia campo a campo; nada é digitado de novo.
import { dataBR, fmt } from './formatacao';
import type { Cliente, DadosPlano, ObraPlano } from './types';

export interface EntradaArt {
  numeroPlano: string;
  contratante: { razaoSocial: string; cnpj: string; enderecoCompleto: string };
  /** Endereço completo da obra, ex.: "Bosch · Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial · Curitiba/PR" */
  enderecoObra: string;
  cepObra: string;
  /** Nome curto de onde a operação acontece, usado na observação (ex.: "Bosch") */
  ondeObra: string;
  dataInicio: string | null; // ISO
  contrato: { numero: string; celebradoEm: string | null; valor: string; termino: string | null };
  cargaDescricao: string;
  /** null = peso inválido/vazio (campo fica pendente) */
  cargaLiquidaKg: number | null;
}

export interface CampoArt { campo: string; valor: string; pendente: boolean }

/** "Rod. Engenheiro Ermênio de Oliveira Penteado, 57 – Helvetia, Indaiatuba/SP – CEP 13337-300" */
export function enderecoContratante(c: Pick<Cliente, 'endereco' | 'cidade' | 'uf' | 'cep'>): string {
  const cidadeUf = [c.cidade.trim(), c.uf.trim().toUpperCase()].filter(Boolean).join('/');
  const linha = [c.endereco.trim(), cidadeUf].filter(Boolean).join(', ');
  return [linha, c.cep.trim() ? `CEP ${c.cep.trim()}` : ''].filter(Boolean).join(' – ');
}

/** "Bosch · Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial · Curitiba/PR" (ou o endereço do contratante). */
export function enderecoObra(obra: ObraPlano, cliente: Cliente | null): string {
  if (obra.mesmoEnderecoContratante) return cliente ? enderecoContratante(cliente) : '';
  const cidadeUf = `${obra.cidade.trim()}${obra.uf.trim() ? `/${obra.uf.trim().toUpperCase()}` : ''}`;
  return [obra.nome, obra.endereco, cidadeUf].map((x) => x.trim()).filter(Boolean).join(' · ');
}

/** Monta a entrada da ART a partir do plano (salvo, ou `planoDoForm(form, base)` durante a edição). */
export function entradaArtDoPlano(numero: string, p: DadosPlano, cliente: Cliente | null): EntradaArt {
  return {
    numeroPlano: numero,
    contratante: { razaoSocial: cliente?.razaoSocial ?? '', cnpj: cliente?.cnpj ?? '', enderecoCompleto: cliente ? enderecoContratante(cliente) : '' },
    enderecoObra: enderecoObra(p.obra, cliente),
    cepObra: p.obra.mesmoEnderecoContratante ? '' : p.obra.cep,
    ondeObra: p.obra.mesmoEnderecoContratante ? cliente?.razaoSocial ?? '' : p.obra.nome || p.obra.cidade,
    dataInicio: p.dataOperacao,
    contrato: { numero: p.contratoArt.numero, celebradoEm: p.contratoArt.celebradoEm, valor: p.contratoArt.valor, termino: p.contratoArt.termino },
    cargaDescricao: p.carga.descricao,
    cargaLiquidaKg: p.carga.pesoKg,
  };
}

/** Campos na ordem do formulário da ART (14). Campos vazios voltam com pendente = true. */
export function camposArt(e: EntradaArt): CampoArt[] {
  const c = (campo: string, valor: string | null): CampoArt => ({ campo, valor: valor?.trim() || '', pendente: !valor?.trim() });
  const contrato = `${e.contrato.numero.trim() ? `Nº ${e.contrato.numero.trim()}` : 'Sem número'}${e.contrato.celebradoEm ? ` · celebrado em ${dataBR(e.contrato.celebradoEm)}` : ''}`;
  const peso = e.cargaLiquidaKg;
  return [
    c('Contratante', e.contratante.razaoSocial),
    c('CPF / CNPJ', e.contratante.cnpj),
    c('Endereço do contratante', e.contratante.enderecoCompleto),
    c('Contrato', contrato),
    c('Valor do contrato', e.contrato.valor.trim() ? `R$ ${e.contrato.valor.trim()}` : null),
    c('Endereço da obra', e.enderecoObra),
    c('CEP da obra', e.cepObra),
    // Na ART 1720264496217 o proprietário é a própria contratante (Kaefer)
    c('Proprietário', e.contratante.razaoSocial),
    c('Data de início', e.dataInicio ? dataBR(e.dataInicio) : null),
    c('Previsão de término', e.contrato.termino ? dataBR(e.contrato.termino) : null),
    c('Finalidade', 'Industrial'),
    c('Atividade técnica', 'Desenvolvimento, Detalhamento, Estudo, Planejamento, Projeto · Plano de rigging'),
    c('Quantidade', peso != null && Number.isFinite(peso) && peso > 0 ? `${fmt(peso / 1000, 2)} TON` : null),
    c('Observações', `ART referente ao plano de rigging nº ${e.numeroPlano} para movimentação de ${e.cargaDescricao.trim().toLowerCase() || 'equipamento'} na ${e.ondeObra.trim() || 'obra'}`),
  ];
}

/** Texto do "Copiar tudo": uma linha "Campo: valor" por campo ("—" quando vazio). */
export const textoArt = (campos: CampoArt[]) => campos.map((c) => `${c.campo}: ${c.valor || '—'}`).join('\n');
