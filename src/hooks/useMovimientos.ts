import { masRecientePrimero, type Movimiento } from '../lib/finanzas';
import { useStore } from './useStore';

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
