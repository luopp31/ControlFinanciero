import type { CSSProperties } from 'react';

export const etiquetaStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--muted-fg)',
};

export const inputStyle: CSSProperties = {
  padding: '11px 13px',
  borderRadius: 12,
  border: '1px solid var(--card-border)',
  background: 'var(--muted)',
  color: 'var(--fg)',
  fontSize: 14.5,
  outline: 'none',
};

export function chipStyle(activo: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${activo ? 'var(--primary)' : 'var(--card-border)'}`,
    background: activo ? 'var(--primary-soft)' : 'var(--muted)',
    color: activo ? 'var(--primary)' : 'var(--muted-fg)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  };
}

/** Igual que chipStyle, pero usa el color de identidad de la categoría en vez
 * de siempre el azul primario — así cada categoría se distingue a simple vista. */
export function chipStyleColor(activo: boolean, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${activo ? color : 'var(--card-border)'}`,
    background: activo ? `${color}26` : 'var(--muted)',
    color: activo ? color : 'var(--muted-fg)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  };
}

export function botonPrimario(deshabilitado: boolean): CSSProperties {
  return {
    padding: '11px 20px',
    borderRadius: 12,
    border: 'none',
    background: deshabilitado ? 'var(--muted)' : 'var(--primary)',
    color: deshabilitado ? 'var(--muted-fg)' : '#FFFFFF',
    fontWeight: 700,
    fontSize: 14,
    cursor: deshabilitado ? 'not-allowed' : 'pointer',
  };
}

export const botonSecundario: CSSProperties = {
  padding: '11px 16px',
  borderRadius: 12,
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--muted-fg)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};
