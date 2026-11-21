import { describe, expect, it } from 'vitest';
import { GUINDASTES, ACESSORIOS, CLIENTES } from '../../data/mock';
import { contarErros, formDoGuindaste, guindasteDoForm, situacaoNoCadastro, textoLaudo, validarLinhas, validarOpcional } from './guindaste';
import { linhasConsulta, validarConsulta } from './consulta';
import { situacaoAcessorio, validarAcessorio, formDoAcessorio, acessorioDoForm, tempoDeUso } from './acessorio';
import { erroCnpj, clienteDoForm, formDoCliente } from './cliente';

const md45 = structuredClone(GUINDASTES[0]);

describe('Guindastes', () => {
  it('laudo do MD 45.007 vencido em HOJE', () => {
    expect(textoLaudo(situacaoNoCadastro(md45)).curto).toBe('Laudo vencido em 06/10/2026');
    expect(textoLaudo(situacaoNoCadastro(GUINDASTES[1])).curto).toBe('Laudo não cadastrado');
  });
  it('formulário ida e volta sem perder dados', () => {
    const { guindaste } = guindasteDoForm(formDoGuindaste(md45), md45);
    expect(guindaste.tabelas[0].pontos).toEqual(md45.tabelas[0].pontos);
    expect([guindaste.aM, guindaste.bM, guindaste.pgKgf, guindaste.comprimentoLancaM]).toEqual([2.95, 5.7, 11550, 5.1]);
  });
  it('novo laudo move o atual para o histórico', () => {
    const f = formDoGuindaste(md45);
    f.laudo = { inicio: '07/10/2026', fim: '07/04/2027', art: '1720262000001', arquivo: '', novo: true };
    const { guindaste, laudoFoiParaHistorico } = guindasteDoForm(f, md45);
    expect(laudoFoiParaHistorico).toBe(true);
    expect(guindaste.laudos.map((l) => l.atual)).toEqual([false, true]);
    expect(textoLaudo(situacaoNoCadastro(guindaste)).curto).toBe('Laudo em dia');
  });
  it('linha inválida ou repetida vira erro; vazio opcional não', () => {
    const v = validarLinhas([{ alcance: '4,18', capacidade: '10900' }, { alcance: '4,18', capacidade: '7300' }, { alcance: '6', capacidade: 'abc' }]);
    expect(v.map((x) => x.ok)).toEqual([true, false, false]);
    expect(v[1].erro).toContain('Alcance repetido');
    expect(validarOpcional('a', '').erro).toBeNull();
    expect(validarOpcional('a', '20').erro).toContain('Fora da faixa');
    expect(contarErros(formDoGuindaste(null), false).campos).toBe(1); // nome obrigatório
  });
});

describe('Consulta rápida', () => {
  const linha = (peso: number, ling: number, raio: number) => linhasConsulta(GUINDASTES, { pesoKg: peso, lingadaKg: ling, raioM: raio }, 75).find((l) => l.guindaste.id === 1)!;
  it('cenário 3.450 + 296,62 a 5,0 m', () => {
    const l = linha(3450, 296.62, 5);
    expect(l.capacidade).toBe('9,26 t');
    expect(l.referencia).toBe('extensão: 7.300 kg (51,32%)');
    expect(l.status).toBe('Atende');
    expect(l.laudo).toBe('Laudo vencido em 06/10/2026 · não pode ser usado');
    expect(l.podeCriarPlano).toBe(false);
  });
  it('85,00% atende perto do limite; acima não atende; raio fora', () => {
    expect(linha(7871, 0, 5).status).toBe('Atende, perto do limite');
    expect(linha(7872, 0, 5).status).toBe('Não atende: passa de 85%');
    expect(linha(3450, 0, 3).status).toBe('Raio fora do gráfico (4,18 a 17,51 m) · não atende');
  });
  it('sem gráfico e validação', () => {
    expect(linhasConsulta(GUINDASTES, { pesoKg: 1, lingadaKg: 0, raioM: 5 }, 75).find((l) => l.guindaste.id === 2)!.status).toBe('Gráfico de carga não cadastrado');
    const v = validarConsulta({ peso: '3.450', lingada: '', raio: '40' });
    expect(v.peso.lidoComo).toBe('lido como 3.450 kg');
    expect(v.lingada.erro).toContain('pode ser 0');
    expect(v.raio.erro).toContain('Fora da faixa');
  });
});

describe('Acessórios', () => {
  it('situação calculada em HOJE', () => {
    expect(situacaoAcessorio(ACESSORIOS[0]).curto).toBe('Vence em 13 dias');
    expect(situacaoAcessorio(ACESSORIOS[1]).curto).toBe('Em dia');
    expect(situacaoAcessorio(ACESSORIOS[5]).curto).toBe('Descartado');
    expect(situacaoAcessorio({ ...ACESSORIOS[0], proximaInspecao: '2026-10-01' }).curto).toBe('Inspeção vencida');
  });
  it('capacidade de trabalho não passa da capacidade e datas em ordem', () => {
    const f = { ...formDoAcessorio(ACESSORIOS[0]), capacidadeTrabalho: '7,5', ultima: '2026-11-01' };
    const e = validarAcessorio(f, true);
    expect(e.capacidadeTrabalho.erro).toContain('Não pode ser maior');
    expect(e.datas).toContain('não pode ser depois');
  });
  it('salvar acessório inativo mantém inativo', () => {
    const inativo = { ...ACESSORIOS[0], situacao: 'inativo' as const };
    expect(acessorioDoForm(formDoAcessorio(inativo), inativo).situacao).toBe('inativo');
  });
  // Resposta 25 (08/10/2026): compra, certificado, tempo de uso, vencimento e motivo do descarte
  it('tempo de uso pela data de entrada', () => {
    expect(tempoDeUso('2025-03-10', '2026-10-07')).toBe('1 ano e 6 meses');
    expect(tempoDeUso('2024-10-07', '2026-10-07')).toBe('2 anos');
    expect(tempoDeUso('2026-02-07', '2026-10-07')).toBe('8 meses');
    expect(tempoDeUso('2026-09-20', '2026-10-07')).toBe('17 dias');
    expect(tempoDeUso('2026-10-07', '2026-10-07')).toBe('desde hoje');
    expect(tempoDeUso(null)).toBeNull();
    expect(tempoDeUso('2027-01-01', '2026-10-07')).toBeNull();
  });
  it('validade na tela: cinta tubular de exemplo avisa em 23 dias; descartado mostra o motivo', () => {
    const tubular = ACESSORIOS.find((a) => a.id === 7)!;
    expect(situacaoAcessorio(tubular)).toMatchObject({ curto: 'Validade: 23 dias', tom: 'alerta', titulo: 'Validade vence em 23 dias (30/10/2026)' });
    expect(situacaoAcessorio({ ...tubular, vencimento: '2026-10-01' }).curto).toBe('Validade vencida');
    expect(situacaoAcessorio(ACESSORIOS[5]).texto).toMatch(/^Motivo: Costura desgastada\./);
  });
  it('valida entrada, vencimento e motivo do descarte', () => {
    const f = formDoAcessorio(ACESSORIOS[0]);
    expect(validarAcessorio({ ...f, entrada: '2026-12-01' }, true).entrada).toBe('A data de entrada não pode ser depois de hoje.');
    expect(validarAcessorio({ ...f, entrada: '2026-01-01', vencimento: '2025-12-01' }, true).vencimento).toMatch(/depois da data de entrada/);
    expect(validarAcessorio({ ...f, situacao: 'descartado' }, true).motivoDescarte).toBe('Informe o motivo do descarte.');
    expect(validarAcessorio({ ...f, situacao: 'descartado', motivoDescarte: 'Etiqueta ilegível' }, true).total).toBe(0);
  });
  it('salvar registra no histórico vencimento, certificado e descarte com motivo', () => {
    const base = ACESSORIOS[0];
    const a = acessorioDoForm({ ...formDoAcessorio(base), vencimento: '2027-06-30', certificado: 'C-123', entrada: '2025-01-15' }, base);
    expect(a).toMatchObject({ vencimento: '2027-06-30', certificado: 'C-123', dataEntrada: '2025-01-15' });
    expect(a.historico.slice(0, 2).map((h) => h.descricao)).toEqual(['Vencimento definido para 30/06/2027', 'Certificado nº C-123 registrado']);
    const d = acessorioDoForm({ ...formDoAcessorio(base), situacao: 'descartado', motivoDescarte: 'Costura rompida' }, base);
    expect(d).toMatchObject({ situacao: 'descartado', motivoDescarte: 'Costura rompida' });
    expect(d.historico[0].descricao).toBe('Descartado: Costura rompida');
    // voltar para "Em uso" limpa o motivo
    expect(acessorioDoForm({ ...formDoAcessorio(d), situacao: 'uso' }, d).motivoDescarte).toBe('');
  });
});

describe('Clientes', () => {
  it('CNPJ numérico, alfanumérico ou não informado', () => {
    expect(erroCnpj('07.522.191/0048-64')).toBeNull();
    expect(erroCnpj('12.ABC.345/01DE-35')).toBeNull();
    expect(erroCnpj('')).toBeNull();
    expect(erroCnpj('07.522.191/0048-65')).toContain('dígitos verificadores');
  });
  it('salva CNPJ formatado e locais com cidade/UF/CEP', () => {
    const c = clienteDoForm({ ...formDoCliente(CLIENTES[0]), cnpj: '07522191004864' }, CLIENTES[0]);
    expect(c.cnpj).toBe('07.522.191/0048-64');
    expect(c.locaisObra[0]).toEqual(CLIENTES[0].locaisObra[0]);
  });
});
