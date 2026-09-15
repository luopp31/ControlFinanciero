import { useState } from 'react';
import { CuentaCard } from '../../components/CuentaCard';
import { CuentaForm } from '../../components/CuentaForm';
import { IconPlus } from '../../components/icons';
import type { CuentasViewProps } from './types';

export function CuentasMobile({ cuentas, movimientos, crearCuenta }: CuentasViewProps) {
  const vacio = cuentas.length === 0;
  const [mostrarForm, setMostrarForm] = useState(vacio);

  return (
    <div style={{ padding: '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          {vacio ? 'Empecemos con tus cuentas' : 'Tus cuentas'}
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>
          {vacio
            ? 'Pon el saldo real que tienes hoy. No hace falta reconstruir historial pasado.'
            : 'El saldo parte de este número inicial más lo que registres desde hoy.'}
        </p>
      </div>

      {!vacio && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cuentas.map((c) => (
            <CuentaCard key={c.id} cuenta={c} movimientos={movimientos} />
          ))}
        </div>
      )}

      {mostrarForm ? (
        <div className="glass-card">
          <CuentaForm
            onCrear={async (datos) => {
              const r = await crearCuenta(datos);
              setMostrarForm(false);
              return r;
            }}
            onCancelar={vacio ? undefined : () => setMostrarForm(false)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setMostrarForm(true)} style={botonAgregar}>
          <IconPlus width={16} height={16} />
          Agregar cuenta
        </button>
      )}
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
