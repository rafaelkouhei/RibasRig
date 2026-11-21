import { describe, expect, it } from 'vitest';
import { carregarPlanoCalculado } from '../usePlanoCalculado';
import { OBS_REV1 } from '../data/mock';
import { escolherVista, resumoHistorico, valoresFicha, vistasDoPlano } from './visualizacao/vistas';
import { passaFiltro } from './visualizacao/historico';
import { api } from '../services/api';

describe('Visualização · revisões do 2607036', async () => {
  const d = await carregarPlanoCalculado('2607036');
  const vistas = vistasDoPlano(d.plano, d.calculo);
  const ficha = (rev: string | null) => valoresFicha(escolherVista(vistas, rev), d.plano, d.acessorios, d.calculo.lingadaKg);

  it('lista Rev. 2 e Rev. 1, a mais nova primeiro', () => {
    expect(vistas.map((v) => v.rotulo)).toEqual(['Rev. 2 · sistema', 'Rev. 1 · Excel']);
    expect(vistas.map((v) => v.selo)).toEqual(['EMITIDO · REV. 2', 'EMITIDO · REV. 1 (EXCEL)']);
  });

  it('Rev. 2 mostra os resultados gravados pelo sistema', () => {
    const v = ficha(null);
    expect(v).toMatchObject({ liq: '3.450', lingada: '46,62', dispositivos: '250', extras: '–', pb: '3.746,62', pbT: '3,75', cap: '9,26', capCarga: '9,26', taxa: '40,46', cinta: '58,36', tubular: '–', laco: '–', manilha: '68,09', es: '7.940,68', rmet: '3,18', isolamento: '7,0', vento: '7,0', raio: '5,0', data: '24/07/2026' });
  });

  it('Rev. 1 mostra os números como no documento do Excel e a nota certa', () => {
    const v = ficha('1');
    expect(v).toMatchObject({ liq: '3450', pb: '3747', pbT: '3,75', cap: '7,95', capCarga: '7,9', taxa: '47,1', cinta: '60,0', manilha: '70,0', es: '7914', rmet: '3,17', lingada: '46,62' });
    const r1 = escolherVista(vistas, '1');
    expect(r1.nota).toBe(OBS_REV1);
    expect(r1.notaAlerta).toBe(true);
    expect(r1.nota).not.toMatch(/sapatas herdaram/);
  });

  it('resumo lateral: revisões, ART e cadastro da Rev. 1', () => {
    expect(resumoHistorico(d.plano).map((h) => h.titulo)).toEqual([
      'Rev. 2 — recalculada e emitida pelo sistema', 'Rev. 1 — emitida no Excel (antes do sistema)', 'ART registrada no CREA-PR', 'Rev. 1 cadastrada no sistema',
    ]);
    expect(resumoHistorico(d.plano)[0].meta).toBe('07/10/2026 · capacidade 9.260 kg · Giuliano Breda');
    expect(resumoHistorico(d.plano)[2].meta).toBe('24/07/2026 às 18h19 · nº 1720264496217');
  });
});

describe('Visualização · rascunho 2610001', async () => {
  const d = await carregarPlanoCalculado('2610001');
  const vistas = vistasDoPlano(d.plano, d.calculo);
  it('mostra só a prévia, com o cálculo atual e bloqueado pelo laudo', () => {
    expect(vistas).toHaveLength(1);
    expect(vistas[0]).toMatchObject({ id: 'rascunho', selo: 'RASCUNHO', revisao: null });
    expect(d.calculo.situacaoSeguranca).toBe('bloqueado');
    const v = valoresFicha(vistas[0], d.plano, d.acessorios, d.calculo.lingadaKg);
    expect(v).toMatchObject({ pb: '3.746,62', taxa: '40,46', data: '15/10/2026' });
  });
});

describe('Histórico · filtros', async () => {
  const eventos = await api.historicoPlano('2607036');
  it('conta por filtro', () => {
    const conta = (f: 'tudo' | 'calculos' | 'anexos' | 'emissoes') => eventos.filter((e) => passaFiltro(e, f)).length;
    expect([conta('tudo'), conta('calculos'), conta('anexos'), conta('emissoes')]).toEqual([5, 1, 2, 1]);
    expect(eventos[0].titulo).toBe('Emitiu a Rev. 2');
  });
});
