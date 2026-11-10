// Convierte el cuerpo JSON que manda el Atajo en la fila que se guarda en captura_pendiente.
// Puro (sin red): dos formas de entrada.
//   {"texto": "<cuerpo del correo>"}                                                  -> correo Plin de Interbank
//   {"origen":"wallet","monto":12.5,"comercio":"...","fecha_hora":"<ISO>","tarjeta":"interbank"}  -> Wallet (solo débito Interbank)
import { aCentimos, claveDedupe, claveDedupeSinLeer, parsearCorreoPlin, quitarNumerosDeCuenta, sha256Hex } from './parser.ts';
import { claveDedupeTransferencia, esTransferencia, parsearCorreoTransferencia } from './transferencia.ts';

export type Construido =
  | { ok: true; estado: 'pendiente' | 'sin_leer'; payload: Record<string, unknown> }
  | { ok: false; status: 400 | 422; motivo: string };

const MAX_CENTIMOS = 9_999_999; // la base exige < 10,000,000

const rechazo = (status: 400 | 422, motivo: string): Construido => ({ ok: false, status, motivo });

const AMBIGUO = Symbol('ambiguo');

/** Atajos a veces manda una lista de un solo elemento: [12.5] se lee como 12.5. Una lista de otro largo es ambigua. */
function desenvolver(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return v.length === 1 && !Array.isArray(v[0]) ? v[0] : AMBIGUO;
}

/**
 * El importe de Wallet como llega del Atajo: número (12.5), texto con o sin símbolo ("S/ 12.50", "12,50", "1,234.50",
 * "12.50 PEN") o una lista de un solo valor. Mismas reglas de siempre: se rechaza 0, negativos y desde S/ 100,000.
 * Sin símbolo o con S/ es soles; con US$/USD/$ es dólares (la bandeja pedirá el monto en soles).
 */
export function leerMontoWallet(valor: unknown): { centimos: number; moneda: 'PEN' | 'USD' } | null {
  const v = desenvolver(valor);
  let centimos: number | null = null;
  let moneda: 'PEN' | 'USD' = 'PEN';
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null;
    centimos = Math.round(v * 100);
  } else if (typeof v === 'string') {
    const m = /^\s*(S\/\.?|US\$|USD|PEN|\$)?\s*(-?[\d.,]+)\s*(S\/\.?|US\$|USD|PEN|\$)?\s*$/i.exec(v);
    if (!m || m[2].startsWith('-')) return null;
    const simbolo = (m[1] ?? m[3] ?? '').toUpperCase();
    if (/^(US\$|USD|\$)$/.test(simbolo)) moneda = 'USD';
    centimos = aCentimos(m[2]);
  }
  if (centimos === null || centimos < 1 || centimos > MAX_CENTIMOS) return null;
  return { centimos, moneda };
}

/** Nombre del comercio: texto (o lista de un texto); vacío o ausente no rompe, entra como "Sin nombre". */
export function leerComercio(valor: unknown): string {
  const v = desenvolver(valor);
  const texto = typeof v === 'string' ? quitarNumerosDeCuenta(v).replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  return texto || 'Sin nombre';
}

/**
 * Fecha y hora del Atajo -> instante en ms. ISO con zona ("2026-11-09T21:39:00-05:00", "...Z", "...+00:00", con
 * fracción de segundos, con espacio en vez de T o con la zona pegada "-0500"). Vacía o ausente: la hora actual.
 * Sin zona se toma como hora de Lima. Ilegible (no es ISO válido): null; quien la llama decide qué hacer
 * (Wallet usa la hora actual; el correo Plin tiene su propio lector estricto en parser.ts y no pasa por aquí).
 */
export function leerFechaHora(valor: unknown, ahoraMs: number): number | null {
  const v = desenvolver(valor);
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return ahoraMs;
  if (typeof v !== 'string') return null;
  let t = v.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(?=\d)/, '$1T').replace(/\s+(?=Z$|[+-]\d{2}:?\d{2}$)/i, '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(t)) t += '-05:00';
  // Solo ISO estricto: Date.parse es permisivo y lee "09/11/2026" como el 11 de septiembre, sin avisar.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(t)) return null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  // Un día inexistente (31 de febrero) no se corrige solo: se rechaza.
  const [anio, mes, dia] = t.slice(0, 10).split('-').map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia ? ms : null;
}

export async function construirPayload(cuerpo: unknown, ahoraMs: number = Date.now()): Promise<Construido> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return rechazo(400, 'formato');
  const c = cuerpo as Record<string, unknown>;

  // --- Correo crudo ---
  if (typeof c.texto === 'string') {
    if (c.texto.trim() === '') return rechazo(400, 'texto_vacio');

    // Constancia de transferencia: se guardan los nombres de producto y la app decide qué es (traspaso, ingreso o gasto).
    if (esTransferencia(c.texto)) {
      const t = parsearCorreoTransferencia(c.texto);
      if (t.ok) {
        const x = t.transferencia;
        return {
          ok: true,
          estado: 'pendiente',
          payload: {
            dedupe_key: await claveDedupeTransferencia(x),
            monto_centimos: x.montoCentimos,
            moneda: x.moneda,
            destinatario: null, // el correo no trae destinatario: no se asume uno
            destino: null,
            codigo_operacion: x.codigoOperacion,
            fecha_hora: x.fechaHora,
            cuenta: x.cuentaCargo,
            cuenta_destino: x.cuentaDestino,
            tipo: 'transferencia',
            origen: 'transferencia_correo',
            estado: 'pendiente',
          },
        };
      }
      return {
        ok: true,
        estado: 'sin_leer',
        payload: { dedupe_key: await claveDedupeSinLeer(t.textoLimpio), origen: 'transferencia_correo', estado: 'sin_leer', texto_crudo: t.textoLimpio },
      };
    }

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
    const importe = leerMontoWallet(c.monto);
    if (!importe) return rechazo(400, 'monto');
    const { centimos, moneda } = importe;
    const comercio = leerComercio(c.comercio);
    // Un formato que no es ISO válido (o una fecha imposible) no hace perder la compra: el Atajo corre al pagar, así
    // que la hora actual es casi exacta. En cambio, un ISO válido pero fuera de rango sí es un error del Atajo.
    const ms = leerFechaHora(c.fecha_hora, ahoraMs) ?? ahoraMs;
    if (ms > ahoraMs + 86_400_000 || ms < ahoraMs - 400 * 86_400_000) return rechazo(400, 'fecha_hora');
    const iso = new Date(ms).toISOString();
    return {
      ok: true,
      estado: 'pendiente',
      payload: {
        dedupe_key: `h:${(await sha256Hex(['wallet', centimos, moneda, comercio.toUpperCase(), iso.slice(0, 16)].join('|'))).slice(0, 32)}`,
        monto_centimos: centimos,
        moneda,
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
