import { useId, useState } from 'react';
import type { PuntoSimulacion } from '../lib/simulacion';
import { formatearMesCorto, formatearMonto } from '../lib/formato';

const ANCHO = 640;
const ALTO = 200;
const PAD_IZQ = 8;
const PAD_DER = 8;
const PAD_ARR = 16;
const PAD_ABAJO = 28;

/**
 * Línea de una sola serie (valor neto proyectado mes a mes) — mismo patrón
 * que GraficoTendencia (Panel), pero con tokens de tema en vez de blanco fijo,
 * porque esta vive en una glass-card normal, no en el hero navy. Se pone en
 * rojo si la proyección termina en negativo (te quedarías debiendo/sin nada),
 * azul primario si no.
 */
export function GraficoSimulacion({ puntos }: { puntos: PuntoSimulacion[] }) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (puntos.length === 0) return null;

  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 0);
  const rango = max - min || 1;
  const anchoUtil = ANCHO - PAD_IZQ - PAD_DER;
  const altoUtil = ALTO - PAD_ARR - PAD_ABAJO;

  const coords = puntos.map((p, i) => {
    const x = puntos.length === 1 ? PAD_IZQ + anchoUtil / 2 : PAD_IZQ + (i / (puntos.length - 1)) * anchoUtil;
    const y = PAD_ARR + altoUtil - ((p.valor - min) / rango) * altoUtil;
    return { x, y };
  });

  const pathLinea = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const base = PAD_ARR + altoUtil;
  const pathArea =
    `M${coords[0].x.toFixed(1)},${base} ` +
    coords.map((c) => `L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
    ` L${coords[coords.length - 1].x.toFixed(1)},${base} Z`;

  const terminaEnNegativo = puntos[puntos.length - 1].valor < 0;
  const color = terminaEnNegativo ? 'var(--destructive)' : 'var(--primary)';

  const activo = hoverIdx ?? puntos.length - 1;
  const puntoActivo = puntos[activo];
  const coordActivo = coords[activo];

  function posicionAIndice(clientX: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const xRelativo = ((clientX - rect.left) / rect.width) * ANCHO;
    let mejor = 0;
    let mejorDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - xRelativo);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = i;
      }
    });
    return mejor;
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Valor neto proyectado: de S/ ${formatearMonto(puntos[0].valor)} a S/ ${formatearMonto(puntos[puntos.length - 1].valor)}`}
        onPointerMove={(e) => setHoverIdx(posicionAIndice(e.clientX, e.currentTarget))}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={PAD_IZQ} x2={ANCHO - PAD_DER} y1={base} y2={base} stroke="var(--card-border)" strokeWidth={1} />

        <path d={pathArea} fill={`url(#${gradientId}-area)`} stroke="none" />
        <path d={pathLinea} fill="none" stroke={color} strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />

        {hoverIdx !== null && coordActivo && (
          <>
            <line
              x1={coordActivo.x}
              x2={coordActivo.x}
              y1={PAD_ARR}
              y2={base}
              stroke="var(--card-border)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={coordActivo.x} cy={coordActivo.y} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10.5, color: 'var(--muted-fg)' }}>{formatearMesCorto(puntos[0].mes)}</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted-fg)' }}>{formatearMesCorto(puntos[puntos.length - 1].mes)}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted-fg)', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
        {formatearMesCorto(puntoActivo.mes)}: <strong style={{ color: 'var(--fg)' }}>S/ {formatearMonto(puntoActivo.valor)}</strong>
      </div>
    </div>
  );
}
