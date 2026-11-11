import type { CSSProperties } from 'react';
import type { Cuenta, Movimiento } from '../lib/finanzas';
import { formatearMonto } from '../lib/formato';
import { colorMonto } from './escenaEstilos';
import { infoVisual, signoDe, titulosDe } from './movimientoVista';

/** Ícono de categoría: pastel pleno con el dibujo oscuro (en claro, el dibujo es una versión más oscura del tono). */
export function TileCategoria({ color, Icono, tamano = 40 }: { color: string; Icono: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element; tamano?: number }) {
  return (
    <span className="tile-cat" style={{ '--c': color, width: tamano, height: tamano } as CSSProperties}>
      <Icono width={Math.round(tamano * 0.5)} height={Math.round(tamano * 0.5)} />
    </span>
  );
}

export function MovimientoRow({ movimiento, cuentas, onAbrir }: { movimiento: Movimiento; cuentas: Cuenta[]; onAbrir?: (id: string) => void }) {
  const { nombre, Icono, color } = infoVisual(movimiento);
  const { titulo, detalle } = titulosDe(movimiento, cuentas, nombre);
  const signo = signoDe(movimiento.tipo);

  const contenido = (
    <>
      <TileCategoria color={color} Icono={Icono} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.015em', overflowWrap: 'anywhere' }}>{titulo}</div>
        <div style={{ fontSize: 13, color: 'var(--muted-fg)' }}>{detalle}</div>
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 16.5, letterSpacing: '-0.015em', color: colorMonto(movimiento.tipo), whiteSpace: 'nowrap' }}>
        {signo} S/ {formatearMonto(movimiento.monto)}
      </div>
    </>
  );

  const estilo: CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, padding: '8px 0', textAlign: 'left', color: 'inherit' };
  return onAbrir ? (
    <button type="button" onClick={() => onAbrir(movimiento.id)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', ...estilo }}>
      {contenido}
    </button>
  ) : (
    <div style={estilo}>{contenido}</div>
  );
}
