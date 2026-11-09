import type { Prestamo } from '../lib/finanzas';
import { useStore } from './useStore';

export function usePrestamos() {
  const { items, cargando, crear, actualizar, borrar } = useStore<Prestamo>('prestamos');
  return { prestamos: items, cargando, crearPrestamo: crear, actualizarPrestamo: actualizar, borrarPrestamo: borrar };
}
