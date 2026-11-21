// Tipos do domínio. Espelham os models que o Django REST vai expor (em camelCase no front;
// a conversão para snake_case fica em services/api.ts, num só lugar).

/** Data 'aaaa-mm-dd' */
export type ISODate = string;
/** Data e hora local de Curitiba 'aaaa-mm-ddThh:mm' (ou só 'aaaa-mm-dd' quando a hora não é conhecida) */
export type ISODateTime = string;

/** Quem criou o cadastro: regra/tipo fixo do sistema, exemplo fictício da equipe RibasRig, ou criado pelo usuário. */
export type OrigemCadastro = 'sistema' | 'exemplo' | 'criado';

// =============================================================================================
// Guindastes
// =============================================================================================

/** Um ponto do gráfico de carga do fabricante. Guindaste articulado: alcance máximo de uma extensão e a capacidade dela. */
export interface PontoGrafico { alcanceM: number; capacidadeKg: number }

/** Gráfico (tabela) de capacidade. Um guindaste pode ter vários (ex.: lança principal, com jib). */
export interface TabelaCapacidade {
  id: string;
  /** Ex.: "lança principal". Para mostrar use `nomeGrafico(tabela)` → "Gráfico de carga · lança principal (8 extensões)". */
  nome: string;
  pontos: PontoGrafico[];
}

export interface Laudo {
  inicio: ISODate | null;
  fim: ISODate | null;
  /** Nº da ART do laudo */
  art: string;
  /** Nome do PDF do laudo (ex.: "Laudo_MD45007.pdf"); null = sem arquivo */
  arquivo: string | null;
  /** true no laudo vigente do cadastro (só um por guindaste) */
  atual: boolean;
}

export interface Guindaste {
  id: number;
  /** Nome / modelo, ex.: "Palfinger MD 45.007" */
  modelo: string;
  /** Código curto para nomes de arquivo, ex.: "MD45007" */
  codigo: string;
  veiculo: string;
  placa: string;
  chassi: string;
  ano: number | null;
  capacidadeNominalT: number | null;
  /** Informativo (o desenhado na ficha). O cálculo usa o gráfico de carga, nunca este valor. */
  comprimentoLancaM: number | null;
  /** a: eixo da coluna até a sapata (m) */
  aM: number | null;
  /** b: abertura entre sapatas (m) */
  bM: number | null;
  /** Pg: peso do guindaste + caminhão (kgf) */
  pgKgf: number | null;
  laudos: Laudo[];
  tabelas: TabelaCapacidade[];
  /** true quando a empresa ainda não forneceu os dados (MD 55, DM 130, MD 300L): telas mostram marcadores [XXX] */
  dadosPendentes: boolean;
  ativo: boolean;
}

// =============================================================================================
// Acessórios
// =============================================================================================

export type TipoAcessorio = 'cinta' | 'tubular' | 'manilha' | 'laco' | 'dispositivo';
/** uso = disponível · inspecao = indisponível até voltar · descartado e inativo = não aparecem no formulário (histórico fica). */
export type SituacaoAcessorio = 'uso' | 'inspecao' | 'descartado' | 'inativo';

export interface EventoAcessorio { data: ISODate; descricao: string }

export interface Acessorio {
  id: number;
  tipo: TipoAcessorio;
  /** Ex.: "Cinta plana 3 m · 6 t" */
  descricao: string;
  /** Ex.: "cinta plana 3 m" (usado em mensagens) */
  nomeCurto: string;
  medida: string;
  norma: string;
  /** Capacidade nominal (t ou tf). null = não se aplica (balancim) */
  capacidadeT: number | null;
  /** Capacidade de trabalho usada no cálculo (ex.: cinta 6 t → 4,2 t). null = usa `capacidadeT`. */
  capacidadeTrabalhoT: number | null;
  /** 't' para cintas e laços, 'tf' para manilhas */
  unidadeCapacidade: 't' | 'tf';
  pesoKg: number;
  situacao: SituacaoAcessorio;
  ultimaInspecao: ISODate | null;
  proximaInspecao: ISODate | null;
  /** Data de entrada (compra) na empresa. O tempo de uso é calculado a partir dela. */
  dataEntrada: ISODate | null;
  /** Número do certificado do fabricante ('' = não informado) */
  certificado: string;
  /** Nome do PDF do certificado anexado (null = sem anexo) */
  certificadoArquivo: string | null;
  /**
   * Vencimento (validade) definido pelo engenheiro para este item. Não há regra fixa de troca por usos ou
   * por meses (resposta do Giuliano, 08/10/2026): o sistema avisa 30 dias antes e bloqueia no plano depois.
   */
  vencimento: ISODate | null;
  /** Motivo do descarte. Obrigatório quando a situação é 'descartado'. */
  motivoDescarte: string;
  /** Inspeções feitas pelo padrão do tipo, da mais nova para a mais antiga */
  inspecoes: RegistroInspecao[];
  historico: EventoAcessorio[];
  /** Números dos planos EMITIDOS em que foi usado */
  planos: string[];
}

/**
 * Padrão de inspeção de um tipo de acessório: os itens que o inspetor confere. Cadastrado e editado pelo
 * engenheiro (as NRs mudam, então o padrão não fica fixo no código). Os itens iniciais são sugestão a validar.
 */
export interface PadraoInspecao {
  tipo: TipoAcessorio;
  /** Normas e documentos de referência (texto livre) */
  referencia: string;
  itens: string[];
  atualizadoEm: ISODate | null;
}

export interface ItemInspecao { texto: string; conforme: boolean }

/** Uma inspeção registrada. Guarda a cópia dos itens: mudar o padrão depois não altera o que foi registrado. */
export interface RegistroInspecao {
  data: ISODate;
  responsavel: string;
  resultado: 'aprovado' | 'reprovado';
  itens: ItemInspecao[];
  observacao: string;
  /** Próxima inspeção definida no registro (aprovado) */
  proxima: ISODate | null;
}

/** Onde o item fica na lingada. Tipos sem balancim não têm 'pernasSuperiores'. */
export type PosicaoLingada = 'pernasInferiores' | 'pernasSuperiores' | 'carga' | 'gancho';

export interface ItemLingada { acessorioId: number; quantidade: number; posicao: PosicaoLingada }

// =============================================================================================
// Tipos de içamento e regras de cálculo
// =============================================================================================

/** Campos que o tipo pede na etapa Lingada */
export interface CamposTipoIcamento {
  anguloInferior: boolean;
  anguloSuperior: boolean;
  anguloUnico: boolean;
  pesoBalancim: boolean;
  capacidadeLaco: boolean;
}

export interface TipoIcamento {
  id: string;
  nome: string;
  descricao: string;
  origem: OrigemCadastro;
  balancim: boolean;
  /** Pernas entre a carga e o balancim (com balancim) ou entre a carga e o gancho (sem balancim) */
  pernas: number;
  /** Pernas entre o balancim e o gancho (só com balancim) */
  pernasSuperiores: number;
  campos: CamposTipoIcamento;
  /** Ids das regras de cálculo (RegraCalculo.id) que o tipo usa */
  regras: string[];
  acessoriosSugeridos: string;
  /** Título da geometria na etapa Lingada */
  geometria: string;
  /** Aviso quando falta acessório no cadastro para usar o tipo */
  avisoSemAcessorio: string | null;
  autor: string;
  versao: number;
  /** Planos emitidos que usaram o tipo */
  planos: string[];
}

export type CategoriaRegra = 'Carga' | 'Guindaste' | 'Lingada' | 'Sapatas e terreno';

export interface VariavelRegra {
  simbolo: string;
  nome: string;
  unidade: string;
  /** De onde vem o valor (ver ORIGENS_VARIAVEL e RESULTADOS_REGRA em regras.ts) */
  origem: string;
  /** Valor de teste (plano 2607036), como texto pt-BR. Vazio quando vem de outra regra. */
  teste: string;
}

export interface VersaoRegra {
  versao: number;
  formula: string;
  variaveis: VariavelRegra[];
  salvaEm: ISODateTime;
  autor: string;
}

export interface RegraCalculo {
  id: string;
  nome: string;
  categoria: CategoriaRegra;
  descricao: string;
  /** Fórmula na sintaxe do avaliador (regras.ts): + − * / ^, cos/sen/tg em graus, raiz, min, max, abs; ';' separa argumentos */
  formula: string;
  resultadoNome: string;
  resultadoUnidade: string;
  variaveis: VariavelRegra[];
  /** true = o resultado é comparado com uma capacidade (taxa de utilização, limite de 85%) */
  limite: boolean;
  /** De onde vem a capacidade de comparação (ver ORIGENS_CAPACIDADE) — é uma entrada do plano, nunca um número fixo */
  origemCapacidade: string | null;
  capacidadeTeste: string;
  noResumo: boolean;
  noMemorial: boolean;
  automatica: boolean;
  origem: OrigemCadastro;
  autor: string;
  versao: number;
  /** Versões anteriores e a atual. Planos emitidos guardam a versão usada. */
  versoes: VersaoRegra[];
  planos: string[];
}

// =============================================================================================
// Clientes
// =============================================================================================

/** Onde o guindaste opera. Pode ser outra empresa (a Kaefer contrata, a operação é na Bosch). */
export interface LocalObra {
  nome: string;
  /** Logradouro e bairro, ex.: "Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial" */
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
}

/** Contratante: quem contrata o serviço e assina a ART. */
export interface Cliente {
  id: number;
  razaoSocial: string;
  /** Nome da pasta do cliente nos planos, ex.: "Kaefer Rip" */
  nomePasta: string;
  /** Pode ser vazio (não informado). Aceita CNPJ alfanumérico. */
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  locaisObra: LocalObra[];
  contato: string;
  telefone: string;
  email: string;
  /** Cliente de exemplo (fictício) */
  exemplo: boolean;
}

// =============================================================================================
// Plano de Rigging
// =============================================================================================

/** Situação do DOCUMENTO (gravada). Nunca "finalizado". */
export type SituacaoDocumento = 'rascunho' | 'emitido';
/** Situação de SEGURANÇA (sempre calculada pelo motor, nunca gravada no rascunho). */
export type SituacaoSeguranca = 'ok' | 'atencao' | 'bloqueado';

export interface GuindasteAdicional {
  guindasteId: number;
  tabelaId: string | null;
  raioM: number | null;
  /** % da carga bruta que este guindaste leva (1 a 99) */
  pct: number | null;
}

export interface Dormente { larguraCm: number | null; comprimentoCm: number | null; quantidade: number | null }

export interface AnexosPlano {
  /** PDF dos desenhos de posicionamento (SolidWorks), ex.: "Desenhos_2607036.pdf". null = não anexado. */
  desenhos: string | null;
  /** true quando a ART do plano foi anexada (o nome do PDF está em `arquivoArt`) */
  artPlano: boolean;
  /** Nome do PDF da ART anexada. Precisa ser `ART_<nº da ART>.pdf` para o checklist aceitar. */
  arquivoArt: string | null;
}

export interface ObraPlano {
  /** true = a operação é no endereço do contratante */
  mesmoEnderecoContratante: boolean;
  /** Nome curto do local, ex.: "Bosch" */
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
}

/** Campos que só a ART pede (portal do CREA-PR) */
export interface ContratoArt { numero: string; celebradoEm: ISODate | null; valor: string; termino: ISODate | null }

/**
 * Dados editáveis do plano. Números podem ser null (rascunho incompleto). O formulário trabalha com
 * `FormPlano` (texto) — ver plano.ts: `formDoPlano` e `planoDoForm`.
 */
export interface DadosPlano {
  clienteId: number | null;
  obra: ObraPlano;
  dataOperacao: ISODate | null;
  descricaoOperacao: string;
  rigger: string;
  /** Nº da ART do plano (13 dígitos). '' = ainda não tem. */
  art: string;
  artRegistradaEm: ISODateTime | null;
  contratoArt: ContratoArt;
  carga: { descricao: string; comprimentoM: number | null; larguraM: number | null; alturaM: number | null; pesoKg: number | null };
  tipoIcamentoId: string;
  lingada: ItemLingada[];
  /** Com balancim: pernas inferiores. Sem balancim: ângulo único das pernas. Graus a partir da vertical. */
  anguloInferiorGraus: number | null;
  /** Só com balancim */
  anguloSuperiorGraus: number | null;
  /** Balancim / dispositivos (só tipos com balancim). acessorioId liga ao cadastro para conferir a inspeção. */
  dispositivo: { acessorioId: number | null; descricao: string; quantidade: number | null; pesoUnitarioKg: number | null };
  cargasExtrasKg: number | null;
  guindasteId: number | null;
  /** Gráfico de carga escolhido (TabelaCapacidade.id). null = o primeiro do guindaste. */
  tabelaId: string | null;
  /** Informativo */
  comprimentoLancaM: number | null;
  raioM: number | null;
  guindastesAdicionais: GuindasteAdicional[];
  quadranteInicial: string;
  quadranteFinal: string;
  ventoMaxMs: number | null;
  raioIsolamentoM: number | null;
  dormente: Dormente;
  anexos: AnexosPlano;
  /** Etapa do formulário onde o usuário parou (1 a 6) */
  etapaAtual: number;
  /** Plano criado como cópia de outro (ex.: 2610001 é cópia do 2607036) */
  copiaDe: string | null;
  /** Plano de exemplo (fictício) */
  exemplo: boolean;
}

export interface ResultadoPosicaoRevisao {
  posicao: PosicaoLingada;
  acessorioId: number | null;
  descricao: string;
  anguloGraus: number | null;
  /** Tração (t) ou esforço (tf). null = não consta no documento */
  tracao: number | null;
  unidade: 't' | 'tf';
  capacidade: number | null;
  taxaPct: number | null;
}

export interface ResultadoGuindasteRevisao {
  guindasteId: number;
  modelo: string;
  tabelaNome: string | null;
  raioM: number | null;
  /** % da carga bruta deste guindaste */
  pctCarga: number | null;
  cargaKg: number | null;
  capacidadeKg: number | null;
  taxaPct: number | null;
  laudoFim: ISODate | null;
  laudoArt: string | null;
}

/** Cópia completa dos resultados no momento da emissão. Plano emitido não é recalculado. */
export interface ResultadosRevisao {
  dataOperacao: ISODate | null;
  cargaKg: number | null;
  lingadaKg: number | null;
  dispositivosKg: number | null;
  extrasKg: number | null;
  pbKg: number | null;
  /** [0] = guindaste principal; os demais = adicionais */
  guindastes: ResultadoGuindasteRevisao[];
  /** Atalhos do guindaste principal */
  capacidadeKg: number | null;
  taxaGuindastePct: number | null;
  referenciaConservadoraKg: number | null;
  taxaReferenciaPct: number | null;
  posicoes: ResultadoPosicaoRevisao[];
  sapatas: { momentoKgfm: number | null; forcaKgf: number | null; esforcoKgf: number | null; areaCm2: number | null; rmet: number | null };
  raioIsolamentoM: number | null;
  ventoMaxMs: number | null;
  situacaoSeguranca: SituacaoSeguranca;
  /** Só na revisão vinda do Excel: números exatamente como impressos no documento ("7,95", "47,1"…) */
  comoNoDocumento: Record<string, string> | null;
}

export interface Revisao {
  numero: number;
  emitidaEm: ISODateTime;
  emitidaPor: string;
  /** 'excel' = emitida antes do sistema e cadastrada depois; 'sistema' = calculada e emitida pelo RibasRig */
  origem: 'excel' | 'sistema';
  /** Quando uma revisão do Excel foi cadastrada no sistema */
  cadastradaEm: ISODateTime | null;
  resultados: ResultadosRevisao;
  arquivoPdf: string;
  observacao: string;
}

export interface PlanoRigging extends DadosPlano {
  id: number;
  /** AAMM + 3 dígitos, gerado pelo sistema pela data de criação. Nunca digitado. Revisões mantêm o número. */
  numero: string;
  situacaoDocumento: SituacaoDocumento;
  /** Revisões emitidas, em ordem. Rascunho nunca emitido = []. Rascunho com revisões = nova revisão (Rev. N+1) em edição. */
  revisoes: Revisao[];
  criadoEm: ISODateTime;
  criadoPor: string;
  atualizadoEm: ISODateTime;
}

export type TipoEvento = 'emissao' | 'calculo' | 'anexo' | 'cadastro' | 'edicao';

export interface EventoHistorico {
  id: number;
  planoNumero: string;
  tipo: TipoEvento;
  titulo: string;
  detalhe: string;
  usuario: string;
  quando: ISODateTime;
}

// =============================================================================================
// Usuários e configurações
// =============================================================================================

/** admin inclui tudo do engenheiro; operacao só consulta */
export type Perfil = 'admin' | 'engenheiro' | 'operacao';

/** Sem e-mail: o administrador cria o usuário e define senha provisória. */
export interface Usuario {
  id: number;
  nome: string;
  /** Login, ex.: "giuliano.breda" */
  usuario: string;
  perfil: Perfil;
  ativo: boolean;
  /** Administrador principal (não pode ser desativado nem ter o perfil trocado) */
  principal: boolean;
  /** Precisa trocar a senha provisória no próximo acesso */
  trocarSenha: boolean;
  ultimoAcesso: ISODateTime | null;
  observacao: string;
}

export interface Configuracoes {
  pastaRaiz: string;
  /** Usa {nº} e {rev}, ex.: "Plano_de_Rigging_{nº}_Rev{rev}.pdf" */
  nomeArquivo: string;
  empresa: { razaoSocial: string; cnpj: string; ie: string; endereco: string; cep: string };
  responsavel: {
    nomeCompleto: string;
    /** Como assina, ex.: "Giuliano Breda" */
    nomeAssinatura: string;
    titulo: string;
    crea: string;
    rnp: string;
    rpp: string;
    assinatura: 'digitalizada' | 'govbr';
  };
  /** Limite da taxa de utilização: acima dele o plano é bloqueado (50 a 100; padrão 85). Só o Administrador muda. */
  limitePct: number;
  /** A partir deste % a taxa fica em "Atenção" (de 50 até abaixo do limite; padrão 75) */
  avisoAtencaoPct: number;
  /** Vento máximo sugerido em planos novos (m/s) */
  ventoPadraoMs: number;
  numeracao: { descricao: string };
}
