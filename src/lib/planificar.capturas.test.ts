import { describe, it, expect } from 'vitest';
import { planificar, type CuentaConciliar, type Decision, type EntradaPlan } from './planificar';
import { conReferencias } from './emparejar';
import type { Captura } from './db';
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';

// Todo inventado.
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 100, desde: '2026-11-02' };
const CONSULTA = { fecha: '2026-11-10', hora: '08:00' };
const AHORA = '2026-11-10T13:00:00.000Z';
let n = 0;

const fila = (descriptor: string, fecha: string, hora: string, soles: number): FilaBanco => ({ descriptor, fecha, hora, centimos: Math.round(soles * 100), pagina: 1 });
const ref = (f: FilaBanco) => conReferencias('S', [f])[0].referencia;
const cuenta = (filas: FilaBanco[], saldoDisponibleCent: number, decisiones: Record<string, Decision> = {}): CuentaConciliar => ({
  cuenta: SIMPLE, filas, consulta: CONSULTA, saldoDisponibleCent, cubreDesde: true, decisiones,
});
const entrada = (c: CuentaConciliar, over: Partial<EntradaPlan> = {}): EntradaPlan => ({
  cuentas: [c], movimientos: [], ignorados: [], reglas: [], ahora: AHORA, nuevoId: () => `r${++n}`, ...over,
});
const captura = (extra: Partial<Captura> = {}): Captura => ({
  id: 'c1', dedupeKey: 'op:1', montoCentimos: 250, moneda: 'PEN', destinatario: 'Alonso Perez Gomez', destino: 'Plin', codigoOperacion: '1',
  fechaHora: '2026-11-09T21:39:00-05:00', cuenta: null, origen: 'plin_correo', estado: 'pendiente', ...extra,
});
const gastoManual = (monto: number, categoria: string): Movimiento => ({ id: `g${++n}`, cuentaId: 'S', fecha: '2026-11-09', monto, tipo: 'GASTO', categoria });

const f = fila('YAPE-ALONSO', '2026-11-09', '21:41', -2.5);
const gasto: Decision = { accion: 'GASTO', categoria: 'TRANSPORTE' };

describe('planificar: capturas de la bandeja', () => {
  it('al cargar la fila del banco, la captura pendiente que coincide queda clasificada y apunta al movimiento', () => {
    const p = planificar(entrada(cuenta([f], 9750, { [ref(f)]: gasto }), { capturas: [captura()] }));
    expect(p.listo).toBe(true);
    expect(p.movimientos).toHaveLength(1);
    expect(p.capturas).toHaveLength(1);
    expect(p.capturas[0]).toMatchObject({ id: 'c1', estado: 'clasificado', categoria: 'TRANSPORTE', movimientoId: p.movimientos[0].id, sincronizado: false });
  });

  it('si el gasto ya estaba en Greedy (p. ej. lo registraste a mano), la captura también se enlaza a ese movimiento', () => {
    const manual = gastoManual(2.5, 'COMPRAS');
    const p = planificar(entrada(cuenta([f], 9750), { movimientos: [manual], capturas: [captura()] }));
    expect(p.movimientos).toEqual([]);
    expect(p.capturas).toEqual([expect.objectContaining({ id: 'c1', estado: 'clasificado', categoria: 'COMPRAS', movimientoId: manual.id })]);
  });

  it('sin coincidencia (otro nombre, otro monto, ya clasificada o fuera de fecha) no toca la captura', () => {
    for (const x of [{ destinatario: 'Angel Gomez' }, { montoCentimos: 300 }, { estado: 'clasificado' }, { fechaHora: '2026-11-01T10:00:00-05:00' }] as const) {
      const p = planificar(entrada(cuenta([f], 9750, { [ref(f)]: gasto }), { capturas: [captura(x)] }));
      expect(p.capturas).toEqual([]);
    }
  });

  it('dos filas iguales y una sola captura: se enlaza una; con dos capturas, las dos (a movimientos distintos)', () => {
    const g = fila('YAPE-ALONSO', '2026-11-09', '22:10', -2.5);
    const dec = { [ref(f)]: gasto, [ref(g)]: gasto };
    const una = planificar(entrada(cuenta([f, g], 9500, { ...dec }), { capturas: [captura()] }));
    expect(una.capturas).toHaveLength(1);
    const dos = planificar(entrada(cuenta([f, g], 9500, { ...dec }), { capturas: [captura(), captura({ id: 'c2', dedupeKey: 'op:2', fechaHora: '2026-11-09T22:09:00-05:00' })] }));
    expect(dos.capturas.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    expect(new Set(dos.capturas.map((c) => c.movimientoId)).size).toBe(2);
  });

  it('un movimiento creado desde la bandeja no se duplica al conciliar: ya estaba, sin escrituras', () => {
    const desdeBandeja: Movimiento = { id: 'mc', cuentaId: 'S', fecha: '2026-11-09', monto: 2.5, tipo: 'GASTO', categoria: 'TRANSPORTE', origen: 'captura', hora: '21:39', descriptor: 'PLIN-ALONSO', nota: 'Plin a Alonso Perez Gomez' };
    const p = planificar(entrada(cuenta([f], 9750), { movimientos: [desdeBandeja], capturas: [captura({ estado: 'clasificado', movimientoId: 'mc' })] }));
    expect(p.listo).toBe(true);
    expect(p.movimientos).toEqual([]);
    expect(p.capturas).toEqual([]);
    expect(p.verificaciones.S.cuadra).toBe(true);
  });

  it('sin capturas el plan no cambia', () => {
    expect(planificar(entrada(cuenta([f], 9750, { [ref(f)]: gasto }))).capturas).toEqual([]);
  });
});
