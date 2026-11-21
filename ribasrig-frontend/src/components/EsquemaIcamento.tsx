import ilustracao from '../assets/ilustracoes/icamento.svg';
import logo from '../assets/logo-ribas-branca.png';

/**
 * Esquema do içamento: ilustração própria (assets/ilustracoes/icamento.svg) com as medidas do plano por cima.
 * Desenho ilustrativo: só os textos vêm do plano. `angulo` é opcional (só mostre se o plano tiver o valor).
 * As coordenadas são as da ilustração (2048 × 1509); o viewBox recorta a cena com espaço embaixo para a cota do raio.
 */
const PE_LANCA = { x: 602, y: 948 };
const LINHA_CABO = 1336;
const COTA_Y = 1268;
const TEXTO = { fontSize: 62, fontFamily: "'Exo 2', sans-serif", fontWeight: 600 } as const;

export function EsquemaIcamento({ lanca, raio, angulo, largura = 270 }: { lanca: string; raio: string; angulo?: string; largura?: number | string }) {
  const descricao = `Esquema do içamento: lança de ${lanca}${angulo ? ` a ${angulo}` : ''}, raio de operação de ${raio}`;
  return (
    <svg width={largura} viewBox="245 190 1485 1180" fill="none" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={descricao} style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
      <rect x="245" y="190" width="1485" height="1180" rx="16" fill="#F4F7FA" />
      <image href={ilustracao} x="0" y="0" width="2048" height="1509" />
      {/* "R" da Ribas pintado no contrapeso (caixa escura atrás da cabine, 515–645 × 962–1052), como nos guindastes da empresa */}
      <image href={logo} x="534" y="979" width="92" height="60" />
      {angulo && <path d={`M${PE_LANCA.x} ${PE_LANCA.y - 40}v-260`} stroke="#8A97A8" strokeWidth="6" strokeDasharray="18 18" />}
      {angulo && <text x={PE_LANCA.x + 30} y={PE_LANCA.y - 170} fill="#3C4A5E" {...TEXTO}>{angulo}</text>}
      <text x="770" y="690" fill="#4A6192" textAnchor="middle" transform="rotate(-44 770 690)" {...TEXTO}>{lanca}</text>
      <path d={`M${PE_LANCA.x} ${COTA_Y}H${LINHA_CABO}M${PE_LANCA.x} ${COTA_Y - 26}v52M${LINHA_CABO} ${COTA_Y - 26}v52`} stroke="#34446A" strokeWidth="6" />
      <text x={(PE_LANCA.x + LINHA_CABO) / 2} y={COTA_Y + 82} fill="#34446A" textAnchor="middle" {...TEXTO}>{raio}</text>
    </svg>
  );
}
