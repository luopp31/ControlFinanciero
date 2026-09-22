import { describe, it, expect } from 'vitest';
import { promedioGastoMensual, simular } from './simulacion';
import type { Movimiento } from './finanzas';

describe('simular', () => {
  it('prorratea el mes actual por los días que faltan y resta un mes completo por cada mes siguiente', () => {
    // Hoy: 22 de septiembre de 2026. Fin: 31 de diciembre (default).
    const hoy = new Date(2026, 8, 22);
    const r = simular(5000, 1000, [], hoy);

    // Septiembre tiene 30 días; quedan 9 (22 al 30 inclusive) -> 1000 * 9/30 = 300.
    expect(r.puntos).toEqual([
      { mes: '2026-09', valor: 4700 },
      { mes: '2026-10', valor: 3700 },
      { mes: '2026-11', valor: 2700 },
      { mes: '2026-12', valor: 1700 },
    ]);
    expect(r.valorFinal).toBe(1700);
    expect(r.totalGastadoProyectado).toBe(3300);
  });

  it('suma los ingresos extra en el mes en que caen', () => {
    const hoy = new Date(2026, 8, 22);
    const r = simular(5000, 1000, [{ monto: 500, fecha: '2026-11-15' }], hoy);

    expect(r.puntos.find((p) => p.mes === '2026-11')?.valor).toBe(3200);
    expect(r.valorFinal).toBe(2200);
    expect(r.totalExtrasProyectado).toBe(500);
  });

  it('con hoy=31 de diciembre solo queda ese día prorrateado', () => {
    const hoy = new Date(2026, 11, 31);
    const r = simular(1000, 3100, [], hoy);
    expect(r.puntos).toEqual([{ mes: '2026-12', valor: 900 }]);
  });

  it('respeta una fecha de fin explícita distinta a fin de año', () => {
    const hoy = new Date(2026, 8, 1);
    const r = simular(1000, 300, [], hoy, '2026-09-30');
    expect(r.puntos).toEqual([{ mes: '2026-09', valor: 700 }]);
  });
});

describe('promedioGastoMensual', () => {
  it('promedia los últimos N meses completos, sin contar el mes actual', () => {
    const hoy = new Date(2026, 8, 22); // septiembre
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-06-10', monto: 1200, tipo: 'GASTO', cuentaId: 'A' },
      { id: '2', fecha: '2026-07-10', monto: 1000, tipo: 'GASTO', cuentaId: 'A' },
      { id: '3', fecha: '2026-08-10', monto: 800, tipo: 'GASTO', cuentaId: 'A' },
      { id: '4', fecha: '2026-09-10', monto: 50, tipo: 'GASTO', cuentaId: 'A' }, // mes actual, se ignora
    ];
    expect(promedioGastoMensual(movs, 3, hoy)).toBe(1000);
  });

  it('devuelve 0 sin historial', () => {
    expect(promedioGastoMensual([], 3, new Date(2026, 8, 22))).toBe(0);
  });
});
