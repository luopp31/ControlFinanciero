import { useMemo, useState } from 'react';
import { ConfirmarBorrado } from '../../components/ConfirmarBorrado';
import { MovimientoForm } from '../../components/MovimientoForm';
import { MovimientoRow } from '../../components/MovimientoRow';
import { SelectorMes } from '../../components/SelectorMes';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { mesActualISO, sumarMeses } from '../../lib/fecha';
import { textoBorradoMovimiento } from '../../lib/textoBorrado';

export function Movimientos() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs, actualizarMovimiento, borrarMovimiento } = useMovimientos();
  const [mes, setMes] = useState(() => mesActualISO());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Borrar pide confirmación: primero se elige qué borrar, y recién al confirmar se borra.
  const [porBorrarId, setPorBorrarId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  const movimientosDelMes = useMemo(() => movimientos.filter((m) => m.fecha.startsWith(mes)), [movimientos, mes]);

  if (cargandoCuentas || cargandoMovs) return null;

  const porBorrar = porBorrarId ? movimientos.find((m) => m.id === porBorrarId) : undefined;

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: 32, maxWidth: 480 }}>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)' }}>
          Primero crea al menos una cuenta en "Cuentas" para poder registrar movimientos.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: isDesktop ? 720 : undefined,
        margin: '0 auto',
        padding: isDesktop ? '48px 32px' : '28px 18px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: isDesktop ? 24 : 20,
      }}
    >
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          Movimientos
        </h1>
      </div>

      <SelectorMes
        mes={mes}
        onCambiar={(delta) => setMes((m) => sumarMeses(m, delta))}
        deshabilitarSiguiente={mes >= mesActualISO()}
      />

      <div className="glass-card">
        {movimientosDelMes.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>Sin movimientos este mes.</p>
        ) : (
          movimientosDelMes.map((m) =>
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
                onBorrar={setPorBorrarId}
              />
            )
          )
        )}
      </div>

      {porBorrar && (
        <ConfirmarBorrado
          texto={textoBorradoMovimiento(porBorrar, cuentas)}
          borrando={borrando}
          onCancelar={() => !borrando && setPorBorrarId(null)}
          onConfirmar={async () => {
            setBorrando(true);
            try {
              await borrarMovimiento(porBorrar.id);
            } finally {
              setBorrando(false);
              setPorBorrarId(null);
            }
          }}
        />
      )}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 6px',
};
