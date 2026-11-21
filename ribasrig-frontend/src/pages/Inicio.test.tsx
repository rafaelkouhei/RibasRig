import { describe, expect, it } from 'vitest';
import { PLANOS, GUINDASTES, ACESSORIOS, CLIENTES, TIPOS, CONFIGURACOES } from '../data/mock';
import { formVazio, revisaoAtual, textoSituacao, type RascunhoLocal } from '../domain/plano';
import { fmt } from '../domain/formatacao';
import { motivoDeIncompleto, barrasDaRevisao, filtrarLinhas, historicoRevisoes, itensAtencao, linhaDoPlano, motivoCurto, naAba, rascunhoPendente, rotuloMes, semAcento, ultimoEmitido, type Painel } from './Inicio';
import { preenchimentoDaRota } from './NovoPlano/carregar';
import { itemAtivo } from '../components/AppLayout';
import { dadosDoLote, validarLote, type FormLote } from './Lote';

const painel: Painel = { planos: structuredClone(PLANOS), clientes: CLIENTES, guindastes: GUINDASTES, acessorios: ACESSORIOS, tipos: TIPOS, configuracoes: CONFIGURACOES };
const linhas = painel.planos.map((p) => linhaDoPlano(p, painel));
const linha = (n: string) => linhas.find((l) => l.numero === n)!;

describe('Início · recuperação do rascunho local', () => {
  const copia = (numero: string | null, salvoEm: string): RascunhoLocal => ({ numero, form: formVazio(), etapa: 4, salvoEm });
  const atualizado = painel.planos.find((p) => p.numero === '2610001')!.atualizadoEm;
  it('sem número: sempre oferece', () => {
    expect(rascunhoPendente(copia(null, '2026-10-07T08:00'), painel.planos)).toBe(true);
  });
  it('com número: só se a cópia for do mesmo minuto ou mais nova que o salvo na api', () => {
    expect(rascunhoPendente(copia('2610001', atualizado), painel.planos)).toBe(true);
    expect(rascunhoPendente(copia('2610001', '2000-01-01T00:00'), painel.planos)).toBe(false);
  });
  it('plano emitido ou inexistente: a cópia não vale', () => {
    expect(rascunhoPendente(copia('2607036', '2099-01-01T00:00'), painel.planos)).toBe(false);
    expect(rascunhoPendente(copia('9999999', '2099-01-01T00:00'), painel.planos)).toBe(false);
  });
});

describe('Novo plano · dados vindos de outra tela', () => {
  it('Consulta rápida: guindaste, gráfico, raio e peso (vírgula decimal)', () => {
    expect(preenchimentoDaRota({ guindasteId: 1, tabelaId: 't1', raioM: 5.26, pesoKg: 3450 })?.form)
      .toEqual({ guindasteId: 1, tabelaId: 't1', raio: '5,26', peso: '3450' });
  });
  it('Clientes: só o contratante', () => {
    expect(preenchimentoDaRota({ clienteId: 1 })?.form).toEqual({ clienteId: 1 });
  });
  it('sem nada: não preenche', () => {
    expect(preenchimentoDaRota(null)).toBeUndefined();
    expect(preenchimentoDaRota({ focarBusca: true })).toBeUndefined();
  });
});

describe('Situação de segurança · texto usa o aviso das Configurações', () => {
  it('padrão 75%, ou o valor configurado', () => {
    expect(textoSituacao({ situacaoSeguranca: 'atencao', motivosBloqueio: [] }).titulo).toBe('Atenção · entre 75% e 85%');
    expect(textoSituacao({ situacaoSeguranca: 'atencao', motivosBloqueio: [] }, 70).titulo).toBe('Atenção · entre 70% e 85%');
    expect(textoSituacao({ situacaoSeguranca: 'ok', motivosBloqueio: [] }, 70).texto).toBe('Guindaste e acessórios abaixo de 70%.');
  });
});

describe('Início · linhas dos planos', () => {
  it('2610001: rascunho bloqueado por laudo → Continuar na edição', () => {
    const l = linha('2610001');
    expect(l.documento).toBe('Rascunho');
    expect(l.bloqueado).toBe(true);
    expect(motivoCurto(l.motivos[0])).toBe('laudo vencido');
    expect(l.acao).toEqual({ tipo: 'continuar', rotulo: 'Continuar', para: '/planos/2610001/editar' });
    expect(l.data).toBe('07/10/2026');
    expect(l.dataTipo).toBe('criado');
  });
  it('2610002: exemplo bloqueado > 85% → Revisar cálculo', () => {
    const l = linha('2610002');
    expect(l.exemplo).toBe(true);
    expect(motivoCurto(l.motivos[0])).toBe('taxa > 85%');
    expect(l.acao).toEqual({ tipo: 'revisar', rotulo: 'Revisar cálculo', para: '/planos/2610002/editar' });
  });
  it('2607036: Emitido · Rev. 2 → Abrir', () => {
    const l = linha('2607036');
    expect(l.documento).toBe('Emitido · Rev. 2');
    expect(l.bloqueado).toBe(false);
    expect(l.acao.para).toBe('/planos/2607036');
    expect(l.carga).toBe('Chiller · 3.450 kg');
    expect(l.data).toBe('24/07/2026');
  });
  it('abas contam por situação', () => {
    expect(linhas.filter((l) => naAba(l, 'rascunho'))).toHaveLength(2);
    expect(linhas.filter((l) => naAba(l, 'bloqueado'))).toHaveLength(2);
    expect(linhas.filter((l) => naAba(l, 'emitido'))).toHaveLength(1);
  });
});

describe('Início · busca e período', () => {
  it('busca por número, razão social com e sem acento e "Volvo"', () => {
    expect(filtrarLinhas(linhas, '2607036', 'todos').map((l) => l.numero)).toEqual(['2607036']);
    expect(filtrarLinhas(linhas, 'Kaefer Rip Serviços Industriais Ltda.', 'todos')).toHaveLength(2);
    expect(filtrarLinhas(linhas, 'servicos industriais', 'todos')).toHaveLength(2);
    expect(filtrarLinhas(linhas, 'Volvo', 'todos').map((l) => l.numero)).toEqual(['2610002']);
    expect(semAcento('Serviços')).toBe('servicos');
  });
  it('período pela data de criação', () => {
    expect(filtrarLinhas(linhas, '', '2026-10').map((l) => l.numero).sort()).toEqual(['2610001', '2610002']);
    expect(filtrarLinhas(linhas, '', '2026-07').map((l) => l.numero)).toEqual(['2607036']);
    expect(rotuloMes('2026-10')).toBe('Outubro de 2026');
  });
});

describe('Início · atenção e último plano', () => {
  it('laudo vencido, 2 bloqueados com motivo do cálculo, inspeção da cinta e validade da tubular', () => {
    const itens = itensAtencao(painel, linhas);
    expect(itens.map((i) => i.tipo)).toEqual(['laudo', 'plano', 'plano', 'inspecao', 'inspecao']);
    expect(itens[0].texto).toBe('venceu em 06/10/2026');
    expect(itens[1].texto).toBe('laudo vencido na data da operação (15/10/2026)');
    expect(itens[2].texto).toBe('taxa acima de 85% (exemplo)');
    expect(itens[3].titulo + ' ' + itens[3].texto).toBe('Cinta plana 3 m · inspeção vence em 20/10/2026');
    // Vencimento (validade) do item, resposta 25: avisa 30 dias antes
    expect(itens[4].titulo + ' ' + itens[4].texto).toBe('Cinta tubular 3 m (exemplo) · validade vence em 30/10/2026');
  });
  it('último emitido: 2607036 Rev. 2 com os valores da revisão', () => {
    const u = ultimoEmitido(painel.planos)!;
    expect(u.numero).toBe('2607036');
    const r = revisaoAtual(u)!.resultados;
    expect(fmt(r.pbKg!)).toBe('3.746,62');
    expect(fmt(r.capacidadeKg! / 1000)).toBe('9,26');
    expect(fmt(r.sapatas.rmet!)).toBe('3,18');
    expect(barrasDaRevisao(r).map((b) => fmt(b.taxa))).toEqual(['40,46', '58,36', '68,09']);
    expect(historicoRevisoes(u.revisoes)).toBe('Rev. 1 emitida no Excel, antes do sistema. Rev. 2 recalculada pelo sistema.');
  });
});

describe('Início · rascunhos incompletos (lote)', () => {
  it('ficam num item só na atenção e aparecem como "dados incompletos" na linha', () => {
    const f: FormLote = { dataOperacao: '2026-10-20', descricao: '', clienteId: 1, local: '0', obraNome: 'Bosch', obraEndereco: 'Av. X', obraCidade: 'Curitiba', obraUf: 'PR', obraCep: '',
      carga: 'Injetora', peso: '3.200', comprimento: '', largura: '', altura: '', quantidade: '2' };
    const dados = dadosDoLote(f, validarLote(f), 7);
    const extras = ['2610003', '2610004'].map((numero, i) => ({ ...dados, id: 10 + i, numero, situacaoDocumento: 'rascunho' as const, revisoes: [], criadoEm: '2026-10-07T15:00', criadoPor: 'Giuliano Breda', atualizadoEm: '2026-10-07T15:00' }));
    const p2: Painel = { ...painel, planos: [...painel.planos, ...extras] };
    const ls = p2.planos.map((p) => linhaDoPlano(p, p2));
    const l = ls.find((x) => x.numero === '2610003')!;
    expect(l.bloqueado).toBe(true);
    expect(l.motivos.every(motivoDeIncompleto)).toBe(true);
    expect(motivoCurto(l.motivos[0])).toBe('dados incompletos');
    const itens = itensAtencao(p2, ls);
    expect(itens.map((i) => i.tipo)).toEqual(['laudo', 'plano', 'plano', 'inspecao', 'inspecao', 'incompletos']);
    expect(itens[5].titulo).toBe('2 rascunhos');
  });
});

describe('Menu · item ativo', () => {
  it.each([
    ['/', '/'], ['/planos/2607036', '/'], ['/planos/2607036/pdf', '/'], ['/planos/novo', '/planos/novo'], ['/planos/lote', '/planos/novo'],
    ['/planos/2610001/editar', '/planos/novo'], ['/planos/2607036/duplicar', '/planos/novo'], ['/planos/2607036/revisao', '/planos/novo'],
    ['/calculos/tipos', '/calculos/regras'], ['/guindastes', '/guindastes'],
  ])('%s → %s', (rota, item) => expect(itemAtivo(rota)).toBe(item));
});
