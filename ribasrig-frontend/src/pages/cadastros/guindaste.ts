// Lógica pura da tela de Guindastes: formulário em texto ⇄ Guindaste, validação e curva do gráfico de carga.
import { HOJE, dataBR, fmt, isoDeBR, lerNum, numParaTexto } from '../../domain/formatacao';
import { laudoAtual, situacaoLaudo, type ResultadoLaudo } from '../../domain/calculos';
import { validarCampo, type NomeFaixa } from '../../domain/validacao';
import type { Guindaste, Laudo } from '../../domain/types';
import type { Tom } from './ui';

export interface FormLinha { alcance: string; capacidade: string }
export interface FormTabela { id: string; nome: string; linhas: FormLinha[] }
export interface FormLaudo { inicio: string; fim: string; art: string; arquivo: string; novo: boolean }

export interface FormGuindaste {
  modelo: string; veiculo: string; placa: string; chassi: string;
  ano: string; nominal: string; lanca: string; a: string; b: string; pg: string;
  laudo: FormLaudo;
  tabelas: FormTabela[];
}

export type CampoNum = 'ano' | 'nominal' | 'lanca' | 'a' | 'b' | 'pg';
export const FAIXA_CAMPO: Record<CampoNum, NomeFaixa> = {
  ano: 'anoGuindaste', nominal: 'capacidadeNominal', lanca: 'comprimentoLanca', a: 'distanciaA', b: 'aberturaB', pg: 'pesoGuindaste',
};

/** Guindaste novo, sem dados (base do formulário "+ Novo guindaste"). */
export const GUINDASTE_VAZIO: Guindaste = {
  id: 0, modelo: '', codigo: '', veiculo: '', placa: '', chassi: '', ano: null, capacidadeNominalT: null, comprimentoLancaM: null,
  aM: null, bM: null, pgKgf: null, laudos: [], tabelas: [], dadosPendentes: false, ativo: true,
};

const laudoVazio = (): FormLaudo => ({ inicio: '', fim: '', art: '', arquivo: '', novo: false });

export function formDoGuindaste(g: Guindaste | null): FormGuindaste {
  if (!g) {
    return { modelo: '', veiculo: '', placa: '', chassi: '', ano: '', nominal: '', lanca: '', a: '', b: '', pg: '', laudo: laudoVazio(), tabelas: [] };
  }
  const l = laudoAtual(g);
  return {
    modelo: g.modelo, veiculo: g.veiculo, placa: g.placa, chassi: g.chassi,
    ano: g.ano == null ? '' : String(g.ano),
    nominal: numParaTexto(g.capacidadeNominalT, 1), lanca: numParaTexto(g.comprimentoLancaM, 1),
    a: numParaTexto(g.aM, 2), b: numParaTexto(g.bM, 2), pg: numParaTexto(g.pgKgf),
    laudo: l ? { inicio: l.inicio ? dataBR(l.inicio) : '', fim: l.fim ? dataBR(l.fim) : '', art: l.art, arquivo: l.arquivo ?? '', novo: false } : laudoVazio(),
    tabelas: g.tabelas.map((t) => ({ id: t.id, nome: t.nome, linhas: t.pontos.map((p) => ({ alcance: numParaTexto(p.alcanceM, 2), capacidade: String(p.capacidadeKg).replace('.', ',') })) })),
  };
}

/** Campo numérico opcional: vazio não é erro (MD 55, DM 130 e MD 300L ainda sem dados). */
export function validarOpcional(campo: CampoNum, texto: string) {
  if (!texto.trim()) return { valor: NaN, erro: null, lidoComo: null };
  const r = validarCampo(FAIXA_CAMPO[campo], texto);
  if (campo === 'ano' && r.erro && !/Fora da faixa/.test(r.erro)) return { ...r, erro: 'Ano inválido: use 4 dígitos (ex.: 2013).', lidoComo: null };
  return campo === 'ano' ? { ...r, lidoComo: null } : r;
}

export const erroNome = (modelo: string) => (modelo.trim() ? null : 'Informe o nome / modelo do guindaste.');

// ---------------------------------------------------------------------------------------------
// Laudo
// ---------------------------------------------------------------------------------------------

export interface ErrosLaudo { inicio: string | null; fim: string | null; art: string | null; algum: boolean }

/** `exigir`: há laudo salvo, um novo laudo está sendo registrado ou algum campo foi preenchido. */
export function validarLaudo(l: FormLaudo, temLaudoSalvo: boolean, tentou: boolean): ErrosLaudo {
  const algum = [l.inicio, l.fim, l.art, l.arquivo].some((x) => x.trim() !== '');
  const exigir = algum || l.novo || temLaudoSalvo;
  const ini = isoDeBR(l.inicio), fim = isoDeBR(l.fim);
  let eIni: string | null = null, eFim: string | null = null, eArt: string | null = null;
  if (l.inicio.trim() && !ini) eIni = 'Data inválida. Use dd/mm/aaaa.';
  else if (exigir && !ini && tentou) eIni = 'Informe o início da validade.';
  if (l.fim.trim() && !fim) eFim = 'Data inválida. Use dd/mm/aaaa.';
  else if (exigir && !fim && tentou) eFim = 'Informe o fim da validade.';
  else if (ini && fim && fim <= ini) eFim = 'O fim da validade precisa ser depois do início.';
  const art = l.art.trim();
  if (art && !/^\d{13}$/.test(art)) eArt = `A ART tem 13 dígitos, só números (ex.: 1720261926954).`;
  return { inicio: eIni, fim: eFim, art: eArt, algum };
}

/** Título e texto da situação do laudo, em HOJE (cadastro). */
export function textoLaudo(r: ResultadoLaudo): { tom: Tom; curto: string; titulo: string; texto: string } {
  const fim = dataBR(r.fim);
  switch (r.situacao) {
    case 'vencido':
      return { tom: 'alertaForte', curto: `Laudo vencido em ${fim}`, titulo: `Laudo vencido em ${fim}`, texto: `Não pode ser usado em planos com operação depois de ${fim}. Registre o novo laudo.` };
    case 'vence-em-breve': {
      const t = r.dias === 0 ? `Laudo vence hoje (${fim})` : `Laudo vence em ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`;
      return { tom: 'alerta', curto: t, titulo: t, texto: 'Ainda pode ser usado. Providencie a renovação.' };
    }
    case 'em-dia':
      return { tom: 'ok', curto: 'Laudo em dia', titulo: 'Laudo em dia', texto: `Válido de ${dataBR(r.laudo?.inicio)} a ${fim}.` };
    default:
      return { tom: 'neutro', curto: 'Laudo não cadastrado', titulo: 'Laudo não cadastrado', texto: 'Cadastre a validade e a ART do laudo para o guindaste poder ser usado nos planos.' };
  }
}

export const situacaoNoCadastro = (g: Guindaste | null) => situacaoLaudo(g, HOJE);

// ---------------------------------------------------------------------------------------------
// Gráfico de carga
// ---------------------------------------------------------------------------------------------

export interface LinhaValidada { alcance: number; capacidade: number; erroAlcance: boolean; erroCapacidade: boolean; erro: string; aviso: string; ok: boolean }

/** Valida as linhas de uma configuração: inválido e repetido viram erro na linha; fora de ordem e capacidade crescente, aviso. */
export function validarLinhas(linhas: FormLinha[]): LinhaValidada[] {
  const vistos: number[] = [];
  let maxA = -Infinity, ultCap: number | null = null;
  return linhas.map((l) => {
    const sa = l.alcance.trim(), sc = l.capacidade.trim();
    const a = lerNum(sa), c = lerNum(sc);
    const erros: string[] = [], avisos: string[] = [];
    let ea = false, ec = false;
    if (!sa && !sc) { erros.push('Linha vazia: preencha alcance e capacidade ou remova a linha.'); ea = ec = true; }
    else {
      if (!sa) { erros.push('Informe o alcance.'); ea = true; }
      else if (Number.isNaN(a)) { erros.push(`Alcance inválido: "${sa}". Use vírgula para decimais (ex.: 4,18).`); ea = true; }
      else if (a < 0.5 || a > 30) { erros.push('Alcance fora da faixa (0,50 a 30,00 m).'); ea = true; }
      if (!sc) { erros.push('Informe a capacidade.'); ec = true; }
      else if (Number.isNaN(c)) { erros.push(`Capacidade inválida: "${sc}".`); ec = true; }
      else if (c < 1 || c > 100000) { erros.push('Capacidade fora da faixa (1 a 100.000 kg).'); ec = true; }
    }
    if (!ea) {
      const j = vistos.indexOf(a);
      if (j >= 0) { erros.push(`Alcance repetido: ${fmt(a, 2)} m já está na linha ${j + 1}.`); ea = true; }
    }
    vistos.push(ea ? NaN : a);
    if (!ea && a < maxA) avisos.push('Fora de ordem: o sistema ordena os alcances ao salvar.');
    if (!ea && !ec && ultCap !== null && a > maxA && c > ultCap) avisos.push('Capacidade maior que a da extensão anterior: confira no gráfico do fabricante.');
    if (!ea && sa.includes('.')) avisos.push(`alcance lido como ${fmt(a, 2)} m`);
    if (!ec && sc.includes('.')) avisos.push(`capacidade lida como ${fmt(c, 0)} kg`);
    if (!ea && a > maxA) { maxA = a; if (!ec) ultCap = c; }
    return { alcance: a, capacidade: c, erroAlcance: ea, erroCapacidade: ec, erro: erros.join(' '), aviso: avisos.join(' · '), ok: !ea && !ec };
  });
}

export function rotuloConfiguracao(t: FormTabela): string {
  const n = validarLinhas(t.linhas).filter((v) => v.ok).length;
  return `Gráfico de carga · ${t.nome.trim() || 'configuração sem nome'} (${n} ${n === 1 ? 'extensão' : 'extensões'})`;
}

// ---------------------------------------------------------------------------------------------
// Erros e montagem do Guindaste para salvar
// ---------------------------------------------------------------------------------------------

export function contarErros(f: FormGuindaste, temLaudoSalvo: boolean) {
  const campos = (Object.keys(FAIXA_CAMPO) as CampoNum[]).filter((k) => validarOpcional(k, f[k]).erro).length + (erroNome(f.modelo) ? 1 : 0);
  const el = validarLaudo(f.laudo, temLaudoSalvo, true);
  const laudo = [el.inicio, el.fim, el.art].filter(Boolean).length;
  const tabela = f.tabelas.reduce((n, t) => n + validarLinhas(t.linhas).filter((v) => !v.ok).length, 0);
  return { campos, laudo, tabela, total: campos + laudo + tabela };
}

const numOuNull = (t: string) => { const n = lerNum(t); return Number.isFinite(n) ? n : null; };
const codigoDe = (modelo: string) => modelo.replace(/^Palfinger\s*/i, '').replace(/[^A-Za-z0-9]/g, '') || 'guindaste';

/** Nome do PDF simulado do laudo: "Laudo_MD45007.pdf" (novo laudo ganha o mês do fim: "Laudo_MD45007_2027-04.pdf"). */
export function nomePdfLaudo(modelo: string, l: FormLaudo): string {
  const fim = isoDeBR(l.fim);
  return `Laudo_${codigoDe(modelo)}${l.novo && fim ? `_${fim.slice(0, 7)}` : ''}.pdf`;
}

/** Monta o Guindaste a partir do formulário (só chame sem erros). Novo laudo vai para o fim e o atual passa a anterior. */
export function guindasteDoForm(f: FormGuindaste, base: Guindaste | null): { guindaste: Guindaste; laudoFoiParaHistorico: boolean } {
  const laudoForm: Laudo | null = validarLaudo(f.laudo, false, false).algum
    ? { inicio: isoDeBR(f.laudo.inicio), fim: isoDeBR(f.laudo.fim), art: f.laudo.art.trim(), arquivo: f.laudo.arquivo || null, atual: true }
    : null;
  let laudos = (base?.laudos ?? []).map((l) => ({ ...l }));
  let foiHist = false;
  if (laudoForm) {
    if (f.laudo.novo || !laudos.length) { foiHist = laudos.length > 0; laudos = [...laudos.map((l) => ({ ...l, atual: false })), laudoForm]; }
    else {
      const atual = laudoAtual({ ...(base as Guindaste), laudos });
      laudos = laudos.map((l) => (l === atual ? laudoForm : { ...l, atual: false }));
    }
  }
  const modelo = f.modelo.trim();
  const guindaste: Guindaste = {
    id: base?.id ?? 0,
    modelo,
    codigo: base?.codigo && base.modelo === modelo ? base.codigo : codigoDe(modelo),
    veiculo: f.veiculo.trim(), placa: f.placa.trim().toUpperCase(), chassi: f.chassi.trim().toUpperCase(),
    ano: numOuNull(f.ano), capacidadeNominalT: numOuNull(f.nominal), comprimentoLancaM: numOuNull(f.lanca),
    aM: numOuNull(f.a), bM: numOuNull(f.b), pgKgf: numOuNull(f.pg),
    laudos,
    tabelas: f.tabelas.map((t) => ({
      id: t.id, nome: t.nome.trim(),
      pontos: t.linhas.map((l) => ({ alcanceM: lerNum(l.alcance), capacidadeKg: lerNum(l.capacidade) })).sort((p, q) => p.alcanceM - q.alcanceM),
    })),
    dadosPendentes: base?.dadosPendentes ?? false,
    ativo: base?.ativo ?? true,
  };
  return { guindaste, laudoFoiParaHistorico: foiHist };
}
