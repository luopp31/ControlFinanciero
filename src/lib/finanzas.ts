// Lógica de dominio pura: sin IO, sin fechas implícitas (Date.now()), fácil de testear.
// Portado desde legacy/index.html (líneas 980-1017 de la app anterior "Sol"), donde
// ya estaba correcta — el bug original era de sincronización/estado, no de estos cálculos.

export type RolCuenta = 'BILLETERA' | 'BOVEDA';

export interface Cuenta {
  id: string;
  nombre: string;
  rol: RolCuenta;
  saldoInicial: number;
  /** Fecha ISO (YYYY-MM-DD) desde la que los movimientos afectan el saldo. */
  desde: string;
  borrado?: boolean;
  /** ISO datetime de la última modificación local — usado por el sync para
   * decidir qué versión gana (la más reciente), fila por fila. */
  actualizado?: string;
  /** false/ausente = pendiente de subir a Supabase. */
  sincronizado?: boolean;
}

export type TipoMovimiento =
  | 'GASTO'
  | 'INGRESO'
  | 'REEMBOLSO'
  | 'TRASPASO'
  | 'AHORRO'
  | 'PRESTAMO';

export type DireccionPrestamo = 'PRESTE' | 'DEBO' | 'COBRO' | 'PAGO';

export interface Movimiento {
  id: string;
  fecha: string; // ISO YYYY-MM-DD
  monto: number;
  tipo: TipoMovimiento;
  categoria?: string | null;
  cuentaId: string;
  destinoId?: string | null; // solo TRASPASO
  dir?: DireccionPrestamo | null; // solo PRESTAMO
  prestId?: string | null; // solo PRESTAMO
  compromisoId?: string | null; // pago real de una suscripción/cuota
  nota?: string | null;
  borrado?: boolean;
  actualizado?: string;
  sincronizado?: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  icono: 'fork-knife' | 'bus' | 'heart' | 'wifi-high' | 'confetti' | 'shopping-bag' | 'book-open' | 'question' | 'briefcase' | 'gift' | 'wrench' | 'tag' | 'sparkle';
  /** Color de identidad de la categoría (mismo hex que usaba la app anterior). */
  color: string;
}

/** Color efectivo de una categoría: el que el usuario haya elegido en Ajustes
 * (Config.catColor), o si no personalizó nada, el de identidad por defecto. */
export function colorCategoria(cat: Categoria, catColor?: Record<string, string>): string {
  return catColor?.[cat.id] ?? cat.color;
}

// Portado de legacy/index.html:573-589.
export const CATS: Categoria[] = [
  { id: 'ALIMENTACION', nombre: 'Alimentación', icono: 'fork-knife', color: '#FFB020' },
  { id: 'TRANSPORTE', nombre: 'Transporte', icono: 'bus', color: '#3DE39A' },
  { id: 'SALUD', nombre: 'Salud', icono: 'heart', color: '#5CC8FF' },
  { id: 'SERVICIOS', nombre: 'Servicios', icono: 'wifi-high', color: '#9A93AC' },
  { id: 'DIVERSION', nombre: 'Diversión', icono: 'confetti', color: '#FF5C86' },
  { id: 'COMPRAS', nombre: 'Compras', icono: 'shopping-bag', color: '#FF8FD6' },
  { id: 'EDUCACION', nombre: 'Educación', icono: 'book-open', color: '#8B5CF6' },
  { id: 'SINID', nombre: 'Sin identificar', icono: 'question', color: '#5A5368' },
];

export const CATS_ING: Categoria[] = [
  { id: 'SUELDO', nombre: 'Sueldo', icono: 'briefcase', color: '#3DE39A' },
  { id: 'EXTRAS', nombre: 'Extras laborales', icono: 'gift', color: '#5CC8FF' },
  { id: 'FREELANCE', nombre: 'Trabajos aparte', icono: 'wrench', color: '#FFB020' },
  { id: 'VENTAS', nombre: 'Ventas', icono: 'tag', color: '#FF8FD6' },
  { id: 'OTROS', nombre: 'Otros', icono: 'sparkle', color: '#9A93AC' },
];

export const TIPOS: { id: TipoMovimiento; nombre: string }[] = [
  { id: 'GASTO', nombre: 'Gasto' },
  { id: 'INGRESO', nombre: 'Ingreso' },
  { id: 'REEMBOLSO', nombre: 'Reembolso' },
  { id: 'TRASPASO', nombre: 'Traspaso' },
  { id: 'AHORRO', nombre: 'Ahorro' },
  { id: 'PRESTAMO', nombre: 'Préstamo' },
];

export type TipoPrestamo = 'PRESTE' | 'DEBO';

export interface Prestamo {
  id: string;
  tipo: TipoPrestamo;
  persona: string;
  capital: number;
  acordado?: number | null;
  fecha: string;
  borrado?: boolean;
  actualizado?: string;
  sincronizado?: boolean;
}

/** Qué le hace un movimiento al saldo de una cuenta específica. */
export function efecto(m: Movimiento, cuentaId: string): number {
  if (m.cuentaId === cuentaId) {
    if (m.tipo === 'INGRESO' || m.tipo === 'REEMBOLSO') return m.monto;
    if (m.tipo === 'GASTO' || m.tipo === 'AHORRO') return -m.monto;
    if (m.tipo === 'TRASPASO') return -m.monto;
    if (m.tipo === 'PRESTAMO') {
      return m.dir === 'DEBO' || m.dir === 'COBRO' ? m.monto : -m.monto;
    }
  }
  if (m.tipo === 'TRASPASO' && m.destinoId === cuentaId) return m.monto;
  return 0;
}

function movimientosActivos(movimientos: Movimiento[]): Movimiento[] {
  return movimientos.filter((m) => !m.borrado);
}

/** Saldo inicial + efecto de movimientos desde la fecha de corte de la cuenta. */
export function saldo(cuenta: Cuenta, movimientos: Movimiento[]): number {
  const desde = cuenta.desde || '';
  return movimientosActivos(movimientos).reduce((s, m) => {
    if (desde && m.fecha < desde) return s;
    return s + efecto(m, cuenta.id);
  }, cuenta.saldoInicial || 0);
}

export function saldoTotal(cuentas: Cuenta[], movimientos: Movimiento[]): number {
  return cuentas.reduce((s, c) => s + saldo(c, movimientos), 0);
}

function movidoDe(
  prestId: string,
  dirs: DireccionPrestamo[],
  movimientos: Movimiento[]
): number {
  return movimientosActivos(movimientos)
    .filter((m) => m.tipo === 'PRESTAMO' && m.prestId === prestId && m.dir && dirs.includes(m.dir))
    .reduce((s, m) => s + m.monto, 0);
}

export interface EstadoPrestamo {
  capital: number;
  meta: number;
  devuelto: number;
  falta: number;
  pendienteCapital: number;
  saldado: boolean;
}

export function estadoPrestamo(p: Prestamo, movimientos: Movimiento[]): EstadoPrestamo {
  const entregado =
    movidoDe(p.id, p.tipo === 'PRESTE' ? ['PRESTE'] : ['DEBO'], movimientos) || p.capital;
  const devuelto = movidoDe(p.id, p.tipo === 'PRESTE' ? ['COBRO'] : ['PAGO'], movimientos);
  const meta = p.acordado || p.capital;
  return {
    capital: entregado,
    meta,
    devuelto,
    falta: Math.max(0, meta - devuelto),
    pendienteCapital: Math.max(0, entregado - devuelto),
    saldado: devuelto >= meta - 0.004,
  };
}

/** Dirección del movimiento cuando alguien devuelve dinero de un préstamo:
 * si tú prestaste (PRESTE), te lo devuelven = COBRO; si a ti te prestaron
 * (DEBO), tú devuelves = PAGO. */
export function direccionPago(tipo: TipoPrestamo): DireccionPrestamo {
  return tipo === 'PRESTE' ? 'COBRO' : 'PAGO';
}

export function porCobrar(prestamos: Prestamo[], movimientos: Movimiento[]): number {
  return prestamos
    .filter((p) => !p.borrado && p.tipo === 'PRESTE')
    .reduce((s, p) => s + estadoPrestamo(p, movimientos).pendienteCapital, 0);
}

export function porPagar(prestamos: Prestamo[], movimientos: Movimiento[]): number {
  return prestamos
    .filter((p) => !p.borrado && p.tipo === 'DEBO')
    .reduce((s, p) => s + estadoPrestamo(p, movimientos).pendienteCapital, 0);
}

/** Total puesto en "ahorro": sale del saldo de la cuenta de origen (como un
 * gasto), pero sigue siendo del usuario, así que se suma de vuelta al valor
 * neto — el mismo efecto que tendría un traspaso a una cuenta no rastreada. */
export function totalAhorrado(movimientos: Movimiento[]): number {
  return movimientosActivos(movimientos)
    .filter((m) => m.tipo === 'AHORRO')
    .reduce((s, m) => s + m.monto, 0);
}

/** Pagos reales registrados para una suscripción/cuota, de más reciente a
 * más antiguo. */
export function pagosDeCompromiso(compromisoId: string, movimientos: Movimiento[]): Movimiento[] {
  return movimientosActivos(movimientos)
    .filter((m) => m.compromisoId === compromisoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Suma de los pagos de una suscripción/cuota cuya fecha cae en [desde, hasta]. */
export function totalPagadoDeCompromiso(
  compromisoId: string,
  movimientos: Movimiento[],
  desde: string,
  hasta: string
): number {
  return pagosDeCompromiso(compromisoId, movimientos)
    .filter((m) => m.fecha >= desde && m.fecha <= hasta)
    .reduce((s, m) => s + m.monto, 0);
}

export interface CategoriaTotal {
  categoria: string;
  monto: number;
}

/** Total gastado por categoría dentro de [desde, hasta] (fechas ISO, ambas
 * incluidas), de mayor a menor — sólo movimientos de tipo GASTO. Los gastos
 * sin categoría se agrupan bajo 'SINID', igual que en la app anterior. */
export function gastoPorCategoria(movimientos: Movimiento[], desde: string, hasta: string): CategoriaTotal[] {
  const totales = new Map<string, number>();
  for (const m of movimientosActivos(movimientos)) {
    if (m.tipo !== 'GASTO') continue;
    if (m.fecha < desde || m.fecha > hasta) continue;
    const categoria = m.categoria || 'SINID';
    totales.set(categoria, (totales.get(categoria) ?? 0) + m.monto);
  }
  return Array.from(totales.entries())
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto);
}

/**
 * Valor neto = saldo en cuentas + lo que te deben − lo que debes + lo ahorrado.
 * Importante: cualquier gráfico o resumen de valor neto debe usar ESTA función
 * completa, nunca solo saldoTotal() — ese fue uno de los bugs de la app anterior
 * (el número principal incluía préstamos pero la curva no, y nunca coincidían).
 */
export function valorNeto(
  cuentas: Cuenta[],
  movimientos: Movimiento[],
  prestamos: Prestamo[]
): number {
  return (
    saldoTotal(cuentas, movimientos) +
    porCobrar(prestamos, movimientos) -
    porPagar(prestamos, movimientos) +
    totalAhorrado(movimientos)
  );
}

/**
 * Valor neto en cada fecha de `fechas` (ascendente), recalculado desde cero cada
 * vez a partir de los movimientos reales hasta ese día — no un acumulador
 * incremental. Es más simple y evita la clase de bug de la app anterior, donde
 * la base del gráfico y el saldo real podían desincronizarse.
 * `fechas` la arma quien llama (ver `menosDiasISO` en `lib/fecha.ts`) para que
 * esta función se quede pura y testeable con fechas fijas.
 */
export function serieValorNeto(
  cuentas: Cuenta[],
  movimientos: Movimiento[],
  prestamos: Prestamo[],
  fechas: string[]
): { fecha: string; valor: number }[] {
  return fechas.map((fecha) => {
    const hastaFecha = movimientos.filter((m) => m.fecha <= fecha);
    return { fecha, valor: valorNeto(cuentas, hastaFecha, prestamos) };
  });
}
