import { describe, expect, it } from 'vitest';
import { carregarPlanoCalculado } from '../usePlanoCalculado';
import { secoesMemorial, veredito } from './visualizacao/memorial';
import { escolherVista, vistasDoPlano } from './visualizacao/vistas';

describe('Memorial · 2607036 Rev. 2', async () => {
  const d = await carregarPlanoCalculado('2607036');
  const vista = escolherVista(vistasDoPlano(d.plano, d.calculo), null);
  const secoes = secoesMemorial({
    resultados: vista.resultados, guindaste: d.guindaste, tabela: d.tabela, acessorios: d.acessorios, dormente: d.plano.dormente,
    balancim: d.calculo.balancim, avisoAtencaoPct: d.config.avisoAtencaoPct,
  });
  const texto = (i: number) => [secoes[i].titulo, ...secoes[i].linhas.map((l) => l.texto), secoes[i].resultado].join('\n');

  it('tem as 8 seções na ordem', () => {
    expect(secoes.map((s) => s.titulo.split('.')[0])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });
  it('Pb e capacidade interpolada passo a passo, com referência conservadora', () => {
    expect(secoes[0].resultado).toBe('Pb = 3.746,62 kg (3,75 t)');
    expect(texto(1)).toContain('C = 10.900 + (5,00 − 4,18) × (7.300 − 10.900) ÷ (5,98 − 4,18) = 10.900 − 1.640,00 = 9.260 kg');
    expect(texto(1)).toContain('= 7.300 kg (taxa 51,32%)');
    expect(secoes[1].resultado).toBe('C = 9.260 kg (9,26 t) · TU = 40,46% ≤ 85% ✓');
  });
  it('trações por posição (ângulos a partir da vertical)', () => {
    expect(texto(2)).toContain('Te = 1,1326 × 1,7250 = 1,9537 t');
    expect(secoes[2].resultado).toBe('Te = 1,95 t · TU = 46,52% ≤ 85% ✓');
    expect(texto(3)).toContain('P + balancim = 3,70 t');
    expect(secoes[3].resultado).toBe('Te = 2,45 t · TU = 58,36% ≤ 85% ✓');
    expect(texto(4)).toContain('= 3,45 ÷ 3,5318 = 0,9768 tf');
    expect(secoes[4].resultado).toBe('Manilha na carga = 0,98 tf · TU = 17,76% ≤ 85% ✓');
    expect(secoes[5].resultado).toBe('Manilha no gancho = 2 · Te superior = 4,90 tf → 68,09% (manilha 1", 7,2 tf) ≤ 85% ✓');
  });
  it('sapatas e RMET', () => {
    expect(texto(6)).toContain('M = Pb × Ro = 3.746,62 × 5,00 = 18.733,10 kgf·m');
    expect(texto(6)).toContain('F = M ÷ (a + b) = 18.733,10 ÷ (2,95 + 5,70) = 2.165,68 kgf');
    expect(secoes[6].resultado).toBe('ES = 7.940,68 kgf');
    expect(texto(7)).toContain('AP = LD × CD × ND = 50 × 50 × 1 = 2.500 cm²');
    expect(secoes[7].resultado).toBe('RMET = 3,18 kgf/cm² (3,1763)');
  });
});

describe('veredito', () => {
  it('85,00% passa; acima bloqueia; inválido bloqueia', () => {
    expect(veredito(85, 75)).toMatch(/Atenção/);
    expect(veredito(85.01, 75)).toMatch(/Bloqueado/);
    expect(veredito(null, 75)).toMatch(/Bloqueado/);
    expect(veredito(40.46, 75)).toBe('≤ 85% ✓');
  });
});
