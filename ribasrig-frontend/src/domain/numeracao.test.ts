import { describe, expect, it } from 'vitest';
import { ErroNumeracao, numerosEmSequencia, numerosParaLote, partesNumero, proximoNumero } from './numeracao';

const EXISTENTES = ['2607036', '2610001', '2610002'];

describe('próximo número (AAMM + 3 dígitos, pela data de criação)', () => {
  it('primeiro de outubro é 2610001 e o próximo livre hoje é 2610003', () => {
    expect(proximoNumero('2026-10-01', ['2607036'])).toBe('2610001');
    expect(proximoNumero('2026-10-07T14:12', EXISTENTES)).toBe('2610003');
  });
  it('zera no mês e trata a virada de ano', () => {
    expect(proximoNumero('2026-11-01', EXISTENTES)).toBe('2611001');
    expect(proximoNumero('2026-12-31', ['2612041'])).toBe('2612042');
    expect(proximoNumero('2027-01-01', ['2612041', '2612042'])).toBe('2701001');
  });
  it('ignora números de outro formato', () => {
    expect(proximoNumero('2026-10-07', ['EX-001', '26100', '2610abc'])).toBe('2610001');
  });
  it('erro passando de 999', () => {
    expect(proximoNumero('2026-10-07', ['2610998'])).toBe('2610999');
    expect(() => proximoNumero('2026-10-07', ['2610999'])).toThrow(ErroNumeracao);
  });
  it('partes do número', () => {
    expect(partesNumero('2610001')).toEqual({ prefixo: '2610', ano: 2026, mes: 10, sequencia: 1 });
    expect(partesNumero('2613001')).toBeNull();
  });
});

describe('lote em sequência', () => {
  it('10 planos a partir de 2610003', () => {
    const n = numerosParaLote('2026-10-07', EXISTENTES, 10);
    expect(n).toHaveLength(10);
    expect(n[0]).toBe('2610003');
    expect(n[9]).toBe('2610012');
  });
  it('não invade o mês seguinte (erro se passar de 999)', () => {
    expect(numerosEmSequencia('2610998', 2)).toEqual(['2610998', '2610999']);
    expect(() => numerosEmSequencia('2610998', 3)).toThrow(/Só cabem mais 2 planos/);
  });
  it('recusa entrada inválida', () => {
    expect(() => numerosEmSequencia('', 3)).toThrow(ErroNumeracao);
    expect(() => numerosEmSequencia('2610003', 0)).toThrow(ErroNumeracao);
    expect(() => numerosEmSequencia('2610003', 1.5)).toThrow(ErroNumeracao);
  });
});
