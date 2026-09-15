import { useState } from 'react';
import { MovimientoForm } from '../../components/MovimientoForm';
import { MovimientoRow } from '../../components/MovimientoRow';
import type { MovimientosViewProps } from './types';

export function MovimientosDesktop({
  cuentas,
  movimientos,
  crearMovimiento,
  actualizarMovimiento,
  borrarMovimiento,
}: MovimientosViewProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Movimientos</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)', margin: 0 }}>Todo lo que registres aquí.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="glass-card">
          <MovimientoForm cuentas={cuentas} onCrear={crearMovimiento} />
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
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 8px',
};
