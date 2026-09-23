import { useState } from 'react';
import { MovimientoForm } from '../../components/MovimientoForm';
import { MovimientoRow } from '../../components/MovimientoRow';
import type { MovimientosViewProps } from './types';

export function MovimientosMobile({
  cuentas,
  movimientos,
  actualizarMovimiento,
  borrarMovimiento,
}: MovimientosViewProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <div style={{ padding: '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Movimientos</h1>
      </div>

      <div className="glass-card">
        {movimientos.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>Aún no registras ningún movimiento.</p>
        ) : (
          movimientos.map((m) =>
            editandoId === m.id ? (
              <div key={m.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--card-border)' }}>
                <MovimientoForm
                  cuentas={cuentas}
                  valoresIniciales={m}
                  etiquetaGuardar="Guardar cambios"
                  onCrear={(datos) => actualizarMovimiento(m.id, datos)}
                  onCancelar={() => setEditandoId(null)}
                />
              </div>
            ) : (
              <MovimientoRow
                key={m.id}
                movimiento={m}
                cuentas={cuentas}
                onEditar={setEditandoId}
                onBorrar={borrarMovimiento}
              />
            )
          )
        )}
      </div>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 6px',
};
