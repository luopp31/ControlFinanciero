import type { Compromiso } from './db';
import { CATS, CATS_ING, estadoPrestamo, porCobrar, porPagar, saldo, saldoTotal, valorNeto, type Cuenta, type Movimiento, type Prestamo } from './finanzas';
import { diasEnMes, sumarMeses } from './fecha';
import { formatearInstanteLima, formatearMonto } from './formato';

/** Resumen compacto en markdown para pegar en un chat con un asesor financiero. Todo puro: recibe los datos y la hora. */
export interface DatosResumen {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  prestamos: Prestamo[];
  compromisos: Compromiso[];
  /** Presupuesto mensual total (0 o ausente = sin presupuesto). */
  presupuesto?: number;
  /** Capturas de la bandeja sin clasificar (los datos pueden estar incompletos). */
  capturasPendientes: number;
  version: string;
}

/** Estimación gruesa de tokens (español con cifras: ~3 caracteres por token). */
export const estimarTokens = (texto: string): number => Math.ceil(texto.length / 3);

const m2 = formatearMonto;
const nombreCat = (id: string): string => [...CATS, ...CATS_ING].find((c) => c.id === id)?.nombre ?? id;
const norm = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const suma = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Fecha y hora de Lima (UTC-5, sin horario de verano) de un instante. */
function lima(ahora: Date): { fecha: string; hora: string } {
  const iso = new Date(ahora.getTime() - 5 * 3_600_000).toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** Tabla "fila × mes" con total y promedio. `meses` son 7 (6 completos + en curso); el promedio usa solo los completos con datos. */
function tabla(titulo: string, filas: Map<string, Record<string, number>>, meses: string[], completos: string[], nombre: (k: string) => string): string[] {
  const arr = [...filas.entries()]
    .map(([k, porMes]) => {
      const total = suma(meses.map((x) => porMes[x] ?? 0));
      const prom = completos.length ? suma(completos.map((x) => porMes[x] ?? 0)) / completos.length : null;
      return { k, porMes, total, prom };
    })
    .filter((f) => Math.abs(f.total) > 0.004)
    .sort((a, b) => (b.prom ?? b.total) - (a.prom ?? a.total));
  if (!arr.length) return [`${titulo}: sin datos.`];
  const lineas = [`| ${titulo} | ${meses.join(' | ')} | Total | Prom/mes |`, `|---|${meses.map(() => '--:').join('|')}|--:|--:|`];
  for (const f of arr) lineas.push(`| ${nombre(f.k)} | ${meses.map((x) => m2(f.porMes[x] ?? 0)).join(' | ')} | ${m2(f.total)} | ${f.prom === null ? '—' : m2(f.prom)} |`);
  return lineas;
}

export function resumenAsesor(d: DatosResumen, ahora: Date): string {
  const { fecha: hoy, hora } = lima(ahora);
  const mesActual = hoy.slice(0, 7);
  const activos = d.movimientos.filter((x) => !x.borrado);
  const fechas = activos.map((x) => x.fecha).sort();
  const primero = fechas[0], ultimo = fechas[fechas.length - 1];
  // Los 6 meses anteriores + el actual, sin los meses previos al primer movimiento (no aportan nada).
  const meses = [-6, -5, -4, -3, -2, -1, 0].map((n) => sumarMeses(mesActual, n)).filter((x) => !primero || x >= primero.slice(0, 7));
  const completos = meses.filter((x) => x < mesActual);

  // Una sola pasada: mismas reglas que finanzas.ts (reembolso resta del gasto; traspasos y pagos de deuda aparte).
  const z = (): Record<string, number> => ({});
  const ing = z(), gas = z(), tra = z(), deu = z(), aho = z();
  const porCat = new Map<string, Record<string, number>>(), porFuente = new Map<string, Record<string, number>>();
  const suma_ = (mapa: Map<string, Record<string, number>>, k: string, mes: string, v: number) => {
    const fila = mapa.get(k) ?? mapa.set(k, {}).get(k)!;
    fila[mes] = (fila[mes] ?? 0) + v;
  };
  for (const x of activos) {
    const mes = x.fecha.slice(0, 7);
    if (!meses.includes(mes)) continue;
    if (x.tipo === 'INGRESO') { ing[mes] = (ing[mes] ?? 0) + x.monto; suma_(porFuente, x.categoria || 'OTROS', mes, x.monto); }
    else if (x.tipo === 'GASTO') { gas[mes] = (gas[mes] ?? 0) + x.monto; suma_(porCat, x.categoria || 'SINID', mes, x.monto); }
    else if (x.tipo === 'REEMBOLSO') { gas[mes] = (gas[mes] ?? 0) - x.monto; suma_(porCat, x.categoria || 'SINID', mes, -x.monto); }
    else if (x.tipo === 'TRASPASO') tra[mes] = (tra[mes] ?? 0) + x.monto;
    else if (x.tipo === 'PRESTAMO' && x.dir === 'PAGO') deu[mes] = (deu[mes] ?? 0) + x.monto;
    else if (x.tipo === 'AHORRO') aho[mes] = (aho[mes] ?? 0) + x.monto;
  }
  const hayAhorro = meses.some((x) => (aho[x] ?? 0) > 0);

  const L: string[] = [];
  // 1. ENCABEZADO
  L.push('# Resumen financiero (Greedy)');
  L.push(`- Corte: ${hoy} ${hora} (hora de Lima) · App ${d.version}`);
  L.push(`- Datos disponibles: ${primero ? `${primero} a ${ultimo} (${activos.length} movimientos)` : 'sin movimientos'}`);
  L.push('- Montos en soles (PEN). El saldo total es exacto; las categorías son aproximadas.');
  L.push('- Reglas: traspasos entre mis cuentas NO son gasto; los pagos de la tarjeta Amex NO son gasto (son pago de deuda); los retiros de cajero cuentan completos como gasto (categoría Efectivo); un reembolso resta del gasto.');
  if (d.capturasPendientes > 0) L.push(`- Ojo: hay ${d.capturasPendientes} gastos por clasificar en la bandeja que aún no están en estos números.`);

  // 2. SALDOS
  L.push('', '## 2. Saldos');
  for (const c of d.cuentas.filter((x) => !x.borrado)) {
    const conc = c.conciliadoHasta ? `conciliada hasta ${formatearInstanteLima(c.conciliadoHasta)}` : 'sin conciliar con el banco';
    L.push(`- ${c.nombre} (${c.rol === 'BILLETERA' ? 'billetera, gasto diario' : 'bóveda, ahorro'}, PEN): ${m2(saldo(c, d.movimientos))} · ${conc}`);
  }
  L.push(`- **Saldo total en cuentas: ${m2(saldoTotal(d.cuentas, d.movimientos))}**`);
  const pendientes = d.prestamos.filter((p) => !p.borrado).map((p) => ({ p, e: estadoPrestamo(p, d.movimientos) })).filter((x) => x.e.pendienteCapital > 0.004);
  const amex = pendientes.find((x) => x.p.tipo === 'DEBO' && /amex/i.test(x.p.persona));
  L.push(amex
    ? `- Tarjeta Amex: deuda actual ${m2(amex.e.pendienteCapital)} (compras registradas, pagadas ${m2(amex.e.devuelto)}). Línea disponible, fecha de cierre, fecha de pago y pago mínimo: no registrados en Greedy.`
    : '- Tarjeta Amex: sin deuda registrada. Línea disponible, cierre, pago y mínimo: no registrados en Greedy.');
  for (const { p, e } of pendientes) if (p !== amex?.p) L.push(`- ${p.tipo === 'PRESTE' ? 'Me deben' : 'Debo'}: ${p.persona} ${m2(e.pendienteCapital)}`);
  L.push(`- Por cobrar ${m2(porCobrar(d.prestamos, d.movimientos))} · Por pagar ${m2(porPagar(d.prestamos, d.movimientos))} · **Valor neto ${m2(valorNeto(d.cuentas, d.movimientos, d.prestamos))}**`);

  // 3. FLUJO MENSUAL
  L.push('', `## 3. Flujo mensual (${meses[0]} a ${mesActual}; el mes en curso es parcial)`);
  L.push(`| Mes | Ingresos | Gastos | Traspasos (no es gasto) | Pago de deuda (no es gasto) |${hayAhorro ? ' Ahorro |' : ''} Neto (ingresos − gastos) |`, `|---|--:|--:|--:|--:|${hayAhorro ? '--:|' : ''}--:|`);
  for (const x of meses) L.push(`| ${x} | ${m2(ing[x] ?? 0)} | ${m2(gas[x] ?? 0)} | ${m2(tra[x] ?? 0)} | ${m2(deu[x] ?? 0)} |${hayAhorro ? ` ${m2(aho[x] ?? 0)} |` : ''} ${m2((ing[x] ?? 0) - (gas[x] ?? 0))} |`);
  L.push('', ...tabla('Ingresos por fuente', porFuente, meses, completos, nombreCat));

  // 4. GASTOS POR CATEGORÍA
  L.push('', `## 4. Gastos por categoría (promedio sobre ${completos.length} mes${completos.length === 1 ? '' : 'es'} completo${completos.length === 1 ? '' : 's'} con datos, sin el mes en curso)`);
  L.push(...tabla('Categoría', porCat, meses, completos, nombreCat));

  // 5. PRESUPUESTO
  const dia = Number(hoy.slice(8, 10)), diasMes = diasEnMes(Number(mesActual.slice(0, 4)), Number(mesActual.slice(5, 7)) - 1);
  const gastoMes = gas[mesActual] ?? 0;
  L.push('', '## 5. Presupuesto');
  if (d.presupuesto && d.presupuesto > 0) {
    const consumido = (gastoMes / d.presupuesto) * 100, transcurrido = (dia / diasMes) * 100;
    L.push(`- Presupuesto mensual total: ${m2(d.presupuesto)} · gastado ${m2(gastoMes)} (${consumido.toFixed(0)}%) · mes transcurrido ${transcurrido.toFixed(0)}%`);
    L.push(`- Ritmo: ${consumido > transcurrido + 5 ? 'más rápido que el mes' : consumido < transcurrido - 5 ? 'más lento que el mes' : 'en línea con el mes'}. Greedy no maneja presupuesto por categoría.`);
  } else L.push('- Sin presupuesto definido (Greedy solo maneja un presupuesto mensual total).');

  // 6. MES EN CURSO
  const proyeccion = dia > 0 ? (gastoMes / dia) * diasMes : 0;
  L.push('', `## 6. Mes en curso (${mesActual})`);
  L.push(`- Día ${dia} de ${diasMes} · gasto acumulado ${m2(gastoMes)} · ingresos ${m2(ing[mesActual] ?? 0)} · proyección de cierre de gasto ${m2(proyeccion)} (lineal: gasto ÷ días × días del mes; no distingue gastos fijos pendientes)`);
  const top = activos.filter((x) => x.tipo === 'GASTO' && x.fecha.startsWith(mesActual)).sort((a, b) => b.monto - a.monto || b.fecha.localeCompare(a.fecha)).slice(0, 10);
  if (top.length) {
    L.push('', '| Fecha | Descripción | Monto | Categoría |', '|---|---|--:|---|');
    for (const x of top) L.push(`| ${x.fecha} | ${(x.nota || x.descriptor || nombreCat(x.categoria || 'SINID')).replace(/[|\n]/g, ' ').slice(0, 40)} | ${m2(x.monto)} | ${nombreCat(x.categoria || 'SINID')} |`);
  }

  // 7. RECURRENTES
  L.push('', '## 7. Recurrentes');
  const reg = d.compromisos.filter((c) => !c.borrado);
  for (const c of reg) L.push(c.tipo === 'SUSCRIPCION' ? `- Registrada: ${c.nombre} ${m2(c.monto)} (cobra el día ${c.diaCobro ?? '?'})` : `- Cuota registrada: ${c.nombre} ${m2(c.monto)} (${c.pagadas ?? 0} de ${c.total ?? '?'} pagadas)`);
  const grupos = new Map<string, Movimiento[]>();
  for (const x of activos) {
    if (x.tipo !== 'GASTO' || !meses.includes(x.fecha.slice(0, 7))) continue;
    const k = norm(x.nota || x.descriptor || '');
    if (k.length >= 3) grupos.set(k, [...(grupos.get(k) ?? []), x]);
  }
  const yaRegistrados = reg.map((c) => norm(c.nombre));
  const detectados = [...grupos.entries()]
    .map(([k, xs]) => ({ k, xs, montos: xs.map((x) => x.monto), meses: new Set(xs.map((x) => x.fecha.slice(0, 7))).size }))
    .filter((g) => g.meses >= 3 && Math.max(...g.montos) <= Math.min(...g.montos) * 1.15 && !yaRegistrados.some((r) => r && (g.k.includes(r) || r.includes(g.k))))
    .sort((a, b) => mediana(b.montos) - mediana(a.montos)).slice(0, 8);
  for (const g of detectados) L.push(`- Detectada (se repite ${g.meses} meses): ${(g.xs[0].nota || g.xs[0].descriptor || g.k).replace(/\(.*?\)/g, '').trim().slice(0, 30)} ~${m2(mediana(g.montos))}, hacia el día ${Math.round(mediana(g.xs.map((x) => Number(x.fecha.slice(8, 10)))))}`);
  if (!reg.length && !detectados.length) L.push('- Ninguno registrado ni detectado.');

  // 8. ALERTAS (el pedido llegó cortado en este punto: criterios razonables con los datos que hay)
  const A: string[] = [];
  if (d.presupuesto && d.presupuesto > 0) {
    if (gastoMes > d.presupuesto) A.push(`Presupuesto del mes excedido en ${m2(gastoMes - d.presupuesto)}.`);
    else if (dia >= 15 && proyeccion > d.presupuesto) A.push(`A este ritmo el gasto cerraría en ${m2(proyeccion)}, sobre el presupuesto de ${m2(d.presupuesto)}.`);
  }
  const promTotal = completos.length ? suma(completos.map((x) => gas[x] ?? 0)) / completos.length : null;
  if (promTotal && proyeccion > promTotal * 1.2 && dia >= 15) A.push(`Gasto proyectado del mes (${m2(proyeccion)}) supera en más de 20% tu promedio (${m2(promTotal)}).`);
  if (completos.length) for (const [k, fila] of porCat) {
    const prom = suma(completos.map((x) => fila[x] ?? 0)) / completos.length, proy = dia > 0 ? ((fila[mesActual] ?? 0) / dia) * diasMes : 0;
    if (dia >= 15 && prom >= 50 && proy > prom * 1.5) A.push(`${nombreCat(k)}: proyección del mes ${m2(proy)} vs promedio ${m2(prom)}.`);
  }
  const sinId = (porCat.get('SINID') ?? {}), totalGasto = suma(meses.map((x) => gas[x] ?? 0)), totalSinId = suma(meses.map((x) => sinId[x] ?? 0));
  if (totalGasto > 0 && totalSinId / totalGasto > 0.1) A.push(`${((totalSinId / totalGasto) * 100).toFixed(0)}% del gasto está sin identificar (${m2(totalSinId)}): las categorías pierden precisión.`);
  for (const c of d.cuentas.filter((x) => !x.borrado)) if (saldo(c, d.movimientos) < 0) A.push(`Saldo negativo en ${c.nombre}: ${m2(saldo(c, d.movimientos))} (revisar movimientos o saldo inicial).`);
  for (const c of d.cuentas.filter((x) => !x.borrado)) {
    if (!c.conciliadoHasta) A.push(`${c.nombre} nunca se ha conciliado con el banco.`);
    else if (ahora.getTime() - Date.parse(c.conciliadoHasta) > 7 * 86_400_000) A.push(`${c.nombre} no se concilia desde hace más de 7 días.`);
  }
  if (amex && !meses.slice(-2).some((x) => (deu[x] ?? 0) > 0)) A.push(`Deuda Amex de ${m2(amex.e.pendienteCapital)} sin pagos registrados en los últimos 2 meses.`);
  if ((ing[mesActual] ?? 0) === 0 && dia >= 10 && completos.some((x) => (ing[x] ?? 0) > 0)) A.push('Sin ingresos registrados este mes pese a que hubo en meses anteriores.');
  L.push('', '## 8. Alertas', ...(A.length ? A.map((a) => `- ${a}`) : ['- Sin alertas.']));
  return L.join('\n');
}
