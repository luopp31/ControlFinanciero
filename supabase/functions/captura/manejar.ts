// Manejador HTTP de la Edge Function "captura". Sin Deno ni red directa: recibe el entorno y la función que
// escribe (captura_registrar), así se prueba entero con vitest.
//
// Seguridad:
//  - Solo POST. La clave llega en la cabecera x-captura-key y se compara en tiempo constante. Se aceptan dos
//    claves a la vez (CAPTURA_KEY y CAPTURA_KEY_ANTERIOR) para poder rotarla sin cortar el Atajo.
//  - Todo fallo de autenticación responde igual (401, sin pistas) y NO toca la base ni lee el cuerpo.
//  - Cuerpo de a lo más 16 KB. Límite de ritmo: dentro de captura_registrar (20 por minuto, 300 por día).
//  - Solo inserta (una sola función SQL). Nunca devuelve ni registra el contenido recibido.
import { construirPayload } from './payload.ts';

export interface Entorno {
  CAPTURA_KEY?: string;
  CAPTURA_KEY_ANTERIOR?: string;
  CAPTURA_USUARIO?: string;
}

export type Registrar = (payload: Record<string, unknown>) => Promise<{ status: number; cuerpo: unknown }>;

export const MAX_CUERPO = 16 * 1024;
const MIN_LARGO_CLAVE = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, cuerpo: Record<string, unknown>, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

/** Comparación sin atajos: tarda lo mismo acierte donde acierte. */
export function compararConstante(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

export function claveValida(recibida: string | null, env: Entorno): boolean {
  if (!recibida) return false;
  let ok = false;
  for (const k of [env.CAPTURA_KEY, env.CAPTURA_KEY_ANTERIOR]) {
    if (k && k.length >= MIN_LARGO_CLAVE && compararConstante(recibida, k)) ok = true; // sin cortocircuito
  }
  return ok;
}

/** Lee el cuerpo sin pasar del tope (aunque no venga content-length). null = demasiado grande. */
async function leerCuerpoLimitado(req: Request, max: number): Promise<string | null> {
  const declarado = Number(req.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > max) return null;
  if (!req.body) return '';
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel();
      return null;
    }
    partes.push(value);
  }
  const todo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    todo.set(p, pos);
    pos += p.byteLength;
  }
  return new TextDecoder().decode(todo);
}

export async function manejar(req: Request, env: Entorno, registrar: Registrar): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, motivo: 'metodo' }, { allow: 'POST' });

  // Mal configurada: se dice sin revelar qué falta.
  if (!env.CAPTURA_KEY || env.CAPTURA_KEY.length < MIN_LARGO_CLAVE || !env.CAPTURA_USUARIO || !UUID.test(env.CAPTURA_USUARIO)) {
    return json(500, { ok: false, motivo: 'configuracion' });
  }

  if (!claveValida(req.headers.get('x-captura-key'), env)) return json(401, { ok: false });

  const bruto = await leerCuerpoLimitado(req, MAX_CUERPO);
  if (bruto === null) return json(413, { ok: false, motivo: 'cuerpo_grande' });

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(bruto);
  } catch {
    return json(400, { ok: false, motivo: 'json' });
  }

  const c = await construirPayload(cuerpo);
  if (!c.ok) return json(c.status, { ok: false, motivo: c.motivo });

  let r: { status: number; cuerpo: unknown };
  try {
    r = await registrar(c.payload);
  } catch {
    return json(502, { ok: false, motivo: 'error' });
  }
  const res = r.cuerpo as { ok?: boolean; creado?: boolean; motivo?: string } | null;
  if (r.status >= 200 && r.status < 300 && res?.ok === true) return json(200, { ok: true, creado: !!res.creado, estado: c.estado });
  if (r.status >= 200 && r.status < 300 && res?.ok === false && res.motivo === 'limite') return json(429, { ok: false, motivo: 'limite' });
  return json(502, { ok: false, motivo: 'error' });
}
