import type { Cuenta } from '../lib/finanzas';
import { useStore } from './useStore';

export function useCuentas() {
  const { items, cargando, crear, actualizar, borrar } = useStore<Cuenta>('cuentas');
  return { cuentas: items, cargando, crearCuenta: crear, actualizarCuenta: actualizar, borrarCuenta: borrar };
}
