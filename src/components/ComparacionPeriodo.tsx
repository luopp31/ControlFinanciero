import type { CSSProperties } from 'react';
import { formatearMonto } from '../lib/formato';

export interface Comparacion {
  diff: number;
  pct: number | null;
}

/** Compara un total actual contra el mismo total en el período anterior de
 * igual duración. `null` cuando no hay período anterior (ej. "todo") o
 * cuando ambos son cero — nada que comparar. */
export function compararPeriodos(actual: number, anterior: number | null): Comparacion | null {
  if (anterior === null) return null;
  if (anterior === 0 && actual === 0) return null;
  const diff = actual - anterior;
  const pct = anterior !== 0 ? (diff / anterior) * 100 : null;
  return { diff, pct };
}

/**
 * Pastilla "▲ S/ X (+Y%)" comparando contra el período anterior — el color
 * depende de si subir es bueno o malo para esta métrica (invertido entre
 * ingreso y gasto: gastar más es malo, ingresar más es bueno).
 */
export function PildoraComparacion({
  comparacion,
  subirEsBueno,
}: {
  comparacion: Comparacion | null;
  subirEsBueno: boolean;
}) {
  if (!comparacion) return null;
  const { diff, pct } = comparacion;
  const neutro = diff === 0;
  const subio = diff > 0;
  const bueno = neutro ? null : subirEsBueno ? subio : !subio;

  const color = neutro ? 'var(--muted-fg)' : bueno ? 'var(--accent)' : 'var(--destructive)';
  const fondo = neutro ? 'var(--muted)' : bueno ? 'var(--accent-soft)' : 'var(--destructive-soft)';
  const flecha = neutro ? '=' : subio ? '▲' : '▼';

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11.5,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 999,
    background: fondo,
    color,
    whiteSpace: 'nowrap',
  };

  return (
    <span style={style}>
      {flecha} S/ {formatearMonto(Math.abs(diff))}
      {pct !== null && ` (${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%)`}
    </span>
  );
}
