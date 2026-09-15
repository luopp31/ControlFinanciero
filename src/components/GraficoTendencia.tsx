import { useId, useMemo, useState } from 'react';
import { formatearMonto } from '../lib/formato';

interface Punto {
  fecha: string;
  valor: number;
}

const ANCHO = 640;
const ALTO = 200;
const PAD_IZQ = 8;
const PAD_DER = 8;
const PAD_ARR = 16;
const PAD_ABAJO = 28;

function formatearFechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(dia)} ${meses[Number(mes) - 1]}`;
}

/**
 * Gráfico de línea de una sola serie (valor neto en el tiempo). Sigue la guía del
 * skill dataviz: 2px de línea, relleno de área al 10%, sin leyenda (una sola serie,
 * el título ya dice qué es), crosshair + tooltip al pasar el mouse, y la marca +
 * etiqueta del último punto en vez de una cifra por cada punto.
 */
export function GraficoTendencia({ puntos, moneda = 'S/' }: { puntos: Punto[]; moneda?: string }) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { pathLinea, pathArea, coords, min, max } = useMemo(() => {
    if (puntos.length === 0) {
      return { pathLinea: '', pathArea: '', coords: [] as { x: number; y: number }[], min: 0, max: 0 };
    }
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
      coords.length > 0
        ? `M${coords[0].x.toFixed(1)},${base} ` +
          coords.map((c) => `L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
          ` L${coords[coords.length - 1].x.toFixed(1)},${base} Z`
        : '';

    return { pathLinea, pathArea, coords, min, max };
  }, [puntos]);

  if (puntos.length === 0) return null;

  const activo = hoverIdx ?? puntos.length - 1;
  const puntoActivo = puntos[activo];
  const coordActivo = coords[activo];
  const primero = puntos[0].valor;
  const ultimo = puntos[puntos.length - 1].valor;
  const cambio = ultimo - primero;
  const pctCambio = primero !== 0 ? (cambio / Math.abs(primero)) * 100 : 0;

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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 999,
            background: cambio >= 0 ? 'var(--accent-soft)' : 'var(--destructive-soft)',
            color: cambio >= 0 ? 'var(--accent)' : 'var(--destructive)',
          }}
        >
          {cambio >= 0 ? '+' : '−'}
          {moneda} {formatearMonto(Math.abs(cambio))} ({pctCambio >= 0 ? '+' : '−'}
          {Math.abs(pctCambio).toFixed(1)}%)
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--muted-fg)' }}>
          desde el {formatearFechaCorta(puntos[0].fecha)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Valor neto: de ${moneda} ${formatearMonto(primero)} a ${moneda} ${formatearMonto(ultimo)}`}
        onPointerMove={(e) => setHoverIdx(posicionAIndice(e.clientX, e.currentTarget))}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* líneas de referencia: máximo, cero (si aplica), mínimo */}
        {[max, min].map((v, i) => {
          const altoUtil = ALTO - PAD_ARR - PAD_ABAJO;
          const rango = max - min || 1;
          const y = PAD_ARR + altoUtil - ((v - min) / rango) * altoUtil;
          return (
            <line
              key={i}
              x1={PAD_IZQ}
              x2={ANCHO - PAD_DER}
              y1={y}
              y2={y}
              stroke="var(--card-border)"
              strokeWidth={1}
            />
          );
        })}

        <path d={pathArea} fill={`url(#${gradientId})`} stroke="none" />
        <path d={pathLinea} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* marca + etiqueta del último punto (no uno por punto) */}
        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />

        {hoverIdx !== null && coordActivo && (
          <>
            <line
              x1={coordActivo.x}
              x2={coordActivo.x}
              y1={PAD_ARR}
              y2={ALTO - PAD_ABAJO}
              stroke="var(--muted-fg)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={coordActivo.x} cy={coordActivo.y} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10.5, color: 'var(--muted-fg)' }}>{formatearFechaCorta(puntos[0].fecha)}</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted-fg)' }}>{formatearFechaCorta(puntos[puntos.length - 1].fecha)}</span>
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 12.5,
          color: 'var(--muted-fg)',
          fontVariantNumeric: 'tabular-nums',
        }}
        aria-live="polite"
      >
        {formatearFechaCorta(puntoActivo.fecha)}:{' '}
        <strong style={{ color: 'var(--fg)' }}>
          {moneda} {formatearMonto(puntoActivo.valor)}
        </strong>
      </div>
    </div>
  );
}
