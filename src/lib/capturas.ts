// Bandeja de capturas (gastos que llegan solos por el correo de Interbank o por Wallet).
// Lógica pura: al clasificar una captura se arma el movimiento (GASTO, origen 'captura'), la captura clasificada
// y, si corresponde, la regla del diccionario. Sin IO ni reloj: la hora y los ids nuevos se reciben.
import type { Captura, ReglaCategoria } from './db';
import type { Cuenta, Movimiento } from './finanzas';
import { aprenderRegla, proponer, reglasVigentes, type Propuesta } from './clasificador';
import { uuidDeterminista } from './emparejar';

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

/**
 * Cómo escribiría el banco esta persona o comercio en la constancia (PDF): es la clave del diccionario del Conciliar.
 * Plin/Yape: "PLIN-" o "YAPE-" (según el destino) y las primeras 7 letras del nombre ("PLIN-ALONSO", "YAPE-LUIS EN").
 * Wallet: el nombre del comercio.
 */
export function descriptorDeCaptura(c: Pick<Captura, 'origen' | 'destino' | 'destinatario'>): string {
  const nombre = sinTildes(c.destinatario ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (c.origen === 'plin_correo') return `${c.destino === 'Yape' ? 'YAPE' : 'PLIN'}-${nombre.slice(0, 7).trim()}`;
  return nombre;
}

/** Fecha (YYYY-MM-DD) y hora (HH:MM) en Lima (UTC-5, sin horario de verano) de un instante ISO. */
export function fechaHoraLima(iso: string): { fecha: string; hora: string } {
  const lima = new Date(Date.parse(iso) - 5 * 3_600_000).toISOString();
  return { fecha: lima.slice(0, 10), hora: lima.slice(11, 16) };
}

/** Qué sugiere el diccionario para esta captura (AUTO / CONFIRMAR / CLASIFICAR) con sus categorías. */
export function proponerCaptura(c: Captura, reglas: ReglaCategoria[]): Propuesta {
  const p = proponer(descriptorDeCaptura(c), -(c.montoCentimos ?? 0), reglas);
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
  const descriptor = descriptorDeCaptura(c);
  const quien = (c.destinatario ?? '').trim();
  const nota = `${c.origen === 'plin_correo' ? `${c.destino ?? 'Plin'} a ` : ''}${quien}${usd ? ` (US$ ${(c.montoCentimos / 100).toFixed(2)})` : ''}`.trim();

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

/** "Es el mismo gasto" (se descarta la repetida) o descarte a secas. */
export function descartarCaptura(c: Captura, ahora: string): Captura {
  return { ...c, estado: 'descartado', actualizado: ahora, sincronizado: false };
}

/** "Son distintos": se quita la marca de posible duplicado. */
export function quitarMarcaDuplicado(c: Captura, ahora: string): Captura {
  return { ...c, posibleDuplicadoDe: null, actualizado: ahora, sincronizado: false };
}
