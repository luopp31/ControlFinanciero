import type { Cuenta, Movimiento } from '../../lib/finanzas';

export interface MovimientosViewProps {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  mes: string;
  onCambiarMes: (delta: number) => void;
  deshabilitarMesSiguiente: boolean;
  actualizarMovimiento: (id: string, datos: Omit<Movimiento, 'id' | 'borrado'>) => Promise<unknown>;
  borrarMovimiento: (id: string) => void;
}
