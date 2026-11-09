import type { ReglaCategoria } from '../lib/db';
import { useStore } from './useStore';

/** Diccionario de categorías aprendidas por el Conciliar. Usar `reglasVigentes` (clasificador.ts) para leerlo sin duplicados. */
export function useReglas() {
  const { items, cargando, crear, actualizar, borrar } = useStore<ReglaCategoria>('reglas_categoria');
  return { reglas: items, cargando, crearRegla: crear, actualizarRegla: actualizar, borrarRegla: borrar };
}
