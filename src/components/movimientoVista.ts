import { CATS, CATS_ING, type Cuenta, type Movimiento } from '../lib/finanzas';
import { formatearFechaCorta } from '../lib/formato';
import { CATEGORIA_ICONOS, IconQuestion, TIPO_COLOR, TIPO_ICONOS } from './icons';

const TIPO_NOMBRE: Record<string, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  REEMBOLSO: 'Reembolso',
  TRASPASO: 'Traspaso',
  AHORRO: 'Ahorro',
  PRESTAMO: 'Préstamo',
};

/** Nombre, ícono y color de identidad (un tono pastel) de un movimiento. */
export function infoVisual(m: Movimiento) {
  if (m.categoria) {
    const cat = [...CATS, ...CATS_ING].find((c) => c.id === m.categoria);
    if (cat) return { nombre: cat.nombre, Icono: CATEGORIA_ICONOS[cat.icono] ?? IconQuestion, color: cat.color };
  }
  return {
    nombre: TIPO_NOMBRE[m.tipo] ?? m.tipo,
    Icono: TIPO_ICONOS[m.tipo] ?? IconQuestion,
    color: TIPO_COLOR[m.tipo] ?? '#C9C6D6',
  };
}

/** "−" lo que sale, "+" lo que entra; el traspaso va sin signo. */
export function signoDe(tipo: Movimiento['tipo']): string {
  if (tipo === 'INGRESO' || tipo === 'REEMBOLSO') return '+';
  if (tipo === 'GASTO' || tipo === 'AHORRO') return '−';
  return '';
}

export function textoCuentas(m: Movimiento, cuentas: Cuenta[]): string {
  const cuenta = cuentas.find((c) => c.id === m.cuentaId);
  const destino = m.destinoId ? cuentas.find((c) => c.id === m.destinoId) : null;
  return `${cuenta?.nombre ?? '—'}${destino ? ` → ${destino.nombre}` : ''}`;
}

/** Lo que va como título (la nota, si la hay) y como detalle (categoría, cuentas y hora). Si la nota repite la categoría, no se dice dos veces. */
export function titulosDe(m: Movimiento, cuentas: Cuenta[], nombre: string): { titulo: string; detalle: string } {
  const nota = m.nota?.trim();
  return {
    titulo: nota || nombre,
    detalle: [nota && nota.toLowerCase() !== nombre.toLowerCase() ? nombre : null, textoCuentas(m, cuentas), m.hora ?? formatearFechaCorta(m.fecha)].filter(Boolean).join(' · '),
  };
}
