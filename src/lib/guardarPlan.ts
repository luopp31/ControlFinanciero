import { put } from './db';
import { avisarCambioDeDatos } from './eventos';
import { programarSyncAutomatico } from './sync';
import type { Plan } from './planificar';

/** Guarda en IndexedDB todo lo que decidió `planificar` (las filas ya vienen con sincronizado=false) y programa el sync. */
export async function guardarPlan(plan: Plan): Promise<void> {
  if (!plan.listo) throw new Error('El plan tiene filas sin resolver.');
  for (const c of plan.cuentas) await put('cuentas', c);
  for (const m of plan.movimientos) await put('movimientos', m);
  for (const i of plan.ignorados) await put('ignorados', i);
  for (const r of plan.reglas) await put('reglas_categoria', r);
  for (const k of plan.capturas) await put('capturas', k);
  avisarCambioDeDatos();
  programarSyncAutomatico();
}
