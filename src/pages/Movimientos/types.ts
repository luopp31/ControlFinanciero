import type { Cuenta, Movimiento } from '../../lib/finanzas';

export interface MovimientosViewProps {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  crearMovimiento: (datos: Omit<Movimiento, 'id' | 'borrado'>) => Promise<unknown>;
  actualizarMovimiento: (id: string, datos: Omit<Movimiento, 'id' | 'borrado'>) => Promise<unknown>;
  borrarMovimiento: (id: string) => void;
}
