import { describe, expect, it } from 'vitest';
import { cnpjValido, dataBR, dataHoraBR, diasEntre, fmt, fmtPct, formatarCnpj, HOJE, isoDeBR, lerNum, lidoComo, numParaTexto } from './formatacao';

describe('lerNum (regra exata da especificação)', () => {
  it.each([
    ['3450', 3450], ['3.450', 3450], ['3.450,5', 3450.5], ['5,0', 5], ['4.2', 4.2], ['4,87', 4.87],
    ['1.234.567', 1234567], ['12.34', 12.34], ['0', 0], [' 3 450 ', 3450], ['11.550', 11550],
  ])('"%s" → %d', (texto, valor) => expect(lerNum(texto)).toBe(valor));

  it.each(['', '   ', '-1', '-3,5', 'abc', '1,234.5', '3.45.6', '1.2.3', '3,450,5', '1e3', null, undefined])('"%s" → NaN', (texto) => {
    expect(lerNum(texto)).toBeNaN();
  });
});

describe('lidoComo', () => {
  it('só aparece quando o texto tem ponto', () => {
    expect(lidoComo('3.450')).toBe('lido como 3.450');
    expect(lidoComo('4.2', 1, 'm')).toBe('lido como 4,2 m');
    expect(lidoComo('3.450,5', 2, 'kg')).toBe('lido como 3.450,50 kg');
    expect(lidoComo('28.5', undefined, '°')).toBe('lido como 28,5°');
    expect(lidoComo('3450')).toBeNull();
    expect(lidoComo('4,2')).toBeNull();
    expect(lidoComo('a.b')).toBeNull();
  });
});

describe('fmt e numParaTexto', () => {
  it('separador de milhar, casas fixas e "—" para inválido', () => {
    expect(fmt(3746.62, 2)).toBe('3.746,62');
    expect(fmt(9260, 0)).toBe('9.260');
    expect(fmt(9.26, 2)).toBe('9,26');
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
    expect(fmt(null)).toBe('—');
    expect(fmtPct(40.4605)).toBe('40,46%');
    expect(fmtPct(NaN)).toBe('—');
  });
  it('número → texto do formulário sem arredondar (volta igual com lerNum)', () => {
    expect(numParaTexto(3450)).toBe('3.450');
    expect(numParaTexto(5, 1)).toBe('5,0');
    expect(numParaTexto(46.62)).toBe('46,62');
    expect(numParaTexto(5.2634)).toBe('5,2634');
    expect(numParaTexto(null)).toBe('');
    for (const v of [3450, 11550, 4.87, 1.95, 5.26, 1234567.891]) expect(lerNum(numParaTexto(v))).toBe(v);
  });
});

describe('datas', () => {
  it('HOJE é 07/10/2026', () => expect(HOJE).toBe('2026-10-07'));
  it('formata e converte', () => {
    expect(dataBR('2026-10-06')).toBe('06/10/2026');
    expect(dataBR('2026-02-30')).toBe('—');
    expect(dataHoraBR('2026-10-07T14:12')).toBe('07/10/2026 às 14h12');
    expect(isoDeBR('15/10/2026')).toBe('2026-10-15');
    expect(isoDeBR('31/02/2026')).toBeNull();
    expect(diasEntre(HOJE, '2026-10-20')).toBe(13);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('CNPJ (numérico e alfanumérico)', () => {
  it('numérico pelos dígitos verificadores', () => {
    expect(cnpjValido('07.522.191/0048-64')).toBe(true);
    expect(cnpjValido('81.076.242/0001-60')).toBe(true);
    expect(cnpjValido('07.522.191/0048-65')).toBe(false);
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
    expect(cnpjValido('')).toBe(false);
  });
  it('alfanumérico (letras nas 12 primeiras posições, regra da Receita de 2026)', () => {
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12abc34501de35')).toBe(true);
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false);
    expect(cnpjValido('12.ABC.345/01DE-3A')).toBe(false); // verificadores são numéricos
    expect(formatarCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
  });
});
