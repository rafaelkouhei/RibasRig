// Lógica pura da Consulta rápida: para cada guindaste (e gráfico), capacidade no raio, taxa e situação em HOJE.
import { HOJE, dataBR, fmt } from '../../domain/formatacao';
import { LIMITE_PCT, capacidadeNoGrafico, capacidadeKg, extensaoQueAlcanca, nivelTaxa, situacaoLaudo, taxaPct } from '../../domain/calculos';
import { validarCampo, validarFaixa, type CampoValidado, type Faixa } from '../../domain/validacao';
import type { Guindaste, SituacaoSeguranca } from '../../domain/types';

export const FAIXA_LINGADA: Faixa = { min: 0, max: 100000, unidade: 'kg', rotulo: 'Lingada + dispositivos', exemplo: '296,62', vazio: 'Informe o peso da lingada (pode ser 0).' };

export interface FormConsulta { peso: string; lingada: string; raio: string }
export interface Consulta { pesoKg: number; lingadaKg: number; raioM: number }

export function validarConsulta(f: FormConsulta): Record<keyof FormConsulta, CampoValidado> {
  return { peso: validarCampo('pesoCarga', f.peso), lingada: validarFaixa(FAIXA_LINGADA, f.lingada), raio: validarCampo('raio', f.raio) };
}

export type SituacaoLinha = 'atende' | 'atende-laudo' | 'nao-atende' | 'fora' | 'sem-grafico';

export interface LinhaConsulta {
  chave: string;
  guindaste: Guindaste;
  tabelaId: string | null;
  nome: string;
  sub: string;
  capacidade: string;
  referencia: string | null;
  taxa: number;
  nivel: SituacaoSeguranca | null;
  situacao: SituacaoLinha;
  status: string;
  /** Laudo reprovado em HOJE: texto para mostrar; null = laudo ok */
  laudo: string | null;
  /** Aviso de laudo perto de vencer (ainda pode usar) */
  avisoLaudo: string | null;
  podeCriarPlano: boolean;
  ordem: number;
}

export function linhasConsulta(guindastes: Guindaste[], q: Consulta, avisoAtencaoPct: number): LinhaConsulta[] {
  const pb = q.pesoKg + q.lingadaKg;
  const linhas: LinhaConsulta[] = [];
  for (const g of guindastes.filter((x) => x.ativo)) {
    const sub = [g.placa || (g.dadosPendentes ? '[PLACA]' : ''), g.veiculo].filter(Boolean).join(' · ') || 'Placa não informada';
    const base = { guindaste: g, nome: g.modelo, capacidade: '—', referencia: null, taxa: NaN, nivel: null, laudo: null, avisoLaudo: null, podeCriarPlano: false };
    if (!g.tabelas.length) {
      linhas.push({ ...base, chave: `${g.id}`, tabelaId: null, sub, situacao: 'sem-grafico', status: 'Gráfico de carga não cadastrado', ordem: 0 });
      continue;
    }
    const laudo = situacaoLaudo(g, HOJE);
    const textoLaudo = laudo.aprovado ? null
      : laudo.situacao === 'vencido' ? `Laudo vencido em ${dataBR(laudo.fim)} · não pode ser usado` : 'Laudo não cadastrado · não pode ser usado';
    const avisoLaudo = laudo.situacao === 'vence-em-breve' ? `Laudo ${laudo.texto}` : null;
    for (const t of g.tabelas) {
      const chave = `${g.id}-${t.id}`;
      const subT = g.tabelas.length > 1 ? `${sub} · ${t.nome}` : sub;
      const cap = capacidadeNoGrafico(t.pontos, q.raioM);
      const comum = { ...base, chave, tabelaId: t.id, sub: subT, laudo: textoLaudo, avisoLaudo };
      if (cap.tipo === 'sem-grafico') { linhas.push({ ...comum, situacao: 'sem-grafico', status: 'Gráfico de carga com pontos inválidos', ordem: 0 }); continue; }
      if (cap.tipo === 'fora-do-grafico') {
        linhas.push({ ...comum, situacao: 'fora', status: `Raio fora do gráfico (${fmt(cap.alcanceMinM, 2)} a ${fmt(cap.alcanceMaxM, 2)} m) · não atende`, ordem: 1 });
        continue;
      }
      const capKg = capacidadeKg(cap);
      const taxa = taxaPct(pb, capKg);
      const nivel = nivelTaxa(taxa, avisoAtencaoPct);
      const ext = extensaoQueAlcanca(t.pontos, q.raioM);
      const atende = nivel !== 'bloqueado';
      const podeCriarPlano = atende && laudo.aprovado;
      linhas.push({
        ...comum, capacidade: `${fmt(capKg / 1000, 2)} t`,
        referencia: ext ? `extensão: ${fmt(ext.capacidadeKg, 0)} kg (${fmt(taxaPct(pb, ext.capacidadeKg), 2)}%)` : null,
        taxa, nivel, situacao: !atende ? 'nao-atende' : podeCriarPlano ? 'atende' : 'atende-laudo',
        status: !atende ? `Não atende: passa de ${LIMITE_PCT}%` : nivel === 'atencao' ? 'Atende, perto do limite' : 'Atende',
        podeCriarPlano, ordem: podeCriarPlano ? 3 : atende ? 2 : 1,
      });
    }
  }
  return linhas.sort((a, b) => b.ordem - a.ordem);
}
