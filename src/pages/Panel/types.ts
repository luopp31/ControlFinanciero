import type { Cuenta, Movimiento, Prestamo } from '../../lib/finanzas';

export interface PanelViewProps {
  nombre: string;
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  prestamos: Prestamo[];
  valorNetoActual: number;
  serie: { fecha: string; valor: number }[];
  recientes: Movimiento[];
  gastoMes: number;
  /** 'YYYY-MM' */
  mes: string;
  onAbrirConciliar: () => void;
  onAbrirBandeja: () => void;
  /** Capturas automáticas esperando clasificarse. */
  bandeja: { pendientes: number; sinLeer: number };
}
