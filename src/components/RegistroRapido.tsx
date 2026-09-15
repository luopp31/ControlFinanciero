import { useState } from 'react';
import { useCuentas } from '../hooks/useCuentas';
import { useMovimientos } from '../hooks/useMovimientos';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { MovimientoForm } from './MovimientoForm';
import { IconPlus } from './icons';

export function RegistroRapido() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando } = useCuentas();
  const { crearMovimiento } = useMovimientos();
  const [abierto, setAbierto] = useState(false);

  if (cargando || cuentas.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Registrar movimiento"
        style={{
          all: 'unset',
          cursor: 'pointer',
          position: 'fixed',
          right: isDesktop ? 24 : 16,
          bottom: isDesktop ? 24 : 84,
          width: 56,
          height: 56,
          borderRadius: 18,
          background: 'var(--primary)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          zIndex: 50,
        }}
      >
        <IconPlus width={24} height={24} />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar movimiento"
          onClick={() => setAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto' }}
          >
            <p style={{ margin: '0 0 14px', fontSize: 14.5, fontWeight: 700 }}>Registrar movimiento</p>
            <MovimientoForm
              cuentas={cuentas}
              onCrear={async (datos) => {
                const r = await crearMovimiento(datos);
                setAbierto(false);
                return r;
              }}
              onCancelar={() => setAbierto(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
