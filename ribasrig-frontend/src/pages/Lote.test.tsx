import { describe, expect, it } from 'vitest';
import { dadosDoLote, descricaoDoItem, erroDataOperacao, validarLote, validarQuantidade, type FormLote } from './Lote';
import { numerosParaLote } from '../domain/numeracao';
import { PLANOS } from '../data/mock';

const base: FormLote = {
  dataOperacao: '2026-10-20', descricao: 'Içamento de injetoras', clienteId: 1, local: '0',
  obraNome: 'Bosch', obraEndereco: 'Av. Juscelino K. de Oliveira, 11800', obraCidade: 'Curitiba', obraUf: 'pr', obraCep: '81460-000',
  carga: 'Injetora', peso: '3.200', comprimento: '3,8', largura: '1,6', altura: '', quantidade: '10',
};

describe('Lote', () => {
  it('quantidade inteira de 1 a 50', () => {
    expect(validarQuantidade('10').erro).toBeNull();
    expect(validarQuantidade('0').erro).toBe('Fora da faixa: 1 a 50.');
    expect(validarQuantidade('51').erro).toBe('Fora da faixa: 1 a 50.');
    expect(validarQuantidade('2,5').erro).toContain('inteiro');
    expect(validarQuantidade('').erro).toBe('Campo obrigatório: 1 a 50.');
  });
  it('data obrigatória e não anterior a hoje', () => {
    expect(erroDataOperacao('')).toBe('Informe a data da operação.');
    expect(erroDataOperacao('2026-10-06')).toContain('anterior a hoje');
    expect(erroDataOperacao('2026-10-07')).toBeNull();
  });
  it('valida o formulário inteiro e monta os dados comuns', () => {
    const v = validarLote(base);
    expect(v.total).toBe(0);
    expect(v.peso.lidoComo).toBe('lido como 3.200 kg');
    const d = dadosDoLote(base, v, 7);
    expect(d.carga).toEqual({ descricao: 'Injetora', pesoKg: 3200, comprimentoM: 3.8, larguraM: 1.6, alturaM: null });
    expect(d.obra.uf).toBe('PR');
    expect(d.dataOperacao).toBe('2026-10-20');
    expect(validarLote({ ...base, peso: '200.000', dataOperacao: '', clienteId: null }).total).toBe(3);
  });
  it('números a partir do próximo livre e descrição por plano', () => {
    const n = numerosParaLote('2026-10-07', PLANOS.map((p) => p.numero), 10);
    expect(n[0]).toBe('2610003');
    expect(n[9]).toBe('2610012');
    expect(descricaoDoItem('Injetora', 2, 10, ' INJ-003 ')).toBe('Injetora 3 de 10 · nº de série INJ-003');
    expect(descricaoDoItem('Injetora', 0, 10, '')).toBe('Injetora 1 de 10');
  });
});
