import { describe, expect, it } from 'vitest';
import {
  PADROES_INSPECAO, aplicarInspecao, formInspecao, motivoSugerido, padraoDoTipo, registroDoForm, resultadoDasMarcas, validarInspecao,
} from './inspecao';
import { ACESSORIOS } from '../data/mock';
import { HOJE } from './formatacao';
import type { TipoAcessorio } from './types';

const tubular = ACESSORIOS.find((a) => a.id === 7)!;
const itensTubular = padraoDoTipo(PADROES_INSPECAO, 'tubular')!.itens;

describe('padrões de inspeção (resposta 25)', () => {
  it('existe um padrão com itens e referência para cada tipo de acessório', () => {
    const tipos: TipoAcessorio[] = ['cinta', 'tubular', 'manilha', 'laco', 'dispositivo'];
    for (const t of tipos) {
      const p = padraoDoTipo(PADROES_INSPECAO, t);
      expect(p?.itens.length).toBeGreaterThan(0);
      expect(p?.referencia).toMatch(/a validar/);
    }
    expect(padraoDoTipo(PADROES_INSPECAO, 'cinta')?.referencia).toMatch(/NBR 15637-1/);
    expect(padraoDoTipo(PADROES_INSPECAO, 'laco')?.referencia).toMatch(/NBR 13541-2.*NBR ISO 4309/);
  });
  it('não traz limite numérico inventado: os itens remetem à norma e ao fabricante', () => {
    const todos = PADROES_INSPECAO.flatMap((p) => p.itens).join(' ');
    expect(todos).not.toMatch(/\d+ ?%/);
  });
});

describe('registrar inspeção', () => {
  it('resultado: um item não conforme reprova; todos conformes aprovam; faltando item, ainda não há resultado', () => {
    expect(resultadoDasMarcas([true, true, true])).toBe('aprovado');
    expect(resultadoDasMarcas([true, false, null])).toBe('reprovado');
    expect(resultadoDasMarcas([true, null])).toBeNull();
    expect(resultadoDasMarcas([])).toBeNull();
  });
  it('motivo sugerido lista os itens não conformes', () => {
    expect(motivoSugerido(['Etiqueta legível', 'Sem cortes', 'Sem nós'], [true, false, false])).toBe('Reprovado na inspeção: Sem cortes; Sem nós');
    expect(motivoSugerido(['A'], [true])).toBe('');
  });
  it('validação: itens a conferir, próxima obrigatória no aprovado, sem data futura, motivo no descarte', () => {
    const f = formInspecao(['A', 'B'], 'Giuliano Breda');
    expect(f.data).toBe(HOJE);
    expect(validarInspecao(f, null).marcas).toBe('Falta conferir 2 itens.');
    const aprovado = { ...f, marcas: [true, true] };
    expect(validarInspecao(aprovado, null).proxima).toBe('Informe a próxima inspeção.');
    expect(validarInspecao({ ...aprovado, proxima: HOJE }, null).proxima).toBe('A próxima inspeção precisa ser depois desta.');
    expect(validarInspecao({ ...aprovado, proxima: '2027-04-07' }, null).total).toBe(0);
    expect(validarInspecao({ ...aprovado, proxima: '2027-04-07', data: '2026-12-01' }, null).data).toBe('A inspeção não pode ter data futura.');
    expect(validarInspecao({ ...aprovado, proxima: '2027-04-07' }, '2026-10-08').data).toMatch(/mais recente/);
    const reprovado = { ...f, marcas: [true, false] };
    expect(validarInspecao(reprovado, null).motivo).toBe('Informe o motivo do descarte.');
    expect(validarInspecao({ ...reprovado, destino: 'inspecao' as const }, null).total).toBe(0);
    expect(validarInspecao(formInspecao([], 'x'), null).marcas).toMatch(/não tem itens/);
  });
  it('aprovada: fica "Em uso", com última e próxima inspeção, registro com cópia dos itens e histórico', () => {
    const f = { ...formInspecao(itensTubular, 'Giuliano Breda'), marcas: itensTubular.map(() => true), proxima: '2027-04-07' };
    const r = registroDoForm(itensTubular, f);
    expect(r).toMatchObject({ resultado: 'aprovado', responsavel: 'Giuliano Breda', proxima: '2027-04-07' });
    expect(r.itens).toHaveLength(6);
    const a = aplicarInspecao(tubular, r);
    expect(a).toMatchObject({ situacao: 'uso', ultimaInspecao: HOJE, proximaInspecao: '2027-04-07' });
    expect(a.inspecoes).toHaveLength(2);
    expect(a.historico[0].descricao).toBe('Inspeção pelo padrão por Giuliano Breda: aprovada (6 de 6 itens conformes); próxima em 07/04/2027');
    expect(tubular.inspecoes).toHaveLength(1); // não altera o original
  });
  it('reprovada: descarta com motivo, ou fica "Em inspeção" para reparo', () => {
    const marcas = itensTubular.map((_, i) => i !== 1);
    const r = registroDoForm(itensTubular, { ...formInspecao(itensTubular, 'Giuliano Breda'), marcas });
    expect(r).toMatchObject({ resultado: 'reprovado', proxima: null });
    const descartado = aplicarInspecao(tubular, r, 'descartado', 'Capa cortada');
    expect(descartado).toMatchObject({ situacao: 'descartado', motivoDescarte: 'Capa cortada' });
    expect(descartado.historico[0].descricao).toBe('Descartado: Capa cortada');
    expect(descartado.historico[1].descricao).toMatch(/reprovada \(não conforme: Capa sem cortes/);
    const reparo = aplicarInspecao(tubular, r, 'inspecao');
    expect(reparo).toMatchObject({ situacao: 'inspecao', motivoDescarte: '' });
    expect(reparo.historico[0].descricao).toMatch(/Enviado para reparo/);
  });
});
