import { describe, it, expect } from 'vitest';
import { estimarTokens, resumenAsesor, type DatosResumen } from './resumenAsesor';
import type { Cuenta, Movimiento, Prestamo } from './finanzas';

// Todo inventado. "Ahora" = 2026-11-10 14:44 en Lima (19:44 UTC): día 10 de 30.
const AHORA = new Date('2026-11-10T19:44:00Z');
const cuentas: Cuenta[] = [
  { id: 'c1', nombre: 'Corriente', rol: 'BILLETERA', saldoInicial: 1000, desde: '2026-08-01', conciliadoHasta: '2026-11-09T22:00:00-05:00' },
  { id: 'c2', nombre: 'Ahorros', rol: 'BOVEDA', saldoInicial: 5000, desde: '2026-08-01' },
];
let n = 0;
const mv = (fecha: string, tipo: Movimiento['tipo'], monto: number, extra: Partial<Movimiento> = {}): Movimiento => ({ id: `m${++n}`, fecha, tipo, monto, cuentaId: 'c1', categoria: null, ...extra });
const base = (): DatosResumen => ({ cuentas, movimientos: [], prestamos: [], compromisos: [], presupuesto: 0, capturasPendientes: 0, version: '1.2.3 (build 2026-11-10)' });
const fila = (txt: string, empieza: string) => txt.split('\n').find((l) => l.startsWith(empieza)) ?? '';

describe('resumenAsesor', () => {
  it('traspasos y pagos de deuda no son gasto; retiro de cajero cuenta completo; reembolso resta', () => {
    const d = base();
    d.prestamos = [{ id: 'p1', tipo: 'DEBO', persona: 'Amex', capital: 1200, acordado: 1200, fecha: '2026-09-20' }];
    d.movimientos = [
      mv('2026-10-01', 'INGRESO', 3000, { categoria: 'SUELDO' }),
      mv('2026-10-05', 'GASTO', 100, { categoria: 'ALIMENTACION' }),
      mv('2026-10-06', 'GASTO', 200, { categoria: 'EFECTIVO', nota: 'retiro' }),
      mv('2026-10-07', 'REEMBOLSO', 30, { categoria: 'ALIMENTACION' }),
      mv('2026-10-08', 'TRASPASO', 500, { cuentaId: 'c2', destinoId: 'c1' }),
      mv('2026-10-09', 'PRESTAMO', 400, { dir: 'PAGO', prestId: 'p1' }),
    ];
    const t = resumenAsesor(d, AHORA);
    expect(fila(t, '| 2026-10 |')).toBe('| 2026-10 | 3,000.00 | 270.00 | 500.00 | 400.00 | 2,730.00 |');
    expect(fila(t, '| Efectivo |')).toContain('200.00');
    expect(fila(t, '| Alimentación |')).toContain('70.00');
    expect(t).toContain('Tarjeta Amex: deuda actual 800.00');
  });

  it('el promedio usa solo meses completos con datos (no el mes en curso ni los anteriores al primer movimiento)', () => {
    const d = base();
    d.movimientos = [
      mv('2026-09-10', 'GASTO', 100, { categoria: 'TRANSPORTE' }),
      mv('2026-10-10', 'GASTO', 300, { categoria: 'TRANSPORTE' }),
      mv('2026-11-03', 'GASTO', 999, { categoria: 'TRANSPORTE' }),
    ];
    const t = resumenAsesor(d, AHORA);
    expect(t).toContain('promedio sobre 2 meses completos con datos');
    // (100 + 300) / 2 = 200; total de los 7 meses = 1,399
    expect(fila(t, '| Transporte |')).toMatch(/1,399\.00 \| 200\.00 \|$/);
  });

  it('no incluye columnas de meses anteriores al primer movimiento', () => {
    const d = base();
    d.movimientos = [mv('2026-10-10', 'GASTO', 10, { categoria: 'SALUD' })];
    const t = resumenAsesor(d, AHORA);
    expect(t).toContain('| 2026-10 |');
    expect(t).not.toContain('| 2026-09 |');
  });

  it('sin meses completos el promedio es "—"', () => {
    const d = base();
    d.movimientos = [mv('2026-11-02', 'GASTO', 50, { categoria: 'SALUD' })];
    const t = resumenAsesor(d, AHORA);
    expect(fila(t, '| Salud |')).toMatch(/50\.00 \| — \|$/);
  });

  it('presupuesto, ritmo y proyección del mes en curso', () => {
    const d = base();
    d.presupuesto = 1000;
    d.movimientos = [mv('2026-11-04', 'GASTO', 500, { categoria: 'COMPRAS', nota: 'zapatos' })];
    const t = resumenAsesor(d, AHORA);
    expect(t).toContain('gastado 500.00 (50%) · mes transcurrido 33%');
    expect(t).toContain('más rápido que el mes');
    expect(t).toContain('Día 10 de 30');
    expect(t).toContain('proyección de cierre de gasto 1,500.00');
    // Antes del día 15 la proyección es demasiado frágil para disparar una alerta.
    expect(t).not.toContain('A este ritmo');
    expect(resumenAsesor({ ...d, presupuesto: 600 }, new Date('2026-11-20T19:44:00Z'))).toContain('A este ritmo el gasto cerraría en 750.00, sobre el presupuesto de 600.00');
  });

  it('los 10 mayores gastos del mes van ordenados y excluyen traspasos e ingresos', () => {
    const d = base();
    d.movimientos = Array.from({ length: 12 }, (_, i) => mv('2026-11-02', 'GASTO', 10 + i, { categoria: 'ALIMENTACION', nota: `g${i}` }));
    d.movimientos.push(mv('2026-11-02', 'TRASPASO', 9999, { cuentaId: 'c2', destinoId: 'c1' }), mv('2026-11-03', 'INGRESO', 8888));
    const t = resumenAsesor(d, AHORA);
    const filas = t.split('\n').filter((l) => /^\| 2026-11-02 \| g\d+/.test(l));
    expect(filas).toHaveLength(10);
    expect(filas[0]).toContain('| g11 | 21.00 |');
    expect(t).not.toContain('9,999.00 | Sin identificar');
  });

  it('detecta recurrentes que se repiten 3 meses y no repite los ya registrados', () => {
    const d = base();
    d.compromisos = [{ id: 'k1', tipo: 'SUSCRIPCION', nombre: 'Musica', monto: 20, diaCobro: 14 }];
    d.movimientos = ['2026-09', '2026-10', '2026-11'].flatMap((m) => [
      mv(`${m}-05`, 'GASTO', 29.9, { categoria: 'SUSCRIPCIONES', nota: 'Gimnasio' }),
      mv(`${m}-14`, 'GASTO', 20, { categoria: 'SUSCRIPCIONES', nota: 'Música' }),
    ]);
    const t = resumenAsesor(d, AHORA);
    expect(t).toContain('Registrada: Musica 20.00 (cobra el día 14)');
    expect(t).toContain('Detectada (se repite 3 meses): Gimnasio ~29.90, hacia el día 5');
    expect(t).not.toContain('Detectada (se repite 3 meses): Música');
  });

  it('alertas: saldo negativo, sin conciliar, sin identificar y bandeja pendiente', () => {
    const d = base();
    d.capturasPendientes = 3;
    d.movimientos = [mv('2026-11-02', 'GASTO', 5000, { cuentaId: 'c1', categoria: null })];
    const t = resumenAsesor(d, AHORA);
    expect(t).toContain('Saldo negativo en Corriente');
    expect(t).toContain('Ahorros nunca se ha conciliado');
    expect(t).toContain('sin identificar');
    expect(t).toContain('hay 3 gastos por clasificar');
  });

  it('sin datos no se rompe', () => {
    const t = resumenAsesor(base(), AHORA);
    expect(t).toContain('sin movimientos');
    expect(t).toContain('Sin presupuesto definido');
  });

  it('con un año de datos denso sigue por debajo de 4.000 tokens', () => {
    const d = base();
    d.presupuesto = 2500;
    d.prestamos = [{ id: 'p1', tipo: 'DEBO', persona: 'Amex', capital: 1200, fecha: '2026-09-20' } as Prestamo];
    const cats = ['ALIMENTACION', 'TRANSPORTE', 'SALUD', 'SERVICIOS', 'DIVERSION', 'COMPRAS', 'EDUCACION', 'TRABAJO', 'EFECTIVO', 'SUSCRIPCIONES', 'SINID'];
    for (let mes = 5; mes <= 11; mes++) for (let dia = 1; dia <= 9; dia++) for (let k = 0; k < 7; k++) {
      d.movimientos.push(mv(`2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, 'GASTO', 20 + dia * 13 + k * 7, { categoria: cats[(dia + k) % cats.length], nota: `compra larga de ejemplo ${dia}-${k}` }));
    }
    const t = resumenAsesor(d, AHORA);
    expect(estimarTokens(t)).toBeLessThan(4000);
  });
});
