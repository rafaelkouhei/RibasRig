// Inspeção de acessórios pelo padrão do tipo (resposta do Giuliano à pergunta 25, 08/10/2026).
// Não existe regra fixa de troca (nem por número de usos, nem por meses): as NRs mudam. O engenheiro
// define o vencimento de cada item e mantém um padrão de verificações por tipo de acessório.
import { HOJE, dataBR, dataIsoValida } from './formatacao';
import type { Acessorio, ISODate, PadraoInspecao, RegistroInspecao, TipoAcessorio } from './types';

const A_VALIDAR = 'Itens iniciais levantados pela equipe nas normas, a validar pelo engenheiro responsável.';

/**
 * Padrões iniciais por tipo. Os itens são qualitativos: os limites numéricos (quantos arames rompidos,
 * quanto desgaste no pino etc.) ficam na norma e no manual do fabricante, não no sistema.
 */
export const PADROES_INSPECAO: PadraoInspecao[] = [
  {
    tipo: 'cinta', atualizadoEm: null,
    referencia: `ABNT NBR 15637-1 (cintas planas), Anexo A: inspeção e descarte; manual do fabricante. ${A_VALIDAR}`,
    itens: [
      'Etiqueta presente e legível (capacidade, comprimento, material, fabricante)',
      'Fita sem cortes, rasgos ou furos',
      'Sem desgaste por abrasão nas bordas e na superfície',
      'Sem queimadura, parte derretida ou endurecida (calor ou atrito)',
      'Sem dano por produto químico ou ressecamento pelo sol',
      'Costuras íntegras, sem fios rompidos ou soltos',
      'Olhais sem desgaste, rasgo ou deformação',
      'Sem nós',
    ],
  },
  {
    tipo: 'tubular', atualizadoEm: null,
    referencia: `ABNT NBR 15637-2 (cintas tubulares); manual do fabricante. ${A_VALIDAR}`,
    itens: [
      'Etiqueta presente e legível (capacidade, comprimento, material, fabricante)',
      'Capa sem cortes, furos ou desgaste que deixe os fios internos à mostra',
      'Sem queimadura ou parte derretida',
      'Sem dano por produto químico ou ressecamento pelo sol',
      'Costura de união da capa íntegra',
      'Sem nós, caroços ou partes achatadas (sinal de fio interno rompido)',
    ],
  },
  {
    tipo: 'manilha', atualizadoEm: null,
    referencia: `Manual do fabricante (limites de desgaste e de abertura); ASME B30.26 como referência; NR-11 para o uso. ${A_VALIDAR}`,
    itens: [
      'Carga de trabalho (CMT/WLL) e fabricante gravados e legíveis',
      'Corpo sem trincas, entalhes ou marcas de solda',
      'Corpo sem deformação, torção ou abertura além do limite do fabricante',
      'Pino original da manilha, reto, com rosca sem dano, encaixando e travando por completo',
      'Desgaste do corpo e do pino dentro do limite do fabricante',
      'Sem corrosão que reduza a seção e sem sinais de superaquecimento',
    ],
  },
  {
    tipo: 'laco', atualizadoEm: null,
    referencia: `ABNT NBR 13541-2 (lingas de cabo de aço: utilização e inspeção); ABNT NBR ISO 4309 (inspeção e descarte de cabos de aço); manual do fabricante. ${A_VALIDAR}`,
    itens: [
      'Plaqueta de identificação presente e legível',
      'Arames rompidos dentro do limite da norma',
      'Sem amassamento, dobra permanente, nó ou "gaiola de passarinho"',
      'Sem corrosão severa nem redução de diâmetro além do limite',
      'Olhais e luva prensada sem trinca, deformação ou deslizamento do cabo',
      'Sem sinais de calor, arco elétrico ou respingo de solda',
    ],
  },
  {
    tipo: 'dispositivo', atualizadoEm: null,
    referencia: `Projeto e manual do fabricante do dispositivo. ${A_VALIDAR}`,
    itens: [
      'Identificação e capacidade gravadas e legíveis',
      'Estrutura sem trincas, deformação ou corrosão severa',
      'Soldas íntegras',
      'Olhais, furos e pinos sem desgaste ou ovalização',
    ],
  },
];

export const padraoDoTipo = (padroes: PadraoInspecao[], tipo: TipoAcessorio) => padroes.find((p) => p.tipo === tipo) ?? null;

/** O que acontece com o acessório reprovado: descartado (com motivo) ou fica "Em inspeção" (reparo). */
export type DestinoReprovado = 'descartado' | 'inspecao';

/** Formulário da janela "Registrar inspeção". `marcas[i]` = null enquanto o item não foi conferido. */
export interface FormInspecao {
  data: string;
  responsavel: string;
  marcas: (boolean | null)[];
  observacao: string;
  proxima: string;
  destino: DestinoReprovado;
  motivo: string;
}

export function formInspecao(itens: string[], responsavel: string): FormInspecao {
  return { data: HOJE, responsavel, marcas: itens.map(() => null), observacao: '', proxima: '', destino: 'descartado', motivo: '' };
}

/** Aprovado só com todos os itens conferidos e conformes; um item não conforme reprova. null = ainda falta conferir. */
export function resultadoDasMarcas(marcas: (boolean | null)[]): 'aprovado' | 'reprovado' | null {
  if (marcas.some((m) => m === false)) return 'reprovado';
  if (!marcas.length || marcas.some((m) => m === null)) return null;
  return 'aprovado';
}

/** Motivo sugerido para o descarte: os itens não conformes. */
export function motivoSugerido(itens: string[], marcas: (boolean | null)[]): string {
  const falhas = itens.filter((_, i) => marcas[i] === false);
  return falhas.length ? `Reprovado na inspeção: ${falhas.join('; ')}` : '';
}

export interface ErrosInspecao { data: string | null; marcas: string | null; proxima: string | null; motivo: string | null; total: number }

export function validarInspecao(f: FormInspecao, ultimaInspecao: ISODate | null): ErrosInspecao {
  const resultado = resultadoDasMarcas(f.marcas);
  const data = !f.data || !dataIsoValida(f.data) ? 'Informe a data da inspeção.'
    : f.data > HOJE ? 'A inspeção não pode ter data futura.'
    : ultimaInspecao && f.data < ultimaInspecao ? `Já existe inspeção mais recente (${dataBR(ultimaInspecao)}).` : null;
  const faltam = f.marcas.filter((m) => m === null).length;
  const marcas = !f.marcas.length ? 'O padrão deste tipo não tem itens. Cadastre os itens em "Padrões de inspeção".'
    : resultado === null ? `Falta conferir ${faltam} ${faltam === 1 ? 'item' : 'itens'}.` : null;
  const proxima = resultado !== 'aprovado' ? null
    : !f.proxima || !dataIsoValida(f.proxima) ? 'Informe a próxima inspeção.'
    : f.data && f.proxima <= f.data ? 'A próxima inspeção precisa ser depois desta.' : null;
  const motivo = resultado === 'reprovado' && f.destino === 'descartado' && !f.motivo.trim() ? 'Informe o motivo do descarte.' : null;
  return { data, marcas, proxima, motivo, total: [data, marcas, proxima, motivo].filter(Boolean).length };
}

/** Monta o registro (com a cópia dos itens) a partir do formulário já validado. */
export function registroDoForm(itens: string[], f: FormInspecao): RegistroInspecao {
  const resultado = resultadoDasMarcas(f.marcas) ?? 'reprovado';
  return {
    data: f.data, responsavel: f.responsavel.trim(), resultado,
    itens: itens.map((texto, i) => ({ texto, conforme: f.marcas[i] === true })),
    observacao: f.observacao.trim(), proxima: resultado === 'aprovado' ? f.proxima || null : null,
  };
}

/**
 * Aplica a inspeção no acessório. Aprovado: volta (ou continua) "Em uso", com última e próxima inspeção.
 * Reprovado: descartado com motivo, ou "Em inspeção" para reparo. Tudo entra no histórico.
 */
export function aplicarInspecao(a: Acessorio, r: RegistroInspecao, destino: DestinoReprovado = 'descartado', motivo = ''): Acessorio {
  const n = r.itens.length;
  const falhas = r.itens.filter((i) => !i.conforme).map((i) => i.texto);
  const quem = r.responsavel ? ` por ${r.responsavel}` : '';
  const novo: Acessorio = { ...structuredClone(a), inspecoes: [r, ...a.inspecoes], ultimaInspecao: r.data };
  if (r.resultado === 'aprovado') {
    novo.situacao = 'uso';
    novo.proximaInspecao = r.proxima;
    novo.historico = [{ data: r.data, descricao: `Inspeção pelo padrão${quem}: aprovada (${n} de ${n} itens conformes)${r.proxima ? `; próxima em ${dataBR(r.proxima)}` : ''}` }, ...a.historico];
    return novo;
  }
  const base = `Inspeção pelo padrão${quem}: reprovada (não conforme: ${falhas.join('; ')})`;
  if (destino === 'descartado') {
    novo.situacao = 'descartado';
    novo.motivoDescarte = motivo.trim() || `Reprovado na inspeção: ${falhas.join('; ')}`;
    novo.historico = [{ data: r.data, descricao: `Descartado: ${novo.motivoDescarte}` }, { data: r.data, descricao: base }, ...a.historico];
  } else {
    novo.situacao = 'inspecao';
    novo.historico = [{ data: r.data, descricao: `${base}. Enviado para reparo (fica "Em inspeção")` }, ...a.historico];
  }
  return novo;
}
