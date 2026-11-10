// Capturas de tipo "transferencia" (Constancia de transferencia de Interbank). Lógica pura.
// El servidor solo guarda los nombres de producto; aquí se decide qué son para ESTE usuario según sus cuentas:
//   A. cargo y destino son cuentas mías            -> TRASPASO (un toque, sin categoría)
//   B. destino mío y el cargo no trae producto      -> ¿desde qué cuenta mía? (o una entrada de fuera). Nunca un gasto.
//   D. destino mío y el cargo es otro producto      -> INGRESO (p. ej. Ahorro Sueldo -> Millonaria, la liquidación)
//   C. cargo mío y el destino NO es mío             -> GASTO (transferencia a un tercero, o a una cuenta en dólares)
//   AJENA. ninguna es mía                           -> probablemente no mueve tu plata: se puede descartar
import type { Captura } from './db';
import type { Cuenta, Movimiento } from './finanzas';
import { cuentaDeProducto, fechaHoraLima, limpiarNota, notaDeTransferencia, type Clasificada } from './capturas';
import { uuidDeterminista } from './emparejar';

export type PropuestaTransferencia =
  | { caso: 'TRASPASO'; origen: Cuenta; destino: Cuenta }
  | { caso: 'ORIGEN_DESCONOCIDO'; destino: Cuenta }
  | { caso: 'INGRESO'; destino: Cuenta; desde: string }
  | { caso: 'GASTO'; origen: Cuenta }
  | { caso: 'AJENA' };

/** Qué propone la bandeja para una transferencia, según las cuentas del usuario. Nunca inventa una cuenta. */
export function proponerTransferencia(c: Captura, cuentas: Cuenta[]): PropuestaTransferencia {
  const origen = cuentaDeProducto(c.cuenta, cuentas);
  const destino = cuentaDeProducto(c.cuentaDestino, cuentas);
  if (origen && destino && origen.id === destino.id) return { caso: 'AJENA' }; // imposible: mal leído
  // En dólares no hay traspaso ni ingreso posible entre cuentas en soles: solo un gasto desde una cuenta mía.
  if (c.moneda === 'USD') return origen && !destino ? { caso: 'GASTO', origen } : { caso: 'AJENA' };
  if (origen && destino) return { caso: 'TRASPASO', origen, destino };
  if (destino) return c.cuenta ? { caso: 'INGRESO', destino, desde: c.cuenta } : { caso: 'ORIGEN_DESCONOCIDO', destino };
  if (origen) return { caso: 'GASTO', origen };
  return { caso: 'AJENA' };
}

export interface ContextoTransferencia {
  cuentas: Cuenta[];
  ahora: string;
  /** Concepto opcional del usuario. */
  nota?: string | null;
  /** En soles, en céntimos. Obligatorio si la captura es en dólares (solo ingresos). */
  montoSolesCentimos?: number | null;
}

function base(c: Captura): { ok: false; motivo: string } | { ok: true; fecha: string; hora: string } {
  if (c.estado !== 'pendiente') return { ok: false, motivo: 'La captura ya no está pendiente.' };
  if (c.tipo !== 'transferencia') return { ok: false, motivo: 'La captura no es una transferencia.' };
  if (!c.montoCentimos || !c.fechaHora) return { ok: false, motivo: 'La captura no tiene monto o fecha.' };
  return { ok: true, ...fechaHoraLima(c.fechaHora) };
}

/** Confirma el traspaso (id determinista: tocar dos veces no duplica) y deja la captura clasificada. Sin categoría. */
export function confirmarTraspaso(c: Captura, origenId: string, destinoId: string, ctx: ContextoTransferencia): Clasificada {
  const b = base(c);
  if (!b.ok) return b;
  if (c.moneda !== 'PEN') return { ok: false, motivo: 'Un traspaso en dólares no se puede registrar entre cuentas en soles.' };
  if (origenId === destinoId) return { ok: false, motivo: 'El origen y el destino son la misma cuenta.' };
  if (!ctx.cuentas.some((x) => x.id === origenId) || !ctx.cuentas.some((x) => x.id === destinoId)) return { ok: false, motivo: 'No encuentro esa cuenta.' };
  const movimiento: Movimiento = {
    id: uuidDeterminista(`cap|${c.id}`),
    fecha: b.fecha,
    monto: c.montoCentimos! / 100,
    tipo: 'TRASPASO',
    categoria: null,
    cuentaId: origenId,
    destinoId,
    nota: limpiarNota(ctx.nota) || null,
    origen: 'captura',
    hora: b.hora,
    borrado: false,
    actualizado: ctx.ahora,
    sincronizado: false,
  };
  return { ok: true, movimiento, captura: { ...c, estado: 'clasificado', categoria: null, movimientoId: movimiento.id, actualizado: ctx.ahora, sincronizado: false } };
}

/** Una entrada a una cuenta mía (Ahorro Sueldo -> Millonaria, o "viene de fuera"): crea el INGRESO con su categoría. */
export function clasificarIngresoTransferencia(c: Captura, categoria: string, destinoId: string, ctx: ContextoTransferencia): Clasificada {
  const b = base(c);
  if (!b.ok) return b;
  const soles = c.moneda === 'USD' ? ctx.montoSolesCentimos : c.montoCentimos;
  if (!soles || soles <= 0) return { ok: false, motivo: 'Pon el monto en soles.' };
  if (!ctx.cuentas.some((x) => x.id === destinoId)) return { ok: false, motivo: 'No encuentro esa cuenta.' };
  const movimiento: Movimiento = {
    id: uuidDeterminista(`cap|${c.id}`),
    fecha: b.fecha,
    monto: soles / 100,
    tipo: 'INGRESO',
    categoria,
    cuentaId: destinoId,
    nota: notaDeTransferencia(c, 'ingreso', ctx.nota),
    origen: 'captura',
    hora: b.hora,
    borrado: false,
    actualizado: ctx.ahora,
    sincronizado: false,
  };
  return { ok: true, movimiento, captura: { ...c, estado: 'clasificado', categoria, movimientoId: movimiento.id, actualizado: ctx.ahora, sincronizado: false } };
}

const aDias = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const aMin = (hora: string) => +hora.slice(0, 2) * 60 + +hora.slice(3, 5);
export const TOLERANCIA_DIAS_TRANSFERENCIA = 3;

/**
 * La captura de transferencia pendiente que corresponde a un movimiento del Conciliar (recién cargado o que ya estaba):
 * mismo monto exacto, a ±3 días (fecha de Lima) y las mismas cuentas.
 *  - TRASPASO: el destino es el de la captura, y el origen también (o la captura no traía producto de cargo).
 *  - GASTO: sale de la cuenta de cargo y el destino de la captura no es mío (transferencia a un tercero o en dólares).
 *  - INGRESO: entra a la cuenta de destino y el cargo de la captura no es mío (Ahorro Sueldo, o sin producto).
 * `usadas` evita enlazar una captura dos veces; entre varias gana la más cercana en el tiempo.
 */
export function capturaTransferenciaQueCoincide(
  mov: { tipo: Movimiento['tipo']; cuentaId: string; destinoId?: string | null; fecha: string; hora?: string | null; centimos: number },
  capturas: Captura[],
  cuentas: Cuenta[],
  usadas: Set<string> = new Set()
): Captura | undefined {
  let mejor: { c: Captura; costo: number } | undefined;
  for (const c of capturas) {
    if (c.tipo !== 'transferencia' || c.estado !== 'pendiente' || c.borrado || usadas.has(c.id) || c.moneda !== 'PEN' || c.montoCentimos !== mov.centimos || !c.fechaHora) continue;
    const origen = cuentaDeProducto(c.cuenta, cuentas);
    const destino = cuentaDeProducto(c.cuentaDestino, cuentas);
    const cuadra =
      mov.tipo === 'TRASPASO'
        ? !!destino && destino.id === mov.destinoId && (origen ? origen.id === mov.cuentaId : !c.cuenta)
        : mov.tipo === 'GASTO'
          ? !!origen && origen.id === mov.cuentaId && !destino
          : mov.tipo === 'INGRESO'
            ? !!destino && destino.id === mov.cuentaId && !origen
            : false;
    if (!cuadra) continue;
    const { fecha, hora } = fechaHoraLima(c.fechaHora);
    const dias = Math.abs(aDias(fecha) - aDias(mov.fecha));
    if (dias > TOLERANCIA_DIAS_TRANSFERENCIA) continue;
    const costo = dias * 1440 + (mov.hora ? Math.abs(aMin(hora) - aMin(mov.hora)) : 0);
    if (!mejor || costo < mejor.costo) mejor = { c, costo };
  }
  return mejor?.c;
}
