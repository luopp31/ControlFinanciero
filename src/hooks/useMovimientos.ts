import type { Movimiento } from '../lib/finanzas';
import { useStore } from './useStore';

const masRecientePrimero = (a: Movimiento, b: Movimiento) => b.fecha.localeCompare(a.fecha);

export function useMovimientos() {
  const { items, cargando, crear, actualizar, borrar } = useStore<Movimiento>('movimientos', masRecientePrimero);
  return {
    movimientos: items,
    cargando,
    crearMovimiento: crear,
    actualizarMovimiento: actualizar,
    borrarMovimiento: borrar,
  };
}
