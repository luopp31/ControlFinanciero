// Parser puro del correo "Constancia de Pago Plin" de Interbank (cuerpo crudo que manda el Atajo de iOS).
// Sin IO ni dependencias de Deno: solo `crypto.subtle`, que existe en Deno y en Node. Se prueba con vitest.
//
// Reglas:
//  - NUNCA se devuelve ni se guarda el número de cuenta ni de tarjeta: se descarta al leer y se limpia
//    también el texto que se guarda cuando el correo no se puede leer ("sin_leer").
//  - Las etiquetas pueden venir en la misma línea que su valor ("Destino: Plin") o en líneas separadas.
//  - Si algo no se puede leer, no se adivina: se devuelve ok:false con el texto ya limpio.

export interface CapturaParseada {
  codigoOperacion: string | null;
  /** ISO con la hora de Lima, p. ej. "2026-11-09T21:39:00-05:00". */
  fechaHora: string;
  /** Nombre de la cuenta como lo escribe el banco ("Simple", "Millonaria"), sin número. */
  cuenta: string | null;
  destinatario: string;
  destino: 'Plin' | 'Yape' | null;
  montoCentimos: number;
  moneda: 'PEN' | 'USD';
}

export type ResultadoCorreo =
  | { ok: true; captura: CapturaParseada }
  | { ok: false; motivo: string; textoLimpio: string };

const MESES: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12 };

/** Lo más que se acepta como monto: la base lo limita a menos de S/ 100,000. */
const MAX_CENTIMOS = 9_999_999;
const MAX_TEXTO_LIMPIO = 8000;

/** Quita números de cuenta y de tarjeta (9 o más dígitos seguidos, con espacios o guiones, y máscaras tipo "**** 1234"). */
export function quitarNumerosDeCuenta(texto: string): string {
  return texto
    .replace(/(?:\*{2,}|[xX•●]{2,})[ -]?\d{2,4}/g, '[tarjeta]')
    .replace(/\d(?:[ -]?\d){8,}/g, '[número]');
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

const ETIQUETAS = {
  codigo: /^c[oó]digo de operaci[oó]n\b/i,
  fecha: /^fecha y hora\b/i,
  cuenta: /^cuenta cargo\b/i,
  destinatario: /^destinatario\b/i,
  destino: /^destino\b/i,
  monto: /^monto( y moneda)?\b/i,
};

const esEtiqueta = (l: string) => Object.values(ETIQUETAS).some((re) => re.test(l));

/** Valor de una etiqueta: lo que sigue en su misma línea o, si no hay nada, la línea siguiente. */
function valor(lineas: string[], re: RegExp): string | null {
  const i = lineas.findIndex((l) => re.test(l));
  if (i < 0) return null;
  const resto = lineas[i].replace(re, '').replace(/^\s*[:\-–]?\s*/, '').trim();
  if (resto) return resto;
  const sig = lineas[i + 1];
  return sig && !esEtiqueta(sig) ? sig.trim() : null;
}

/** "1,234.50" | "12.5" | "12,50" | "1.234,50" -> céntimos enteros; null si no es un monto. */
function aCentimos(texto: string): number | null {
  const t = texto.replace(/\s/g, '');
  let normal: string;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) normal = t.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) normal = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(t)) normal = t.replace(',', '.');
  else if (/^\d+(\.\d{1,2})?$/.test(t)) normal = t;
  else return null;
  const [ent, dec = ''] = normal.split('.');
  return Number(ent) * 100 + Number(dec.padEnd(2, '0'));
}

/** "09 Nov 2026 09:39 PM" (o 24 h sin AM/PM) -> "2026-11-09T21:39:00-05:00". */
function aFechaHoraLima(texto: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-zñÑáéíóúÁÉÍÓÚ]{3,4})\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?\s*[Mm]\.?)?/.exec(texto);
  if (!m) return null;
  const mes = MESES[sinTildes(m[2]).toLowerCase()];
  if (!mes) return null;
  const dia = Number(m[1]);
  const anio = Number(m[3]);
  let hora = Number(m[4]);
  const min = Number(m[5]);
  if (m[6]) {
    if (hora < 1 || hora > 12) return null;
    hora = (hora % 12) + (m[6].toLowerCase() === 'p' ? 12 : 0);
  }
  if (hora > 23 || min > 59) return null;
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${anio}-${p(mes)}-${p(dia)}T${p(hora)}:${p(min)}:00-05:00`;
}

/** Lee un correo "Constancia de Pago Plin". Si no es de ese tipo o falta algo, ok:false con el texto limpio. */
export function parsearCorreoPlin(texto: string): ResultadoCorreo {
  const limpio = quitarNumerosDeCuenta(texto.replace(/\r\n?/g, '\n').replace(/[ ​]/g, ' ')).slice(0, MAX_TEXTO_LIMPIO);
  const fallo = (motivo: string): ResultadoCorreo => ({ ok: false, motivo, textoLimpio: limpio });

  const lineas = texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ ​]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!/constancia de pago plin/i.test(sinTildes(lineas.join(' ')))) return fallo('No es una "Constancia de Pago Plin".');

  const fechaTxt = valor(lineas, ETIQUETAS.fecha);
  const montoTxt = valor(lineas, ETIQUETAS.monto);
  const destinatarioTxt = valor(lineas, ETIQUETAS.destinatario);
  if (!fechaTxt) return fallo('Falta "Fecha y hora".');
  if (!montoTxt) return fallo('Falta "Monto y moneda".');
  if (!destinatarioTxt) return fallo('Falta "Destinatario".');

  const fechaHora = aFechaHoraLima(fechaTxt);
  if (!fechaHora) return fallo('No pude leer la fecha y hora.');

  const mm = /(S\/|US\$|USD|PEN|\$)\s*([\d.,]+)|([\d.,]+)\s*(S\/|US\$|USD|PEN|\$)/i.exec(montoTxt);
  const simbolo = (mm?.[1] ?? mm?.[4] ?? '').toUpperCase();
  const montoCentimos = mm ? aCentimos(mm[2] ?? mm[3]) : null;
  if (montoCentimos === null || montoCentimos <= 0) return fallo('No pude leer el monto.');
  if (montoCentimos > MAX_CENTIMOS) return fallo('Monto fuera de rango.');
  const moneda: 'PEN' | 'USD' = simbolo === 'S/' || simbolo === 'PEN' ? 'PEN' : 'USD';

  const codigo = valor(lineas, ETIQUETAS.codigo)?.match(/[A-Za-z0-9]{4,20}/)?.[0] ?? null;

  const cuentaTxt = valor(lineas, ETIQUETAS.cuenta);
  const cuenta = cuentaTxt ? (/cuenta\s+(.+?)\s+(?:soles|d[oó]lares)\b/i.exec(cuentaTxt)?.[1]?.trim() ?? null) : null;

  const destinoTxt = valor(lineas, ETIQUETAS.destino);
  const destino = destinoTxt && /plin/i.test(destinoTxt) ? 'Plin' : destinoTxt && /yape/i.test(destinoTxt) ? 'Yape' : null;

  const destinatario = destinatarioTxt.replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!destinatario) return fallo('Falta el nombre del destinatario.');

  return { ok: true, captura: { codigoOperacion: codigo, fechaHora, cuenta, destinatario, destino, montoCentimos, moneda } };
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Clave de idempotencia: el código de operación si hay; si no, hash de monto + destinatario + minuto. */
export async function claveDedupe(c: CapturaParseada): Promise<string> {
  if (c.codigoOperacion) return `op:${c.codigoOperacion}`;
  const base = [c.montoCentimos, c.moneda, c.destinatario.toUpperCase().replace(/\s+/g, ' '), c.fechaHora.slice(0, 16)].join('|');
  return `h:${(await sha256Hex(base)).slice(0, 32)}`;
}

/** Clave para un correo que no se pudo leer: dos envíos del mismo texto no se duplican. */
export async function claveDedupeSinLeer(textoLimpio: string): Promise<string> {
  return `s:${(await sha256Hex(textoLimpio.replace(/\s+/g, ' ').trim())).slice(0, 32)}`;
}
