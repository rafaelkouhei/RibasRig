import type { TipoIcamento } from '../../domain/types';

/** Desenhos (paths) do esquema: gancho em (140, 29), carga entre x 70..210, y 150..185. */
export function caminhosEsquema(t: Pick<TipoIcamento, 'balancim' | 'pernas' | 'pernasSuperiores'>) {
  const n = t.pernas || 2;
  const cargaY = 150;
  const xs = (ini: number, larg: number) => Array.from({ length: n }, (_, i) => (n === 1 ? 140 : ini + i * (larg / (n - 1))));
  const pts = n === 2 ? [82, 198] : xs(82, 116);
  let pernas = '';
  let formas = `M70 ${cargaY} H210 V185 H70 Z`;
  if (t.balancim) {
    const barY = 92;
    const [e0, e1] = [56, 224];
    pernas += t.pernasSuperiores === 1 ? `M140 29 L140 ${barY} ` : `M140 29 L${e0 + 14} ${barY} M140 29 L${e1 - 14} ${barY} `;
    const bx = n === 2 ? [76, 204] : xs(66, 148);
    pts.forEach((x, i) => { pernas += `M${bx[i].toFixed(1)} ${barY + 8} L${x.toFixed(1)} ${cargaY} `; });
    formas += ` M${e0} ${barY} H${e1} V${barY + 8} H${e0} Z`;
  } else {
    pts.forEach((x) => { pernas += `M140 29 L${x.toFixed(1)} ${cargaY} `; });
  }
  return { pernas, formas };
}

export function EsquemaLingada({ tipo }: { tipo: Pick<TipoIcamento, 'balancim' | 'pernas' | 'pernasSuperiores'> }) {
  const { pernas, formas } = caminhosEsquema(tipo);
  const descricao = tipo.balancim
    ? `Esquema: gancho, ${tipo.pernasSuperiores} ${tipo.pernasSuperiores === 1 ? 'perna' : 'pernas'} até o balancim e ${tipo.pernas} pernas até a carga`
    : `Esquema: gancho e ${tipo.pernas} pernas direto até a carga, sem balancim`;
  return (
    <svg width="280" height="220" viewBox="0 0 280 220" role="img" aria-label={descricao}
      style={{ background: '#F7F8FA', border: '1px solid #D5DAE3', borderRadius: 3, maxWidth: '100%', height: 'auto' }}>
      <circle cx="140" cy="22" r="7" fill="none" stroke="#34446A" strokeWidth="3" />
      <path d={pernas} fill="none" stroke="#4A6192" strokeWidth="2.5" strokeLinecap="round" />
      <path d={formas} fill="#E6E9F0" stroke="#34446A" strokeWidth="2" />
      <text x="152" y="26" fontFamily="'Exo 2', sans-serif" fontSize="11" fill="#34446A">GANCHO</text>
      <text x="140" y="172" textAnchor="middle" fontFamily="'Exo 2', sans-serif" fontSize="12" fill="#34446A">CARGA</text>
    </svg>
  );
}
