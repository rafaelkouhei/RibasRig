// Abre o plano conforme a rota: novo, editar, duplicar ou nova revisão. Sem React.
import { ErroApi, api } from '../../services/api';
import { dadosVazios, formDoPlano, lerRascunho, proximaRevisao, type Etapa, type FormPlano } from '../../domain/plano';
import type { Configuracoes, DadosPlano, PlanoRigging } from '../../domain/types';

export type Modo = 'novo' | 'editar' | 'duplicar' | 'revisao';

export function modoDaRota(pathname: string): Modo {
  if (pathname.endsWith('/duplicar')) return 'duplicar';
  if (pathname.endsWith('/revisao')) return 'revisao';
  if (pathname.endsWith('/editar')) return 'editar';
  return 'novo';
}

export interface PlanoAberto {
  /** null = ainda não existe na api (número gerado no primeiro salvamento) */
  plano: PlanoRigging | null;
  /** Dados de base para planoDoForm (campos que o formulário não tem) */
  base: DadosPlano;
  form: FormPlano;
  etapa: Etapa;
  /** true = há mudanças a salvar já na abertura (cópia, rascunho recuperado) */
  sujo: boolean;
  aviso: string | null;
}

export type ResultadoAbertura = PlanoAberto | { redirecionar: string };

export const etapaValida = (n: number): Etapa => (Math.min(6, Math.max(1, Math.round(n) || 1)) as Etapa);

/** Só os dados editáveis (sem id, número, revisões, datas de criação). */
export function dadosDe(p: PlanoRigging): DadosPlano {
  const { id, numero, situacaoDocumento, revisoes, criadoEm, criadoPor, atualizadoEm, ...dados } = p;
  return structuredClone(dados);
}

/** Plano em branco: vento padrão das Configurações e o responsável técnico como rigger/supervisor. */
export function dadosNovos(config: Configuracoes): DadosPlano {
  return { ...dadosVazios(config.ventoPadraoMs), rigger: `${config.responsavel.nomeAssinatura} — ${config.responsavel.rpp}` };
}

export interface Preenchimento { form: Partial<FormPlano>; aviso: string }

/** Dados enviados por outra tela ao abrir um plano novo: Consulta rápida ("Criar plano com ele") ou Clientes ("Novo plano para este cliente"). */
export function preenchimentoDaRota(state: unknown): Preenchimento | undefined {
  const s = (state ?? {}) as { clienteId?: number; guindasteId?: number; tabelaId?: string | null; raioM?: number; pesoKg?: number };
  const texto = (n: number) => String(n).replace('.', ',');
  if (typeof s.guindasteId === 'number') {
    return {
      form: { guindasteId: s.guindasteId, tabelaId: s.tabelaId ?? null, ...(s.raioM != null ? { raio: texto(s.raioM) } : {}), ...(s.pesoKg != null ? { peso: texto(s.pesoKg) } : {}) },
      aviso: 'Guindaste, gráfico de carga, raio e peso da carga vieram da Consulta rápida. Confira e complete as outras etapas.',
    };
  }
  if (typeof s.clienteId === 'number') return { form: { clienteId: s.clienteId }, aviso: 'Contratante escolhido a partir do cadastro de clientes.' };
  return undefined;
}

export async function abrirPlano(modo: Modo, numero: string | undefined, config: Configuracoes, recuperar: boolean, preencher?: Preenchimento): Promise<ResultadoAbertura> {
  if (modo === 'novo') {
    const base = dadosNovos(config);
    const local = recuperar ? lerRascunho() : null;
    if (local?.numero) return { redirecionar: `/planos/${local.numero}/editar` };
    if (local) return { plano: null, base, form: local.form, etapa: etapaValida(local.etapa), sujo: true, aviso: 'Rascunho recuperado deste computador: ele ainda não tinha número. O número é gerado agora, no primeiro salvamento.' };
    return { plano: null, base, form: { ...formDoPlano(base), ...preencher?.form }, etapa: 1, sujo: false, aviso: preencher?.aviso ?? null };
  }
  if (!numero) throw new ErroApi(404, 'Plano não informado.');

  if (modo === 'duplicar') {
    const origem = await api.obterPlano(numero);
    const base: DadosPlano = {
      ...dadosDe(origem), art: '', artRegistradaEm: null, anexos: { desenhos: null, artPlano: false, arquivoArt: null },
      etapaAtual: 1, copiaDe: numero, exemplo: false,
    };
    return { plano: null, base, form: formDoPlano(base), etapa: 1, sujo: true,
      aviso: `Cópia do plano ${numero}: o novo número é gerado pelo sistema ao salvar. ART e anexos não são copiados; confira a data da operação.` };
  }

  let p = await api.obterPlano(numero);
  let aviso: string | null = null;
  if (modo === 'revisao') {
    if (p.situacaoDocumento === 'emitido') {
      try { p = await api.novaRevisao(numero); } catch (e) {
        // Outra chamada já abriu a revisão: só recarrega
        if (e instanceof ErroApi && e.status === 409) p = await api.obterPlano(numero); else throw e;
      }
    }
    if (p.revisoes.length) aviso = `Rascunho da Rev. ${proximaRevisao(p)} do plano ${numero}. As revisões emitidas continuam guardadas como foram entregues.`;
  }

  let form = formDoPlano(p);
  let etapa = etapaValida(p.etapaAtual);
  let sujo = false;
  // A cópia local só sobra quando havia alterações não salvas; mesmo minuto do último salvamento conta como mais nova
  const local = lerRascunho();
  if (p.situacaoDocumento === 'rascunho' && local?.numero === p.numero && local.salvoEm >= p.atualizadoEm) {
    form = local.form; etapa = etapaValida(local.etapa); sujo = true;
    aviso = 'Recuperadas alterações deste computador que ainda não tinham sido salvas.';
  }
  return { plano: p, base: p, form, etapa, sujo, aviso };
}
