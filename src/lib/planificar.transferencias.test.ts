import { describe, it, expect } from 'vitest';
import { planificar, type CuentaConciliar, type Decision, type EntradaPlan } from './planificar';
import { conReferencias } from './emparejar';
import { confirmarTraspaso } from './transferencias';
import type { Captura } from './db';
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';

// Todo inventado. Dos cuentas; la transferencia de ejemplo: Millonaria -> Simple, S/ 300.00, 1 nov 8:51.
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-10-01' };
const MILL: Cuenta = { id: 'M', nombre: 'Millonaria', rol: 'BOVEDA', saldoInicial: 100000, desde: '2026-10-01' };
const MILL_DESPUES = 9_970_000; // 100,000.00 - 300.00, en céntimos
const CONSULTA = { fecha: '2026-11-09', hora: '11:46' };
const AHORA = '2026-11-09T17:00:00.000Z';
let n = 0;

const fila = (descriptor: string, fecha: string, hora: string, soles: number): FilaBanco => ({ descriptor, fecha, hora, centimos: Math.round(soles * 100), pagina: 1 });
const ref = (cuentaId: string, f: FilaBanco) => conReferencias(cuentaId, [f])[0].referencia;
const conc = (c: Cuenta, filas: FilaBanco[], disponibleCent: number, decisiones: Record<string, Decision> = {}): CuentaConciliar => ({ cuenta: c, filas, consulta: CONSULTA, saldoDisponibleCent: disponibleCent, cubreDesde: true, decisiones });
const entrada = (cuentas: CuentaConciliar[], over: Partial<EntradaPlan> = {}): EntradaPlan => ({ cuentas, cuentasTodas: [SIMPLE, MILL], movimientos: [], ignorados: [], reglas: [], ahora: AHORA, nuevoId: () => `r${++n}`, ...over });
const tr = (extra: Partial<Captura> = {}): Captura => ({
  id: 't1', dedupeKey: 'tr:1', montoCentimos: 30000, moneda: 'PEN', destinatario: null, destino: null, codigoOperacion: '1',
  fechaHora: '2026-11-01T08:51:00-05:00', cuenta: 'Millonaria', cuentaDestino: 'Simple', origen: 'transferencia_correo', tipo: 'transferencia', estado: 'pendiente', ...extra,
});

const sale = fila('Transf Web/App', '2026-11-01', '08:51', -300); // Millonaria
const entra = fila('Transf Web/App', '2026-11-01', '08:51', 300); // Simple
const aM: Decision = { accion: 'TRASPASO', cuentaContrariaId: 'S' };
const aS: Decision = { accion: 'TRASPASO', cuentaContrariaId: 'M' };

describe('el Conciliar enlaza la transferencia de la bandeja', () => {
  it('traspaso nuevo desde los dos PDFs: la captura queda clasificada y apunta a ese traspaso', () => {
    const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES, { [ref('M', sale)]: aM }), conc(SIMPLE, [entra], 30000, { [ref('S', entra)]: aS })], { capturas: [tr()] }));
    expect(p.listo).toBe(true);
    expect(p.movimientos).toHaveLength(1);
    expect(p.movimientos[0]).toMatchObject({ tipo: 'TRASPASO', cuentaId: 'M', destinoId: 'S', monto: 300 });
    expect(p.capturas).toEqual([expect.objectContaining({ id: 't1', estado: 'clasificado', movimientoId: p.movimientos[0].id, sincronizado: false })]);
  });

  it('con un solo PDF (el de la cuenta de destino) también', () => {
    const p = planificar(entrada([conc(SIMPLE, [entra], 30000, { [ref('S', entra)]: aS })], { capturas: [tr()], cuentasTodas: [SIMPLE, MILL] }));
    expect(p.movimientos).toHaveLength(1);
    expect(p.movimientos[0]).toMatchObject({ tipo: 'TRASPASO', cuentaId: 'M', destinoId: 'S' });
    expect(p.capturas).toHaveLength(1);
  });

  it('un traspaso que ya estaba en Greedy (registrado a mano) cubre a su captura pendiente, sin crear nada', () => {
    const manual: Movimiento = { id: 'mm', cuentaId: 'M', destinoId: 'S', fecha: '2026-11-01', monto: 300, tipo: 'TRASPASO' };
    const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES), conc(SIMPLE, [entra], 30000)], { movimientos: [manual], capturas: [tr()] }));
    expect(p.movimientos).toEqual([]);
    expect(p.capturas).toEqual([expect.objectContaining({ id: 't1', estado: 'clasificado', movimientoId: 'mm' })]);
  });

  it('confirmado desde la bandeja y luego conciliado con los dos PDFs: ya estaba en ambas cuentas, sin duplicar ni escribir nada', () => {
    const c = tr();
    const r = confirmarTraspaso(c, 'M', 'S', { cuentas: [SIMPLE, MILL], ahora: AHORA });
    if (!r.ok) throw new Error(r.motivo);
    const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES), conc(SIMPLE, [entra], 30000)], { movimientos: [r.movimiento], capturas: [r.captura] }));
    expect(p.listo).toBe(true);
    expect(p.movimientos).toEqual([]);
    expect(p.ignorados).toEqual([]);
    expect(p.capturas).toEqual([]); // ya estaba clasificada
    expect(p.verificaciones.M.greedyCent).toBe(MILL_DESPUES);
    expect(p.verificaciones.S.greedyCent).toBe(30000);
    expect(p.verificaciones.M.cuadra && p.verificaciones.S.cuadra).toBe(true);
  });

  it('caso D: el ingreso desde Ahorro Sueldo se enlaza con la fila positiva de la Millonaria', () => {
    const entrada420 = fila('Transf Web/App', '2026-11-01', '08:51', 4200.57);
    const d = tr({ cuenta: 'Ahorro Sueldo', cuentaDestino: 'Millonaria', montoCentimos: 420057 });
    const p = planificar(entrada([conc(MILL, [entrada420], 100000 + 420057, { [ref('M', entrada420)]: { accion: 'INGRESO', categoria: 'LIQUIDACION' } })], { capturas: [d] }));
    expect(p.movimientos).toEqual([expect.objectContaining({ tipo: 'INGRESO', cuentaId: 'M', monto: 4200.57 })]);
    expect(p.capturas).toEqual([expect.objectContaining({ id: 't1', estado: 'clasificado', categoria: 'LIQUIDACION', movimientoId: p.movimientos[0].id })]);
  });

  it('caso C: el gasto a un tercero se enlaza con la fila negativa de la cuenta de cargo', () => {
    const c = tr({ cuentaDestino: 'Premium Plus' });
    const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES, { [ref('M', sale)]: { accion: 'GASTO', categoria: 'COMPRAS' } })], { capturas: [c] }));
    expect(p.movimientos).toEqual([expect.objectContaining({ tipo: 'GASTO', cuentaId: 'M', monto: 300 })]);
    expect(p.capturas).toEqual([expect.objectContaining({ id: 't1', estado: 'clasificado', movimientoId: p.movimientos[0].id })]);
  });

  it('una transferencia entre mis cuentas NO se enlaza con un gasto ni un ingreso del mismo monto', () => {
    const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES, { [ref('M', sale)]: { accion: 'GASTO', categoria: 'COMPRAS' } })], { capturas: [tr()] }));
    expect(p.capturas).toEqual([]);
  });

  it('otro monto, otra cuenta o fuera de ±3 días: no se enlaza', () => {
    const dec = { [ref('M', sale)]: aM };
    const dec2 = { [ref('S', entra)]: aS };
    for (const x of [{ montoCentimos: 30100 }, { fechaHora: '2026-10-20T08:51:00-05:00' }, { cuentaDestino: 'Premium Plus' }] as const) {
      const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES, { ...dec }), conc(SIMPLE, [entra], 30000, { ...dec2 })], { capturas: [tr(x)] }));
      expect(p.capturas).toEqual([]);
    }
  });

  it('la captura B (cargo sin producto, destino Millonaria) se enlaza cuando el origen es la otra cuenta mía', () => {
    const b = tr({ cuenta: null, cuentaDestino: 'Millonaria', montoCentimos: 30000 });
    const s2m = fila('Transf Web/App', '2026-11-01', '08:51', -300); // sale de Simple
    const m2 = fila('Transf Web/App', '2026-11-01', '08:51', 300); // entra a Millonaria
    const p = planificar(entrada([conc(SIMPLE, [s2m], -30000, { [ref('S', s2m)]: { accion: 'TRASPASO', cuentaContrariaId: 'M' } }), conc(MILL, [m2], 130000, { [ref('M', m2)]: { accion: 'TRASPASO', cuentaContrariaId: 'S' } })], { capturas: [b] }));
    expect(p.movimientos).toEqual([expect.objectContaining({ tipo: 'TRASPASO', cuentaId: 'S', destinoId: 'M' })]);
    expect(p.capturas).toHaveLength(1);
  });

  it('sin la lista completa de cuentas no se enlaza ninguna transferencia (una cuenta suya podría pasar por ajena)', () => {
    const p = planificar(entrada([conc(MILL, [sale], MILL_DESPUES, { [ref('M', sale)]: { accion: 'GASTO', categoria: 'COMPRAS' } })], { capturas: [tr()], cuentasTodas: undefined }));
    expect(p.capturas).toEqual([]);
  });

  it('sin capturas (o sin transferencias) el plan no cambia', () => {
    expect(planificar(entrada([conc(MILL, [sale], MILL_DESPUES, { [ref('M', sale)]: aM }), conc(SIMPLE, [entra], 30000, { [ref('S', entra)]: aS })])).capturas).toEqual([]);
  });
});
