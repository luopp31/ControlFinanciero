import { CuentaCard } from '../../components/CuentaCard';
import { CuentaForm } from '../../components/CuentaForm';
import type { CuentasViewProps } from './types';

export function CuentasDesktop({ cuentas, movimientos, crearCuenta }: CuentasViewProps) {
  const vacio = cuentas.length === 0;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          {vacio ? 'Empecemos con tus cuentas' : 'Tus cuentas'}
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)', margin: 0, maxWidth: '58ch' }}>
          {vacio
            ? 'Pon el saldo real que tienes hoy en cada cuenta. No hace falta reconstruir historial pasado.'
            : 'El saldo de cada cuenta parte de este número inicial más los movimientos que registres desde hoy.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: vacio ? '1fr' : '360px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="glass-card" style={{ maxWidth: vacio ? 420 : undefined }}>
          <CuentaForm onCrear={crearCuenta} />
        </div>

        {!vacio && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {cuentas.map((c) => (
              <CuentaCard key={c.id} cuenta={c} movimientos={movimientos} />
            ))}
          </div>
        )}
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
