import { describe, it, expect } from 'vitest';
import { verificar, saldoGreedyAlMomento, instanteConsulta, nuevoConciliadoHasta } from './verificar';
import { conReferencias } from './emparejar';
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';

// Simple: 229.33 al inicio; gastos 25.60 + 16.00 + 100 de traspaso recibido => 229.33 - 41.60 + 100 = 287.73
const CUENTA: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 229.33, desde: '2026-11-02' };
const CONSULTA = { fecha: '2026-11-09', hora: '11:46' };
let n = 0;
const mov = (p: Partial<Movimiento> & Pick<Movimiento, 'fecha' | 'monto' | 'tipo' | 'cuentaId'>): Movimiento => ({ id: `m${++n}`, ...p });
const gasto = (fecha: string, monto: number, extra: Partial<Movimiento> = {}) => mov({ cuentaId: 'S', fecha, monto, tipo: 'GASTO', ...extra });
const fila = (descriptor: string, fecha: string, hora: string, soles: number): FilaBanco => ({ descriptor, fecha, hora, centimos: Math.round(soles * 100), pagina: 1 });

const movs = [
  gasto('2026-11-08', 25.6),
  gasto('2026-11-08', 16),
  mov({ cuentaId: 'M', destinoId: 'S', fecha: '2026-11-08', monto: 100, tipo: 'TRASPASO' }),
];
const filas = [
  fila('SUPERM METRO SN FELIPE', '2026-11-08', '18:54', -25.6),
  fila('YAPE-ALONSO', '2026-11-08', '18:23', -16),
  fila('Transf Web/App', '2026-11-08', '18:23', 100),
];
const BANCO = 28773;
const base = (over: Record<string, unknown> = {}) => ({ cuenta: CUENTA, filas, movimientos: movs, ignorados: [], consulta: CONSULTA, cubreDesde: true, saldoDisponibleCent: BANCO, ...over }) as Parameters<typeof verificar>[0];

describe('saldoGreedyAlMomento', () => {
  it('saldo inicial + efecto de los movimientos desde la fecha de corte, en céntimos', () => {
    expect(saldoGreedyAlMomento(base())).toBe(28773);
  });
  it('no cuenta borrados, anteriores a la fecha de corte ni posteriores a la consulta', () => {
    const extra = [gasto('2026-11-08', 5, { borrado: true }), gasto('2026-11-01', 5), gasto('2026-11-10', 5)];
    expect(saldoGreedyAlMomento(base({ movimientos: [...movs, ...extra] }))).toBe(28773);
  });
  it('el mismo día de la consulta: excluye los de hora posterior, incluye los de hora anterior o sin hora', () => {
    const tarde = gasto('2026-11-09', 5, { hora: '15:00' });
    const temprano = gasto('2026-11-09', 7, { hora: '08:00' });
    const sinHora = gasto('2026-11-09', 1);
    expect(saldoGreedyAlMomento(base({ movimientos: [...movs, tarde, temprano, sinHora] }))).toBe(28773 - 700 - 100);
  });
  it('no arrastra error de coma flotante', () => {
    const c = { ...CUENTA, saldoInicial: 0.1 };
    const m = [mov({ cuentaId: 'S', fecha: '2026-11-03', monto: 0.2, tipo: 'INGRESO' })];
    expect(saldoGreedyAlMomento({ cuenta: c, movimientos: m, consulta: CONSULTA })).toBe(30);
  });
});

describe('verificar', () => {
  it('cuadra: diferencia 0 y nada que listar', () => {
    const v = verificar(base());
    expect(v).toMatchObject({ cuadra: true, greedyCent: 28773, bancoCent: 28773, diferenciaCent: 0, sinExplicarCent: 0 });
    expect(v.faltanEnGreedy).toEqual([]);
    expect(v.sobranEnGreedy).toEqual([]);
  });
  it('difiere porque falta un cargo en Greedy: lo lista y lo explica entero', () => {
    const v = verificar(base({ filas: [...filas, fila('OXXO', '2026-11-07', '21:42', -6.9)], saldoDisponibleCent: BANCO - 690 }));
    expect(v.cuadra).toBe(false);
    expect(v.diferenciaCent).toBe(-690);
    expect(v.faltanEnGreedy.map((f) => f.centimos)).toEqual([-690]);
    expect(v.sinExplicarCent).toBe(0);
  });
  it('difiere porque sobra un movimiento en Greedy (duplicado): lo lista y lo explica entero', () => {
    const dup = gasto('2026-11-08', 16, { nota: 'duplicado' });
    const v = verificar(base({ movimientos: [...movs, dup], saldoDisponibleCent: BANCO }));
    expect(v.cuadra).toBe(false);
    expect(v.diferenciaCent).toBe(1600);
    expect(v.sobranEnGreedy).toEqual([dup]);
    expect(v.sinExplicarCent).toBe(0);
  });
  it('saldo inicial mal: todo queda sin explicar, no hay nada que "cuadrar"', () => {
    const v = verificar(base({ cuenta: { ...CUENTA, saldoInicial: 200 } }));
    expect(v.cuadra).toBe(false);
    expect(v.faltanEnGreedy).toEqual([]);
    expect(v.sobranEnGreedy).toEqual([]);
    expect(v.sinExplicarCent).toBe(2933);
  });
  it('una fila ignorada no afecta: ya estaba reflejada en el saldo inicial', () => {
    const f = fila('Transf Web/App', '2026-11-03', '14:04', -328.66);
    const [{ referencia }] = conReferencias('S', [f]);
    const v = verificar(base({ filas: [...filas, f], ignorados: [{ id: 'i', cuentaId: 'S', referencia }] }));
    expect(v.cuadra).toBe(true);
    expect(v.emparejo.ignoradas).toHaveLength(1);
    expect(v.faltanEnGreedy).toEqual([]);
  });
});

describe('Conciliado hasta', () => {
  it('el instante de la consulta es hora de Lima (UTC-5)', () => {
    expect(instanteConsulta(CONSULTA)).toBe('2026-11-09T16:46:00.000Z');
  });
  it('solo se guarda si cuadra', () => {
    expect(nuevoConciliadoHasta(null, CONSULTA, true)).toBe('2026-11-09T16:46:00.000Z');
    expect(nuevoConciliadoHasta(null, CONSULTA, false)).toBeNull();
  });
  it('un PDF más viejo no hace retroceder la fecha; uno más nuevo la avanza', () => {
    expect(nuevoConciliadoHasta('2026-11-09T16:46:00.000Z', { fecha: '2026-11-09', hora: '11:40' }, true)).toBeNull();
    expect(nuevoConciliadoHasta('2026-11-09T16:46:00.000Z', { fecha: '2026-11-09', hora: '11:46' }, true)).toBeNull();
    expect(nuevoConciliadoHasta('2026-11-09T16:46:00+00:00', { fecha: '2026-11-10', hora: '08:00' }, true)).toBe('2026-11-10T13:00:00.000Z');
  });
});
