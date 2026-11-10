// Edge Function "captura": recibe lo que manda el Atajo de iOS y lo deja en captura_pendiente.
// Desplegar SIN verificación de JWT (Atajos no puede mandar uno; la protección es la clave en x-captura-key):
//   npx supabase functions deploy captura --no-verify-jwt
// Secretos (nunca en el repo):  CAPTURA_KEY, CAPTURA_USUARIO  (y CAPTURA_KEY_ANTERIOR al rotar).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los provee Supabase solo.
import { manejar, type Registrar } from './manejar.ts';

declare const Deno: {
  env: { get(nombre: string): string | undefined };
  serve(manejador: (req: Request) => Response | Promise<Response>): unknown;
};

const entorno = {
  CAPTURA_KEY: Deno.env.get('CAPTURA_KEY'),
  CAPTURA_KEY_ANTERIOR: Deno.env.get('CAPTURA_KEY_ANTERIOR'),
  CAPTURA_USUARIO: Deno.env.get('CAPTURA_USUARIO'),
};

// La única operación contra la base: llamar a captura_registrar (insertar con límite de ritmo e idempotencia).
const registrar: Registrar = async (payload) => {
  const url = Deno.env.get('SUPABASE_URL');
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !clave) throw new Error('sin configuración de Supabase');
  const r = await fetch(`${url}/rest/v1/rpc/captura_registrar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: clave, authorization: `Bearer ${clave}` },
    body: JSON.stringify({ p: payload, p_usuario: entorno.CAPTURA_USUARIO }),
    signal: AbortSignal.timeout(8000),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
};

Deno.serve((req) => manejar(req, entorno, registrar));
