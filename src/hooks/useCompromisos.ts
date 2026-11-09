import type { Compromiso } from '../lib/db';
import { useStore } from './useStore';

export function useCompromisos() {
  const { items, cargando, crear, actualizar, borrar } = useStore<Compromiso>('compromisos');
  return {
    compromisos: items,
    cargando,
    crearCompromiso: crear,
    actualizarCompromiso: actualizar,
    borrarCompromiso: borrar,
  };
}
