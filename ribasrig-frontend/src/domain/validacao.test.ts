import { describe, expect, it } from 'vitest';
import { erroLogin, erroNomeArquivo, erroNumeroArt, FAIXAS, faixaTexto, validarCampo } from './validacao';

describe('validarCampo (faixas da especificação)', () => {
  it('aceita valores válidos e mostra "lido como" quando há ponto', () => {
    expect(validarCampo('pesoCarga', '3.450')).toEqual({ valor: 3450, erro: null, lidoComo: 'lido como 3.450 kg' });
    expect(validarCampo('raio', '5,0')).toEqual({ valor: 5, erro: null, lidoComo: null });
    expect(validarCampo('angulo', '0').valor).toBe(0);
    expect(validarCampo('angulo', '60').valor).toBe(60);
    expect(validarCampo('cargasExtras', '0').valor).toBe(0);
  });
  it('ângulo 95 e ângulo vazio dão erro', () => {
    const a = validarCampo('angulo', '95');
    expect(a.valor).toBeNaN();
    expect(a.erro).toBe('Fora da faixa: 0° a 60° (a partir da vertical).');
    expect(validarCampo('angulo', '').erro).toMatch(/Vazio não vale como 0°/);
  });
  it('quantidade precisa ser inteira de 1 a 50', () => {
    expect(validarCampo('quantidade', '2,5').erro).toMatch(/inteiro/);
    expect(validarCampo('quantidade', '51').erro).toMatch(/Fora da faixa/);
    expect(validarCampo('dormentesPorSapata', '1').erro).toBeNull();
  });
  it('negativo e texto inválido dão "Número inválido"', () => {
    expect(validarCampo('pesoCarga', '-3450').erro).toMatch(/Número inválido/);
    expect(validarCampo('raio', '5.0.1').erro).toMatch(/Número inválido/);
  });
  it('"4.2" é lido como 4,2 e avisa', () => {
    const c = validarCampo('capacidadeAcessorio', '4.2');
    expect(c.valor).toBe(4.2);
    expect(c.lidoComo).toBe('lido como 4,2 t');
  });
  it('faixas como dados', () => {
    expect(FAIXAS.raio).toMatchObject({ min: 0.5, max: 30 });
    expect(FAIXAS.pesoGuindaste).toMatchObject({ min: 500, max: 100000 });
    expect(faixaTexto(FAIXAS.pesoCarga)).toBe('1 kg a 100.000 kg');
    expect(faixaTexto(FAIXAS.cargasExtras)).toBe('a partir de 0 kg');
  });
});

describe('outras validações', () => {
  it('nº da ART com 13 dígitos', () => {
    expect(erroNumeroArt('1720264496217')).toBeNull();
    expect(erroNumeroArt('17202644962')).toMatch(/13 dígitos/);
    expect(erroNumeroArt('')).toBeNull();
  });
  it('login e nome de arquivo', () => {
    expect(erroLogin('giuliano.breda')).toBeNull();
    expect(erroLogin('Giuliano')).not.toBeNull();
    expect(erroNomeArquivo('Plano_de_Rigging_{nº}_Rev{rev}.pdf')).toBeNull();
    expect(erroNomeArquivo('Plano_{nº}.pdf')).toMatch(/\{rev\}/);
  });
});
