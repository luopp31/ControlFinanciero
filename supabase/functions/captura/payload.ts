// Convierte el cuerpo JSON que manda el Atajo en la fila que se guarda en captura_pendiente.
// Puro (sin red): dos formas de entrada.
//   {"texto": "<cuerpo del correo>"}                                                  -> correo Plin de Interbank
//   {"origen":"wallet","monto":12.5,"comercio":"...","fecha_hora":"<ISO>","tarjeta":"interbank"}  -> Wallet (solo débito Interbank)
import { claveDedupe, claveDedupeSinLeer, parsearCorreoPlin, quitarNumerosDeCuenta, sha256Hex } from './parser.ts';

export type Construido =
  | { ok: true; estado: 'pendiente' | 'sin_leer'; payload: Record<string, unknown> }
  | { ok: false; status: 400 | 422; motivo: string };

const MAX_CENTIMOS = 9_999_999; // la base exige < 10,000,000

const rechazo = (status: 400 | 422, motivo: string): Construido => ({ ok: false, status, motivo });

export async function construirPayload(cuerpo: unknown, ahoraMs: number = Date.now()): Promise<Construido> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return rechazo(400, 'formato');
  const c = cuerpo as Record<string, unknown>;

  // --- Correo crudo ---
  if (typeof c.texto === 'string') {
    if (c.texto.trim() === '') return rechazo(400, 'texto_vacio');
    const r = parsearCorreoPlin(c.texto);
    if (r.ok) {
      const x = r.captura;
      return {
        ok: true,
        estado: 'pendiente',
        payload: {
          dedupe_key: await claveDedupe(x),
          monto_centimos: x.montoCentimos,
          moneda: x.moneda,
          destinatario: x.destinatario,
          destino: x.destino,
          codigo_operacion: x.codigoOperacion,
          fecha_hora: x.fechaHora,
          cuenta: x.cuenta,
          origen: 'plin_correo',
          estado: 'pendiente',
        },
      };
    }
    // No se pudo leer: se guarda sin el número de cuenta para que se pueda revisar y pasar otro formato.
    return {
      ok: true,
      estado: 'sin_leer',
      payload: { dedupe_key: await claveDedupeSinLeer(r.textoLimpio), origen: 'plin_correo', estado: 'sin_leer', texto_crudo: r.textoLimpio },
    };
  }

  // --- Wallet ---
  if (c.origen === 'wallet') {
    if (c.tarjeta !== undefined && String(c.tarjeta).toLowerCase() !== 'interbank') return rechazo(422, 'tarjeta_no_soportada');
    if (typeof c.monto !== 'number' || !Number.isFinite(c.monto) || c.monto <= 0) return rechazo(400, 'monto');
    const centimos = Math.round(c.monto * 100);
    if (centimos < 1 || centimos > MAX_CENTIMOS) return rechazo(400, 'monto');
    if (typeof c.comercio !== 'string') return rechazo(400, 'comercio');
    const comercio = quitarNumerosDeCuenta(c.comercio).replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!comercio) return rechazo(400, 'comercio');
    if (typeof c.fecha_hora !== 'string') return rechazo(400, 'fecha_hora');
    const ms = Date.parse(c.fecha_hora);
    // Con huso horario explícito (-05:00 o Z); más allá de un día en el futuro o 400 días atrás es un error del Atajo.
    if (!Number.isFinite(ms) || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(c.fecha_hora.trim()) || ms > ahoraMs + 86_400_000 || ms < ahoraMs - 400 * 86_400_000) {
      return rechazo(400, 'fecha_hora');
    }
    const iso = new Date(ms).toISOString();
    return {
      ok: true,
      estado: 'pendiente',
      payload: {
        dedupe_key: `h:${(await sha256Hex(['wallet', centimos, comercio.toUpperCase(), iso.slice(0, 16)].join('|'))).slice(0, 32)}`,
        monto_centimos: centimos,
        moneda: 'PEN',
        destinatario: comercio, // en Wallet es el comercio
        destino: null,
        codigo_operacion: null,
        fecha_hora: iso,
        cuenta: null, // se elige al clasificar (Simple por defecto)
        origen: 'wallet',
        estado: 'pendiente',
      },
    };
  }

  return rechazo(400, 'formato');
}
