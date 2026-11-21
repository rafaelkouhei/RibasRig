import { describe, expect, it } from 'vitest';
import { api, daApi, ErroApi, paraApi, SENHA_PROVISORIA } from './api';

// Os testes rodam em ordem e compartilham o estado do mock.
describe('api (mock) · planos', () => {
  it('lista e obtém por número (sempre cópia)', async () => {
    const planos = await api.listarPlanos();
    expect(planos.map((p) => p.numero)).toEqual(['2607036', '2610001', '2610002']);
    const p = await api.obterPlano('2610001');
    p.descricaoOperacao = 'mudado fora da api';
    expect((await api.obterPlano('2610001')).descricaoOperacao).not.toBe('mudado fora da api');
    await expect(api.obterPlano('9999999')).rejects.toMatchObject({ status: 404 });
  });

  it('plano emitido recusa alteração', async () => {
    const p = await api.obterPlano('2607036');
    await expect(api.salvarRascunho({ ...p, raioM: 6 })).rejects.toBeInstanceOf(ErroApi);
    await expect(api.salvarRascunho({ ...p, raioM: 6 })).rejects.toMatchObject({ status: 409 });
  });

  it('salvar rascunho mantém id e número', async () => {
    const p = await api.obterPlano('2610001');
    const salvo = await api.salvarRascunho({ ...p, numero: '0000000', etapaAtual: 5 });
    expect(salvo).toMatchObject({ id: p.id, numero: '2610001', etapaAtual: 5, situacaoDocumento: 'rascunho' });
  });

  it('não emite o 2610001 (laudo vencido, sem ART)', async () => {
    await expect(api.emitirPlano('2610001')).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/laudo do Palfinger MD 45.007 vencido em 06\/10\/2026/) });
  });

  it('nova revisão do 2607036 = rascunho da Rev. 3 e emitir cria a Rev. 3 com cópia dos resultados', async () => {
    const r = await api.novaRevisao('2607036');
    expect(r.situacaoDocumento).toBe('rascunho');
    expect(r.revisoes).toHaveLength(2);
    const e = await api.emitirPlano('2607036', 'Teste de emissão');
    expect(e.situacaoDocumento).toBe('emitido');
    expect(e.revisoes.map((x) => x.numero)).toEqual([1, 2, 3]);
    const rev3 = e.revisoes[2];
    expect(rev3).toMatchObject({ origem: 'sistema', arquivoPdf: 'Plano_de_Rigging_2607036_Rev3.pdf', observacao: 'Teste de emissão' });
    expect(rev3.resultados.pbKg).toBeCloseTo(3746.62, 10);
    expect(rev3.resultados.taxaGuindastePct).toBeCloseTo(40.46, 2);
    expect(rev3.resultados.sapatas.esforcoKgf).toBeCloseTo(7940.68, 2);
    const hist = await api.historicoPlano('2607036');
    expect(hist[0].titulo).toBe('Emitiu a Rev. 3');
  });

  it('criar plano gera o número (2610003) e lote continua a sequência', async () => {
    const base = await api.obterPlano('2610001');
    const novo = await api.criarPlano({ ...base, copiaDe: '2610001' });
    expect(novo.numero).toBe('2610003');
    expect(novo.situacaoDocumento).toBe('rascunho');
    const lote = await api.criarLote(base, 3);
    expect(lote.map((p) => p.numero)).toEqual(['2610004', '2610005', '2610006']);
    await expect(api.criarLote(base, 0)).rejects.toMatchObject({ status: 400 });
  });
});

describe('api (mock) · cadastros e acesso', () => {
  it('login: perfil vem do usuário; usuário inexistente falha', async () => {
    const { usuario, token } = await api.login('rigger.campo', 'qualquer');
    expect(usuario.perfil).toBe('operacao');
    expect(token).toMatch(/token/);
    await expect(api.login('ninguem', 'x')).rejects.toMatchObject({ status: 401 });
    await api.login('giuliano.breda', 'x');
  });
  it('criar usuário com senha provisória fixa e gerar nova', async () => {
    const r = await api.criarUsuario({ nome: 'Operador Teste', usuario: 'operador.teste', perfil: 'operacao' });
    expect(r.senhaProvisoria).toBe(SENHA_PROVISORIA);
    expect(r.usuario).toMatchObject({ usuario: 'operador.teste', trocarSenha: true });
    expect((await api.gerarSenhaProvisoria(r.usuario.id)).senhaProvisoria).toBe('Ribas-4821');
    await expect(api.criarUsuario({ nome: 'X', usuario: 'operador.teste', perfil: 'operacao' })).rejects.toMatchObject({ status: 409 });
  });
  it('desativar acessório não apaga', async () => {
    const a = await api.desativarAcessorio(6);
    expect(a.situacao).toBe('inativo');
    expect((await api.listarAcessorios()).some((x) => x.id === 6)).toBe(true);
  });
  it('acessório descartado precisa de motivo; inspeção pelo padrão aprova, reprova e recusa inativo', async () => {
    const lista = await api.listarAcessorios();
    const tubular = lista.find((x) => x.id === 7)!;
    await expect(api.salvarAcessorio({ ...tubular, situacao: 'descartado', motivoDescarte: ' ' })).rejects.toMatchObject({ status: 400 });
    const itens = [{ texto: 'Etiqueta legível', conforme: true }];
    const aprovado = await api.registrarInspecao(7, { data: '2026-10-07', responsavel: 'Giuliano Breda', resultado: 'aprovado', itens, observacao: '', proxima: '2027-04-07' }, 'descartado', '');
    expect(aprovado).toMatchObject({ situacao: 'uso', ultimaInspecao: '2026-10-07', proximaInspecao: '2027-04-07' });
    expect(aprovado.inspecoes).toHaveLength(2);
    await expect(api.registrarInspecao(7, { data: '2026-10-07', responsavel: '', resultado: 'aprovado', itens, observacao: '', proxima: null }, 'descartado', '')).rejects.toMatchObject({ status: 400 });
    const reparo = await api.registrarInspecao(7, { data: '2026-10-07', responsavel: '', resultado: 'reprovado', itens: [{ texto: 'Etiqueta legível', conforme: false }], observacao: '', proxima: null }, 'inspecao', '');
    expect(reparo.situacao).toBe('inspecao');
    // o 6 foi desativado no teste anterior
    await expect(api.registrarInspecao(6, { data: '2026-10-07', responsavel: '', resultado: 'aprovado', itens, observacao: '', proxima: '2027-01-01' }, 'descartado', '')).rejects.toMatchObject({ status: 409 });
  });
  it('padrão de inspeção: um por tipo, salvar exige item e marca a data', async () => {
    const padroes = await api.listarPadroesInspecao();
    expect(padroes.map((p) => p.tipo)).toEqual(['cinta', 'tubular', 'manilha', 'laco', 'dispositivo']);
    await expect(api.salvarPadraoInspecao({ ...padroes[2], itens: ['  '] })).rejects.toMatchObject({ status: 400 });
    const salvo = await api.salvarPadraoInspecao({ ...padroes[2], itens: [...padroes[2].itens, ' Trava do pino presente '] });
    expect(salvo.itens.at(-1)).toBe('Trava do pino presente');
    expect(salvo.atualizadoEm).toBe('2026-10-07');
    expect((await api.listarPadroesInspecao())[2].itens).toHaveLength(padroes[2].itens.length + 1);
  });
  it('salvar guindaste ordena o gráfico e mantém um laudo atual', async () => {
    const [md] = await api.listarGuindastes();
    md.tabelas[0].pontos.reverse();
    md.laudos.push({ inicio: '2026-10-07', fim: '2027-04-07', art: '1720269999999', arquivo: 'Laudo_MD45007_renovado.pdf', atual: false });
    const salvo = await api.salvarGuindaste({ ...md, laudos: md.laudos.map((l) => ({ ...l, atual: false })) });
    expect(salvo.tabelas[0].pontos[0].alcanceM).toBe(4.18);
    expect(salvo.laudos.filter((l) => l.atual)).toHaveLength(1);
    expect(salvo.laudos[1].atual).toBe(true);
  });
  it('configurações exigem {nº} e {rev}', async () => {
    const c = await api.obterConfiguracoes();
    await expect(api.salvarConfiguracoes({ ...c, nomeArquivo: 'Plano_{nº}.pdf' })).rejects.toMatchObject({ status: 400 });
  });
  it('conversão camelCase ⇄ snake_case num só lugar', () => {
    expect(paraApi({ situacaoDocumento: 'emitido', revisoes: [{ emitidaEm: 'x' }] })).toEqual({ situacao_documento: 'emitido', revisoes: [{ emitida_em: 'x' }] });
    expect(daApi({ capacidade_trabalho_t: 4.2, laudos: [{ arquivo: null }] })).toEqual({ capacidadeTrabalhoT: 4.2, laudos: [{ arquivo: null }] });
  });
});
