import { saldo, type Cuenta, type Movimiento } from '../lib/finanzas';
import { formatearInstanteLima, formatearMontoOcultable } from '../lib/formato';
import { IconBank, IconWallet } from './icons';

/** Una cuenta como fila: ícono, nombre, estado de conciliación y saldo. */
export function CuentaFila({ cuenta, movimientos, oculto, conCaption = false }: { cuenta: Cuenta; movimientos: Movimiento[]; oculto: boolean; conCaption?: boolean }) {
  const monto = saldo(cuenta, movimientos);
  const Icono = cuenta.rol === 'BOVEDA' ? IconBank : IconWallet;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: conCaption ? 72 : 62 }}>
      <span style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icono width={21} height={21} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.015em' }}>{cuenta.nombre}</div>
        {conCaption && (
          <div style={{ fontSize: 13, color: 'var(--muted-fg)' }}>
            {cuenta.rol === 'BOVEDA' ? 'Bóveda' : 'Billetera'} · {cuenta.conciliadoHasta ? `cuadra hasta ${formatearInstanteLima(cuenta.conciliadoHasta)}` : 'sin conciliar'}
          </div>
        )}
      </div>
      <div style={{ fontSize: 16.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em', color: monto < 0 ? 'var(--destructive)' : undefined }}>
        {monto < 0 ? '− ' : ''}S/ {formatearMontoOcultable(Math.abs(monto), oculto)}
      </div>
    </div>
  );
}
