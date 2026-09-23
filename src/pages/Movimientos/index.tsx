import { useMemo, useState } from 'react';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { mesActualISO, sumarMeses } from '../../lib/fecha';
import { MovimientosDesktop } from './Movimientos.desktop';
import { MovimientosMobile } from './Movimientos.mobile';

export function Movimientos() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs, actualizarMovimiento, borrarMovimiento } = useMovimientos();
  const [mes, setMes] = useState(() => mesActualISO());

  const movimientosDelMes = useMemo(() => movimientos.filter((m) => m.fecha.startsWith(mes)), [movimientos, mes]);

  if (cargandoCuentas || cargandoMovs) return null;

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: 32, maxWidth: 480 }}>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)' }}>
          Primero crea al menos una cuenta en "Cuentas" para poder registrar movimientos.
        </p>
      </div>
    );
  }

  const props = {
    cuentas,
    movimientos: movimientosDelMes,
    mes,
    onCambiarMes: (delta: number) => setMes((m) => sumarMeses(m, delta)),
    deshabilitarMesSiguiente: mes >= mesActualISO(),
    actualizarMovimiento,
    borrarMovimiento,
  };
  return isDesktop ? <MovimientosDesktop {...props} /> : <MovimientosMobile {...props} />;
}
