import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CATS, CATS_ING, type Cuenta, type Movimiento } from '../lib/finanzas';
import { formatearFechaCorta, formatearMonto } from '../lib/formato';
import { botonSecundario } from './formStyles';

const TIPO_NOMBRE: Record<string, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  REEMBOLSO: 'Reembolso',
  TRASPASO: 'Traspaso',
  AHORRO: 'Ahorro',
  PRESTAMO: 'Préstamo',
};

/** Texto corto para identificar el movimiento: su nota, o si no tiene, su categoría o su tipo. */
export function etiquetaMovimiento(m: Movimiento): string {
  const cat = [...CATS, ...CATS_ING].find((c) => c.id === m.categoria)?.nombre;
  return m.nota?.trim() || cat || TIPO_NOMBRE[m.tipo] || m.tipo;
}

/** "¿Borrar S/ 2.00 pasaje?" con el detalle del movimiento. Cancelar es lo que tiene el foco: un Enter sin querer no borra. */
export function ConfirmarBorrado({
  movimiento,
  cuentas,
  borrando,
  onConfirmar,
  onCancelar,
}: {
  movimiento: Movimiento;
  cuentas: Cuenta[];
  borrando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const cuenta = cuentas.find((c) => c.id === movimiento.cuentaId)?.nombre;
  const destino = movimiento.destinoId ? cuentas.find((c) => c.id === movimiento.destinoId)?.nombre : null;
  const cat = [...CATS, ...CATS_ING].find((c) => c.id === movimiento.categoria)?.nombre;

  useEffect(() => {
    cancelarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCancelar]);

  return createPortal(
    <div
      onClick={onCancelar}
      style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-borrado-titulo"
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--card)' }}
      >
        <p id="confirmar-borrado-titulo" style={{ margin: 0, fontSize: 18, fontWeight: 800, overflowWrap: 'anywhere' }}>
          ¿Borrar S/ {formatearMonto(movimiento.monto)} {etiquetaMovimiento(movimiento)}?
        </p>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)', overflowWrap: 'anywhere' }}>
          {TIPO_NOMBRE[movimiento.tipo] ?? movimiento.tipo}
          {cat && movimiento.nota?.trim() ? ` · ${cat}` : ''} · {cuenta ?? '—'}
          {destino ? ` → ${destino}` : ''} · {formatearFechaCorta(movimiento.fecha)}
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>Deja de contar en tus saldos y en las estadísticas.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button ref={cancelarRef} type="button" onClick={onCancelar} disabled={borrando} style={{ ...botonSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={borrando}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 12, border: 'none', background: 'var(--destructive)', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: borrando ? 'not-allowed' : 'pointer', opacity: borrando ? 0.6 : 1 }}
          >
            {borrando ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
