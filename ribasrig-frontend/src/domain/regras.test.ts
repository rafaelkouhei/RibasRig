import { describe, expect, it } from 'vitest';
import { avaliarBruto, avaliarExpressao, ErroExpressao, erroMontagemDoTipo, erroRegrasDoTipo, MAX_FORMULA, MSG_MONTAGEM_BALANCIM, MSG_MONTAGEM_SEM_BALANCIM, REGRAS_CALCULO, testarRegra, TIPOS_ICAMENTO, valorDeTeste } from './regras';

describe('avaliador: nomes herdados, × ÷ colados e limites', () => {
  it('constructor(), toString() e afins não são funções da fórmula', () => {
    expect(avaliarExpressao('2 * constructor(5)')).toEqual({ ok: false, erro: 'Função "constructor" não existe.' });
    expect(avaliarExpressao('toString(1)')).toMatchObject({ ok: false });
  });
  it('× e ÷ colados na variável são operadores, não parte do nome', () => {
    expect(avaliarBruto('P×2', { P: 3 })).toBe(6);
    expect(avaliarBruto('P÷2', { P: 3 })).toBe(1.5);
    expect(avaliarBruto('Pé×2', { 'Pé': 4 })).toBe(8);
  });
  it('fórmula longa demais e aninhamento exagerado dão erro em português', () => {
    expect(avaliarExpressao('1+'.repeat(MAX_FORMULA) + '1')).toMatchObject({ ok: false, erro: expect.stringMatching(/longa demais/) });
    // Dentro do limite de tamanho o aninhamento máximo (~250 níveis) não estoura a pilha
    expect(avaliarExpressao('('.repeat(200) + '1' + ')'.repeat(200))).toEqual({ ok: true, valor: 1 });
  });
});

describe('avaliador de expressões (sem eval)', () => {
  it('min/max com ";" e vírgula decimal', () => {
    expect(avaliarExpressao('min(3;45)')).toEqual({ ok: true, valor: 3 });
    expect(avaliarExpressao('max(2,5; 1; 4)')).toEqual({ ok: true, valor: 4 });
    expect(avaliarBruto('0,5 * 4')).toBe(2);
  });
  it('vírgula como separador de argumentos é recusada', () => {
    const r = avaliarExpressao('min(3,45)'); // vira 1 argumento: 3,45
    expect(r.ok).toBe(false);
    expect(avaliarExpressao('min(3 , 45)')).toMatchObject({ ok: false, erro: expect.stringMatching(/separe os valores com ";"/) });
  });
  it('menos unário com precedência certa: −2^2 = −4 (e resultado negativo é inválido)', () => {
    expect(avaliarBruto('-2^2')).toBe(-4);
    expect(avaliarBruto('−2^2')).toBe(-4);
    expect(avaliarBruto('5 + -2^2')).toBe(1);
    expect(avaliarBruto('(-2)^2')).toBe(4);
    expect(avaliarBruto('2^-1')).toBe(0.5);
    expect(avaliarBruto('2^3^2')).toBe(512);
    expect(avaliarExpressao('-2^2')).toMatchObject({ ok: false, valor: -4 });
  });
  it('cos/sen/tg em graus; cos(90) = 0 e dividir por ele é inválido', () => {
    expect(avaliarBruto('cos(60)')).toBeCloseTo(0.5, 12);
    expect(avaliarBruto('sen(30)')).toBeCloseTo(0.5, 12);
    expect(avaliarBruto('tg(45)')).toBeCloseTo(1, 12);
    expect(avaliarBruto('cos(90)')).toBe(0);
    expect(avaliarExpressao('3,45 / (2 * cos(90))')).toEqual({ ok: false, erro: 'Divisão por zero.' });
    expect(avaliarExpressao('P / (2 * cos(a))', { P: 3.45, a: 100 })).toMatchObject({ ok: false }); // cos < 0 → negativo
  });
  it('raiz, abs e erros em português', () => {
    expect(avaliarBruto('raiz(16) + abs(-1)')).toBe(5);
    expect(avaliarExpressao('raiz(-1)')).toEqual({ ok: false, erro: 'Raiz de número negativo.' });
    expect(avaliarExpressao('2 * (3')).toEqual({ ok: false, erro: 'Falta fechar um parêntese.' });
    expect(avaliarExpressao('1.5 * 2')).toMatchObject({ ok: false, erro: expect.stringMatching(/vírgula/) });
    expect(avaliarExpressao('x + 1')).toMatchObject({ ok: false, erro: expect.stringMatching(/não está definida/) });
    expect(avaliarExpressao('alert(1)')).toMatchObject({ ok: false, erro: 'Função "alert" não existe.' });
    expect(avaliarExpressao('constructor')).toMatchObject({ ok: false });
    expect(() => avaliarBruto('')).toThrow(ErroExpressao);
  });
  it('resultado não finito é inválido', () => {
    expect(avaliarExpressao('10^20')).toMatchObject({ ok: false });
  });
});

describe('catálogo de regras e tipos (igual ao protótipo)', () => {
  it('regras do sistema reproduzem o 2607036 Rev. 2', () => {
    expect(valorDeTeste(REGRAS_CALCULO, 'r1')).toBeCloseTo(3746.62, 10);
    expect(valorDeTeste(REGRAS_CALCULO, 'r2')).toBeCloseTo(9260, 9);
    expect(valorDeTeste(REGRAS_CALCULO, 'r3') / 4.2 * 100).toBeCloseTo(46.52, 2);
    expect(valorDeTeste(REGRAS_CALCULO, 'r4') / 4.2 * 100).toBeCloseTo(58.36, 2);
    expect(valorDeTeste(REGRAS_CALCULO, 'r5') / 5.5 * 100).toBeCloseTo(17.76, 2);
    expect(valorDeTeste(REGRAS_CALCULO, 'r8') / 7.2 * 100).toBeCloseTo(68.09, 2);
    expect(valorDeTeste(REGRAS_CALCULO, 'r6')).toBeCloseTo(7940.68, 2);
    expect(valorDeTeste(REGRAS_CALCULO, 'r7')).toBeCloseTo(3.1763, 4);
  });
  it('inclui "Esforço na manilha do gancho" e "Taxa de utilização do guindaste"', () => {
    const nomes = REGRAS_CALCULO.map((r) => r.nome);
    expect(nomes).toContain('Esforço na manilha do gancho');
    expect(nomes).toContain('Taxa de utilização do guindaste');
    const taxa = testarRegra(REGRAS_CALCULO.find((r) => r.id === 'r9')!, REGRAS_CALCULO);
    expect(taxa.taxaPct).toBeCloseTo(40.46, 2);
    expect(taxa.nivel).toBe('ok');
  });
  it('u1/u2 e t2/t3 são exemplos fictícios da equipe', () => {
    expect(REGRAS_CALCULO.filter((r) => r.origem === 'exemplo').map((r) => r.id)).toEqual(['u1', 'u2']);
    expect(TIPOS_ICAMENTO.map((t) => [t.id, t.origem, t.balancim])).toEqual([['t1', 'sistema', true], ['t2', 'exemplo', false], ['t3', 'exemplo', false]]);
    for (const t of TIPOS_ICAMENTO) expect(erroRegrasDoTipo(t.regras, REGRAS_CALCULO)).toBeNull();
    expect(erroRegrasDoTipo(['r1'], REGRAS_CALCULO)).toMatch(/tração/);
  });
  it('testarRegra mostra a substituição', () => {
    const t = testarRegra(REGRAS_CALCULO.find((r) => r.id === 'r3')!, REGRAS_CALCULO);
    expect(t.resultado.ok).toBe(true);
    expect(t.substituicao).toBe('Te = 3,45 ÷ (2 × cos(28))');
  });
  it('montagem do tipo: só as que as fórmulas de tração cobrem (igual a motor/regras.py)', () => {
    expect(erroMontagemDoTipo({ balancim: true, pernas: 4, pernasSuperiores: 2 })).toBeNull();
    expect(erroMontagemDoTipo({ balancim: true, pernas: 4, pernasSuperiores: 1 })).toBe(MSG_MONTAGEM_BALANCIM);
    expect(erroMontagemDoTipo({ balancim: true, pernas: 2, pernasSuperiores: 2 })).toBe(MSG_MONTAGEM_BALANCIM);
    expect(erroMontagemDoTipo({ balancim: false, pernas: 2, pernasSuperiores: 0 })).toBeNull();
    expect(erroMontagemDoTipo({ balancim: false, pernas: 4, pernasSuperiores: 0 })).toBeNull();
    expect(erroMontagemDoTipo({ balancim: false, pernas: 1, pernasSuperiores: 0 })).toBe(MSG_MONTAGEM_SEM_BALANCIM);
    for (const t of TIPOS_ICAMENTO) expect(erroMontagemDoTipo(t)).toBeNull();
  });
});
