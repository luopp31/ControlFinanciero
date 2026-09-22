import type { Compromiso } from '../../lib/db';
import type { Cuenta, Movimiento, Prestamo, TipoPrestamo } from '../../lib/finanzas';

export interface CompromisosViewProps {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  prestamos: Prestamo[];
  suscripciones: Compromiso[];
  crearPrestamo: (
    datos: { persona: string; tipo: TipoPrestamo; capital: number; acordado?: number | null; fecha: string },
    cuentaId: string,
  ) => Promise<unknown>;
  actualizarPrestamo: (
    id: string,
    datos: { persona: string; tipo: TipoPrestamo; capital: number; acordado?: number | null; fecha: string },
  ) => Promise<unknown>;
  borrarPrestamo: (id: string) => void;
  registrarPago: (prestamo: Prestamo, monto: number, cuentaId: string) => Promise<unknown>;
  crearSuscripcion: (datos: { nombre: string; monto: number; diaCobro: number }) => Promise<unknown>;
  actualizarSuscripcion: (id: string, datos: { nombre: string; monto: number; diaCobro: number }) => Promise<unknown>;
  registrarPagoSuscripcion: (suscripcion: Compromiso, monto: number, cuentaId: string) => Promise<unknown>;
  borrarSuscripcion: (id: string) => void;
}
