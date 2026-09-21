import type { Cuenta, Movimiento, Prestamo } from '../../lib/finanzas';

export interface PanelViewProps {
  nombre: string;
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  prestamos: Prestamo[];
  valorNetoActual: number;
  serie: { fecha: string; valor: number }[];
  recientes: Movimiento[];
}
