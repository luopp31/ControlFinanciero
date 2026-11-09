import type { Ignorado } from '../lib/db';
import { useStore } from './useStore';

/** Filas del banco marcadas "ignorar": el Conciliar no las vuelve a proponer. */
export function useIgnorados() {
  const { items, cargando, crear, actualizar, borrar } = useStore<Ignorado>('ignorados');
  return { ignorados: items, cargando, crearIgnorado: crear, actualizarIgnorado: actualizar, borrarIgnorado: borrar };
}
