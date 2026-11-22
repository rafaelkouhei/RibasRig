import { describe, expect, it } from 'vitest';
import {
  LIMITE_PADRAO_PCT, LIMITE_PCT, capacidadeKg, capacidadeNoGrafico, definirLimite, esforcoSapatas, extensaoQueAlcanca, nivelTaxa, nomeGrafico, situacaoInspecao, situacaoLaudo,
  tabelaDoGuindaste, taxaPct, tracoesPorPosicao,
} from './calculos';
import { ACESSORIOS, GUINDASTES } from '../data/mock';
import { HOJE } from './formatacao';
import type { Guindaste } from './types';

const md45007 = GUINDASTES[0];
const pontos = md45007.tabelas[0].pontos;

describe('gráfico de carga do MD 45.007 (interpolação linear, sem arredondar)', () => {
  it('raio 5,0 m → 9.260 kg (Rev. 1 dava 7.948 por erro de divisão)', () => {
    const r = capacidadeNoGrafico(pontos, 5.0);
    expect(r.tipo).toBe('interpolado');
    expect(capacidadeKg(r)).toBeCloseTo(9260, 9);
  });
  it('raio 5,26 m → 8.740 kg (nada arredondado: com 5,3 m daria 8.660)', () => {
    expect(capacidadeKg(capacidadeNoGrafico(pontos, 5.26))).toBeCloseTo(8740, 9);
  });
  it('raio igual a um ponto → exato', () => {
    expect(capacidadeNoGrafico(pontos, 5.98)).toMatchObject({ tipo: 'exato', capacidadeKg: 7300 });
    expect(capacidadeNoGrafico(pontos, 4.18)).toMatchObject({ tipo: 'exato', capacidadeKg: 10900 });
    expect(capacidadeNoGrafico(pontos, 17.51)).toMatchObject({ tipo: 'exato', capacidadeKg: 900 });
  });
  it('raio 3 m (abaixo do primeiro) e 18 m (acima do último) → fora do gráfico', () => {
    expect(capacidadeNoGrafico(pontos, 3)).toMatchObject({ tipo: 'fora-do-grafico', lado: 'abaixo', alcanceMinM: 4.18, alcanceMaxM: 17.51 });
    expect(capacidadeNoGrafico(pontos, 18)).toMatchObject({ tipo: 'fora-do-grafico', lado: 'acima' });
    expect(capacidadeKg(capacidadeNoGrafico(pontos, 18))).toBeNaN();
  });
  it('sem gráfico, gráfico inválido e raio inválido', () => {
    expect(capacidadeNoGrafico([], 5).tipo).toBe('sem-grafico');
    expect(capacidadeNoGrafico([{ alcanceM: 4, capacidadeKg: NaN }], 4).tipo).toBe('sem-grafico');
    expect(capacidadeNoGrafico(pontos, NaN).tipo).toBe('raio-invalido');
    expect(capacidadeNoGrafico(pontos, -5).tipo).toBe('raio-invalido');
  });
  it('referência conservadora: extensão que alcança 5,0 m = 7.300 kg', () => {
    expect(extensaoQueAlcanca(pontos, 5.0)).toEqual({ alcanceM: 5.98, capacidadeKg: 7300 });
    expect(extensaoQueAlcanca(pontos, 5.98)).toEqual({ alcanceM: 5.98, capacidadeKg: 7300 });
    expect(extensaoQueAlcanca(pontos, 3)).toBeNull();
    expect(extensaoQueAlcanca(pontos, 18)).toBeNull();
    expect(taxaPct(3746.62, 7300)).toBeCloseTo(51.32, 2);
  });
  it('nome do gráfico nunca é "Lança 5,1 m"', () => {
    expect(nomeGrafico(md45007.tabelas[0])).toBe('Gráfico de carga · lança principal (8 extensões)');
  });
});

describe('regra dos 85% e atenção (comparação com tolerância, valor não arredondado)', () => {
  it('85,00% passa (atenção) e 85,06% bloqueia', () => {
    expect(nivelTaxa(85)).toBe('atencao');
    expect(nivelTaxa((7871 / 9260) * 100)).toBe('atencao'); // 85,00000000000001 por ponto flutuante
    expect(nivelTaxa(85.06)).toBe('bloqueado');
    expect(nivelTaxa(85.001)).toBe('bloqueado');
  });
  it('75% é atenção; abaixo é ok; aviso configurável', () => {
    expect(nivelTaxa(75)).toBe('atencao');
    expect(nivelTaxa(74.99)).toBe('ok');
    expect(nivelTaxa(72, 70)).toBe('atencao');
  });
  it('NaN, negativo e infinito bloqueiam', () => {
    expect(nivelTaxa(NaN)).toBe('bloqueado');
    expect(nivelTaxa(-1)).toBe('bloqueado');
    expect(nivelTaxa(Infinity)).toBe('bloqueado');
    expect(taxaPct(100, 0)).toBeNaN();
    expect(taxaPct(-1, 100)).toBeNaN();
  });
});

describe('tração por posição (fórmulas da especificação)', () => {
  const t = tracoesPorPosicao({ pT: 3.45, balancimT: 0.25, anguloInferior: 28, anguloSuperior: 41, balancim: true });
  it('com balancim: 2607036', () => {
    expect(t.pernasInferiores).toBeCloseTo(1.9537, 4);
    expect(t.pernasSuperiores).toBeCloseTo(2.4513, 4);
    expect(t.carga).toBeCloseTo(0.97684, 5);
    expect(t.gancho).toBeCloseTo(2 * t.pernasSuperiores, 12);
  });
  it('sem balancim: ângulo único, sem pernas superiores', () => {
    const s = tracoesPorPosicao({ pT: 3.45, balancimT: 0.25, anguloInferior: 28, anguloSuperior: NaN, balancim: false });
    expect(s.pernasInferiores).toBeCloseTo(3.45 / (2 * Math.cos((28 * Math.PI) / 180)), 12);
    expect(s.carga).toBeCloseTo(s.pernasInferiores, 12);
    expect(s.gancho).toBeCloseTo(2 * s.pernasInferiores, 12);
    expect(s.pernasSuperiores).toBeNaN();
  });
  it('cos ≤ 0 (90° ou mais) e valores inválidos → NaN', () => {
    const r = tracoesPorPosicao({ pT: 3.45, balancimT: 0.25, anguloInferior: 95, anguloSuperior: 90, balancim: true });
    expect(r.pernasInferiores).toBeNaN();
    expect(r.pernasSuperiores).toBeNaN();
    expect(tracoesPorPosicao({ pT: NaN, balancimT: 0, anguloInferior: 28, anguloSuperior: 41, balancim: true }).carga).toBeNaN();
  });
});

describe('sapatas e RMET', () => {
  it('2607036: ES 7.940,68 kgf e RMET 3,1763 (lingada entra na Pb)', () => {
    const r = esforcoSapatas({ pbKg: 3746.62, raioM: 5, pgKgf: 11550, aM: 2.95, bM: 5.7, dormente: { larguraCm: 50, comprimentoCm: 50, quantidade: 1 } });
    expect(r.esforcoKgf).toBeCloseTo(7940.68, 2);
    expect(r.areaCm2).toBe(2500);
    expect(r.rmet).toBeCloseTo(3.1763, 4);
  });
  it('sem dados do guindaste → NaN', () => {
    const r = esforcoSapatas({ pbKg: 3746.62, raioM: 5, pgKgf: NaN, aM: NaN, bM: NaN, dormente: { larguraCm: 50, comprimentoCm: 50, quantidade: 1 } });
    expect(r.esforcoKgf).toBeNaN();
    expect(r.rmet).toBeNaN();
  });
});

describe('laudo do guindaste', () => {
  it('MD 45.007: válido na operação de 24/07/2026, vencido em 15/10/2026 e hoje', () => {
    expect(situacaoLaudo(md45007, '2026-07-24')).toMatchObject({ situacao: 'em-dia', aprovado: true, fim: '2026-10-06' });
    expect(situacaoLaudo(md45007, '2026-10-15')).toMatchObject({ situacao: 'vencido', aprovado: false, dias: -9, texto: 'vencido em 06/10/2026' });
    expect(situacaoLaudo(md45007, HOJE)).toMatchObject({ situacao: 'vencido', aprovado: false });
  });
  it('vence em breve (≤ 30 dias) ainda aprova', () => {
    expect(situacaoLaudo(md45007, '2026-09-20')).toMatchObject({ situacao: 'vence-em-breve', aprovado: true, dias: 16 });
    expect(situacaoLaudo(md45007, '2026-10-06')).toMatchObject({ situacao: 'vence-em-breve', aprovado: true, dias: 0 });
  });
  it('sem laudo, laudo sem data de fim e sem data da operação reprovam', () => {
    expect(situacaoLaudo(GUINDASTES[1], HOJE)).toMatchObject({ situacao: 'nao-cadastrado', aprovado: false });
    const semFim: Guindaste = { ...md45007, laudos: [{ inicio: '2026-04-06', fim: null, art: '1', arquivo: null, atual: true }] };
    expect(situacaoLaudo(semFim, HOJE)).toMatchObject({ situacao: 'nao-cadastrado', aprovado: false });
    expect(situacaoLaudo(md45007, null)).toMatchObject({ situacao: 'sem-data', aprovado: false });
    expect(situacaoLaudo(md45007, '')).toMatchObject({ situacao: 'sem-data', aprovado: false });
    expect(situacaoLaudo(null, HOJE).aprovado).toBe(false);
  });
});

describe('inspeção dos acessórios', () => {
  const cinta3m = ACESSORIOS[0];
  it('cinta plana 3 m: vence em 13 dias (hoje) e está em dia para 15/10/2026', () => {
    expect(situacaoInspecao(cinta3m, HOJE)).toMatchObject({ situacao: 'vence-em-breve', dias: 13, aprovado: true });
    expect(situacaoInspecao(cinta3m, '2026-10-15')).toMatchObject({ aprovado: true, dias: 5 });
    expect(situacaoInspecao(cinta3m, '2026-10-21')).toMatchObject({ situacao: 'vencida', aprovado: false });
  });
  it('descartado/inativo indisponível; sem próxima inspeção reprova', () => {
    expect(situacaoInspecao(ACESSORIOS[5], HOJE)).toMatchObject({ situacao: 'indisponivel', aprovado: false });
    expect(situacaoInspecao({ ...cinta3m, proximaInspecao: null }, HOJE)).toMatchObject({ situacao: 'sem-inspecao', aprovado: false });
  });
  // Vencimento (validade) do item, resposta 25: sem regra fixa, a data é do engenheiro; vale o que vence primeiro
  it('validade: cinta tubular (exemplo) vence em 23 dias e bloqueia depois de 30/10/2026', () => {
    const tubular = ACESSORIOS.find((a) => a.id === 7)!;
    expect(situacaoInspecao(tubular, HOJE)).toMatchObject({ situacao: 'vence-em-breve', motivo: 'validade', dias: 23, proxima: '2026-10-30', aprovado: true });
    expect(situacaoInspecao(tubular, '2026-10-30')).toMatchObject({ aprovado: true, dias: 0, texto: 'validade vence no dia (30/10/2026)' });
    expect(situacaoInspecao(tubular, '2026-11-05')).toMatchObject({ situacao: 'vencida', motivo: 'validade', aprovado: false, texto: 'validade vencida em 30/10/2026' });
    // sem vencimento, só a inspeção conta
    expect(situacaoInspecao({ ...tubular, vencimento: null }, HOJE)).toMatchObject({ situacao: 'em-dia', motivo: 'inspecao' });
  });
  it('validade vencida reprova mesmo com a inspeção em dia; a inspeção que vence antes da validade é a que avisa', () => {
    expect(situacaoInspecao({ ...cinta3m, vencimento: '2026-10-01' }, HOJE)).toMatchObject({ situacao: 'vencida', motivo: 'validade' });
    // inspeção vence em 13 dias, validade em 20: avisa a inspeção
    expect(situacaoInspecao({ ...cinta3m, vencimento: '2026-10-27' }, HOJE)).toMatchObject({ motivo: 'inspecao', dias: 13 });
    // validade em 5 dias, antes da inspeção: avisa a validade
    expect(situacaoInspecao({ ...cinta3m, vencimento: '2026-10-12' }, HOJE)).toMatchObject({ motivo: 'validade', dias: 5 });
    // inspeção vencida continua reprovando quando a validade está longe
    expect(situacaoInspecao({ ...cinta3m, vencimento: '2028-01-01' }, '2026-10-21')).toMatchObject({ situacao: 'vencida', motivo: 'inspecao' });
  });
});

describe('limite configurável', () => {
  it('nivelTaxa usa o limite informado; o valor exato passa', () => {
    expect(nivelTaxa(90, 75, 90)).toBe('atencao');
    expect(nivelTaxa(90.01, 75, 90)).toBe('bloqueado');
    expect(nivelTaxa(86, 75, 90)).toBe('atencao');
  });
  it('definirLimite troca o limite em uso (e ignora valor inválido)', () => {
    definirLimite(90);
    expect(LIMITE_PCT).toBe(90);
    expect(nivelTaxa(88)).toBe('atencao');
    definirLimite(Number.NaN);
    expect(LIMITE_PCT).toBe(90);
    definirLimite(LIMITE_PADRAO_PCT);
    expect(nivelTaxa(88)).toBe('bloqueado');
  });
});

describe('tabelaDoGuindaste (igual a motor/calculos.py)', () => {
  const g = GUINDASTES[0];
  it('sem escolha usa o primeiro gráfico; escolha existente usa ela', () => {
    expect(tabelaDoGuindaste(g, null)).toBe(g.tabelas[0]);
    expect(tabelaDoGuindaste(g, g.tabelas[0].id)).toBe(g.tabelas[0]);
  });
  it('gráfico escolhido que não existe mais = null (bloqueia; não troca de lança sem avisar)', () => {
    expect(tabelaDoGuindaste(g, 'apagado')).toBeNull();
  });
});
