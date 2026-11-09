import { CATS, type Movimiento } from './finanzas';

/** Categorías de gasto que se ofrecen primero en el registro rápido. */
const POR_DEFECTO = ['ALIMENTACION', 'TRANSPORTE', 'COMPRAS', 'SERVICIOS', 'SALUD', 'DIVERSION'];

/**
 * Las `n` categorías de gasto más usadas en los últimos `dias` días (por cantidad de gastos),
 * completadas con las de siempre si hay pocas. `hoy` es explícito para que sea pura y testeable.
 */
export function categoriasFrecuentes(movimientos: Movimiento[], hoy: string, n = 6, dias = 60): string[] {
  const desde = menosDiasDesde(hoy, dias);
  const cuenta = new Map<string, number>();
  for (const m of movimientos) {
    if (m.borrado || m.tipo !== 'GASTO' || !m.categoria || m.categoria === 'SINID' || m.fecha < desde || m.fecha > hoy) continue;
    cuenta.set(m.categoria, (cuenta.get(m.categoria) ?? 0) + 1);
  }
  const validas = new Set(CATS.map((c) => c.id));
  const usadas = [...cuenta.entries()]
    .filter(([id]) => validas.has(id))
    .sort((a, b) => b[1] - a[1] || POR_DEFECTO.indexOf(a[0]) - POR_DEFECTO.indexOf(b[0]))
    .map(([id]) => id);
  return [...new Set([...usadas, ...POR_DEFECTO])].slice(0, n);
}

function menosDiasDesde(hoy: string, dias: number): string {
  const [a, m, d] = hoy.split('-').map(Number);
  const f = new Date(a, m - 1, d - dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

