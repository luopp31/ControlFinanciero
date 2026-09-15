import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { CuentasDesktop } from './Cuentas.desktop';
import { CuentasMobile } from './Cuentas.mobile';

export function Cuentas() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando, crearCuenta } = useCuentas();
  const { movimientos } = useMovimientos();

  if (cargando) return null;

  const props = { cuentas, movimientos, crearCuenta };
  return isDesktop ? <CuentasDesktop {...props} /> : <CuentasMobile {...props} />;
}
