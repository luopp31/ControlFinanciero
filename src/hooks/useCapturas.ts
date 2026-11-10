import type { Captura } from '../lib/db';
import { useStore } from './useStore';

/** Bandeja de la captura automática. Usar `resumenBandeja` (lib/capturas) para separar pendientes y sin_leer. */
export function useCapturas() {
  const { items, cargando, actualizar } = useStore<Captura>('capturas');
  return { capturas: items, cargando, actualizarCaptura: actualizar };
}
