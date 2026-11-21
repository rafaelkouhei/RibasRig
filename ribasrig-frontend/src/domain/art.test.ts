import { describe, expect, it } from 'vitest';
import { camposArt, enderecoContratante, entradaArtDoPlano, textoArt } from './art';
import { CLIENTES, PLANOS } from '../data/mock';

describe('dados para a ART a partir do plano 2607036 (ART 1720264496217)', () => {
  const kaefer = CLIENTES[0];
  const campos = camposArt(entradaArtDoPlano('2607036', PLANOS[0], kaefer));
  const v = (campo: string) => campos.find((c) => c.campo === campo)?.valor;

  it('separa contratante e local da obra', () => {
    expect(v('Contratante')).toBe('Kaefer Rip Serviços Industriais Ltda.');
    expect(v('CPF / CNPJ')).toBe('07.522.191/0048-64');
    expect(v('Endereço do contratante')).toBe('Rod. Engenheiro Ermênio de Oliveira Penteado, 57 – Helvetia, Indaiatuba/SP – CEP 13337-300');
    expect(v('Endereço da obra')).toBe('Bosch · Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial · Curitiba/PR');
    expect(v('CEP da obra')).toBe('81460-000');
    expect(v('Proprietário')).toBe('Kaefer Rip Serviços Industriais Ltda.');
  });
  it('converte a carga líquida para TON como na ART', () => expect(v('Quantidade')).toBe('3,45 TON'));
  it('monta contrato, datas e observação', () => {
    expect(v('Contrato')).toBe('Sem número · celebrado em 24/07/2026');
    expect(v('Valor do contrato')).toBe('R$ 2.700,00');
    expect(v('Data de início')).toBe('24/07/2026');
    expect(v('Previsão de término')).toBe('24/08/2026');
    expect(v('Observações')).toBe('ART referente ao plano de rigging nº 2607036 para movimentação de chiller na Bosch');
  });
  it('2610001: término ainda não informado fica pendente', () => {
    const c = camposArt(entradaArtDoPlano('2610001', PLANOS[1], kaefer));
    expect(c.filter((x) => x.pendente).map((x) => x.campo)).toEqual(['Previsão de término']);
  });
  it('"Copiar tudo" tem uma linha por campo', () => {
    expect(campos).toHaveLength(14);
    expect(textoArt(campos).split('\n')).toHaveLength(14);
  });
  it('endereço do contratante', () => {
    expect(enderecoContratante({ endereco: 'Rua A, 1', cidade: 'Curitiba', uf: 'pr', cep: '' })).toBe('Rua A, 1, Curitiba/PR');
  });
});
