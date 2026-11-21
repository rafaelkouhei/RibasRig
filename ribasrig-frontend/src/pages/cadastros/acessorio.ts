// Lógica pura da tela de Acessórios de lingada: formulário em texto, validação e situação calculada.
import { HOJE, dataBR, dataIsoValida, diasEntre, fmt, lerNum, numParaTexto } from '../../domain/formatacao';
import { situacaoInspecao } from '../../domain/calculos';
import { validarCampo, type CampoValidado } from '../../domain/validacao';
import type { Acessorio, EventoAcessorio, SituacaoAcessorio, TipoAcessorio } from '../../domain/types';
import type { Tom } from './ui';

export const ROTULO_TIPO: Record<TipoAcessorio, string> = {
  cinta: 'Cinta plana', tubular: 'Cinta tubular', manilha: 'Manilha', laco: 'Laço de cabo de aço', dispositivo: 'Balancim / dispositivo',
};
export type Aba = 'todos' | TipoAcessorio | 'inativos';
export const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' }, { id: 'cinta', rotulo: 'Cintas planas' }, { id: 'tubular', rotulo: 'Cintas tubulares' }, { id: 'manilha', rotulo: 'Manilhas' },
  { id: 'laco', rotulo: 'Laços de cabo' }, { id: 'dispositivo', rotulo: 'Balancins' }, { id: 'inativos', rotulo: 'Inativos' },
];
export const naAba = (a: Acessorio, aba: Aba) => (aba === 'inativos' ? a.situacao === 'inativo' : a.situacao !== 'inativo' && (aba === 'todos' || a.tipo === aba));

/** Unidade da capacidade: manilhas em tf, o resto em t. */
export const unidadeDoTipo = (t: TipoAcessorio): 't' | 'tf' => (t === 'manilha' ? 'tf' : 't');

export interface FormAcessorio {
  tipo: TipoAcessorio; descricao: string; medida: string; norma: string;
  capacidade: string; capacidadeTrabalho: string; peso: string;
  situacao: Exclude<SituacaoAcessorio, 'inativo'>; ultima: string; proxima: string;
  /** Compra, certificado e validade (resposta 25) */
  entrada: string; certificado: string; certificadoArquivo: string; vencimento: string; motivoDescarte: string;
}

export function formDoAcessorio(a: Acessorio | null, tipo: TipoAcessorio = 'cinta'): FormAcessorio {
  if (!a) {
    return {
      tipo, descricao: '', medida: '', norma: '', capacidade: '', capacidadeTrabalho: '', peso: '', situacao: 'uso', ultima: '', proxima: '',
      entrada: '', certificado: '', certificadoArquivo: '', vencimento: '', motivoDescarte: '',
    };
  }
  return {
    tipo: a.tipo, descricao: a.descricao, medida: a.medida, norma: a.norma,
    capacidade: numParaTexto(a.capacidadeT), capacidadeTrabalho: numParaTexto(a.capacidadeTrabalhoT), peso: numParaTexto(a.pesoKg, 2),
    situacao: a.situacao === 'inativo' ? 'uso' : a.situacao, ultima: a.ultimaInspecao ?? '', proxima: a.proximaInspecao ?? '',
    entrada: a.dataEntrada ?? '', certificado: a.certificado, certificadoArquivo: a.certificadoArquivo ?? '', vencimento: a.vencimento ?? '', motivoDescarte: a.motivoDescarte,
  };
}

const vazio: CampoValidado = { valor: NaN, erro: null, lidoComo: null };

export interface ErrosAcessorio {
  descricao: string | null; capacidade: CampoValidado; capacidadeTrabalho: CampoValidado; peso: CampoValidado; datas: string | null;
  entrada: string | null; vencimento: string | null; motivoDescarte: string | null; total: number;
}

/** Valida o formulário. Capacidade é obrigatória exceto para balancim/dispositivo; peso sempre; descartado pede o motivo. */
export function validarAcessorio(f: FormAcessorio, tentou: boolean): ErrosAcessorio {
  const un = unidadeDoTipo(f.tipo);
  const comUnidade = (r: CampoValidado): CampoValidado => ({ ...r, erro: r.erro?.replace(/ t\b/g, ` ${un}`) ?? null, lidoComo: r.lidoComo?.replace(/ t$/, ` ${un}`) ?? null });
  const opcional = (texto: string, obrig: boolean, nome: 'capacidadeAcessorio' | 'pesoAcessorio') => {
    if (!texto.trim()) return obrig && tentou ? { ...vazio, erro: 'Obrigatório.' } : vazio;
    return validarCampo(nome, texto);
  };
  const capacidade = comUnidade(opcional(f.capacidade, f.tipo !== 'dispositivo', 'capacidadeAcessorio'));
  let capacidadeTrabalho = comUnidade(opcional(f.capacidadeTrabalho, false, 'capacidadeAcessorio'));
  if (!capacidadeTrabalho.erro && !capacidade.erro && capacidadeTrabalho.valor > capacidade.valor) {
    capacidadeTrabalho = { ...capacidadeTrabalho, valor: NaN, erro: `Não pode ser maior que a capacidade (${fmt(capacidade.valor, 2)} ${un}).` };
  }
  const peso = opcional(f.peso, true, 'pesoAcessorio');
  const descricao = tentou && !f.descricao.trim() ? 'Informe a descrição.' : null;
  const datas = f.ultima && f.proxima && f.ultima > f.proxima
    ? `A última inspeção (${dataBR(f.ultima)}) não pode ser depois da próxima (${dataBR(f.proxima)}). Confira as datas.` : null;
  const entrada = f.entrada && f.entrada > HOJE ? 'A data de entrada não pode ser depois de hoje.' : null;
  const vencimento = f.vencimento && f.entrada && f.vencimento <= f.entrada ? 'O vencimento precisa ser depois da data de entrada.' : null;
  const motivoDescarte = tentou && f.situacao === 'descartado' && !f.motivoDescarte.trim() ? 'Informe o motivo do descarte.' : null;
  const total = [descricao, capacidade.erro, capacidadeTrabalho.erro, peso.erro, datas, entrada, vencimento, motivoDescarte].filter(Boolean).length;
  return { descricao, capacidade, capacidadeTrabalho, peso, datas, entrada, vencimento, motivoDescarte, total };
}

/**
 * Há quanto tempo o acessório está na empresa, pela data de entrada: "1 ano e 6 meses", "8 meses", "12 dias".
 * null sem data (ou data depois de hoje).
 */
export function tempoDeUso(entrada: string | null | undefined, hoje = HOJE): string | null {
  if (!entrada || !dataIsoValida(entrada) || entrada > hoje) return null;
  const [a1, m1, d1] = entrada.split('-').map(Number);
  const [a2, m2, d2] = hoje.split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  if (meses < 1) {
    const d = diasEntre(entrada, hoje);
    return d === 0 ? 'desde hoje' : `${d} ${d === 1 ? 'dia' : 'dias'}`;
  }
  const anos = Math.floor(meses / 12), m = meses % 12;
  return [anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '', m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : ''].filter(Boolean).join(' e ');
}

export interface Situacao { curto: string; tom: Tom; titulo: string; texto: string }

/** Situação calculada em HOJE (inativo, descartado, em inspeção, vencida, vence em N dias, validade, em dia). */
export function situacaoAcessorio(a: Acessorio): Situacao {
  if (a.situacao === 'inativo') return { curto: 'Inativo', tom: 'neutro', titulo: 'Inativo', texto: 'Não aparece no formulário do plano. O histórico fica guardado.' };
  if (a.situacao === 'descartado') {
    return { curto: 'Descartado', tom: 'neutro', titulo: 'Descartado', texto: `Motivo: ${a.motivoDescarte.trim() || 'não informado'}. Não aparece mais no formulário do plano. O histórico fica guardado.` };
  }
  if (a.situacao === 'inspecao') return { curto: 'Em inspeção', tom: 'alerta', titulo: 'Em inspeção', texto: 'Fica indisponível no formulário até voltar para "Em uso".' };
  const r = situacaoInspecao(a, HOJE);
  const limite = dataBR(r.proxima);
  const emDias = (n: number | null) => (n === 0 ? 'hoje' : `em ${n} ${n === 1 ? 'dia' : 'dias'}`);
  if (r.motivo === 'validade') {
    if (r.situacao === 'vencida') return { curto: 'Validade vencida', tom: 'alertaForte', titulo: `Validade vencida em ${limite}`, texto: 'Bloqueado no formulário do plano. Se o item foi reavaliado, defina um novo vencimento; senão, descarte com o motivo.' };
    return { curto: r.dias === 0 ? 'Validade: hoje' : `Validade: ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`, tom: 'alerta', titulo: `Validade vence ${emDias(r.dias)} (${limite})`, texto: `Aviso também aparece na tela inicial. Pode ser usado em planos com operação até ${limite}.` };
  }
  switch (r.situacao) {
    case 'sem-inspecao': return { curto: 'Sem inspeção', tom: 'alerta', titulo: 'Inspeção não informada', texto: 'Informe a próxima inspeção para o sistema avisar antes do vencimento.' };
    case 'vencida': return { curto: 'Inspeção vencida', tom: 'alertaForte', titulo: `Inspeção vencida em ${limite}`, texto: 'Bloqueado no formulário até registrar uma nova inspeção.' };
    case 'vence-em-breve': {
      const d = emDias(r.dias);
      return { curto: r.dias === 0 ? 'Vence hoje' : `Vence ${d}`, tom: 'alerta', titulo: `Inspeção vence ${d} (${limite})`, texto: `Aviso também aparece na tela inicial. Pode ser usado em planos com operação até ${limite}.` };
    }
    default: return { curto: 'Em dia', tom: 'ok', titulo: 'Inspeção em dia', texto: `Próxima inspeção em ${limite}.${a.vencimento ? ` Validade até ${dataBR(a.vencimento)}.` : ''}` };
  }
}

export const textoUso = (a: Pick<Acessorio, 'planos'>) => {
  const n = a.planos.length;
  return n ? `usado em ${n} ${n === 1 ? 'plano' : 'planos'} (${a.planos.join(', ')})` : 'ainda não usado';
};

const numOuNull = (t: string) => { const n = lerNum(t); return Number.isFinite(n) ? n : null; };
const nomeCurtoDe = (d: string) => { const s = d.split(' · ')[0].trim(); return s.charAt(0).toLowerCase() + s.slice(1); };

/** Monta o Acessorio para salvar e registra no histórico mudanças de situação, inspeção, vencimento e certificado. */
export function acessorioDoForm(f: FormAcessorio, base: Acessorio | null): Acessorio {
  const descricao = f.descricao.trim();
  const certificado = f.certificado.trim();
  const motivo = f.motivoDescarte.trim();
  const novos: EventoAcessorio[] = [];
  if (!base) novos.push({ data: HOJE, descricao: 'Cadastrado no sistema' });
  if (base && f.ultima && f.ultima !== base.ultimaInspecao) novos.push({ data: f.ultima, descricao: `Inspeção registrada${f.proxima ? `: próxima em ${dataBR(f.proxima)}` : ''}` });
  if (base && certificado && certificado !== base.certificado) novos.push({ data: HOJE, descricao: `Certificado nº ${certificado} registrado` });
  if ((f.vencimento || null) !== (base?.vencimento ?? null)) {
    novos.push({ data: HOJE, descricao: f.vencimento ? `Vencimento ${base?.vencimento ? 'alterado' : 'definido'} para ${dataBR(f.vencimento)}` : 'Vencimento removido' });
  }
  const situacao: SituacaoAcessorio = base?.situacao === 'inativo' ? 'inativo' : f.situacao;
  if (base && situacao !== base.situacao) {
    novos.push({ data: HOJE, descricao: { uso: 'Voltou para "Em uso"', inspecao: 'Enviado para inspeção', descartado: `Descartado: ${motivo}` }[f.situacao] });
  }
  return {
    id: base?.id ?? 0,
    tipo: f.tipo, descricao,
    nomeCurto: base && base.descricao === descricao ? base.nomeCurto : nomeCurtoDe(descricao),
    medida: f.medida.trim(), norma: f.norma.trim(),
    capacidadeT: numOuNull(f.capacidade), capacidadeTrabalhoT: numOuNull(f.capacidadeTrabalho), unidadeCapacidade: unidadeDoTipo(f.tipo),
    pesoKg: lerNum(f.peso), situacao,
    ultimaInspecao: f.ultima || null, proximaInspecao: f.proxima || null,
    dataEntrada: f.entrada || null, certificado, certificadoArquivo: f.certificadoArquivo || null, vencimento: f.vencimento || null,
    // O motivo só vale para o descartado; voltar para "Em uso" limpa
    motivoDescarte: situacao === 'descartado' ? motivo : '',
    inspecoes: base?.inspecoes ?? [],
    historico: [...novos.reverse(), ...(base?.historico ?? [])],
    planos: base?.planos ?? [],
  };
}

/** Capacidade para a tabela: "6 t", "5,5 tf"; vazio = "—". */
export const textoCapacidade = (v: number | null, un: string) => (v == null ? '—' : `${numParaTexto(v)} ${un}`);

/** Nome sugerido para o PDF do certificado: "Certificado_Cinta_plana_3_m_6_t.pdf". */
export function nomePdfCertificado(descricao: string): string {
  const base = descricao.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `Certificado_${base || 'acessorio'}.pdf`;
}
