import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatearFechaCorta, formatearMonto } from '../lib/formato';
import { MontoGrande } from './Escena';
import { kickStyle } from './escenaEstilos';

interface Punto {
  fecha: string;
  valor: number;
}

const RANGOS = [
  { id: '1S', dias: 7, nombre: '1 semana' },
  { id: '1M', dias: 30, nombre: '1 mes' },
  { id: '3M', dias: 90, nombre: '3 meses' },
] as const;
type RangoId = (typeof RANGOS)[number]['id'];

const MAX_PUNTOS = 16;
const H = 150;

/** Pocos puntos repartidos parejo: la curva sale suave en vez de zigzag. */
function muestrear(p: Punto[]): Punto[] {
  if (p.length <= MAX_PUNTOS) return p;
  return Array.from({ length: MAX_PUNTOS }, (_, i) => p[Math.round((i * (p.length - 1)) / (MAX_PUNTOS - 1))]);
}

/** Curva suave que pasa por todos los puntos (Catmull-Rom a Bézier). */
function curva(P: [number, number][]): string {
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * El patrimonio como paisaje: una curva suave con brillo dorado que se funde al fondo, el número grande debajo y los rangos
 * 1S / 1M / 3M. Al arrastrar el dedo sobre la curva se ve el valor y la fecha de ese punto.
 */
export function HeroPatrimonio({ serie, oculto, saludo, children }: { serie: Punto[]; oculto: boolean; saludo: string; children?: React.ReactNode }) {
  const idGrad = useId();
  const [rango, setRango] = useState<RangoId>('3M');
  const [idx, setIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(390);
  const r = RANGOS.find((x) => x.id === rango)!;

  // El ancho real del contenedor manda: así el alto queda fijo y en escritorio la curva no se estira.
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const medir = () => setW(Math.max(280, Math.round(caja.clientWidth)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(caja);
    return () => obs.disconnect();
  }, []);

  const { pts, P, path } = useMemo(() => {
    const pts = muestrear(serie.slice(-r.dias));
    const valores = pts.map((p) => p.valor);
    const mn = Math.min(...valores);
    const mx = Math.max(...valores);
    const P: [number, number][] = pts.map((p, i) => [
      pts.length === 1 ? W : (i / (pts.length - 1)) * W,
      mx === mn ? H / 2 : H - 4 - ((p.valor - mn) / (mx - mn)) * (H - 28),
    ]);
    return { pts, P, path: P.length > 1 ? curva(P) : `M0 ${P[0]?.[1] ?? H / 2}L${W} ${P[0]?.[1] ?? H / 2}` };
  }, [serie, r.dias, W]);

  if (pts.length === 0) return null;

  const ultimo = pts[pts.length - 1];
  const primero = pts[0];
  const actual = idx === null ? ultimo : pts[idx];
  const cambio = ultimo.valor - primero.valor;
  const pct = primero.valor !== 0 ? (cambio / Math.abs(primero.valor)) * 100 : null;
  const fin = P[P.length - 1];
  const marca = idx === null ? fin : P[idx];

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const b = svgRef.current!.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    setIdx(Math.round(t * (pts.length - 1)));
  }

  return (
    <>
      <div ref={cajaRef} style={{ margin: '12px -20px 0' }}>
        <svg
          key={rango}
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Valor neto de los últimos ${r.nombre}`}
          style={{ display: 'block', touchAction: 'none', cursor: 'crosshair', overflow: 'visible' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            mover(e);
          }}
          onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && mover(e)}
          onPointerUp={() => setIdx(null)}
          onPointerLeave={() => setIdx(null)}
          onPointerCancel={() => setIdx(null)}
        >
          <defs>
            <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F9C846" stopOpacity="0.42" />
              <stop offset="0.7" stopColor="#F9C846" stopOpacity="0.06" />
              <stop offset="1" stopColor="#F9C846" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path}L${W} ${H}L0 ${H}Z`} fill={`url(#${idGrad})`} />
          <path
            d={path}
            pathLength={1}
            fill="none"
            stroke="var(--fg)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1}
            strokeDashoffset={1}
            style={{ animation: 'greedy-dibujar 1.3s ease forwards' }}
          />
          {idx !== null && <line x1={marca[0]} x2={marca[0]} y1={0} y2={H} stroke="var(--muted-fg)" />}
          <circle cx={Math.min(Math.max(marca[0], 8), W - 8)} cy={marca[1]} r={6.5} fill="#F9C846" stroke="var(--ring)" strokeWidth={2.5} />
        </svg>
      </div>

      <div style={{ ...kickStyle, marginTop: 14 }}>
        {saludo} / <b style={{ color: 'var(--fg)', fontWeight: 600 }}>Valor neto</b>
      </div>
      <MontoGrande valor={actual.valor} oculto={oculto} signo={actual.valor < 0 ? '−' : ''} />
      <div style={{ fontSize: 16, color: 'var(--muted-fg)', marginTop: 8 }}>
        {idx !== null ? (
          formatearFechaCorta(actual.fecha)
        ) : oculto ? null : (
          <>
            <span style={{ color: cambio >= 0 ? 'var(--accent)' : 'var(--destructive)' }}>
              {cambio >= 0 ? '▲' : '▼'}
              {pct !== null ? ` ${Math.abs(pct).toFixed(1)}%` : ''}
            </span>
            {' · '}
            {cambio >= 0 ? '+' : '−'} S/ {formatearMonto(Math.abs(cambio))} en {r.nombre}
          </>
        )}
      </div>

      <div role="group" aria-label="Rango del gráfico" style={{ display: 'flex', gap: 8, margin: '16px 0 18px' }}>
        {RANGOS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={rango === x.id}
            onClick={() => setRango(x.id)}
            style={{
              minHeight: 44,
              minWidth: 52,
              padding: '0 16px',
              borderRadius: 999,
              border: `1px solid ${rango === x.id ? 'var(--fg)' : 'var(--btn-line)'}`,
              background: rango === x.id ? 'var(--fg)' : 'transparent',
              color: rango === x.id ? 'var(--bg)' : 'var(--fg)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {x.id}
          </button>
        ))}
      </div>
      {children}
    </>
  );
}
