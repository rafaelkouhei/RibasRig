// Memorial de cálculo: monta as seções (texto) a partir dos resultados de uma revisão (ou do cálculo do rascunho).
// Resultados vêm SEMPRE do que foi gravado/calculado; os passos intermediários (cos α, P ÷ 2…) são recalculados só para mostrar.
import { capacidadeNoGrafico, extensaoQueAlcanca, LIMITE_PCT, nivelTaxa, nomeGrafico } from '../../domain/calculos';
import { casasDe, fmt, fmtPct } from '../../domain/formatacao';
import { NOME_POSICAO, POSICOES } from '../../domain/plano';
import type { Acessorio, Dormente, Guindaste, PosicaoLingada, ResultadoPosicaoRevisao, ResultadosRevisao, TabelaCapacidade } from '../../domain/types';
import { kg } from './vistas';

export interface LinhaMemorial { texto: string; nota?: boolean }
export interface SecaoMemorial { titulo: string; linhas: LinhaMemorial[]; resultado: string }

export interface EntradaMemorial {
  resultados: ResultadosRevisao;
  guindaste: Guindaste | null;
  tabela: TabelaCapacidade | null;
  acessorios: Acessorio[];
  dormente: Dormente;
  balancim: boolean;
  avisoAtencaoPct: number;
  /** Limite da taxa usado no veredito: o gravado na revisão; sem ele (rascunho), o das Configurações. */
  limitePct?: number;
}

const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const n = (v: number | null | undefined) => (ok(v) ? v : NaN);
const f2 = (v: number) => fmt(v, 2);
const f4 = (v: number) => fmt(v, 4);
const graus = (v: number) => (ok(v) ? `${fmt(v, casasDe(v))}°` : '—');

/** "≤ 85% ✓" · "≤ 85% · Atenção" · "> 85% · Bloqueado" · "sem resultado · Bloqueado" */
export function veredito(taxa: number | null | undefined, aviso: number, limite: number = LIMITE_PCT): string {
  if (!ok(taxa)) return '· sem resultado · Bloqueado';
  const nivel = nivelTaxa(taxa, aviso, limite);
  if (nivel === 'bloqueado') return `> ${limite}% · Bloqueado`;
  if (nivel === 'atencao') return `≤ ${limite}% · Atenção (a partir de ${aviso}%)`;
  return `≤ ${limite}% ✓`;
}

function secaoCargaBruta(r: ResultadosRevisao): SecaoMemorial {
  return {
    titulo: 'Composição da carga bruta',
    linhas: [
      { texto: 'Pb = carga líquida + lingada/amarração + dispositivos + cargas extras' },
      { texto: `Pb = ${f2(n(r.cargaKg))} + ${f2(n(r.lingadaKg))} + ${f2(n(r.dispositivosKg))} + ${f2(r.extrasKg ?? 0)}` },
    ],
    resultado: `Pb = ${f2(n(r.pbKg))} kg (${f2(n(r.pbKg) / 1000)} t)`,
  };
}

function linhasInterpolacao(tabela: TabelaCapacidade | null, raio: number, capKg: number): LinhaMemorial[] {
  if (!tabela) return [{ texto: 'Guindaste sem gráfico de carga cadastrado: sem capacidade, o plano fica bloqueado.' }];
  const c = capacidadeNoGrafico(tabela.pontos, raio);
  const nome = nomeGrafico(tabela);
  if (c.tipo === 'interpolado') {
    const { p1, p2 } = c;
    const delta = ((raio - p1.alcanceM) * (p2.capacidadeKg - p1.capacidadeKg)) / (p2.alcanceM - p1.alcanceM);
    return [
      { texto: `${nome}. O raio de operação ${fmt(raio, 1)} m fica entre dois pontos do gráfico: interpolação linear entre ${f2(p1.alcanceM)} m (${kg(p1.capacidadeKg)} kg) e ${f2(p2.alcanceM)} m (${kg(p2.capacidadeKg)} kg)` },
      { texto: 'C = C1 + (r − r1) × (C2 − C1) ÷ (r2 − r1)' },
      { texto: `C = ${kg(p1.capacidadeKg)} + (${f2(raio)} − ${f2(p1.alcanceM)}) × (${kg(p2.capacidadeKg)} − ${kg(p1.capacidadeKg)}) ÷ (${f2(p2.alcanceM)} − ${f2(p1.alcanceM)}) = ${kg(p1.capacidadeKg)} ${delta < 0 ? '−' : '+'} ${f2(Math.abs(delta))} = ${kg(capKg)} kg` },
    ];
  }
  if (c.tipo === 'exato') return [{ texto: `${nome}. O raio de operação ${fmt(raio, 1)} m coincide com um ponto do gráfico: C = ${kg(c.capacidadeKg)} kg` }];
  if (c.tipo === 'fora-do-grafico') return [{ texto: `${nome}. O raio de operação ${fmt(raio, 1)} m está fora do gráfico (${f2(c.alcanceMinM)} m a ${f2(c.alcanceMaxM)} m): sem capacidade, o plano fica bloqueado.` }];
  if (c.tipo === 'raio-invalido') return [{ texto: `${nome}. Raio de operação inválido: sem capacidade, o plano fica bloqueado.` }];
  return [{ texto: `${nome}: sem pontos válidos, o plano fica bloqueado.` }];
}

function secoesGuindastes(e: EntradaMemorial): SecaoMemorial[] {
  const r = e.resultados;
  const [principal, ...adicionais] = r.guindastes;
  const raio = n(principal?.raioM);
  const capKg = n(r.capacidadeKg);
  const pbG = n(principal?.cargaKg ?? r.pbKg);
  const pct = n(principal?.pctCarga ?? 100);
  const ext = e.tabela ? extensaoQueAlcanca(e.tabela.pontos, raio) : null;
  const linhas: LinhaMemorial[] = [...linhasInterpolacao(e.tabela, raio, capKg)];
  if (ok(r.referenciaConservadoraKg)) {
    linhas.push({ texto: `Referência conservadora: extensão que alcança ${fmt(raio, 1)} m${ext ? ` (${f2(ext.alcanceM)} m)` : ''} = ${kg(r.referenciaConservadoraKg)} kg (taxa ${fmtPct(r.taxaReferenciaPct)})`, nota: true });
  }
  if (ok(pct) && pct < 100) linhas.push({ texto: `Parte da carga neste guindaste = Pb × ${fmt(pct, casasDe(pct))}% = ${f2(pbG)} kg` });
  linhas.push({ texto: `Taxa de utilização = Pb ÷ C = ${f2(pbG)} ÷ ${kg(capKg)} × 100` });
  const secoes: SecaoMemorial[] = [{
    titulo: `Capacidade de carga no raio · ${principal?.modelo ?? e.guindaste?.modelo ?? 'guindaste'}`,
    linhas,
    resultado: `C = ${kg(capKg)} kg (${f2(capKg / 1000)} t) · TU = ${fmtPct(r.taxaGuindastePct)} ${veredito(r.taxaGuindastePct, e.avisoAtencaoPct, e.limitePct)}`,
  }];
  for (const a of adicionais) {
    secoes.push({
      titulo: `Guindaste adicional · ${a.modelo}`,
      linhas: [
        { texto: `${a.tabelaNome ?? 'Sem gráfico cadastrado'} · raio ${fmt(a.raioM, 1)} m` },
        { texto: `Parte da carga = Pb × ${fmt(a.pctCarga, casasDe(n(a.pctCarga)))}% = ${fmt(a.cargaKg, 2)} kg` },
        { texto: `Taxa de utilização = ${fmt(a.cargaKg, 2)} ÷ ${kg(a.capacidadeKg)} × 100` },
      ],
      resultado: `C = ${kg(a.capacidadeKg)} kg · TU = ${fmtPct(a.taxaPct)} ${veredito(a.taxaPct, e.avisoAtencaoPct, e.limitePct)}`,
    });
  }
  return secoes;
}

function geometria(pos: PosicaoLingada, balancim: boolean): string {
  if (!balancim) return 'carga × gancho';
  return pos === 'pernasInferiores' || pos === 'carga' ? 'carga × balancim' : 'balancim × gancho';
}

function secaoPosicao(p: ResultadoPosicaoRevisao, e: EntradaMemorial, angInf: number): SecaoMemorial {
  const r = e.resultados;
  const a = e.acessorios.find((x) => x.id === p.acessorioId) ?? null;
  const P = (n(r.cargaKg) + (r.extrasKg ?? 0)) / 1000;
  const B = (r.dispositivosKg ?? 0) / 1000;
  const alfa = n(p.anguloGraus);
  const cos = Math.cos((alfa * Math.PI) / 180);
  const t = n(p.tracao);
  const cap = n(p.capacidade);
  const u = p.unidade;
  const tu = { texto: `TU = ${f4(t)} ÷ ${f2(cap)} × 100` };
  const ver = `${fmtPct(p.taxaPct)} ${veredito(p.taxaPct, e.avisoAtencaoPct, e.limitePct)}`;
  const pernas = p.posicao === 'pernasInferiores' || p.posicao === 'pernasSuperiores';
  const titulo = pernas
    ? `${p.descricao} · ${NOME_POSICAO[p.posicao]} (${geometria(p.posicao, e.balancim)})`
    : `${p.descricao} (${geometria(p.posicao, e.balancim)}) · ${fmt(cap, 1)} ${u}`;
  const vertical = '(medido a partir da vertical)';
  switch (p.posicao) {
    case 'pernasInferiores':
      return {
        titulo,
        linhas: [
          { texto: `Te = (1 ÷ cos α) × (P ÷ 2), com α = ${graus(alfa)} ${vertical} e P = ${f2(P)} t` },
          { texto: `Te = ${f4(1 / cos)} × ${f4(P / 2)} = ${f4(t)} ${u}` },
          { texto: `TU = Te ÷ capacidade de trabalho = ${f4(t)} ÷ ${f2(cap)} × 100` },
        ],
        resultado: `Te = ${f2(t)} ${u} · TU = ${ver}`,
      };
    case 'pernasSuperiores':
      return {
        titulo,
        linhas: [
          { texto: `Te = (1 ÷ cos α) × ((P + balancim) ÷ 2), com α = ${graus(alfa)} ${vertical} e P + balancim = ${f2(P + B)} t` },
          { texto: `Te = ${f4(1 / cos)} × ${f4((P + B) / 2)} = ${f4(t)} ${u}` },
          tu,
        ],
        resultado: `Te = ${f2(t)} ${u} · TU = ${ver}`,
      };
    case 'carga': {
      const k = e.balancim ? 4 : 2;
      const cosCarga = Math.cos((n(angInf) * Math.PI) / 180);
      return {
        titulo,
        linhas: [{ texto: `Esforço por manilha = P ÷ (${k} × cos ${graus(angInf)}) = ${f2(P)} ÷ ${f4(k * cosCarga)} = ${f4(t)} ${u}` }, tu],
        resultado: `Manilha na carga = ${f2(t)} ${u} · TU = ${ver}`,
      };
    }
    case 'gancho': {
      const deQue = e.balancim ? 'Te superior' : 'Te das pernas';
      return {
        titulo,
        linhas: [{ texto: `Esforço = 2 × ${deQue} = 2 × ${f4(t / 2)} = ${f4(t)} ${u}` }, tu],
        resultado: `Manilha no gancho = 2 · ${deQue} = ${f2(t)} ${u} → ${fmtPct(p.taxaPct)} (${a?.nomeCurto ?? p.descricao}, ${fmt(cap, 1)} ${u}) ${veredito(p.taxaPct, e.avisoAtencaoPct, e.limitePct)}`,
      };
    }
  }
}

function secoesSapatas(e: EntradaMemorial): SecaoMemorial[] {
  const r = e.resultados;
  const s = r.sapatas;
  const raio = n(r.guindastes[0]?.raioM);
  const pbG = n(r.guindastes[0]?.cargaKg ?? r.pbKg);
  const a = n(e.guindaste?.aM), b = n(e.guindaste?.bM), pg = n(e.guindaste?.pgKgf);
  const { larguraCm, comprimentoCm, quantidade } = e.dormente;
  return [
    {
      titulo: 'Esforço nas sapatas',
      linhas: [
        { texto: `M = Pb × Ro = ${f2(pbG)} × ${f2(raio)} = ${f2(n(s.momentoKgfm))} kgf·m` },
        { texto: `F = M ÷ (a + b) = ${f2(n(s.momentoKgfm))} ÷ (${f2(a)} + ${f2(b)}) = ${f2(n(s.forcaKgf))} kgf` },
        { texto: `ES = Pg ÷ 2 + F = ${kg(pg)} ÷ 2 + ${f2(n(s.forcaKgf))} = ${f2(pg / 2)} + ${f2(n(s.forcaKgf))}` },
      ],
      resultado: `ES = ${f2(n(s.esforcoKgf))} kgf`,
    },
    {
      titulo: 'Resistência mínima exigida do terreno (RMET)',
      linhas: [
        { texto: `AP = LD × CD × ND = ${kg(larguraCm)} × ${kg(comprimentoCm)} × ${kg(quantidade)} = ${kg(s.areaCm2)} cm²` },
        { texto: `RMET = ES ÷ AP = ${f2(n(s.esforcoKgf))} ÷ ${kg(s.areaCm2)} = ${f4(n(s.rmet))}` },
      ],
      resultado: `RMET = ${f2(n(s.rmet))} kgf/cm² (${f4(n(s.rmet))})`,
    },
  ];
}

/** Seções numeradas do memorial: carga bruta, guindaste(s), cada posição da lingada, sapatas e RMET. */
export function secoesMemorial(e: EntradaMemorial): SecaoMemorial[] {
  const r = e.resultados;
  const angInf = n(r.posicoes.find((p) => p.posicao === 'pernasInferiores')?.anguloGraus);
  const usadas = POSICOES.filter((pos) => e.balancim || pos !== 'pernasSuperiores');
  const posicoes = usadas.flatMap((pos) => r.posicoes.filter((p) => p.posicao === pos));
  const secoes = [secaoCargaBruta(r), ...secoesGuindastes(e), ...posicoes.map((p) => secaoPosicao(p, e, angInf)), ...secoesSapatas(e)];
  return secoes.map((s, i) => ({ ...s, titulo: `${i + 1}. ${s.titulo}` }));
}
