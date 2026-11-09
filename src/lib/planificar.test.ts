import { describe, it, expect } from 'vitest';
import { planificar, decisionDesdePropuesta, type CuentaConciliar, type Decision, type EntradaPlan } from './planificar';
import { conReferencias } from './emparejar';
import { proponer } from './clasificador';
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';
import type { ReglaCategoria } from './db';

const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 100, desde: '2026-11-02' };
const MILL: Cuenta = { id: 'M', nombre: 'Millonaria', rol: 'BOVEDA', saldoInicial: 1000, desde: '2026-11-02' };
const CONSULTA = { fecha: '2026-11-09', hora: '11:46' };
const AHORA = '2026-11-09T17:00:00.000Z';
let ids = 0;
const nuevoId = () => `r${++ids}`;

const fila = (descriptor: string, fecha: string, hora: string, soles: number): FilaBanco => ({ descriptor, fecha, hora, centimos: Math.round(soles * 100), pagina: 1 });
const ref = (cuentaId: string, f: FilaBanco) => conReferencias(cuentaId, [f])[0].referencia;
const gasto = (cuentaId: string, fecha: string, monto: number, categoria?: string, nota = ''): Movimiento => ({ id: `g${++ids}`, cuentaId, fecha, monto, tipo: 'GASTO', categoria, nota });

function cuenta(c: Cuenta, filas: FilaBanco[], saldoDisponibleCent: number, decisiones: Record<string, Decision> = {}): CuentaConciliar {
  return { cuenta: c, filas, consulta: CONSULTA, saldoDisponibleCent, cubreDesde: true, decisiones };
}
const entrada = (cuentas: CuentaConciliar[], over: Partial<EntradaPlan> = {}): EntradaPlan => ({ cuentas, movimientos: [], ignorados: [], reglas: [], ahora: AHORA, nuevoId, ...over });

describe('decisionDesdePropuesta', () => {
  it('rellena lo que el clasificador ya sabe', () => {
    expect(decisionDesdePropuesta(proponer('INTERES GANADO', 12, []))).toEqual({ accion: 'INGRESO', categoria: 'INTERESES' });
    expect(decisionDesdePropuesta(proponer('RETIRO CAJERO', -5000, []))).toEqual({ accion: 'GASTO', categoria: 'EFECTIVO' });
    expect(decisionDesdePropuesta(proponer('PAGO MI TC', -1000, []), 'amex')).toEqual({ accion: 'PAGO_PRESTAMO', prestId: 'amex' });
    expect(decisionDesdePropuesta(proponer('PAGO MI TC', -1000, []))).toBeNull();
    expect(decisionDesdePropuesta(proponer('MIFARMA', -1000, []))).toBeNull();
  });
});

describe('planificar: movimientos', () => {
  const f = fila('SUPERM METRO SN FELIPE', '2026-11-08', '18:54', -25.6);
  const r = ref('S', f);
  const plan = planificar(entrada([cuenta(SIMPLE, [f], 7440, { [r]: { accion: 'GASTO', categoria: 'ALIMENTACION' } })]));

  it('crea el movimiento con los datos del banco, id determinista y pendiente de sync', () => {
    expect(plan.listo).toBe(true);
    expect(plan.movimientos).toHaveLength(1);
    expect(plan.movimientos[0]).toMatchObject({
      cuentaId: 'S', fecha: '2026-11-08', monto: 25.6, tipo: 'GASTO', categoria: 'ALIMENTACION',
      referencia: r, descriptor: 'SUPERM METRO SN FELIPE', origen: 'conciliar', hora: '18:54', sincronizado: false, actualizado: AHORA, borrado: false,
    });
    expect(plan.movimientos[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(planificar(entrada([cuenta(SIMPLE, [f], 7440, { [r]: { accion: 'GASTO', categoria: 'ALIMENTACION' } })])).movimientos[0].id).toBe(plan.movimientos[0].id);
  });
  it('proyecta la verificación con lo que se va a cargar y guarda "Conciliado hasta" si cuadra', () => {
    expect(plan.verificaciones.S.cuadra).toBe(true);
    expect(plan.cuentas).toHaveLength(1);
    expect(plan.cuentas[0]).toMatchObject({ id: 'S', conciliadoHasta: '2026-11-09T16:46:00.000Z', sincronizado: false });
  });
  it('si no cuadra no toca "Conciliado hasta" y no ofrece cuadrar a mano', () => {
    const p = planificar(entrada([cuenta(SIMPLE, [f], 9999, { [r]: { accion: 'GASTO', categoria: 'ALIMENTACION' } })]));
    expect(p.verificaciones.S.cuadra).toBe(false);
    expect(p.cuentas).toEqual([]);
  });
  it('es idempotente: con lo ya cargado, el mismo PDF no escribe nada', () => {
    const p2 = planificar(entrada([cuenta(SIMPLE, [f], 7440)], { movimientos: plan.movimientos }));
    expect(p2.listo).toBe(true);
    expect(p2.movimientos).toEqual([]);
    expect(p2.ignorados).toEqual([]);
    expect(p2.verificaciones.S.cuadra).toBe(true);
  });
  it('ingreso, reembolso y pago de préstamo según el signo', () => {
    const fi = fila('YAPE-LUIS EN', '2026-11-07', '20:07', 33.7);
    const fp = fila('PAGO MI TC', '2026-11-08', '09:00', -178.41);
    const p = planificar(entrada([
      cuenta(SIMPLE, [fi], 10000 + 3370, { [ref('S', fi)]: { accion: 'REEMBOLSO', categoria: 'ALIMENTACION' } }),
      cuenta(MILL, [fp], 100000 - 17841, { [ref('M', fp)]: { accion: 'PAGO_PRESTAMO', prestId: 'amex' } }),
    ]));
    expect(p.movimientos.find((m) => m.cuentaId === 'S')).toMatchObject({ tipo: 'REEMBOLSO', categoria: 'ALIMENTACION', monto: 33.7 });
    expect(p.movimientos.find((m) => m.cuentaId === 'M')).toMatchObject({ tipo: 'PRESTAMO', dir: 'PAGO', prestId: 'amex', monto: 178.41 });
    expect(p.verificaciones.S.cuadra && p.verificaciones.M.cuadra).toBe(true);
  });
  it('INGRESO sin categoría va a Otros', () => {
    const fi = fila('Transf Web/App', '2026-11-06', '17:26', 50);
    const p = planificar(entrada([cuenta(MILL, [fi], 105000, { [ref('M', fi)]: { accion: 'INGRESO' } })]));
    expect(p.movimientos[0]).toMatchObject({ tipo: 'INGRESO', categoria: 'OTROS' });
  });
});

describe('planificar: pendientes y errores', () => {
  it('una fila sin decisión deja el plan sin listo y no escribe nada', () => {
    const f = fila('OXXO', '2026-11-07', '21:42', -6.9);
    const p = planificar(entrada([cuenta(SIMPLE, [f], 9310)]));
    expect(p.listo).toBe(false);
    expect(p.sinResolver).toHaveLength(1);
    expect(p.movimientos).toEqual([]);
  });
  it('una decisión que contradice el signo es un error', () => {
    const f = fila('OXXO', '2026-11-07', '21:42', -6.9);
    const p = planificar(entrada([cuenta(SIMPLE, [f], 9310, { [ref('S', f)]: { accion: 'INGRESO' } })]));
    expect(p.listo).toBe(false);
    expect(p.errores).toHaveLength(1);
    const g = fila('YAPE-X', '2026-11-07', '21:42', 6.9);
    expect(planificar(entrada([cuenta(SIMPLE, [g], 10690, { [ref('S', g)]: { accion: 'GASTO', categoria: 'COMPRAS' } })])).errores).toHaveLength(1);
  });
});

describe('planificar: ignorar', () => {
  const f = fila('Transf Web/App', '2026-11-03', '14:04', -328.66);
  const r = ref('M', f);
  it('crea el ignorado con id determinista y la fila no vuelve a proponerse', () => {
    const p = planificar(entrada([cuenta(MILL, [f], 100000, { [r]: { accion: 'IGNORAR' } })]));
    expect(p.listo).toBe(true);
    expect(p.movimientos).toEqual([]);
    expect(p.ignorados).toEqual([expect.objectContaining({ cuentaId: 'M', referencia: r, monto: -328.66, fecha: '2026-11-03', sincronizado: false })]);
    expect(p.verificaciones.M.cuadra).toBe(true);
    const p2 = planificar(entrada([cuenta(MILL, [f], 100000)], { ignorados: p.ignorados }));
    expect(p2.listo).toBe(true);
    expect(p2.ignorados).toEqual([]);
  });
});

describe('planificar: traspasos', () => {
  const sale = fila('Transf Web/App', '2026-11-06', '12:14', -300);
  const entra = fila('Transf Web/App', '2026-11-06', '12:14', 300);
  it('las dos constancias se funden en UN traspaso', () => {
    const p = planificar(entrada([
      cuenta(MILL, [sale], 70000, { [ref('M', sale)]: { accion: 'TRASPASO', cuentaContrariaId: 'S' } }),
      cuenta(SIMPLE, [entra], 40000, { [ref('S', entra)]: { accion: 'TRASPASO', cuentaContrariaId: 'M' } }),
    ]));
    expect(p.listo).toBe(true);
    expect(p.movimientos).toHaveLength(1);
    expect(p.movimientos[0]).toMatchObject({ tipo: 'TRASPASO', cuentaId: 'M', destinoId: 'S', monto: 300, referencia: ref('M', sale) });
    expect(p.verificaciones.M.cuadra && p.verificaciones.S.cuadra).toBe(true);
    // Idempotente en ambas cuentas.
    const p2 = planificar(entrada([cuenta(MILL, [sale], 70000), cuenta(SIMPLE, [entra], 40000)], { movimientos: p.movimientos }));
    expect(p2.listo && p2.movimientos.length === 0).toBe(true);
  });
  it('el orden de las cuentas no cambia el resultado', () => {
    const p = planificar(entrada([
      cuenta(SIMPLE, [entra], 40000, { [ref('S', entra)]: { accion: 'TRASPASO', cuentaContrariaId: 'M' } }),
      cuenta(MILL, [sale], 70000, { [ref('M', sale)]: { accion: 'TRASPASO', cuentaContrariaId: 'S' } }),
    ]));
    expect(p.movimientos).toHaveLength(1);
    expect(p.movimientos[0]).toMatchObject({ cuentaId: 'M', destinoId: 'S' });
  });
  it('con una sola constancia: traspaso con la cuenta que elijas, en el sentido correcto', () => {
    const a = planificar(entrada([cuenta(MILL, [sale], 70000, { [ref('M', sale)]: { accion: 'TRASPASO', cuentaContrariaId: 'S' } })]));
    expect(a.movimientos[0]).toMatchObject({ cuentaId: 'M', destinoId: 'S' });
    const b = planificar(entrada([cuenta(SIMPLE, [entra], 40000, { [ref('S', entra)]: { accion: 'TRASPASO', cuentaContrariaId: 'M' } })]));
    expect(b.movimientos[0]).toMatchObject({ cuentaId: 'M', destinoId: 'S', monto: 300 });
  });
  it('misma cantidad pero distinto minuto: no se funden, son dos traspasos', () => {
    const entraOtroMinuto = fila('Transf Web/App', '2026-11-06', '12:15', 300);
    const p = planificar(entrada([
      cuenta(MILL, [sale], 70000, { [ref('M', sale)]: { accion: 'TRASPASO', cuentaContrariaId: 'S' } }),
      cuenta(SIMPLE, [entraOtroMinuto], 40000, { [ref('S', entraOtroMinuto)]: { accion: 'TRASPASO', cuentaContrariaId: 'M' } }),
    ]));
    expect(p.movimientos).toHaveLength(2);
  });
});

describe('planificar: diccionario', () => {
  const regla = (clave: string, tipo: ReglaCategoria['tipo'], categoria: string, veces: number): ReglaCategoria => ({ id: `x-${clave}`, clave, tipo, categoria, vecesConfirmada: veces, actualizado: '2026-11-01T00:00:00Z' });

  it('clasificar una persona nueva guarda la regla con 1 confirmación', () => {
    const f = fila('YAPE-ANGEL G', '2026-11-08', '17:19', -2.5);
    const p = planificar(entrada([cuenta(SIMPLE, [f], 9750, { [ref('S', f)]: { accion: 'GASTO', categoria: 'TRANSPORTE' } })]));
    expect(p.reglas).toEqual([expect.objectContaining({ clave: 'YAPE-ANGEL G', tipo: 'PERSONA', categoria: 'TRANSPORTE', vecesConfirmada: 1, sincronizado: false })]);
  });
  it('confirmar una regla de persona con 1 voto la sube a 2 (automática desde ahí)', () => {
    const f = fila('YAPE-ANGEL G', '2026-11-08', '17:19', -2.5);
    const p = planificar(entrada([cuenta(SIMPLE, [f], 9750, { [ref('S', f)]: { accion: 'GASTO', categoria: 'TRANSPORTE' } })], { reglas: [regla('YAPE-ANGEL G', 'PERSONA', 'TRANSPORTE', 1)] }));
    expect(p.reglas).toEqual([expect.objectContaining({ id: 'x-YAPE-ANGEL G', vecesConfirmada: 2 })]);
  });
  it('una regla automática no se vuelve a tocar', () => {
    const f = fila('OXXO', '2026-11-07', '21:42', -6.9);
    const p = planificar(entrada([cuenta(SIMPLE, [f], 9310, { [ref('S', f)]: { accion: 'GASTO', categoria: 'ALIMENTACION' } })], { reglas: [regla('OXXO', 'COMERCIO', 'ALIMENTACION', 1)] }));
    expect(p.reglas).toEqual([]);
  });
  it('dos filas de la misma persona en una importación cuentan como una sola confirmación', () => {
    const a = fila('YAPE-JUAN C', '2026-11-08', '12:38', -2);
    const b = fila('YAPE-JUAN C', '2026-11-08', '16:00', -2);
    const d: Decision = { accion: 'GASTO', categoria: 'TRANSPORTE' };
    const p = planificar(entrada([cuenta(SIMPLE, [a, b], 9600, { [ref('S', a)]: d, [ref('S', b)]: d })]));
    expect(p.reglas).toHaveLength(1);
    expect(p.reglas[0].vecesConfirmada).toBe(1);
  });
  it('siembra el diccionario con los "ya estaban" (veces = 1), sin pisar reglas existentes', () => {
    const f1 = fila('YAPE-JUAN C', '2026-11-08', '12:38', -2);
    const f2 = fila('OXXO', '2026-11-07', '21:42', -6.9);
    const p = planificar(entrada([cuenta(SIMPLE, [f1, f2], 9110)], {
      movimientos: [gasto('S', '2026-11-08', 2, 'TRANSPORTE'), gasto('S', '2026-11-07', 6.9, 'COMPRAS')],
      reglas: [regla('OXXO', 'COMERCIO', 'ALIMENTACION', 3)],
    }));
    expect(p.reglas).toEqual([expect.objectContaining({ clave: 'YAPE-JUAN C', categoria: 'TRANSPORTE', vecesConfirmada: 1 })]);
  });
});
