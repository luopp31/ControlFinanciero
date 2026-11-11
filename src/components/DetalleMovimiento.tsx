import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Cuenta, Movimiento } from '../lib/finanzas';
import { formatearFechaCorta } from '../lib/formato';
import { colorMonto } from './escenaEstilos';
import { MontoGrande } from './Escena';
import { TileCategoria } from './MovimientoRow';
import { infoVisual, signoDe, titulosDe } from './movimientoVista';

/** Hoja con el movimiento y sus dos acciones. Editar y Eliminar viven aquí, no en cada fila de la lista. */
export function DetalleMovimiento({
  movimiento,
  cuentas,
  onCerrar,
  onEditar,
  onEliminar,
}: {
  movimiento: Movimiento;
  cuentas: Cuenta[];
  onCerrar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const { nombre, Icono, color } = infoVisual(movimiento);
  const { titulo, detalle } = titulosDe(movimiento, cuentas, nombre);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return createPortal(
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.55)', animation: 'greedy-hoja-fondo 0.2s ease' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del movimiento"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--bg)',
          borderRadius: '30px 30px 0 0',
          boxShadow: '0 -1px 0 var(--card-border), 0 -12px 40px rgba(0,0,0,0.35)',
          padding: '12px 22px calc(26px + env(safe-area-inset-bottom))',
          animation: 'greedy-hoja-subir 0.28s cubic-bezier(.2,.9,.3,1)',
        }}
      >
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--muted)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <TileCategoria color={color} Icono={Icono} tamano={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{titulo}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>
              {formatearFechaCorta(movimiento.fecha)} · {detalle}
            </div>
          </div>
        </div>
        <MontoGrande valor={movimiento.monto} tamano={48} signo={signoDe(movimiento.tipo)} color={colorMonto(movimiento.tipo)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" onClick={onEditar} className="pildora borde" style={{ flex: 1 }}>
            Editar
          </button>
          <button type="button" onClick={onEliminar} className="pildora borde" style={{ flex: 1, color: 'var(--destructive)', borderColor: 'var(--destructive)' }}>
            Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
