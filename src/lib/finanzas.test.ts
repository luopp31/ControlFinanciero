import { describe, it, expect } from 'vitest';
import {
  gastoPorCategoria,
  saldo,
  saldoTotal,
  estadoPrestamo,
  porCobrar,
  porPagar,
  totalAhorrado,
  valorNeto,
  serieValorNeto,
  type Cuenta,
  type Movimiento,
  type Prestamo,
} from './finanzas';

function cuenta(overrides: Partial<Cuenta> = {}): Cuenta {
  return {
    id: 'SIMPLE',
    nombre: 'Simple',
    rol: 'BILLETERA',
    saldoInicial: 100,
    desde: '2026-09-15',
    ...overrides,
  };
}

describe('saldo', () => {
  it('devuelve el saldo inicial cuando no hay movimientos', () => {
    expect(saldo(cuenta(), [])).toBe(100);
  });

  it('ignora movimientos anteriores a la fecha "desde" de la cuenta', () => {
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-01', monto: 500, tipo: 'INGRESO', cuentaId: 'SIMPLE' },
    ];
    expect(saldo(cuenta(), movs)).toBe(100);
  });

  it('suma movimientos en o después de "desde"', () => {
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-15', monto: 50, tipo: 'GASTO', cuentaId: 'SIMPLE' },
      { id: '2', fecha: '2026-09-16', monto: 30, tipo: 'INGRESO', cuentaId: 'SIMPLE' },
    ];
    expect(saldo(cuenta(), movs)).toBe(80);
  });

  it('ignora movimientos borrados', () => {
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-16', monto: 50, tipo: 'GASTO', cuentaId: 'SIMPLE', borrado: true },
    ];
    expect(saldo(cuenta(), movs)).toBe(100);
  });

  it('un traspaso resta de la cuenta origen y suma en la destino', () => {
    const origen = cuenta({ id: 'SIMPLE' });
    const destino = cuenta({ id: 'MILLONARIA', saldoInicial: 0 });
    const movs: Movimiento[] = [
      {
        id: '1',
        fecha: '2026-09-16',
        monto: 40,
        tipo: 'TRASPASO',
        cuentaId: 'SIMPLE',
        destinoId: 'MILLONARIA',
      },
    ];
    expect(saldo(origen, movs)).toBe(60);
    expect(saldo(destino, movs)).toBe(40);
  });
});

describe('saldoTotal', () => {
  it('suma el saldo de todas las cuentas', () => {
    const cuentas = [cuenta({ id: 'A', saldoInicial: 10 }), cuenta({ id: 'B', saldoInicial: 20 })];
    expect(saldoTotal(cuentas, [])).toBe(30);
  });
});

describe('estadoPrestamo', () => {
  it('un préstamo sin devoluciones queda con todo el capital pendiente', () => {
    const p: Prestamo = { id: 'p1', tipo: 'PRESTE', persona: 'Flavio', capital: 200, fecha: '2026-09-01' };
    const estado = estadoPrestamo(p, []);
    expect(estado.pendienteCapital).toBe(200);
    expect(estado.saldado).toBe(false);
  });

  it('un pago parcial reduce lo pendiente sin saldar', () => {
    const p: Prestamo = { id: 'p1', tipo: 'PRESTE', persona: 'Coco', capital: 200, fecha: '2026-09-01' };
    const movs: Movimiento[] = [
      { id: 'm1', fecha: '2026-09-10', monto: 80, tipo: 'PRESTAMO', cuentaId: 'SIMPLE', dir: 'COBRO', prestId: 'p1' },
    ];
    const estado = estadoPrestamo(p, movs);
    expect(estado.pendienteCapital).toBe(120);
    expect(estado.saldado).toBe(false);
  });

  it('un préstamo pagado por completo queda saldado', () => {
    const p: Prestamo = { id: 'p1', tipo: 'DEBO', persona: 'Banco', capital: 100, fecha: '2026-09-01' };
    const movs: Movimiento[] = [
      { id: 'm1', fecha: '2026-09-10', monto: 100, tipo: 'PRESTAMO', cuentaId: 'SIMPLE', dir: 'PAGO', prestId: 'p1' },
    ];
    const estado = estadoPrestamo(p, movs);
    expect(estado.pendienteCapital).toBe(0);
    expect(estado.saldado).toBe(true);
  });
});

describe('valorNeto', () => {
  it('incluye préstamos por cobrar y por pagar, no solo el saldo en cuentas', () => {
    const cuentas = [cuenta({ id: 'SIMPLE', saldoInicial: 1000 })];
    const prestamos: Prestamo[] = [
      { id: 'p1', tipo: 'PRESTE', persona: 'Flavio', capital: 300, fecha: '2026-09-01' },
      { id: 'p2', tipo: 'DEBO', persona: 'Coco', capital: 100, fecha: '2026-09-01' },
    ];
    // saldoTotal = 1000, porCobrar = 300, porPagar = 100 -> valorNeto = 1200
    expect(saldoTotal(cuentas, [])).toBe(1000);
    expect(porCobrar(prestamos, [])).toBe(300);
    expect(porPagar(prestamos, [])).toBe(100);
    expect(valorNeto(cuentas, [], prestamos)).toBe(1200);
  });

  it('el número de valorNeto nunca debe divergir de saldoTotal + porCobrar - porPagar', () => {
    const cuentas = [cuenta({ id: 'A', saldoInicial: 50 }), cuenta({ id: 'B', saldoInicial: 25 })];
    const prestamos: Prestamo[] = [
      { id: 'p1', tipo: 'PRESTE', persona: 'X', capital: 10, fecha: '2026-09-01' },
    ];
    const esperado = saldoTotal(cuentas, []) + porCobrar(prestamos, []) - porPagar(prestamos, []);
    expect(valorNeto(cuentas, [], prestamos)).toBe(esperado);
  });

  it('un ahorro resta el saldo de la cuenta pero no el valor neto — sigue siendo del usuario', () => {
    const cuentas = [cuenta({ id: 'SIMPLE', saldoInicial: 1000 })];
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-16', monto: 100, tipo: 'AHORRO', cuentaId: 'SIMPLE' },
    ];
    expect(saldoTotal(cuentas, movs)).toBe(900);
    expect(totalAhorrado(movs)).toBe(100);
    expect(valorNeto(cuentas, movs, [])).toBe(1000);
  });
});

describe('gastoPorCategoria', () => {
  it('suma el gasto de cada categoría dentro del rango, de mayor a menor', () => {
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-05', monto: 50, tipo: 'GASTO', categoria: 'ALIMENTACION', cuentaId: 'A' },
      { id: '2', fecha: '2026-09-10', monto: 30, tipo: 'GASTO', categoria: 'ALIMENTACION', cuentaId: 'A' },
      { id: '3', fecha: '2026-09-10', monto: 100, tipo: 'GASTO', categoria: 'TRANSPORTE', cuentaId: 'A' },
    ];
    expect(gastoPorCategoria(movs, '2026-09-01', '2026-09-30')).toEqual([
      { categoria: 'TRANSPORTE', monto: 100 },
      { categoria: 'ALIMENTACION', monto: 80 },
    ]);
  });

  it('ignora movimientos fuera de rango, borrados, y que no sean GASTO', () => {
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-08-31', monto: 50, tipo: 'GASTO', categoria: 'ALIMENTACION', cuentaId: 'A' },
      { id: '2', fecha: '2026-09-05', monto: 30, tipo: 'GASTO', categoria: 'ALIMENTACION', cuentaId: 'A', borrado: true },
      { id: '3', fecha: '2026-09-05', monto: 200, tipo: 'INGRESO', categoria: 'SUELDO', cuentaId: 'A' },
    ];
    expect(gastoPorCategoria(movs, '2026-09-01', '2026-09-30')).toEqual([]);
  });

  it('agrupa los gastos sin categoría bajo SINID', () => {
    const movs: Movimiento[] = [{ id: '1', fecha: '2026-09-05', monto: 40, tipo: 'GASTO', cuentaId: 'A' }];
    expect(gastoPorCategoria(movs, '2026-09-01', '2026-09-30')).toEqual([{ categoria: 'SINID', monto: 40 }]);
  });
});

describe('serieValorNeto', () => {
  it('recalcula el valor neto en cada fecha usando solo movimientos hasta ese día', () => {
    const c = cuenta({ id: 'SIMPLE', saldoInicial: 100, desde: '2026-09-01' });
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-10', monto: 50, tipo: 'INGRESO', cuentaId: 'SIMPLE' },
      { id: '2', fecha: '2026-09-12', monto: 20, tipo: 'GASTO', cuentaId: 'SIMPLE' },
    ];
    const serie = serieValorNeto([c], movs, [], ['2026-09-09', '2026-09-10', '2026-09-12']);
    expect(serie).toEqual([
      { fecha: '2026-09-09', valor: 100 },
      { fecha: '2026-09-10', valor: 150 },
      { fecha: '2026-09-12', valor: 130 },
    ]);
  });

  it('ignora movimientos posteriores a la fecha del punto', () => {
    const c = cuenta({ id: 'SIMPLE', saldoInicial: 0, desde: '2026-09-01' });
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-20', monto: 999, tipo: 'INGRESO', cuentaId: 'SIMPLE' },
    ];
    const serie = serieValorNeto([c], movs, [], ['2026-09-15']);
    expect(serie).toEqual([{ fecha: '2026-09-15', valor: 0 }]);
  });
});
