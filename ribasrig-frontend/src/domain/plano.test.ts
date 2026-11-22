import { describe, expect, it } from 'vitest';
import { ACESSORIOS, CLIENTES, CONFIGURACOES, GUINDASTES, PLANOS, TIPOS } from '../data/mock';
import { HOJE } from './formatacao';
import { artsEmUso, calcularPlano, caminhoPlano, formDoPlano, pastaDe, planoDoForm, resultadosDoCalculo, rotuloDocumento, TEXTO_MONTAGEM_NAO_CALCULADA, type FormPlano } from './plano';
import type { Acessorio } from './types';

const [p2607036, p2610001, p2610002] = PLANOS;

const calcular = (form: FormPlano, numero = 'teste', extra: { acessorios?: Acessorio[]; aviso?: number; limite?: number } = {}) =>
  calcularPlano({
    form, numero, acessorios: extra.acessorios ?? ACESSORIOS, guindastes: GUINDASTES, tipos: TIPOS, clientes: CLIENTES,
    configuracoes: { avisoAtencaoPct: extra.aviso ?? CONFIGURACOES.avisoAtencaoPct, limitePct: extra.limite }, hoje: HOJE,
    artsEmUso: artsEmUso(PLANOS.filter((p) => p.numero !== numero)),
  });
const form2607036 = () => formDoPlano(p2607036);
const pos = (r: ReturnType<typeof calcular>, p: string) => r.porPosicao.find((x) => x.posicao === p)!;
const item = (r: ReturnType<typeof calcular>, id: string) => r.checklist.find((c) => c.id === id)!;

describe('plano 2607036 · Rev. 2 (valores corretos da especificação)', () => {
  const r = calcular(form2607036(), '2607036');

  it('formulário em texto como o usuário digita', () => {
    const f = form2607036();
    expect(f.peso).toBe('3.450');
    expect(f.raio).toBe('5,0');
    expect(f.vento).toBe('7,0');
    expect(f.lingada.map((l) => l.posicao)).toEqual(['pernasInferiores', 'carga', 'pernasSuperiores', 'gancho']);
  });
  it('carga bruta Pb = 3.746,62 kg (lingada 46,62 + balancim 250)', () => {
    expect(r.lingadaKg).toBeCloseTo(46.62, 10);
    expect(r.dispositivosKg).toBe(250);
    expect(r.pbKg).toBeCloseTo(3746.62, 10);
  });
  it('capacidade 9.260 kg e taxa do guindaste 40,46%', () => {
    expect(r.capacidade.tipo).toBe('interpolado');
    expect(r.capacidadeKg).toBeCloseTo(9260, 9);
    expect(r.taxaGuindaste).toBeCloseTo(40.46, 2);
    expect(r.nivelGuindaste).toBe('ok');
  });
  it('referência conservadora 7.300 kg · 51,32%', () => {
    expect(r.referenciaConservadora).toMatchObject({ alcanceM: 5.98, capacidadeKg: 7300 });
    expect(r.referenciaConservadora!.taxaPct).toBeCloseTo(51.32, 2);
  });
  it('acessórios por posição: 46,52% · 58,36% · 17,76% · 68,09%', () => {
    expect(pos(r, 'pernasInferiores').tracao).toBeCloseTo(1.95, 2);
    expect(pos(r, 'pernasInferiores').taxaPct).toBeCloseTo(46.52, 2);
    expect(pos(r, 'pernasSuperiores').tracao).toBeCloseTo(2.45, 2);
    expect(pos(r, 'pernasSuperiores').taxaPct).toBeCloseTo(58.36, 2);
    expect(pos(r, 'carga').tracao).toBeCloseTo(0.98, 2);
    expect(pos(r, 'carga').taxaPct).toBeCloseTo(17.76, 2);
    expect(pos(r, 'carga').unidade).toBe('tf');
    expect(pos(r, 'gancho').tracao).toBeCloseTo(4.9, 2);
    expect(pos(r, 'gancho').taxaPct).toBeCloseTo(68.09, 2);
    expect(pos(r, 'gancho').governante?.id).toBe(4);
  });
  it('sapatas: ES 7.940,68 kgf · área 2.500 cm² · RMET 3,1763', () => {
    expect(r.sapatas.esforcoKgf).toBeCloseTo(7940.68, 2);
    expect(r.sapatas.areaCm2).toBe(2500);
    expect(r.rmet).toBeCloseTo(3.1763, 4);
  });
  it('laudo válido na operação (24/07), dentro do limite e checklist completo', () => {
    expect(r.laudo.situacao).toBe('em-dia');
    expect(r.situacaoSeguranca).toBe('ok');
    expect(r.motivosBloqueio).toEqual([]);
    expect(r.checklist.filter((c) => !c.ok)).toEqual([]);
    expect(r.podeEmitir).toBe(true);
  });
  it('a Rev. 2 do mock foi calculada pelo motor', () => {
    const rev2 = p2607036.revisoes[1];
    expect(rev2.origem).toBe('sistema');
    expect(rev2.resultados).toEqual(resultadosDoCalculo(r));
    expect(rev2.resultados.pbKg).toBeCloseTo(3746.62, 10);
    expect(rev2.resultados.posicoes).toHaveLength(4);
  });
  it('a Rev. 1 guarda os números do documento do Excel', () => {
    const rev1 = p2607036.revisoes[0];
    expect(rev1).toMatchObject({ numero: 1, origem: 'excel', emitidaEm: '2026-07-24', cadastradaEm: '2026-10-07T09:12' });
    expect(rev1.resultados).toMatchObject({ capacidadeKg: 7948, taxaGuindastePct: 47.1 });
    expect(rev1.resultados.comoNoDocumento).toMatchObject({ cap: '7,95', taxa: '47,1', cinta: '60,0', manilha: '70,0', es: '7914', rmet: '3,17' });
    expect(rotuloDocumento(p2607036)).toBe('Emitido · Rev. 2');
  });
  it('caminho do PDF', () => {
    expect(caminhoPlano(CONFIGURACOES, 'Kaefer Rip', '2607036', 2)).toBe('C:\\Guindastes Ribas\\Planos de Rigging\\Kaefer Rip\\2607036\\Relatório\\Plano_de_Rigging_2607036_Rev2.pdf');
    // macOS: barras normais, sem barra dupla se a pasta raiz terminar em /
    expect(caminhoPlano({ ...CONFIGURACOES, pastaRaiz: '/Users/rafael/Downloads/teste/' }, 'Kaefer Rip', '2610003', 1))
      .toBe('/Users/rafael/Downloads/teste/Kaefer Rip/2610003/Relatório/Plano_de_Rigging_2610003_Rev1.pdf');
    expect(pastaDe('/Users/rafael/teste/Kaefer Rip/2610003/Relatório/x.pdf')).toBe('/Users/rafael/teste/Kaefer Rip/2610003/Relatório/');
    expect(pastaDe('C:\\Planos\\Kaefer Rip\\x.pdf')).toBe('C:\\Planos\\Kaefer Rip\\');
  });
});

describe('plano 2610001 (rascunho, cópia do 2607036, operação 15/10/2026)', () => {
  const r = calcular(formDoPlano(p2610001), '2610001');
  it('mesmos números do 2607036', () => {
    expect(r.pbKg).toBeCloseTo(3746.62, 10);
    expect(r.capacidadeKg).toBeCloseTo(9260, 9);
    expect(r.taxaGuindaste).toBeCloseTo(40.46, 2);
    expect(r.sapatas.esforcoKgf).toBeCloseTo(7940.68, 2);
  });
  it('bloqueado porque o laudo venceu em 06/10/2026', () => {
    expect(r.laudo.situacao).toBe('vencido');
    expect(r.situacaoSeguranca).toBe('bloqueado');
    expect(r.motivosBloqueio).toContain('laudo do Palfinger MD 45.007 vencido em 06/10/2026');
    expect(item(r, 'laudo').ok).toBe(false);
    expect(r.podeEmitir).toBe(false);
  });
  it('sem ART e sem anexos; inspeções em dia para 15/10 (cinta 3 m vence em 13 dias a partir de hoje)', () => {
    expect(item(r, 'art').ok).toBe(false);
    expect(item(r, 'anexos').ok).toBe(false);
    expect(item(r, 'inspecoes').ok).toBe(true);
    const cinta = r.inspecoes.itens.find((x) => x.acessorio.id === 1)!;
    expect(cinta.hoje).toMatchObject({ situacao: 'vence-em-breve', dias: 13 });
    expect(r.inspecoes.itens.map((x) => x.acessorio.id)).toContain(5); // balancim
  });
  it('rascunho criado hoje às 14:12, etapa 4', () => {
    expect(p2610001).toMatchObject({ situacaoDocumento: 'rascunho', criadoEm: '2026-10-07T14:12', etapaAtual: 4, dataOperacao: '2026-10-15', art: '', revisoes: [] });
    expect(rotuloDocumento(p2610001)).toBe('Rascunho');
  });
  it('a ART do 2607036 não pode ser reaproveitada', () => {
    const r2 = calcular({ ...formDoPlano(p2610001), art: '1720264496217' }, '2610001');
    expect(r2.art.erro).toBe('Esta ART já pertence ao plano 2607036.');
  });
});

describe('plano 2610002 (exemplo Volvo, prensa 4.800 kg, raio 7,83 m)', () => {
  const r = calcular(formDoPlano(p2610002), '2610002');
  it('taxa acima de 85% → bloqueado', () => {
    expect(r.capacidadeKg).toBe(5200);
    expect(r.taxaGuindaste).toBeGreaterThan(85);
    expect(r.nivelGuindaste).toBe('bloqueado');
    expect(r.situacaoSeguranca).toBe('bloqueado');
    expect(r.motivosBloqueio).toContain('taxa acima de 85%');
  });
});

describe('bloqueios e limites', () => {
  it('ângulo 95 bloqueia (fora da faixa e cos de 95° < 0)', () => {
    const r = calcular({ ...form2607036(), anguloInferior: '95' });
    expect(r.campos.anguloInferior.erro).toMatch(/Fora da faixa/);
    expect(pos(r, 'pernasInferiores').taxaPct).toBeNaN();
    expect(r.situacaoSeguranca).toBe('bloqueado');
  });
  it('ângulo vazio bloqueia (vazio não vale 0°)', () => {
    const r = calcular({ ...form2607036(), anguloSuperior: '' });
    expect(r.campos.anguloSuperior.erro).toMatch(/Vazio não vale como 0°/);
    expect(r.situacaoSeguranca).toBe('bloqueado');
    expect(item(r, 'campos').ok).toBe(false);
  });
  it('acessório com capacidade nula bloqueia a posição', () => {
    const acessorios = ACESSORIOS.map((a) => (a.id === 3 ? { ...a, capacidadeT: null, capacidadeTrabalhoT: null } : a));
    const r = calcular(form2607036(), 'teste', { acessorios });
    expect(pos(r, 'carga').problema).toBe('item sem capacidade no cadastro');
    expect(r.situacaoSeguranca).toBe('bloqueado');
  });
  it('guindaste sem gráfico (capacidade nula) bloqueia', () => {
    const r = calcular({ ...form2607036(), guindasteId: 2, tabelaId: null });
    expect(r.capacidade.tipo).toBe('sem-grafico');
    expect(r.capacidadeKg).toBeNaN();
    expect(r.situacaoSeguranca).toBe('bloqueado');
  });
  it('raio 3 m e 18 m ficam fora do gráfico e bloqueiam', () => {
    for (const raio of ['3', '18']) {
      const r = calcular({ ...form2607036(), raio, isolamento: '20' });
      expect(r.capacidade.tipo).toBe('fora-do-grafico');
      expect(item(r, 'raio').ok).toBe(false);
      expect(r.situacaoSeguranca).toBe('bloqueado');
    }
  });
  it('raio 5,26 m → 8.740 kg (sem arredondar)', () => {
    const r = calcular({ ...form2607036(), raio: '5,26' });
    expect(r.capacidadeKg).toBeCloseTo(8740, 9);
  });
  it('taxa do guindaste exatamente 85,00% passa e 85,06% bloqueia', () => {
    // Pb = 0,85 × 9.260 = 7.871 kg → peso = 7.871 − 46,62 − 250 = 7.574,38
    const r85 = calcular({ ...form2607036(), peso: '7.574,38' });
    expect(r85.taxaGuindaste).toBeCloseTo(85, 9);
    expect(r85.nivelGuindaste).toBe('atencao');
    expect(item(r85, 'guindaste').ok).toBe(true);
    // Pb = 0,8506 × 9.260 = 7.876,556 → peso 7.579,936
    const r8506 = calcular({ ...form2607036(), peso: '7.579,936' });
    expect(r8506.taxaGuindaste).toBeCloseTo(85.06, 9);
    expect(r8506.nivelGuindaste).toBe('bloqueado');
    expect(item(r8506, 'guindaste').ok).toBe(false);
  });
  it('75% é atenção (aviso das Configurações)', () => {
    // Pb = 0,75 × 9.260 = 6.945 → peso 6.648,38; acessórios ficam acima de 85%, então olhamos o guindaste
    const r = calcular({ ...form2607036(), peso: '6.648,38' });
    expect(r.taxaGuindaste).toBeCloseTo(75, 9);
    expect(r.nivelGuindaste).toBe('atencao');
    // com aviso em 80%, os 40,46% do 2607036 continuam ok e 75% vira ok
    expect(calcular({ ...form2607036(), peso: '6.648,38' }, 'x', { aviso: 80 }).nivelGuindaste).toBe('ok');
  });
  it('situação "atencao" quando a maior taxa fica entre 75% e 85%', () => {
    // raio 8,5 m: capacidade 4.729,19 kg → taxa do guindaste 79,22%; acessórios continuam abaixo de 75%
    const r = calcular({ ...form2607036(), raio: '8,5', isolamento: '10' }, '2607036');
    expect(r.taxaGuindaste).toBeCloseTo(79.22, 2);
    expect(r.nivelGuindaste).toBe('atencao');
    expect(r.situacaoSeguranca).toBe('atencao');
    expect(r.podeEmitir).toBe(true);
  });
  it('isolamento menor que o raio bloqueia', () => {
    const r = calcular({ ...form2607036(), isolamento: '4' }, '2607036');
    expect(r.campos.isolamento.erro).toMatch(/Menor que o raio/);
    expect(r.situacaoSeguranca).toBe('bloqueado');
  });
  it('sem data da operação: laudo e inspeções sem conferência → bloqueado', () => {
    const r = calcular({ ...form2607036(), dataOperacao: '' }, '2607036');
    expect(r.laudo.situacao).toBe('sem-data');
    expect(item(r, 'data').ok).toBe(false);
    expect(r.situacaoSeguranca).toBe('bloqueado');
  });
});

describe('tipos sem balancim (t2, exemplo)', () => {
  const base = (): FormPlano => ({
    ...form2607036(), tipoIcamentoId: 't2', anguloSuperior: '', dispositivoQtd: '', dispositivoPeso: '',
    lingada: [{ acessorioId: 1, quantidade: '2', posicao: 'pernasInferiores' }, { acessorioId: 3, quantidade: '2', posicao: 'carga' }, { acessorioId: 4, quantidade: '1', posicao: 'gancho' }],
  });
  it('ângulo único, sem balancim na Pb e sem validar campos do balancim', () => {
    const r = calcular(base(), '2607036');
    expect(r.balancim).toBe(false);
    expect(r.dispositivosKg).toBe(0);
    expect(r.campos.anguloSuperior.ativo).toBe(false);
    expect(r.pbKg).toBeCloseTo(3450 + 2 * 4.87 + 2 * 1.7 + 2.5, 10);
    const te = 3.45 / (2 * Math.cos((28 * Math.PI) / 180));
    expect(pos(r, 'pernasInferiores').tracao).toBeCloseTo(te, 12);
    expect(pos(r, 'gancho').tracao).toBeCloseTo(2 * te, 12);
    expect(r.porPosicao.some((p) => p.posicao === 'pernasSuperiores')).toBe(false);
  });
  it('item em pernas superiores bloqueia', () => {
    const f = base();
    f.lingada.push({ acessorioId: 2, quantidade: '2', posicao: 'pernasSuperiores' });
    const r = calcular(f, '2607036');
    expect(r.itens[3].erroPosicao).toBe('Este tipo não tem pernas superiores.');
    expect(r.situacaoSeguranca).toBe('bloqueado');
  });
});

describe('cargas extras e guindastes adicionais', () => {
  it('P = carga + cargas extras na tração; extras entram na Pb', () => {
    const r = calcular({ ...form2607036(), extras: '100' }, '2607036');
    expect(r.pT).toBeCloseTo(3.55, 12);
    expect(r.pbKg).toBeCloseTo(3846.62, 10);
  });
  it('adicional divide a carga, sem repetir modelo, e exige laudo e gráfico', () => {
    const f = { ...form2607036(), guindastesAdicionais: [{ guindasteId: 2, tabelaId: null, raio: '5,0', pct: '40' }] };
    const r = calcular(f, '2607036');
    expect(r.pctPrincipal).toBeCloseTo(60, 12);
    expect(r.pbPrincipalKg).toBeCloseTo(3746.62 * 0.6, 10);
    expect(r.adicionais[0].cargaKg).toBeCloseTo(3746.62 * 0.4, 10);
    expect(r.adicionais[0].capacidade.tipo).toBe('sem-grafico'); // MD 55 sem dados
    expect(r.adicionais[0].laudo.situacao).toBe('nao-cadastrado');
    expect(r.situacaoSeguranca).toBe('bloqueado');
    const rep = calcular({ ...f, guindastesAdicionais: [{ guindasteId: 1, tabelaId: null, raio: '5,0', pct: '40' }] }, '2607036');
    expect(rep.adicionais[0].repetido).toBe(true);
    const div = calcular({ ...f, guindastesAdicionais: [{ guindasteId: 2, tabelaId: null, raio: '5,0', pct: '60' }, { guindasteId: 3, tabelaId: null, raio: '5,0', pct: '40' }] }, '2607036');
    expect(div.divisaoInvalida).toBe(true);
  });
});

describe('conversões', () => {
  it('formDoPlano ⇄ planoDoForm preserva os dados', () => {
    const volta = planoDoForm(formDoPlano(p2607036), p2607036);
    const { id, numero, situacaoDocumento, revisoes, criadoEm, criadoPor, atualizadoEm, ...dados } = p2607036;
    void [id, numero, situacaoDocumento, revisoes, criadoEm, criadoPor, atualizadoEm];
    expect({ ...volta }).toMatchObject(dados);
  });
});

describe('limite da taxa configurável (Configurações)', () => {
  it('com limite de 60%, a manilha do gancho (68,09%) bloqueia e os textos mostram 60%', () => {
    const r = calcular(form2607036(), '2607036', { limite: 60, aviso: 55 });
    expect(pos(r, 'gancho').nivel).toBe('bloqueado');
    expect(r.situacaoSeguranca).toBe('bloqueado');
    expect(r.motivosBloqueio).toContain('taxa acima de 60%');
    expect(item(r, 'acessorios').rotulo).toBe('Acessórios até 60%');
  });
  it('com limite de 70%, os mesmos 68,09% ficam em atenção e o plano não bloqueia por taxa', () => {
    const r = calcular(form2607036(), '2607036', { limite: 70, aviso: 60 });
    expect(pos(r, 'gancho').nivel).toBe('atencao');
    expect(r.motivosBloqueio.some((m) => m.startsWith('taxa acima'))).toBe(false);
  });
});

describe('tipo com montagem que as fórmulas não cobrem', () => {
  it('balancim com 1 perna superior bloqueia (a tração real seria o dobro da calculada)', () => {
    const tipos = TIPOS.map((t) => (t.id === p2607036.tipoIcamentoId ? { ...t, pernasSuperiores: 1 } : t));
    const r = calcularPlano({
      form: form2607036(), numero: '2607036', acessorios: ACESSORIOS, guindastes: GUINDASTES, tipos, clientes: CLIENTES,
      configuracoes: { avisoAtencaoPct: CONFIGURACOES.avisoAtencaoPct }, hoje: HOJE, artsEmUso: artsEmUso(PLANOS.filter((p) => p.numero !== '2607036')),
    });
    expect(r.podeEmitir).toBe(false);
    expect(r.motivosBloqueio).toContain(`lingada incompleta (${TEXTO_MONTAGEM_NAO_CALCULADA})`);
  });
});
