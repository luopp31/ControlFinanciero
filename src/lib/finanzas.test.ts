import { describe, it, expect } from 'vitest';
import {
  gastoPorCategoria,
  saldo,
  saldoTotal,
  estadoPrestamo,
  porCobrar,
  porPagar,
  totalAhorrado,
  pagosDeCompromiso,
  totalPagadoDeCompromiso,
  totalIngresos,
  totalGastos,
  totalesPorMes,
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

describe('pagosDeCompromiso / totalPagadoDeCompromiso', () => {
  const movs: Movimiento[] = [
    { id: '1', fecha: '2025-12-20', monto: 45.9, tipo: 'GASTO', cuentaId: 'SIMPLE', compromisoId: 'netflix' },
    { id: '2', fecha: '2026-01-20', monto: 45.9, tipo: 'GASTO', cuentaId: 'SIMPLE', compromisoId: 'netflix' },
    { id: '3', fecha: '2026-02-20', monto: 45.9, tipo: 'GASTO', cuentaId: 'SIMPLE', compromisoId: 'netflix' },
    { id: '4', fecha: '2026-02-15', monto: 19.9, tipo: 'GASTO', cuentaId: 'SIMPLE', compromisoId: 'spotify' },
    { id: '5', fecha: '2026-01-01', monto: 45.9, tipo: 'GASTO', cuentaId: 'SIMPLE', compromisoId: 'netflix', borrado: true },
  ];

  it('lista solo los pagos de ese compromiso, de más reciente a más antiguo', () => {
    const pagos = pagosDeCompromiso('netflix', movs);
    expect(pagos.map((m) => m.id)).toEqual(['3', '2', '1']);
  });

  it('suma solo los pagos dentro del rango de fechas', () => {
    expect(totalPagadoDeCompromiso('netflix', movs, '2026-01-01', '2026-12-31')).toBeCloseTo(91.8);
    expect(totalPagadoDeCompromiso('netflix', movs, '2026-01-01', '2026-01-31')).toBeCloseTo(45.9);
  });
});

describe('totalIngresos / totalGastos / totalesPorMes', () => {
  const movs: Movimiento[] = [
    { id: '1', fecha: '2026-01-10', monto: 2000, tipo: 'INGRESO', cuentaId: 'SIMPLE' },
    { id: '2', fecha: '2026-01-15', monto: 50, tipo: 'REEMBOLSO', cuentaId: 'SIMPLE' },
    { id: '3', fecha: '2026-01-20', monto: 300, tipo: 'GASTO', cuentaId: 'SIMPLE' },
    { id: '4', fecha: '2026-02-05', monto: 100, tipo: 'AHORRO', cuentaId: 'SIMPLE' },
    { id: '5', fecha: '2026-02-10', monto: 150, tipo: 'GASTO', cuentaId: 'SIMPLE' },
  ];

  it('totalIngresos suma solo INGRESO (el reembolso no es ingreso)', () => {
    expect(totalIngresos(movs, '2026-01-01', '2026-01-31')).toBe(2000);
    expect(totalIngresos(movs, '2026-02-01', '2026-02-28')).toBe(0);
  });

  it('totalGastos resta los REEMBOLSO del GASTO y no cuenta AHORRO', () => {
    expect(totalGastos(movs, '2026-01-01', '2026-01-31')).toBe(250);
    expect(totalGastos(movs, '2026-02-01', '2026-02-28')).toBe(150);
  });

  it('gastoPorCategoria resta el reembolso de su categoría', () => {
    const m: Movimiento[] = [
      { id: '1', fecha: '2026-11-07', monto: 63.5, tipo: 'GASTO', categoria: 'ALIMENTACION', cuentaId: 'A' },
      { id: '2', fecha: '2026-11-07', monto: 33.7, tipo: 'REEMBOLSO', categoria: 'ALIMENTACION', cuentaId: 'A' },
    ];
    expect(gastoPorCategoria(m, '2026-11-01', '2026-11-30')).toEqual([{ categoria: 'ALIMENTACION', monto: expect.closeTo(29.8, 5) }]);
  });

  it('totalesPorMes arma ingreso y gasto reales por cada mes pedido', () => {
    expect(totalesPorMes(movs, ['2026-01', '2026-02', '2026-03'])).toEqual([
      { mes: '2026-01', ingreso: 2000, gasto: 250 },
      { mes: '2026-02', ingreso: 0, gasto: 150 },
      { mes: '2026-03', ingreso: 0, gasto: 0 },
    ]);
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

  it('un ahorro anterior a la fecha desde de su cuenta no infla el valor neto', () => {
    const c = cuenta({ id: 'SIMPLE', saldoInicial: 100, desde: '2026-09-15' });
    const movs: Movimiento[] = [{ id: '1', fecha: '2026-09-01', monto: 40, tipo: 'AHORRO', cuentaId: 'SIMPLE' }];
    expect(serieValorNeto([c], movs, [], ['2026-09-20'])).toEqual([{ fecha: '2026-09-20', valor: 100 }]);
  });

  it('un préstamo pendiente cuenta completo aunque sea anterior a desde, sin tocar el saldo de la cuenta', () => {
    const c = cuenta({ id: 'SIMPLE', saldoInicial: 100, desde: '2026-11-02' });
    const p: Prestamo = { id: 'P', tipo: 'PRESTE', persona: 'Coco', capital: 950, fecha: '2026-10-01' };
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-10-01', monto: 950, tipo: 'PRESTAMO', dir: 'PRESTE', prestId: 'P', cuentaId: 'SIMPLE' },
    ];
    expect(saldo(c, movs)).toBe(100); // el movimiento previo a desde no mueve el saldo
    expect(valorNeto([c], movs, [p])).toBe(1050); // pero lo que te deben sí cuenta
  });

  it('no cuenta un préstamo en fechas anteriores a que existiera', () => {
    const c = cuenta({ id: 'SIMPLE', saldoInicial: 100, desde: '2026-09-01' });
    const p: Prestamo = { id: 'P', tipo: 'PRESTE', persona: 'Ana', capital: 50, fecha: '2026-09-10' };
    const movs: Movimiento[] = [
      { id: '1', fecha: '2026-09-10', monto: 50, tipo: 'PRESTAMO', dir: 'PRESTE', prestId: 'P', cuentaId: 'SIMPLE' },
    ];
    const serie = serieValorNeto([c], movs, [p], ['2026-09-09', '2026-09-10']);
    expect(serie).toEqual([
      { fecha: '2026-09-09', valor: 100 },
      { fecha: '2026-09-10', valor: 100 },
    ]);
  });
});
