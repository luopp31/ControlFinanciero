import type { Cuenta, Movimiento, RolCuenta } from '../../lib/finanzas';

export interface CuentasViewProps {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  crearCuenta: (datos: { nombre: string; rol: RolCuenta; saldoInicial: number; desde: string }) => Promise<unknown>;
}
