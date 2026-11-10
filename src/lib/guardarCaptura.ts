import { put, type Captura } from './db';
import { avisarCambioDeDatos } from './eventos';
import { programarSyncAutomatico } from './sync';
import type { Clasificada } from './capturas';

/** Guarda en IndexedDB una clasificación (movimiento + captura + regla aprendida) y programa el sync. */
export async function guardarClasificacion(r: Extract<Clasificada, { ok: true }>): Promise<void> {
  await put('movimientos', r.movimiento);
  await put('capturas', r.captura);
  if (r.regla) await put('reglas_categoria', r.regla);
  avisarCambioDeDatos();
  programarSyncAutomatico();
}

/** Guarda una captura cambiada (descartada, o sin la marca de posible duplicado). */
export async function guardarCaptura(c: Captura): Promise<void> {
  await put('capturas', c);
  avisarCambioDeDatos();
  programarSyncAutomatico();
}
