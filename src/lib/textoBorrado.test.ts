import { describe, it, expect } from 'vitest';
import { textoBorradoMovimiento, textoBorradoPrestamo, textoBorradoSuscripcion } from './textoBorrado';
import type { Cuenta, Movimiento, Prestamo } from './finanzas';
import type { Compromiso } from './db';

const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-11-02' };
const MILL: Cuenta = { id: 'M', nombre: 'Millonaria', rol: 'BOVEDA', saldoInicial: 0, desde: '2026-11-02' };

describe('textoBorradoMovimiento', () => {
  it('monto y nota en el título; tipo, categoría, cuenta y fecha en el detalle', () => {
    const t = textoBorradoMovimiento({ id: '1', fecha: '2026-11-08', monto: 2, tipo: 'GASTO', categoria: 'TRANSPORTE', cuentaId: 'S', nota: 'pasaje' }, [SIMPLE, MILL]);
    expect(t.titulo).toBe('¿Borrar S/ 2.00 pasaje?');
    expect(t.detalle).toBe('Gasto · Transporte · Simple · 8 nov');
  });
  it('sin nota usa la categoría; sin categoría, el tipo', () => {
    const base = { id: '1', fecha: '2026-11-08', monto: 15, cuentaId: 'S' } as const;
    expect(textoBorradoMovimiento({ ...base, tipo: 'GASTO', categoria: 'ALIMENTACION' }, [SIMPLE]).titulo).toBe('¿Borrar S/ 15.00 Alimentación?');
    expect(textoBorradoMovimiento({ ...base, tipo: 'INGRESO' }, [SIMPLE]).titulo).toBe('¿Borrar S/ 15.00 Ingreso?');
  });
  it('un traspaso muestra origen y destino', () => {
    const t = textoBorradoMovimiento({ id: '1', fecha: '2026-11-06', monto: 300, tipo: 'TRASPASO', cuentaId: 'M', destinoId: 'S' }, [SIMPLE, MILL]);
    expect(t.detalle).toBe('Traspaso · Millonaria → Simple · 6 nov');
  });
});

describe('textoBorradoPrestamo', () => {
  const mov = (extra: Partial<Movimiento>): Movimiento => ({ id: Math.random().toString(), fecha: '2026-11-03', monto: 0, tipo: 'PRESTAMO', cuentaId: 'S', ...extra });
  const presto: Prestamo = { id: 'p1', tipo: 'PRESTE', persona: 'Persona Prueba', capital: 100, fecha: '2026-10-01' };

  it('préstamo que hice: monto y nombre, lo pendiente y su efecto en el valor neto', () => {
    const t = textoBorradoPrestamo(presto, [mov({ prestId: 'p1', dir: 'PRESTE', monto: 100 }), mov({ prestId: 'p1', dir: 'COBRO', monto: 40 })]);
    expect(t.titulo).toBe('¿Borrar el préstamo de S/ 100.00 a Persona Prueba?');
    expect(t.detalle).toBe('Te deben S/ 60.00 · desde el 1 oct · 2 movimientos registrados');
    expect(t.aviso).toContain('S/ 60.00 pendientes dejan de contar en tu valor neto (lo que te deben)');
    expect(t.aviso).toContain('Lo ya registrado en tus cuentas se queda');
  });
  it('deuda mía: lo dice como deuda', () => {
    const t = textoBorradoPrestamo({ id: 'p2', tipo: 'DEBO', persona: 'Tarjeta Prueba', capital: 50, fecha: '2026-02-22' }, [mov({ prestId: 'p2', dir: 'DEBO', monto: 50 })]);
    expect(t.titulo).toBe('¿Borrar la deuda de S/ 50.00 con Tarjeta Prueba?');
    expect(t.detalle).toContain('Debes S/ 50.00');
    expect(t.detalle).toContain('1 movimiento registrado');
    expect(t.aviso).toContain('(lo que debes)');
  });
  it('saldado: ya no hay nada pendiente que deje de contar', () => {
    const t = textoBorradoPrestamo(presto, [mov({ prestId: 'p1', dir: 'PRESTE', monto: 100 }), mov({ prestId: 'p1', dir: 'COBRO', monto: 100 })]);
    expect(t.aviso).toBe('Lo ya registrado en tus cuentas se queda.');
  });
  it('no cuenta movimientos borrados ni de otro préstamo', () => {
    const t = textoBorradoPrestamo(presto, [mov({ prestId: 'p1', dir: 'PRESTE', monto: 100, borrado: true }), mov({ prestId: 'otro', dir: 'PRESTE', monto: 9 })]);
    expect(t.detalle).toContain('0 movimientos registrados');
  });
});

describe('textoBorradoSuscripcion', () => {
  const sus: Compromiso = { id: 'c1', tipo: 'SUSCRIPCION', nombre: 'Servicio Prueba', monto: 30, diaCobro: 5 };
  it('monto y nombre; día de cobro y pagos registrados', () => {
    const pagos: Movimiento[] = [{ id: 'a', fecha: '2026-10-05', monto: 30, tipo: 'GASTO', cuentaId: 'S', compromisoId: 'c1' }];
    const t = textoBorradoSuscripcion(sus, pagos);
    expect(t.titulo).toBe('¿Borrar la suscripción Servicio Prueba de S/ 30.00?');
    expect(t.detalle).toBe('Se cobra el día 5 de cada mes · 1 pago registrado');
    expect(t.aviso).toContain('siguen en tus movimientos');
  });
  it('sin pagos no hay aviso extra', () => {
    const t = textoBorradoSuscripcion(sus, []);
    expect(t.detalle).toBe('Se cobra el día 5 de cada mes · 0 pagos registrados');
    expect(t.aviso).toBeUndefined();
  });
});
