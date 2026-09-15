// Bus mínimo para que los distintos hooks (useCuentas, useMovimientos, etc.)
// se enteren cuando otro cambia algo — sin esto, dos pantallas montadas a la vez
// (ej. un botón "+" flotante y la lista de Movimientos) podían desincronizarse:
// cada una tenía su propia copia de los datos leída de IndexedDB al montarse.

type Escuchador = () => void;

const escuchadores = new Set<Escuchador>();

export function avisarCambioDeDatos(): void {
  escuchadores.forEach((fn) => fn());
}

export function suscribirCambiosDeDatos(fn: Escuchador): () => void {
  escuchadores.add(fn);
  return () => escuchadores.delete(fn);
}
