// Clasificador de filas del banco + diccionario de categorías aprendidas.
// Lógica pura (sin IO ni Date.now()): el id y la hora se reciben como parámetros.
import type { ReglaCategoria } from './db';
import type { TipoMovimiento } from './finanzas';

export type Clase = 'PERSONA' | 'COMERCIO' | 'TRANSFERENCIA' | 'RETIRO' | 'INTERES' | 'PAGO_TC';

/** Cuántas veces hay que confirmar a una persona con la misma categoría para que sea automática. */
export const CONFIRMACIONES_PERSONA = 2;

/** Tipo de fila según su descriptor. Todo lo que no es especial es una compra con tarjeta/QR: COMERCIO. */
export function clasificarDescriptor(descriptor: string): Clase {
  const d = descriptor.trim().toUpperCase();
  if (/^(YAPE|PLIN)-/.test(d)) return 'PERSONA';
  if (/^TRANSF/.test(d)) return 'TRANSFERENCIA';
  if (d.startsWith('RETIRO CAJERO')) return 'RETIRO';
  if (d.startsWith('INTERES')) return 'INTERES';
  if (d.startsWith('PAGO MI TC')) return 'PAGO_TC';
  return 'COMERCIO';
}

/** Clave del diccionario: mayúsculas, sin dígitos ni signos sobrantes al final. */
export function normalizarClave(descriptor: string): string {
  return descriptor
    .toUpperCase()
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s*\-]+$/, '')
    .trim();
}

const palabras = (clave: string) => clave.split(/\s+/).filter(Boolean);

/** Palabras iniciales en común entre dos claves. */
function prefijoComun(a: string, b: string): number {
  const x = palabras(a);
  const y = palabras(b);
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}

/** Reglas vivas, sin duplicados: si dos dispositivos crearon la misma clave, queda la más nueva. */
export function reglasVigentes(reglas: ReglaCategoria[]): ReglaCategoria[] {
  const porClave = new Map<string, ReglaCategoria>();
  for (const r of reglas) {
    if (r.borrado) continue;
    const k = `${r.tipo}|${r.clave}`;
    const previa = porClave.get(k);
    if (!previa || (r.actualizado ?? '') > (previa.actualizado ?? '') || ((r.actualizado ?? '') === (previa.actualizado ?? '') && r.vecesConfirmada > previa.vecesConfirmada)) {
      porClave.set(k, r);
    }
  }
  return [...porClave.values()];
}

/**
 * Regla que aplica a un descriptor. Personas: solo clave exacta (nombres cortados, no se agrupan).
 * Comercios: clave exacta, o la de más palabras iniciales en común (mínimo 2, o 1 si la clave
 * es de una sola palabra) para absorber sucursales ("SUPERM METRO SN FELIPE" ~ "SUPERM METRO MIRAFLORES").
 */
export function buscarRegla(descriptor: string, clase: 'PERSONA' | 'COMERCIO', reglas: ReglaCategoria[]): ReglaCategoria | undefined {
  const clave = normalizarClave(descriptor);
  const candidatas = reglasVigentes(reglas).filter((r) => r.tipo === clase);
  const exacta = candidatas.find((r) => r.clave === clave);
  if (exacta || clase === 'PERSONA') return exacta;
  let mejor: { r: ReglaCategoria; n: number } | undefined;
  for (const r of candidatas) {
    const n = prefijoComun(r.clave, clave);
    if (n === 0 || n < Math.min(2, palabras(r.clave).length, palabras(clave).length)) continue;
    if (!mejor || n > mejor.n || (n === mejor.n && r.vecesConfirmada > mejor.r.vecesConfirmada)) mejor = { r, n };
  }
  return mejor?.r;
}

/** ¿Se aplica sola, sin tocar nada? Comercios sí; personas tras 2 confirmaciones. */
export function esAutomatica(regla: ReglaCategoria): boolean {
  return regla.tipo === 'COMERCIO' || regla.vecesConfirmada >= CONFIRMACIONES_PERSONA;
}

/**
 * Registra una clasificación confirmada por el usuario. Devuelve la fila a guardar:
 * misma categoría que la regla = +1 confirmación; otra categoría = la reemplaza y reinicia en 1.
 */
export function aprenderRegla(
  existente: ReglaCategoria | undefined,
  descriptor: string,
  clase: 'PERSONA' | 'COMERCIO',
  categoria: string,
  nuevoId: string,
  ahora: string
): ReglaCategoria {
  if (existente) {
    const igual = existente.categoria === categoria;
    return { ...existente, categoria, vecesConfirmada: igual ? existente.vecesConfirmada + 1 : 1, borrado: false, actualizado: ahora, sincronizado: false };
  }
  return { id: nuevoId, clave: normalizarClave(descriptor), tipo: clase, categoria, vecesConfirmada: 1, borrado: false, actualizado: ahora, sincronizado: false };
}

/**
 * Siembra el diccionario con filas que ya estaban en Greedy (descriptor del banco + categoría del
 * movimiento emparejado). Solo crea reglas que no existen, con veces_confirmada = 1; si una clave
 * aparece con varias categorías gana la más frecuente. No toca reglas existentes.
 */
export function sembrarReglas(
  pares: { descriptor: string; categoria: string | null | undefined }[],
  reglas: ReglaCategoria[],
  nuevoId: () => string,
  ahora: string
): ReglaCategoria[] {
  const vivas = reglasVigentes(reglas);
  const conteo = new Map<string, { clase: 'PERSONA' | 'COMERCIO'; clave: string; cats: Map<string, number> }>();
  for (const p of pares) {
    const clase = clasificarDescriptor(p.descriptor);
    if ((clase !== 'PERSONA' && clase !== 'COMERCIO') || !p.categoria) continue;
    const clave = normalizarClave(p.descriptor);
    if (!clave || vivas.some((r) => r.tipo === clase && r.clave === clave)) continue;
    const k = `${clase}|${clave}`;
    const e = conteo.get(k) ?? { clase, clave, cats: new Map() };
    e.cats.set(p.categoria, (e.cats.get(p.categoria) ?? 0) + 1);
    conteo.set(k, e);
  }
  return [...conteo.values()].map((e) => {
    const [categoria] = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0];
    return { id: nuevoId(), clave: e.clave, tipo: e.clase, categoria, vecesConfirmada: 1, borrado: false, actualizado: ahora, sincronizado: false };
  });
}

// --- Propuesta para una fila ---

export type EstadoPropuesta =
  | 'AUTO' // se carga sola
  | 'CONFIRMAR' // viene rellenada, necesita un toque
  | 'PREGUNTAR' // hay que elegir qué es (opciones)
  | 'CLASIFICAR'; // a la cola "por clasificar"

export interface OpcionPregunta {
  id: 'ENTRE_CUENTAS' | 'INGRESO_SUELDO' | 'PAGO_DOLARES' | 'OTRO' | 'INGRESO' | 'REEMBOLSO';
  nombre: string;
}

export interface Propuesta {
  clase: Clase;
  clave: string;
  estado: EstadoPropuesta;
  tipo: TipoMovimiento | null;
  categoria: string | null;
  /** PAGO MI TC: es un pago de préstamo (dir PAGO), no un gasto. */
  dir?: 'PAGO';
  /** Hasta 3 categorías para mostrar como chips. */
  sugerencias: string[];
  opciones?: OpcionPregunta[];
}

const POR_DEFECTO = ['ALIMENTACION', 'TRANSPORTE', 'COMPRAS'];

/** Categorías más usadas en las reglas de la misma clase, completadas con unas por defecto. */
function sugerir(clase: 'PERSONA' | 'COMERCIO', reglas: ReglaCategoria[], primera?: string): string[] {
  const peso = new Map<string, number>();
  for (const r of reglasVigentes(reglas)) if (r.tipo === clase) peso.set(r.categoria, (peso.get(r.categoria) ?? 0) + r.vecesConfirmada);
  const ranking = [...peso.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const lista = [primera, ...ranking, ...POR_DEFECTO].filter((c): c is string => !!c && c !== 'SINID');
  return [...new Set(lista)].slice(0, 3);
}

const OPC_ABONO: OpcionPregunta[] = [
  { id: 'INGRESO', nombre: 'Ingreso' },
  { id: 'REEMBOLSO', nombre: 'Reembolso (me devolvieron algo que pagué)' },
];

/** Qué hacer con una fila del banco (monto con signo, en céntimos) según el diccionario. */
export function proponer(descriptor: string, centimos: number, reglas: ReglaCategoria[]): Propuesta {
  const clase = clasificarDescriptor(descriptor);
  const clave = normalizarClave(descriptor);
  const base = { clase, clave, sugerencias: [] as string[] };

  switch (clase) {
    case 'INTERES':
      return centimos > 0
        ? { ...base, estado: 'AUTO', tipo: 'INGRESO', categoria: 'INTERESES' }
        : { ...base, estado: 'CLASIFICAR', tipo: null, categoria: null };
    case 'RETIRO':
      return centimos < 0
        ? { ...base, estado: 'AUTO', tipo: 'GASTO', categoria: 'EFECTIVO' }
        : { ...base, estado: 'CLASIFICAR', tipo: null, categoria: null };
    case 'PAGO_TC':
      return centimos < 0
        ? { ...base, estado: 'CONFIRMAR', tipo: 'PRESTAMO', categoria: null, dir: 'PAGO' }
        : { ...base, estado: 'CLASIFICAR', tipo: null, categoria: null };
    case 'TRANSFERENCIA': {
      const propia: OpcionPregunta = { id: 'ENTRE_CUENTAS', nombre: 'Entre mis cuentas' };
      const otro: OpcionPregunta = { id: 'OTRO', nombre: 'Otro' };
      const opciones: OpcionPregunta[] =
        centimos > 0
          ? [propia, { id: 'INGRESO_SUELDO', nombre: 'Ingreso (sueldo)' }, otro]
          : [propia, { id: 'PAGO_DOLARES', nombre: 'Pago en dólares (gasto)' }, otro];
      return { ...base, estado: 'PREGUNTAR', tipo: null, categoria: null, opciones };
    }
    case 'PERSONA':
    case 'COMERCIO': {
      const regla = buscarRegla(descriptor, clase, reglas);
      const sugerencias = sugerir(clase, reglas, regla?.categoria);
      if (centimos > 0) {
        // Me pagaron: ¿ingreso o devolución de algo que pagué yo? Lo decide el usuario.
        return { ...base, sugerencias, estado: 'PREGUNTAR', tipo: null, categoria: regla?.categoria ?? null, opciones: OPC_ABONO };
      }
      if (!regla) return { ...base, sugerencias, estado: 'CLASIFICAR', tipo: 'GASTO', categoria: null };
      return { ...base, sugerencias, estado: esAutomatica(regla) ? 'AUTO' : 'CONFIRMAR', tipo: 'GASTO', categoria: regla.categoria };
    }
  }
}
