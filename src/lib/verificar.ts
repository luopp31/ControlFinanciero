// Verificación final de la conciliación: saldo de Greedy al momento de la consulta contra el
// saldo DISPONIBLE del banco (el contable no incluye las compras "en proceso"). Céntimos enteros.
// No existe "cuadrar a mano": si no cuadra, se muestra qué movimiento falta o sobra.
import { efecto, type Movimiento } from './finanzas';
import { emparejar, type EntradaEmparejar, type FilaConRef, type ResultadoEmparejo } from './emparejar';

const cent = (n: number) => Math.round(n * 100);

export interface Verificacion {
  cuadra: boolean;
  greedyCent: number;
  bancoCent: number;
  /** banco - Greedy. Positivo = el banco tiene más plata que Greedy. */
  diferenciaCent: number;
  /** Filas del banco que Greedy no tiene (explican parte de la diferencia). */
  faltanEnGreedy: FilaConRef[];
  /** Movimientos de Greedy que el banco no muestra (idem). */
  sobranEnGreedy: Movimiento[];
  /** Lo que ni lo uno ni lo otro explica: saldo inicial o fecha de corte mal, o algo oculto. */
  sinExplicarCent: number;
  emparejo: ResultadoEmparejo;
}

/** Saldo de Greedy en el instante de la consulta: saldo inicial + movimientos desde la fecha de corte hasta ese momento. */
export function saldoGreedyAlMomento(
  e: Pick<EntradaEmparejar, 'cuenta' | 'movimientos' | 'consulta'>
): number {
  const { cuenta, consulta } = e;
  return e.movimientos.reduce((s, m) => {
    if (m.borrado || m.fecha < cuenta.desde || m.fecha > consulta.fecha) return s;
    // El mismo día solo cuentan los que, sabiéndose la hora, ocurrieron antes de la consulta.
    if (m.fecha === consulta.fecha && m.hora && m.hora > consulta.hora) return s;
    return s + cent(efecto(m, cuenta.id));
  }, cent(cuenta.saldoInicial));
}

export function verificar(e: EntradaEmparejar & { saldoDisponibleCent: number }): Verificacion {
  const emparejo = emparejar(e);
  const greedyCent = saldoGreedyAlMomento(e);
  const diferenciaCent = e.saldoDisponibleCent - greedyCent;
  const faltan = emparejo.nuevos;
  const sobran = emparejo.soloEnGreedy;
  const explicado =
    faltan.reduce((s, f) => s + f.centimos, 0) - sobran.reduce((s, m) => s + cent(efecto(m, e.cuenta.id)), 0);
  return {
    cuadra: diferenciaCent === 0,
    greedyCent,
    bancoCent: e.saldoDisponibleCent,
    diferenciaCent,
    faltanEnGreedy: faltan,
    sobranEnGreedy: sobran,
    sinExplicarCent: diferenciaCent - explicado,
    emparejo,
  };
}

/** El banco usa hora de Lima (UTC-5, sin horario de verano). */
export function instanteConsulta(consulta: { fecha: string; hora: string }): string {
  return new Date(`${consulta.fecha}T${consulta.hora}:00-05:00`).toISOString();
}

/**
 * Nuevo valor de `cuenta.conciliadoHasta`, o null si no debe cambiar: solo si cuadra
 * y la consulta es más nueva que lo ya guardado (subir un PDF viejo no hace retroceder la fecha).
 */
export function nuevoConciliadoHasta(
  actual: string | null | undefined,
  consulta: { fecha: string; hora: string },
  cuadra: boolean
): string | null {
  if (!cuadra) return null;
  const nuevo = instanteConsulta(consulta);
  return !actual || nuevo > new Date(actual).toISOString() ? nuevo : null;
}
