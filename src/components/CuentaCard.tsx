import type { Cuenta, Movimiento } from '../lib/finanzas';
import { saldo } from '../lib/finanzas';
import { formatearFechaCorta, formatearMontoOcultable } from '../lib/formato';
import { useConfig } from '../hooks/useConfig';
import { IconBank, IconWallet } from './icons';

export function CuentaCard({ cuenta, movimientos }: { cuenta: Cuenta; movimientos: Movimiento[] }) {
  const monto = saldo(cuenta, movimientos);
  const { config, cargando: cargandoConfig } = useConfig();
  const Icono = cuenta.rol === 'BOVEDA' ? IconBank : IconWallet;

  return (
    <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          <Icono width={15} height={15} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {cuenta.nombre}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{cuenta.rol === 'BOVEDA' ? 'Bóveda' : 'Billetera'}</div>
        </div>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 18.5,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        S/ {formatearMontoOcultable(monto, cargandoConfig || !!config.ocultarSaldos)}
      </p>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-fg)' }}>
        Desde el {formatearFechaCorta(cuenta.desde)}
      </p>
    </div>
  );
}
