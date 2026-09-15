import { useState } from 'react';
import { MovimientoForm } from '../../components/MovimientoForm';
import { MovimientoRow } from '../../components/MovimientoRow';
import { IconPlus } from '../../components/icons';
import type { MovimientosViewProps } from './types';

export function MovimientosMobile({
  cuentas,
  movimientos,
  crearMovimiento,
  actualizarMovimiento,
  borrarMovimiento,
}: MovimientosViewProps) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <div style={{ padding: '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Movimientos</h1>
      </div>

      {mostrarForm ? (
        <div className="glass-card">
          <MovimientoForm
            cuentas={cuentas}
            onCrear={async (datos) => {
              const r = await crearMovimiento(datos);
              setMostrarForm(false);
              return r;
            }}
            onCancelar={() => setMostrarForm(false)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setMostrarForm(true)} style={botonAgregar}>
          <IconPlus width={16} height={16} />
          Registrar movimiento
        </button>
      )}

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

const botonAgregar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px 16px',
  borderRadius: 14,
  border: '1px dashed var(--card-border)',
  background: 'transparent',
  color: 'var(--primary)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
