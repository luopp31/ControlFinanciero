// Simulación "qué pasaría si": proyecta el valor neto mes a mes asumiendo
// que dejas de generar ingreso regular (sueldo) desde hoy y solo sale plata
// (tu gasto típico) hasta una fecha futura — con la opción de sumar
// ingresos extra puntuales (ej. algún servicio que te paguen en el camino).
// No lee ni escribe nada — los ingresos extra son hipotéticos del momento,
// no se guardan como movimientos reales.

import { diasEnMes, isoDe, ultimosMesesISO } from './fecha';
import { totalesPorMes, type Movimiento } from './finanzas';

export interface IngresoExtra {
  monto: number;
  fecha: string; // ISO YYYY-MM-DD, cualquier día dentro del mes en que caería
}

export interface PuntoSimulacion {
  mes: string; // 'YYYY-MM'
  valor: number; // valor neto proyectado al cierre de ese mes
}

export interface ResultadoSimulacion {
  puntos: PuntoSimulacion[];
  valorFinal: number;
  totalGastadoProyectado: number;
  totalExtrasProyectado: number;
}

/** Promedio de gasto real de los últimos `mesesHistoricos` meses COMPLETOS
 * (excluye el mes actual, que suele estar a medias y sesgaría el promedio
 * hacia abajo) — la sugerencia de "gasto típico mensual" para el simulador. */
export function promedioGastoMensual(movimientos: Movimiento[], mesesHistoricos = 3, hoy: Date = new Date()): number {
  const meses = ultimosMesesISO(mesesHistoricos + 1, hoy).slice(0, -1);
  if (meses.length === 0) return 0;
  const totales = totalesPorMes(movimientos, meses);
  return totales.reduce((s, m) => s + m.gasto, 0) / totales.length;
}

/**
 * Proyecta el valor neto mes a mes desde hoy hasta `fechaFinISO` (31 de
 * diciembre de este año por defecto): cada mes resta `gastoMensualTipico`
 * (el mes actual se prorratea por los días que faltan, para no restar de más
 * los días que ya pasaron) y suma los `ingresosExtra` que caigan en el mes.
 * Sin ingreso regular asumido — si querés simular que seguís cobrando algo,
 * agrégalo como un ingreso extra más.
 */
export function simular(
  valorNetoActual: number,
  gastoMensualTipico: number,
  ingresosExtra: IngresoExtra[],
  hoy: Date = new Date(),
  fechaFinISO?: string
): ResultadoSimulacion {
  const fin = fechaFinISO ?? isoDe(new Date(hoy.getFullYear(), 11, 31));
  const [anioFinStr, mesFinStr] = fin.split('-');
  const anioFin = Number(anioFinStr);
  const mesFin0 = Number(mesFinStr) - 1;

  const puntos: PuntoSimulacion[] = [];
  let acumulado = valorNetoActual;
  let totalGastado = 0;
  let totalExtras = 0;

  let anio = hoy.getFullYear();
  let mes = hoy.getMonth();
  let esPrimerMes = true;

  while (anio < anioFin || (anio === anioFin && mes <= mesFin0)) {
    const diasDelMes = diasEnMes(anio, mes);
    const diasRestantes = esPrimerMes ? diasDelMes - hoy.getDate() + 1 : diasDelMes;
    const gastoDelMes = gastoMensualTipico * (diasRestantes / diasDelMes);

    const claveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;
    const extrasDelMes = ingresosExtra.filter((e) => e.fecha.startsWith(claveMes)).reduce((s, e) => s + e.monto, 0);

    acumulado += extrasDelMes - gastoDelMes;
    totalGastado += gastoDelMes;
    totalExtras += extrasDelMes;
    puntos.push({ mes: claveMes, valor: acumulado });

    esPrimerMes = false;
    mes += 1;
    if (mes > 11) {
      mes = 0;
      anio += 1;
    }
  }

  return { puntos, valorFinal: acumulado, totalGastadoProyectado: totalGastado, totalExtrasProyectado: totalExtras };
}
