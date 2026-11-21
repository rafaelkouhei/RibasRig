import { describe, expect, it } from 'vitest';
import { REGRAS_CALCULO, TIPOS_ICAMENTO, testarRegra } from '../../domain/regras';
import type { Acessorio } from '../../domain/types';
import { caminhosEsquema } from './EsquemaLingada';
import {
  alternarBalancim, avisoAcessorioFaltando, duplicarRegra, erroDoTeste, erroSalvarRegra, erroSalvarTipo, geometriaDoTipo, novaRegra, novoTipo,
  textoUsoRegra, tipoParaSalvar, tiposQueUsam, trocarOrigem, trocarOrigemCapacidade,
} from './logica';

const r = (id: string) => REGRAS_CALCULO.find((x) => x.id === id)!;
const t = (id: string) => TIPOS_ICAMENTO.find((x) => x.id === id)!;

describe('regras', () => {
  it('nova regra começa sem fórmula e não salva', () => {
    const n = novaRegra('Giuliano Breda');
    expect(n.origem).toBe('criado');
    expect(erroSalvarRegra({ ...n, nome: 'X' }, REGRAS_CALCULO)).toBe('Escreva a fórmula.');
  });
  it('duplicar sistema vira criada, sem versões', () => {
    const d = duplicarRegra(r('r3'), 'Giuliano Breda');
    expect(d).toMatchObject({ id: 'nova', origem: 'criado', nome: 'Tração na cinta · pernas inferiores (cópia)', versao: 0, versoes: [] });
    expect(erroSalvarRegra(d, REGRAS_CALCULO)).toBeNull();
  });
  it('nome repetido, símbolo repetido e limite sem capacidade bloqueiam', () => {
    const d = duplicarRegra(r('r3'), 'G');
    expect(erroSalvarRegra({ ...d, nome: 'carga bruta' }, REGRAS_CALCULO)).toMatch(/Já existe/);
    expect(erroSalvarRegra({ ...d, variaveis: [d.variaveis[0], { ...d.variaveis[1], simbolo: 'P' }] }, REGRAS_CALCULO)).toMatch(/único/);
    expect(erroSalvarRegra({ ...d, origemCapacidade: null }, REGRAS_CALCULO)).toMatch(/capacidade de comparação/);
  });
  it('valor de teste fora da faixa aparece pela variável', () => {
    const d = { ...r('u1'), variaveis: r('u1').variaveis.map((v) => (v.simbolo === 'a' ? { ...v, teste: '95' } : v)) };
    expect(erroDoTeste(testarRegra(d, REGRAS_CALCULO))).toBe('Valor de teste de "a": Ângulo a partir da vertical: de 0° a 60°.');
  });
  it('divisão por zero é inválida e não salva', () => {
    const d = { ...duplicarRegra(r('r3'), 'G'), formula: 'P / (2 * cos(90))' };
    expect(erroSalvarRegra(d, REGRAS_CALCULO)).toBe('Divisão por zero.');
  });
  it('troca de origem puxa o valor de teste do 2607036', () => {
    expect(trocarOrigem({ simbolo: 'a', nome: '', unidade: '°', origem: 'Valor fixo', teste: '' }, 'Ângulo pernas superiores (°)').teste).toBe('41');
    expect(trocarOrigem({ simbolo: 'Pb', nome: '', unidade: 'kg', origem: 'Valor fixo', teste: '9' }, 'Resultado: carga bruta (kg)').teste).toBe('');
    expect(trocarOrigemCapacidade(r('u1'), 'Capacidade de trabalho da manilha do gancho (tf)').capacidadeTeste).toBe('7,2');
  });
  it('textos de uso', () => {
    expect(textoUsoRegra(r('r1'))).toBe('usada no plano 2607036 (Rev. 2)');
    expect(textoUsoRegra(r('u1'))).toBe('ainda não usada');
  });
  it('tipos que usam a regra', () => {
    expect(tiposQueUsam('u1', TIPOS_ICAMENTO).map((x) => x.id)).toEqual(['t2', 't3']);
  });
});

describe('tipos de içamento', () => {
  it('salvar exige tração e taxa do guindaste', () => {
    const n = { ...novoTipo('G'), nome: 'Novo' };
    expect(erroSalvarTipo(n, REGRAS_CALCULO, TIPOS_ICAMENTO)).toMatch(/regra de tração/);
    expect(erroSalvarTipo({ ...n, regras: [...n.regras, 'u1'] }, REGRAS_CALCULO, TIPOS_ICAMENTO)).toBeNull();
    expect(erroSalvarTipo({ ...n, regras: ['u1'] }, REGRAS_CALCULO, TIPOS_ICAMENTO)).toMatch(/Taxa de utilização do guindaste/);
    expect(erroSalvarTipo({ ...t('t2'), id: 'novo' }, REGRAS_CALCULO, TIPOS_ICAMENTO)).toMatch(/Já existe/);
  });
  it('balancim liga os ângulos inferior/superior e o peso do balancim', () => {
    const b = alternarBalancim(novoTipo('G'));
    expect(b.campos).toMatchObject({ anguloInferior: true, anguloSuperior: true, anguloUnico: false, pesoBalancim: true });
    expect(b.pernasSuperiores).toBe(2);
    expect(alternarBalancim(b).pernasSuperiores).toBe(0);
  });
  it('geometria coerente com a montagem', () => {
    expect(geometriaDoTipo(t('t1'))).toBe(t('t1').geometria);
    expect(geometriaDoTipo(t('t2'))).toBe(t('t2').geometria);
    expect(geometriaDoTipo(t('t3'))).toBe(t('t3').geometria);
    expect(tipoParaSalvar({ ...t('t2'), campos: { ...t('t2').campos, capacidadeLaco: true } }).avisoSemAcessorio).toMatch(/laço/);
  });
  it('aviso do t3 só quando não há laço em uso', () => {
    expect(avisoAcessorioFaltando(t('t3'), [])).toBe(t('t3').avisoSemAcessorio);
    expect(avisoAcessorioFaltando(t('t3'), [{ tipo: 'laco', situacao: 'uso' } as Acessorio])).toBeNull();
    expect(avisoAcessorioFaltando(t('t1'), [])).toBeNull();
  });
  it('esquema: 4 pernas com balancim tem 6 traços; 2 sem balancim tem 2', () => {
    expect(caminhosEsquema(t('t1')).pernas.match(/M/g)).toHaveLength(6);
    expect(caminhosEsquema(t('t2')).pernas.match(/M/g)).toHaveLength(2);
  });
});
