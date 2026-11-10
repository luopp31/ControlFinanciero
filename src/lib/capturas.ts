// Bandeja de capturas (gastos que llegan solos por el correo de Interbank o por Wallet).
// Lógica pura: al clasificar una captura se arma el movimiento (GASTO, origen 'captura'), la captura clasificada
// y, si corresponde, la regla del diccionario. Sin IO ni reloj: la hora y los ids nuevos se reciben.
import type { Captura, ReglaCategoria } from './db';
import type { Cuenta, Movimiento } from './finanzas';
import { aprenderRegla, proponer, reglasVigentes, type Propuesta } from './clasificador';
import { uuidDeterminista } from './emparejar';

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

const normalizarNombre = (s: string) => sinTildes(s).toUpperCase().replace(/\s+/g, ' ').trim();

/** Nombre completo de la captura, en mayúsculas y sin tildes. */
export function nombreCompleto(c: Pick<Captura, 'destinatario'>): string {
  return normalizarNombre(c.destinatario ?? '');
}

/**
 * ¿La etiqueta del banco ("JUAN C", "ALEXAND", "MARIA C") corresponde a este nombre completo?
 * El banco corta el nombre y no siempre igual, así que no se compara por un largo fijo sino por:
 *  - prefijo: el nombre completo empieza con la etiqueta ("ALEXAND" ~ "ALEXANDER RAMOS"), o
 *  - primer nombre + inicial: "JUAN C" ~ cualquier "JUAN ..." con algún apellido que empiece con C.
 */
export function coincideNombre(etiqueta: string, completo: string): boolean {
  const a = normalizarNombre(etiqueta);
  const b = normalizarNombre(completo);
  if (a.length < 3 || b === '') return false;
  if (b.startsWith(a)) return true;
  const m = /^(\S+) (\S)$/.exec(a);
  if (!m) return false;
  const palabras = b.split(' ');
  return palabras[0] === m[1] && palabras.slice(1).some((w) => w[0] === m[2]);
}

/**
 * Cómo escribiría el banco esta persona o comercio en la constancia (PDF): es la clave del diccionario del Conciliar.
 * Plin/Yape: "PLIN-" o "YAPE-" (según el destino) y el nombre recortado. Si el diccionario ya aprendió la etiqueta
 * real de esa persona (la que escribió el banco en un PDF), se usa esa; si no, se supone "las 7 primeras letras".
 * Wallet: el nombre del comercio.
 */
export function descriptorDeCaptura(c: Pick<Captura, 'origen' | 'destino' | 'destinatario'>, reglas: ReglaCategoria[] = []): string {
  const nombre = nombreCompleto(c);
  if (c.origen !== 'plin_correo') return nombre;
  const aprendida = reglasVigentes(reglas)
    .filter((r) => r.tipo === 'PERSONA' && coincideNombre(r.clave.replace(/^(?:PLIN|YAPE)-/, ''), nombre))
    .sort((x, y) => y.vecesConfirmada - x.vecesConfirmada)[0];
  if (aprendida) return aprendida.clave;
  return `${c.destino === 'Yape' ? 'YAPE' : 'PLIN'}-${nombre.slice(0, 7).trim()}`;
}

/** Fecha (YYYY-MM-DD) y hora (HH:MM) en Lima (UTC-5, sin horario de verano) de un instante ISO. */
export function fechaHoraLima(iso: string): { fecha: string; hora: string } {
  const lima = new Date(Date.parse(iso) - 5 * 3_600_000).toISOString();
  return { fecha: lima.slice(0, 10), hora: lima.slice(11, 16) };
}

/** Qué sugiere el diccionario para esta captura (AUTO / CONFIRMAR / CLASIFICAR) con sus categorías. */
export function proponerCaptura(c: Captura, reglas: ReglaCategoria[]): Propuesta {
  const p = proponer(descriptorDeCaptura(c, reglas), -(c.montoCentimos ?? 0), reglas);
  // Un pago en dólares casi siempre es una suscripción: esa categoría va primera (sin pisar la que ya sabe el diccionario).
  if (c.moneda === 'USD' && !p.categoria) return { ...p, sugerencias: ['SUSCRIPCIONES', ...p.sugerencias.filter((x) => x !== 'SUSCRIPCIONES')].slice(0, 3) };
  return p;
}

/** La captura contra la que se marcó "posible duplicado", si sigue viva. */
export function duplicadoDe(c: Captura, todas: Captura[]): Captura | undefined {
  if (!c.posibleDuplicadoDe) return undefined;
  return todas.find((x) => x.id === c.posibleDuplicadoDe && !x.borrado && (x.estado === 'pendiente' || x.estado === 'clasificado'));
}

/** Pendientes por clasificar (lo más reciente primero) y correos que no se supieron leer. */
export function resumenBandeja(todas: Captura[]): { pendientes: Captura[]; sinLeer: Captura[] } {
  const vivas = todas.filter((c) => !c.borrado);
  const porFecha = (a: Captura, b: Captura) => (b.fechaHora ?? '').localeCompare(a.fechaHora ?? '');
  return {
    pendientes: vivas.filter((c) => c.estado === 'pendiente').sort(porFecha),
    sinLeer: vivas.filter((c) => c.estado === 'sin_leer').sort(porFecha),
  };
}

const norm = (t: string) => t.trim().toLowerCase();

/** Cuenta donde cae el gasto: la que dice la captura, o si no, la billetera (Simple por defecto). */
export function cuentaDeCaptura(c: Captura, cuentas: Cuenta[]): Cuenta | undefined {
  const nombre = c.cuenta ? norm(c.cuenta) : '';
  return (nombre && cuentas.find((x) => norm(x.nombre) === nombre)) || cuentas.find((x) => x.rol === 'BILLETERA') || cuentas[0];
}

export interface ContextoClasificar {
  cuentas: Cuenta[];
  reglas: ReglaCategoria[];
  ahora: string;
  nuevoId: () => string;
  /** Cuenta elegida por el usuario (si no, la de la captura). */
  cuentaId?: string;
  /** En soles, en céntimos. Obligatorio si la captura es en dólares. */
  montoSolesCentimos?: number | null;
  /** Concepto opcional que escribe el usuario ("pasaje", "almuerzo"). */
  nota?: string | null;
}

export const MAX_NOTA = 80;

/** Espacios colapsados, sin bordes y con tope de largo. Vacío = sin nota. */
export function limpiarNota(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTA).trim();
}

/**
 * La nota del movimiento. Sin concepto: el detalle automático ("Plin a Alonso Perez Gomez", o el comercio; en
 * dólares "... (US$ 23.60)"). Con concepto: el concepto primero y el detalle entre paréntesis, como las notas a mano
 * ("pasaje (Plin a Alonso Perez Gomez)", "Claude (Plin a Servicio Prueba · US$ 23.60)").
 */
export function notaDeCaptura(
  c: Pick<Captura, 'origen' | 'destino' | 'destinatario' | 'moneda' | 'montoCentimos'>,
  conceptoUsuario?: string | null
): string | null {
  const quien = (c.destinatario ?? '').trim();
  const detalle = `${c.origen === 'plin_correo' ? `${c.destino ?? 'Plin'} a ` : ''}${quien}`.trim();
  const dolares = c.moneda === 'USD' && c.montoCentimos ? `US$ ${(c.montoCentimos / 100).toFixed(2)}` : '';
  const concepto = limpiarNota(conceptoUsuario);
  if (!concepto) return `${detalle}${dolares ? ` (${dolares})` : ''}`.trim() || null;
  // "Sin nombre" (Wallet sin comercio) no aporta nada entre paréntesis.
  const util = quien && quien !== 'Sin nombre' ? [detalle, dolares].filter(Boolean).join(' · ') : dolares;
  return util ? `${concepto} (${util})` : concepto;
}

export type Clasificada =
  | { ok: true; movimiento: Movimiento; captura: Captura; regla?: ReglaCategoria }
  | { ok: false; motivo: string };

/** Clasifica una captura: crea el GASTO (id determinista: tocar dos veces no duplica) y la deja "clasificada". */
export function clasificarCaptura(c: Captura, categoria: string, ctx: ContextoClasificar): Clasificada {
  if (c.estado !== 'pendiente') return { ok: false, motivo: 'La captura ya no está pendiente.' };
  if (!c.montoCentimos || !c.fechaHora) return { ok: false, motivo: 'La captura no tiene monto o fecha.' };
  const usd = c.moneda === 'USD';
  const soles = usd ? ctx.montoSolesCentimos : c.montoCentimos;
  if (!soles || soles <= 0) return { ok: false, motivo: 'Pon el monto en soles.' };
  const cuenta = (ctx.cuentaId && ctx.cuentas.find((x) => x.id === ctx.cuentaId)) || cuentaDeCaptura(c, ctx.cuentas);
  if (!cuenta) return { ok: false, motivo: 'No hay una cuenta donde cargar el gasto.' };

  const { fecha, hora } = fechaHoraLima(c.fechaHora);
  const descriptor = descriptorDeCaptura(c, ctx.reglas);
  const nota = notaDeCaptura(c, ctx.nota);

  const movimiento: Movimiento = {
    id: uuidDeterminista(`cap|${c.id}`),
    fecha,
    monto: soles / 100,
    tipo: 'GASTO',
    categoria,
    cuentaId: cuenta.id,
    nota: nota || null,
    descriptor,
    origen: 'captura',
    hora,
    borrado: false,
    actualizado: ctx.ahora,
    sincronizado: false,
  };
  const captura: Captura = { ...c, estado: 'clasificado', categoria, movimientoId: movimiento.id, actualizado: ctx.ahora, sincronizado: false };

  // Aprende la categoría como el Conciliar: cuenta una confirmación salvo que la regla ya sea automática.
  const p = proponer(descriptor, -soles, ctx.reglas);
  let regla: ReglaCategoria | undefined;
  if ((p.clase === 'PERSONA' || p.clase === 'COMERCIO') && p.estado !== 'AUTO') {
    const clave = p.clave;
    const existente = reglasVigentes(ctx.reglas).find((r) => r.tipo === p.clase && r.clave === clave);
    regla = aprenderRegla(existente, descriptor, p.clase, categoria, ctx.nuevoId(), ctx.ahora);
  }
  return { ok: true, movimiento, captura, regla };
}

const aDias = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const aMin = (hora: string) => +hora.slice(0, 2) * 60 + +hora.slice(3, 5);

/** Nombre que viene después de "PLIN-" o "YAPE-" en el descriptor del banco; null si no es un pago a una persona. */
function nombreDePersona(descriptor: string): string | null {
  const m = /^(?:PLIN|YAPE)-(.*)$/.exec(sinTildes(descriptor).toUpperCase().trim());
  return m ? m[1].trim() : null;
}

export const TOLERANCIA_DIAS_CAPTURA = 3;
/** Wallet no comparte nombre con el banco ("Plaza Vea" vs "229 PVEA SALAVERRY"): se reconoce por monto y por la misma hora. */
export const TOLERANCIA_MIN_WALLET = 30;

/**
 * La captura pendiente que corresponde a una fila del banco (un cargo), o undefined. Reglas:
 *  - Plin/Yape: mismo monto exacto, a ±3 días y el mismo nombre (las 7 letras que escribe el banco).
 *  - Wallet: mismo monto exacto, el mismo día y a 30 minutos o menos.
 * `usadas` evita que una captura se enlace con dos filas; entre varias se toma la más cercana en el tiempo.
 */
export function capturaQueCoincide(
  fila: { descriptor: string; centimos: number; fecha: string; hora?: string | null },
  capturas: Captura[],
  usadas: Set<string> = new Set()
): Captura | undefined {
  if (fila.centimos >= 0) return undefined;
  const monto = -fila.centimos;
  const nombreBanco = nombreDePersona(fila.descriptor);
  let mejor: { c: Captura; costo: number } | undefined;
  for (const c of capturas) {
    if (c.estado !== 'pendiente' || c.borrado || usadas.has(c.id) || c.moneda !== 'PEN' || c.montoCentimos !== monto || !c.fechaHora) continue;
    const { fecha, hora } = fechaHoraLima(c.fechaHora);
    const dias = Math.abs(aDias(fecha) - aDias(fila.fecha));
    if (dias > TOLERANCIA_DIAS_CAPTURA) continue;
    const minutos = fila.hora ? Math.abs(aMin(hora) - aMin(fila.hora)) : 0;
    if (c.origen === 'plin_correo') {
      if (nombreBanco === null || !coincideNombre(nombreBanco, nombreCompleto(c))) continue;
    } else if (dias !== 0 || !fila.hora || minutos > TOLERANCIA_MIN_WALLET) continue;
    const costo = dias * 1440 + minutos;
    if (!mejor || costo < mejor.costo) mejor = { c, costo };
  }
  return mejor?.c;
}

/** La captura queda clasificada y apunta al movimiento que ya existe (o que se acaba de cargar desde el banco). */
export function enlazarCaptura(c: Captura, movimiento: Pick<Movimiento, 'id' | 'categoria'>, ahora: string): Captura {
  return { ...c, estado: 'clasificado', categoria: movimiento.categoria ?? c.categoria ?? null, movimientoId: movimiento.id, actualizado: ahora, sincronizado: false };
}

/** "Es el mismo gasto" (se descarta la repetida) o descarte a secas. */
export function descartarCaptura(c: Captura, ahora: string): Captura {
  return { ...c, estado: 'descartado', actualizado: ahora, sincronizado: false };
}

/** "Son distintos": se quita la marca de posible duplicado. */
export function quitarMarcaDuplicado(c: Captura, ahora: string): Captura {
  return { ...c, posibleDuplicadoDe: null, actualizado: ahora, sincronizado: false };
}
