import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { MovimientosDesktop } from './Movimientos.desktop';
import { MovimientosMobile } from './Movimientos.mobile';

export function Movimientos() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const {
    movimientos,
    cargando: cargandoMovs,
    crearMovimiento,
    actualizarMovimiento,
    borrarMovimiento,
  } = useMovimientos();

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

  const props = { cuentas, movimientos, crearMovimiento, actualizarMovimiento, borrarMovimiento };
  return isDesktop ? <MovimientosDesktop {...props} /> : <MovimientosMobile {...props} />;
}
