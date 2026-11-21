import { useId, useRef, useState, type MouseEvent } from 'react';
import { Box, Typography } from '@mui/material';
import { fmt } from '../domain/formatacao';

/**
 * Gráfico de carga (capacidade × alcance) usado no cadastro de guindastes e na etapa Guindaste do plano.
 * Uma série só (sem legenda: o título da seção diz o que é), linha de 2 px com área suave, pontos com anel
 * da cor do fundo, grade discreta com marcas em números redondos e dica ao passar o mouse em cada extensão.
 * `destaque`: o ponto do raio de operação do plano (capacidade interpolada), com guias até os eixos.
 */
export interface PontoCurva { alcanceM: number; capacidadeKg: number }

const COR = {
  linha: '#34446A', destaque: '#4A6192', grade: '#E4E8EE', base: '#B9C2D2', guia: '#8F9AB0',
  marca: '#566075', titulo: '#3A465E', tinta: '#1F2A40', superficie: '#FFFFFF', borda: '#D5DAE3',
};
const FONTE = "'Exo 2', sans-serif";

/** Passo "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) para dividir `amplitude` em mais ou menos `alvo` partes. */
export function passoRedondo(amplitude: number, alvo: number): number {
  if (!(amplitude > 0) || !(alvo > 0)) return 1;
  const bruto = amplitude / alvo;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const m = bruto / ordem;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * ordem;
}

/** Marcas de `ini` a `fim` (inclusive) de `passo` em `passo`, sem resíduo de ponto flutuante. */
export function marcas(ini: number, fim: number, passo: number): number[] {
  const n = Math.max(0, Math.round((fim - ini) / passo));
  return Array.from({ length: n + 1 }, (_, i) => +(ini + i * passo).toFixed(6));
}

/** Eixos pelos dados: alcance arredondado para fora no passo do eixo; capacidade (t) de 0 até a marca acima do maior valor. */
export function eixosDoGrafico(pontos: PontoCurva[]) {
  const xs = pontos.map((p) => p.alcanceM);
  const ts = pontos.map((p) => p.capacidadeKg / 1000);
  const xMin = Math.min(...xs), xMax = Math.max(...xs), tMax = Math.max(...ts);
  const passoX = passoRedondo(xMax - xMin || 1, 7);
  const x0 = Math.floor(xMin / passoX) * passoX;
  const x1 = Math.max(x0 + passoX, Math.ceil(xMax / passoX) * passoX);
  const passoY = passoRedondo(tMax || 1, 6);
  const y1 = Math.max(passoY, Math.ceil(tMax / passoY) * passoY);
  return { x0, x1, y1, marcasX: marcas(x0, x1, passoX), marcasY: marcas(0, y1, passoY) };
}

const casas = (v: number) => (Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2);

export function GraficoCapacidade({ pontos, destaque, rotulo, largura = 480, altura = 260 }: {
  pontos: PontoCurva[]; destaque?: PontoCurva | null; rotulo: string; largura?: number; altura?: number;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [ativo, setAtivo] = useState<number | null>(null);

  const validos = pontos.filter((p) => Number.isFinite(p.alcanceM) && Number.isFinite(p.capacidadeKg) && p.capacidadeKg >= 0)
    .sort((a, b) => a.alcanceM - b.alcanceM);
  if (!validos.length) {
    return (
      <Box sx={{ width: '100%', maxWidth: largura, aspectRatio: `${largura} / ${altura}`, display: 'grid', placeItems: 'center', bgcolor: COR.superficie, border: `1px solid ${COR.borda}`, borderRadius: '3px' }}>
        <Typography sx={{ fontSize: 13, color: COR.marca }}>Sem pontos válidos para desenhar o gráfico.</Typography>
      </Box>
    );
  }

  const W = largura, H = altura;
  const M = { esq: 52, dir: 18, topo: 16, base: 44 };
  const e = eixosDoGrafico(destaque && Number.isFinite(destaque.alcanceM) ? [...validos, destaque] : validos);
  const X = (m: number) => M.esq + ((m - e.x0) / (e.x1 - e.x0)) * (W - M.esq - M.dir);
  const Y = (t: number) => H - M.base - (t / e.y1) * (H - M.base - M.topo);
  const base = Y(0);
  const pts = validos.map((p) => ({ ...p, x: X(p.alcanceM), y: Y(p.capacidadeKg / 1000) }));
  const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${linha} L${pts[pts.length - 1].x.toFixed(1)} ${base} L${pts[0].x.toFixed(1)} ${base} Z`;
  const fmtT = (t: number) => `${fmt(t, casas(t))} t`;
  const fmtM = (m: number) => `${fmt(m, casas(m))} m`;

  const aoMover = (ev: MouseEvent<SVGRectElement>) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const xv = ((ev.clientX - r.left) / r.width) * W;
    let melhor = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - xv) < Math.abs(pts[melhor].x - xv)) melhor = i; });
    setAtivo(melhor);
  };

  const d = destaque && Number.isFinite(destaque.alcanceM) && Number.isFinite(destaque.capacidadeKg)
    ? { x: X(destaque.alcanceM), y: Y(destaque.capacidadeKg / 1000), texto: `Raio ${fmt(destaque.alcanceM, 2)} m · ${fmt(destaque.capacidadeKg, 0)} kg` } : null;
  const a = ativo !== null ? pts[ativo] : null;

  return (
    <Box component="svg" ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo}
      sx={{ display: 'block', width: '100%', maxWidth: largura, height: 'auto', bgcolor: COR.superficie, border: `1px solid ${COR.borda}`, borderRadius: '3px' }}>
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COR.linha} stopOpacity={0.16} />
          <stop offset="1" stopColor={COR.linha} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grade horizontal discreta e marcas do eixo (números redondos) */}
      {e.marcasY.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.esq} x2={W - M.dir} y1={Y(t)} y2={Y(t)} stroke={t === 0 ? COR.base : COR.grade} strokeWidth={1} />
          <text x={M.esq - 8} y={Y(t) + 4} textAnchor="end" fontFamily={FONTE} fontSize={11} fill={COR.marca}>{fmtT(t)}</text>
        </g>
      ))}
      {e.marcasX.map((m) => (
        <g key={`x${m}`}>
          <line x1={X(m)} x2={X(m)} y1={base} y2={base + 4} stroke={COR.base} strokeWidth={1} />
          <text x={X(m)} y={base + 17} textAnchor="middle" fontFamily={FONTE} fontSize={11} fill={COR.marca}>{fmt(m, casas(m))}</text>
        </g>
      ))}
      <text x={M.esq + (W - M.esq - M.dir) / 2} y={H - 8} textAnchor="middle" fontFamily={FONTE} fontSize={12} fill={COR.titulo}>Alcance (m)</text>
      <text x={14} y={M.topo + (base - M.topo) / 2} textAnchor="middle" fontFamily={FONTE} fontSize={12} fill={COR.titulo}
        transform={`rotate(-90 14 ${M.topo + (base - M.topo) / 2})`}>Capacidade</text>

      {/* Série: área suave + linha de 2 px + pontos com anel da cor do fundo */}
      <path d={area} fill={`url(#${id}-area)`} />
      <path d={linha} fill="none" stroke={COR.linha} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === ativo ? 6 : 4} fill={COR.linha} stroke={COR.superficie} strokeWidth={2} />
      ))}

      {/* Ponto do raio de operação do plano */}
      {d && (
        <g>
          <line x1={d.x} x2={d.x} y1={base} y2={d.y} stroke={COR.destaque} strokeWidth={1} />
          <line x1={M.esq} x2={d.x} y1={d.y} y2={d.y} stroke={COR.destaque} strokeWidth={1} />
          <circle cx={d.x} cy={d.y} r={6} fill={COR.destaque} stroke={COR.superficie} strokeWidth={2} />
          <Rotulo x={d.x} y={d.y} W={W} topo={M.topo} linhas={[d.texto]} forte aoLado />
        </g>
      )}

      {/* Dica ao passar o mouse: guia vertical + alcance e capacidade da extensão mais próxima */}
      {a && (
        <g pointerEvents="none">
          <line x1={a.x} x2={a.x} y1={M.topo} y2={base} stroke={COR.guia} strokeWidth={1} />
          <Rotulo x={a.x} y={a.y} W={W} topo={M.topo} linhas={[`Extensão ${(ativo ?? 0) + 1}`, `${fmtM(a.alcanceM)} · ${fmt(a.capacidadeKg, 0)} kg`]} />
        </g>
      )}
      <rect x={M.esq} y={M.topo} width={W - M.esq - M.dir} height={base - M.topo} fill="transparent"
        onMouseMove={aoMover} onMouseLeave={() => setAtivo(null)} />
    </Box>
  );
}

/**
 * Caixinha de texto junto a um ponto, sem sair da área do gráfico: acima dele (ou abaixo, perto do topo);
 * com `aoLado`, à direita do ponto (ou à esquerda, perto da borda), para não cobrir os números do eixo.
 */
function Rotulo({ x, y, W, topo, linhas, forte, aoLado }: { x: number; y: number; W: number; topo: number; linhas: string[]; forte?: boolean; aoLado?: boolean }) {
  const larg = Math.max(...linhas.map((l) => l.length)) * 6 + 16;
  const alt = linhas.length * 15 + 8;
  const bx = aoLado
    ? (x + 12 + larg <= W - 4 ? x + 12 : x - 12 - larg)
    : Math.min(Math.max(x - larg / 2, 4), W - larg - 4);
  const by = aoLado
    ? Math.max(topo, y - alt / 2)
    : (y - alt - 12 < topo ? y + 12 : y - alt - 12);
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={larg} height={alt} rx={3} fill={COR.superficie} stroke={forte ? COR.destaque : COR.borda} strokeWidth={1} />
      {linhas.map((l, i) => (
        <text key={i} x={bx + 8} y={by + 16 + i * 15} fontFamily={FONTE} fontSize={12} fontWeight={i === linhas.length - 1 ? 600 : 400} fill={i === linhas.length - 1 ? COR.tinta : COR.marca}>{l}</text>
      ))}
    </g>
  );
}
