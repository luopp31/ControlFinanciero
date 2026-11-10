// Parser puro de la "Constancia de transferencia" de Interbank (cuerpo crudo que manda el Atajo de iOS).
// Misma estructura que el correo Plin (etiquetas y valores en líneas separadas) pero con otras etiquetas, y SIN destinatario.
//
// Reglas:
//  - NUNCA se devuelve ni se guarda el número de cuenta: se descarta al leer ("898 XXXXXXXXXX", "361XXXXXXXXXX", dígitos).
//  - El servidor no sabe qué cuentas tiene el usuario: devuelve los nombres de producto tal cual los escribe el banco
//    ("Millonaria", "Simple", "Ahorro Sueldo"); la app decide si es traspaso, ingreso o gasto.
//  - Un producto en dólares sale como "Simple (USD)" para que no se confunda con la cuenta en soles.
//  - Si el cargo no nombra producto ("Soles 898 …") queda null: no se adivina (ni por el prefijo del número).
//  - Si algo no se puede leer, no se adivina: ok:false con el texto ya limpio.
import { aCentimos, aFechaHoraLima, MAX_CENTIMOS, MAX_TEXTO_LIMPIO, quitarNumerosDeCuenta, sha256Hex, sinTildes } from './parser.ts';

export interface TransferenciaParseada {
  codigoOperacion: string | null;
  /** ISO con la hora de Lima, p. ej. "2026-11-01T08:51:00-05:00". */
  fechaHora: string;
  montoCentimos: number;
  moneda: 'PEN' | 'USD';
  /** Producto de cargo; null si el correo no lo nombra. "(USD)" al final si es en dólares. */
  cuentaCargo: string | null;
  /** Producto de destino; null si el correo no lo nombra. "(USD)" al final si es en dólares. */
  cuentaDestino: string | null;
}

export type ResultadoTransferencia =
  | { ok: true; transferencia: TransferenciaParseada }
  | { ok: false; motivo: string; textoLimpio: string };

export const esTransferencia = (texto: string) => /constancia de transferencia/i.test(sinTildes(texto));

const ETIQUETAS = {
  codigo: /^c[oó]digo de operaci[oó]n\b/i,
  fecha: /^fecha y hora\b/i,
  cargo: /^cuenta cargo\b/i,
  destino: /^cuenta destino\b/i,
  monto: /^(?:moneda y monto|monto y moneda|monto)\b/i,
};
const esEtiqueta = (l: string) => Object.values(ETIQUETAS).some((re) => re.test(l));

// Formato viejo: varias etiquetas en una sola línea ("Cuenta cargo: … Cuenta destino: …"). Se parte antes de cada una.
const ANTES_DE_ETIQUETA = /[ \t]*\.?[ \t]+(?=(?:C[oó]digo de operaci[oó]n|Fecha y hora|Cuenta cargo|Cuenta destino|Moneda y monto|Monto y moneda)\b)/gi;

/** Valor de una etiqueta que puede ocupar varias líneas: lo que sigue en la suya y las siguientes hasta otra etiqueta (máx. 4). */
function valorVarias(lineas: string[], re: RegExp, max = 4): string | null {
  const i = lineas.findIndex((l) => re.test(l));
  if (i < 0) return null;
  const partes = [lineas[i].replace(re, '').replace(/^\s*[:\-–]?\s*/, '').trim()];
  for (let j = i + 1; j < lineas.length && j <= i + max; j++) {
    if (esEtiqueta(lineas[j])) break;
    partes.push(lineas[j]);
  }
  return partes.filter(Boolean).join(' ') || null;
}

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * "Millonaria Soles 898 XXXXXXXXXX" -> Millonaria / PEN. "Cuenta Simple Soles 361…" -> Simple / PEN.
 * "Soles 898 …" (sin producto) -> null / PEN. El número que acompaña se ignora.
 */
export function leerProducto(texto: string | null): { producto: string | null; moneda: 'PEN' | 'USD' | null } {
  if (!texto) return { producto: null, moneda: null };
  const m = /\b(soles|d[oó]lares)\b/i.exec(texto);
  const antes = m ? texto.slice(0, m.index) : texto;
  const producto = antes
    .replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s]/g, ' ') // fuera dígitos, máscaras y signos
    .replace(/^\s*cuenta\b/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return { producto: producto ? titulo(producto) : null, moneda: m ? (m[1].toLowerCase() === 'soles' ? 'PEN' : 'USD') : null };
}

const nombreDeCuenta = (p: { producto: string | null; moneda: 'PEN' | 'USD' | null }) => (p.producto ? (p.moneda === 'USD' ? `${p.producto} (USD)` : p.producto) : null);

/** Lee una "Constancia de transferencia". Si no es de ese tipo o falta algo, ok:false con el texto limpio. */
export function parsearCorreoTransferencia(texto: string): ResultadoTransferencia {
  const normal = texto.replace(/\r\n?/g, '\n').replace(/[ ​]/g, ' ').replace(ANTES_DE_ETIQUETA, '\n');
  const textoLimpio = quitarNumerosDeCuenta(normal).slice(0, MAX_TEXTO_LIMPIO);
  const fallo = (motivo: string): ResultadoTransferencia => ({ ok: false, motivo, textoLimpio });

  if (!esTransferencia(texto)) return fallo('No es una "Constancia de transferencia".');

  const lineas = normal
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const fechaTxt = valorVarias(lineas, ETIQUETAS.fecha);
  const montoTxt = valorVarias(lineas, ETIQUETAS.monto);
  const cargoTxt = valorVarias(lineas, ETIQUETAS.cargo);
  const destinoTxt = valorVarias(lineas, ETIQUETAS.destino);
  if (!fechaTxt) return fallo('Falta "Fecha y hora".');
  if (!montoTxt) return fallo('Falta "Moneda y monto".');
  if (cargoTxt === null) return fallo('Falta "Cuenta cargo".');
  if (destinoTxt === null) return fallo('Falta "Cuenta destino".');

  const fechaHora = aFechaHoraLima(fechaTxt);
  if (!fechaHora) return fallo('No pude leer la fecha y hora.');

  const mm = /(S\/|US\$|USD|PEN|\$)\s*([\d.,]+)|([\d.,]+)\s*(S\/|US\$|USD|PEN|\$)/i.exec(montoTxt);
  const simbolo = (mm?.[1] ?? mm?.[4] ?? '').toUpperCase();
  const montoCentimos = mm ? aCentimos(mm[2] ?? mm[3]) : null;
  if (montoCentimos === null || montoCentimos <= 0) return fallo('No pude leer el monto.');
  if (montoCentimos > MAX_CENTIMOS) return fallo('Monto fuera de rango.');
  const moneda: 'PEN' | 'USD' = simbolo === 'S/' || simbolo === 'PEN' ? 'PEN' : 'USD';

  const cuentaCargo = nombreDeCuenta(leerProducto(cargoTxt));
  const cuentaDestino = nombreDeCuenta(leerProducto(destinoTxt));
  // Sin ningún producto no hay con qué decidir qué es: se deja para revisar a mano.
  if (!cuentaCargo && !cuentaDestino) return fallo('No pude identificar las cuentas de la transferencia.');

  const codigo = valorVarias(lineas, ETIQUETAS.codigo)?.match(/[A-Za-z0-9]{4,20}/)?.[0] ?? null;
  return { ok: true, transferencia: { codigoOperacion: codigo, fechaHora, montoCentimos, moneda, cuentaCargo, cuentaDestino } };
}

/** Clave de idempotencia: "tr:<código>" (nunca "op:", para que no choque con un Plin); sin código, un hash. */
export async function claveDedupeTransferencia(t: TransferenciaParseada): Promise<string> {
  if (t.codigoOperacion) return `tr:${t.codigoOperacion}`;
  const base = ['transferencia', t.montoCentimos, t.moneda, t.cuentaCargo ?? '', t.cuentaDestino ?? '', t.fechaHora.slice(0, 16)].join('|');
  return `t:${(await sha256Hex(base)).slice(0, 32)}`;
}
