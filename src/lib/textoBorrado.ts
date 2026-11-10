// Textos del diálogo "¿Borrar …?": siempre con monto y nombre, y con lo que pasa de verdad al borrar.
import type { Compromiso } from './db';
import { CATS, CATS_ING, estadoPrestamo, pagosDeCompromiso, type Cuenta, type Movimiento, type Prestamo } from './finanzas';
import { formatearFechaCorta, formatearMonto } from './formato';

export interface TextoBorrado {
  titulo: string;
  detalle?: string;
  aviso?: string;
}

const soles = (n: number) => `S/ ${formatearMonto(n)}`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const TIPO_NOMBRE: Record<string, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  REEMBOLSO: 'Reembolso',
  TRASPASO: 'Traspaso',
  AHORRO: 'Ahorro',
  PRESTAMO: 'Préstamo',
};

/** Movimiento: "¿Borrar S/ 2.00 pasaje?" (la nota; si no tiene, su categoría o su tipo). */
export function textoBorradoMovimiento(m: Movimiento, cuentas: Cuenta[]): TextoBorrado {
  const cat = [...CATS, ...CATS_ING].find((c) => c.id === m.categoria)?.nombre;
  const nota = m.nota?.trim();
  const cuenta = cuentas.find((c) => c.id === m.cuentaId)?.nombre ?? '—';
  const destino = m.destinoId ? cuentas.find((c) => c.id === m.destinoId)?.nombre : null;
  return {
    titulo: `¿Borrar ${soles(m.monto)} ${nota || cat || TIPO_NOMBRE[m.tipo] || m.tipo}?`,
    detalle: `${TIPO_NOMBRE[m.tipo] ?? m.tipo}${cat && nota ? ` · ${cat}` : ''} · ${cuenta}${destino ? ` → ${destino}` : ''} · ${formatearFechaCorta(m.fecha)}`,
    aviso: 'Deja de contar en tus saldos y en las estadísticas.',
  };
}

/** Préstamo o deuda: avisa que lo pendiente deja de contar en el valor neto y que lo ya movido se queda en las cuentas. */
export function textoBorradoPrestamo(p: Prestamo, movimientos: Movimiento[]): TextoBorrado {
  const e = estadoPrestamo(p, movimientos);
  const esCobrar = p.tipo === 'PRESTE';
  const ligados = movimientos.filter((m) => !m.borrado && m.prestId === p.id).length;
  return {
    titulo: esCobrar ? `¿Borrar el préstamo de ${soles(p.capital)} a ${p.persona}?` : `¿Borrar la deuda de ${soles(p.capital)} con ${p.persona}?`,
    detalle: `${esCobrar ? 'Te deben' : 'Debes'} ${soles(e.pendienteCapital)} · desde el ${formatearFechaCorta(p.fecha)} · ${plural(ligados, 'movimiento registrado', 'movimientos registrados')}`,
    aviso:
      e.pendienteCapital > 0
        ? `Los ${soles(e.pendienteCapital)} pendientes dejan de contar en tu valor neto (${esCobrar ? 'lo que te deben' : 'lo que debes'}). Lo ya registrado en tus cuentas se queda.`
        : 'Lo ya registrado en tus cuentas se queda.',
  };
}

/** Suscripción (compromiso): los pagos ya registrados siguen como gastos. */
export function textoBorradoSuscripcion(c: Compromiso, movimientos: Movimiento[]): TextoBorrado {
  const pagos = pagosDeCompromiso(c.id, movimientos).length;
  return {
    titulo: `¿Borrar la suscripción ${c.nombre} de ${soles(c.monto)}?`,
    detalle: `${c.diaCobro ? `Se cobra el día ${c.diaCobro} de cada mes · ` : ''}${plural(pagos, 'pago registrado', 'pagos registrados')}`,
    aviso: pagos > 0 ? 'Los pagos ya registrados siguen en tus movimientos y en tus saldos.' : undefined,
  };
}
