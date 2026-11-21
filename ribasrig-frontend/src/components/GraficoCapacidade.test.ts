import { describe, expect, it } from 'vitest';
import { eixosDoGrafico, marcas, passoRedondo } from './GraficoCapacidade';

describe('GraficoCapacidade · eixos com números redondos', () => {
  it('passo redondo (1, 2, 2,5 ou 5 × 10ⁿ)', () => {
    expect(passoRedondo(13.33, 7)).toBe(2);
    expect(passoRedondo(10.9, 6)).toBe(2);
    expect(passoRedondo(0.9, 6)).toBeCloseTo(0.2);
    expect(passoRedondo(0, 6)).toBe(1);
  });
  it('marcas sem resíduo de ponto flutuante', () => {
    expect(marcas(0, 1, 0.2)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it('gráfico do MD 45.007: alcance de 4 a 18 m de 2 em 2, capacidade de 0 a 12 t de 2 em 2', () => {
    const pontos = [[4.18, 10900], [5.98, 7300], [7.83, 5200], [9.68, 3900], [11.53, 3300], [13.46, 1900], [15.46, 1200], [17.51, 900]]
      .map(([alcanceM, capacidadeKg]) => ({ alcanceM, capacidadeKg }));
    const e = eixosDoGrafico(pontos);
    expect(e.marcasX).toEqual([4, 6, 8, 10, 12, 14, 16, 18]);
    expect(e.marcasY).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });
  it('um ponto só não quebra o eixo', () => {
    const e = eixosDoGrafico([{ alcanceM: 5, capacidadeKg: 3000 }]);
    expect(e.x1).toBeGreaterThan(e.x0);
    expect(e.y1).toBeGreaterThanOrEqual(3);
  });
});
