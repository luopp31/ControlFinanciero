import type { Cuenta, Movimiento } from '../lib/finanzas';
import { saldo } from '../lib/finanzas';
import { formatearMonto } from '../lib/formato';
import { IconBank, IconWallet } from './icons';

export function CuentaCard({ cuenta, movimientos }: { cuenta: Cuenta; movimientos: Movimiento[] }) {
  const monto = saldo(cuenta, movimientos);
  const Icono = cuenta.rol === 'BOVEDA' ? IconBank : IconWallet;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          <Icono width={18} height={18} />
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{cuenta.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
            {cuenta.rol === 'BOVEDA' ? 'Bóveda' : 'Billetera'}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        S/ {formatearMonto(monto)}
      </p>
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-fg)' }}>
        Desde el {cuenta.desde}
      </p>
    </div>
  );
}
