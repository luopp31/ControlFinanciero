import { describe, it, expect } from 'vitest';
import { progresoPresupuesto, leerMonto } from './presupuesto';
import { categoriasFrecuentes } from './frecuentes';
import { totalGastos, type Movimiento } from './finanzas';

describe('progresoPresupuesto', () => {
  it('lo que llevas y lo que te queda', () => {
    expect(progresoPresupuesto(2030.51, 3000)).toMatchObject({ restante: 969.49, excedido: false });
    expect(progresoPresupuesto(2030.51, 3000).porcentaje).toBeCloseTo(67.68, 1);
  });
  it('pasarse del presupuesto: restante negativo y barra al 100%', () => {
    expect(progresoPresupuesto(3500, 3000)).toEqual({ restante: -500, porcentaje: 100, excedido: true });
  });
  it('sin presupuesto no hay porcentaje', () => {
    expect(progresoPresupuesto(100, 0).porcentaje).toBe(0);
  });
  it('usa el gasto neto: el reembolso resta (igual que Estadísticas)', () => {
    const m: Movimiento[] = [
      { id: '1', fecha: '2026-11-07', monto: 63.5, tipo: 'GASTO', cuentaId: 'S' },
      { id: '2', fecha: '2026-11-07', monto: 33.7, tipo: 'REEMBOLSO', cuentaId: 'S' },
    ];
    expect(progresoPresupuesto(totalGastos(m, '2026-11-01', '2026-11-30'), 100).restante).toBe(70.2);
  });
});

describe('leerMonto', () => {
  it.each([
    ['12', 12], ['12.5', 12.5], ['12,5', 12.5], ['2,030.50', 2030.5], ['1,000', 1000], [' 7 ', 7],
  ])('%s -> %s', (t, n) => expect(leerMonto(t)).toBe(n));
  it.each(['', '  ', '0', '-5', 'abc', '1,2,3'])('%j no es un monto', (t) => expect(leerMonto(t)).toBeNull());
});

describe('categoriasFrecuentes', () => {
  const g = (fecha: string, categoria: string | null, extra: Partial<Movimiento> = {}): Movimiento => ({ id: Math.random().toString(), fecha, monto: 5, tipo: 'GASTO', cuentaId: 'S', categoria, ...extra });
  const HOY = '2026-11-09';
  it('ordena por frecuencia reciente y completa con las de siempre', () => {
    const m = [g('2026-11-08', 'COMPRAS'), g('2026-11-07', 'COMPRAS'), g('2026-11-06', 'COMPRAS'), g('2026-11-08', 'SALUD'), g('2026-11-05', 'SALUD'), g('2026-11-04', 'EDUCACION')];
    expect(categoriasFrecuentes(m, HOY, 6)).toEqual(['COMPRAS', 'SALUD', 'EDUCACION', 'ALIMENTACION', 'TRANSPORTE', 'SERVICIOS']);
  });
  it('ignora lo viejo, lo borrado, lo que no es gasto y las categorías desconocidas o sin identificar', () => {
    const m = [
      g('2026-06-01', 'SALUD'), g('2026-11-08', 'SALUD', { borrado: true }), g('2026-11-08', 'SALUD', { tipo: 'INGRESO' }),
      g('2026-11-08', 'SINID'), g('2026-11-08', 'NOEXISTE'), g('2026-11-08', null), g('2026-11-10', 'SALUD'),
    ];
    expect(categoriasFrecuentes(m, HOY, 3)).toEqual(['ALIMENTACION', 'TRANSPORTE', 'COMPRAS']);
  });
  it('sin historial: las de siempre', () => {
    expect(categoriasFrecuentes([], HOY, 4)).toEqual(['ALIMENTACION', 'TRANSPORTE', 'COMPRAS', 'SERVICIOS']);
  });
});
