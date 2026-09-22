import type { Compromiso } from '../../lib/db';
import type { Cuenta, Movimiento, Prestamo, TipoPrestamo } from '../../lib/finanzas';

export interface CompromisosViewProps {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  prestamos: Prestamo[];
  suscripciones: Compromiso[];
  crearPrestamo: (
    datos: { persona: string; tipo: TipoPrestamo; capital: number; fecha: string },
    cuentaId: string,
  ) => Promise<unknown>;
  actualizarPrestamo: (id: string, datos: { persona: string; tipo: TipoPrestamo; capital: number; fecha: string }) => Promise<unknown>;
  borrarPrestamo: (id: string) => void;
  registrarPago: (prestamo: Prestamo, monto: number, cuentaId: string) => Promise<unknown>;
  crearSuscripcion: (datos: { nombre: string; monto: number; diaCobro: number }) => Promise<unknown>;
  borrarSuscripcion: (id: string) => void;
}
