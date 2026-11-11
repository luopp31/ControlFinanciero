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
  // 16px o más — con menos, iOS hace zoom automático al enfocar el campo.
  fontSize: 16,
  outline: 'none',
};

export function chipStyle(activo: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${activo ? 'var(--fg)' : 'var(--card-border)'}`,
    background: activo ? 'var(--fg)' : 'var(--muted)',
    color: activo ? 'var(--bg)' : 'var(--muted-fg)',
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
    background: activo ? color : 'var(--muted)',
    color: activo ? '#1B1622' : 'var(--muted-fg)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  };
}

export function botonPrimario(deshabilitado: boolean): CSSProperties {
  return {
    padding: '12px 22px',
    borderRadius: 999,
    border: 'none',
    background: deshabilitado ? 'var(--muted)' : 'var(--yellow)',
    color: deshabilitado ? 'var(--muted-fg)' : 'var(--on-yellow)',
    fontWeight: 600,
    fontSize: 15,
    cursor: deshabilitado ? 'not-allowed' : 'pointer',
  };
}

export const botonSecundario: CSSProperties = {
  padding: '12px 20px',
  borderRadius: 999,
  border: '1px solid var(--btn-line)',
  background: 'transparent',
  color: 'var(--fg)',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

/** Selector de tipo como control segmentado (Gasto/Ingreso/Otro dentro de un
 * mismo riel) — el estilo del panel de registro que el usuario señaló como
 * referencia: el segmento activo se eleva sobre un fondo blanco/tarjeta con
 * sombra suave, los demás quedan planos en gris. */
export const segmentoTrackStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  borderRadius: 16,
  background: 'var(--muted)',
};

export function segmentoStyle(activo: boolean, color: string): CSSProperties {
  return {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 8px',
    borderRadius: 12,
    border: 'none',
    background: activo ? 'var(--card)' : 'transparent',
    boxShadow: activo ? 'var(--shadow)' : 'none',
    color: activo ? color : 'var(--muted-fg)',
    fontWeight: 700,
    fontSize: 13.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background .15s ease, color .15s ease, box-shadow .15s ease',
  };
}

/** Fila de "campo seleccionado" (Categoría/Cuenta): resumen de la selección
 * actual que abre un picker en vez de mostrar todas las opciones a la vez —
 * igual patrón que .campo-sel de la app anterior (legacy/index.html:399-408). */
export const campoSelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  textAlign: 'left',
  background: 'var(--muted)',
  border: '1px solid var(--card-border)',
  borderRadius: 14,
  padding: '11px 13px',
  cursor: 'pointer',
};

export function campoSelIconoStyle(color: string): CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 10,
    flex: '0 0 34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `color-mix(in srgb, ${color} var(--tile-a), transparent)`,
    color: `var(--glyph, color-mix(in srgb, ${color} 50%, #000))`,
  };
}

/** Color de acento del monto según el tipo de movimiento — rojo=gasto,
 * verde=ingreso, color propio del tipo para "otro". Los dos primeros usan
 * los tokens semánticos (ya theme-aware); "otro" usa el hex de TIPO_COLOR. */
export interface AcentoMonto {
  texto: string;
}

export function acentoGasto(): AcentoMonto {
  return { texto: 'var(--destructive)' };
}

export function acentoIngreso(): AcentoMonto {
  return { texto: 'var(--accent)' };
}

export function acentoColor(color: string): AcentoMonto {
  return { texto: color };
}

/** Monto grande sin tarjeta de fondo, con una barrita de acento a la
 * izquierda y la unidad monetaria a la derecha — el patrón de referencia que
 * pidió el usuario en vez de la tarjeta tintada anterior. El número se tiñe
 * del color del tipo solo una vez que hay algo escrito. */
export function barraAcentoStyle(acento: AcentoMonto): CSSProperties {
  return {
    width: 3,
    height: 40,
    borderRadius: 2,
    background: acento.texto,
    flex: '0 0 auto',
  };
}

export function montoGrandeInputStyle(acento: AcentoMonto, tieneValor: boolean): CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    textAlign: 'right',
    color: tieneValor ? acento.texto : 'var(--muted-fg)',
    fontWeight: 800,
    fontSize: 'clamp(40px, 14vw, 64px)',
    fontVariantNumeric: 'tabular-nums',
    padding: 0,
    minWidth: 0,
    width: '100%',
  };
}

/** `createPortal` lo cuelga de `document.body`, no del contenedor de la hoja
 * de RegistroRapido — por eso este `fixed` SIEMPRE cubre el viewport real
 * completo (el `transform` de la hoja no aplica como "containing block" a un
 * nodo que ya no es su descendiente en el DOM), y su borde superior cae justo
 * bajo el notch/isla dinámica/barra de estado del teléfono si no se le suma
 * el safe-area-inset-top. */
export const pickerOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg)',
  padding: 'calc(18px + env(safe-area-inset-top)) 18px calc(18px + env(safe-area-inset-bottom))',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  zIndex: 200,
  overflowY: 'auto',
};

export const pickerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
};

export function pickerItemStyle(activo: boolean, color: string): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 7,
    padding: '14px 6px',
    borderRadius: 16,
    background: activo ? `${color}1F` : 'var(--muted)',
    border: `1.5px solid ${activo ? color : 'var(--card-border)'}`,
    color: activo ? color : 'var(--fg)',
    cursor: 'pointer',
  };
}

export function pickerItemIconoStyle(color: string): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `color-mix(in srgb, ${color} var(--tile-a), transparent)`,
    color: `var(--glyph, color-mix(in srgb, ${color} 50%, #000))`,
  };
}
