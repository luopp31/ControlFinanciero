import type { CSSProperties } from 'react';

/** Color del escenario de cada pantalla (se funde al fondo). */
export const ESCENA = {
  hoy: '#2E3560',
  libro: '#3A2F57',
  analisis: '#124047',
  cuentas: '#4A2E43',
  bandeja: '#4A3A1F',
  ajustes: '#2B3A55',
  conciliar: '#124047',
} as const;

export const kickStyle: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--muted-fg)', letterSpacing: '-0.005em' };

export const tituloEscenaStyle: CSSProperties = { fontSize: 44, lineHeight: 1, letterSpacing: '-0.045em', fontWeight: 700, margin: '8px 0 0' };

export const subEscenaStyle: CSSProperties = { fontSize: 16, color: 'var(--muted-fg)', margin: '8px 0 0', maxWidth: '34ch' };

export const seccionTituloStyle: CSSProperties = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.035em' };

/** Rojo para lo que sale, verde para lo que entra; el traspaso queda neutro. */
export function colorMonto(tipo: string): string {
  if (tipo === 'INGRESO' || tipo === 'REEMBOLSO') return 'var(--accent)';
  if (tipo === 'GASTO' || tipo === 'AHORRO') return 'var(--destructive)';
  return 'var(--muted-fg)';
}
