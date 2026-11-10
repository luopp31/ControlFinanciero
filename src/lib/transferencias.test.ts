import { describe, it, expect } from 'vitest';
import type { Captura, ReglaCategoria } from './db';
import type { Cuenta } from './finanzas';
import { cuentaDeProducto, cuentaDeCaptura, notaDeTransferencia, clasificarCaptura, proponerCaptura, capturaQueCoincide } from './capturas';
import { proponerTransferencia, confirmarTraspaso, clasificarIngresoTransferencia, capturaTransferenciaQueCoincide } from './transferencias';

// Todo inventado.
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-10-01' };
const MILL: Cuenta = { id: 'M', nombre: 'Millonaria', rol: 'BOVEDA', saldoInicial: 0, desde: '2026-10-01' };
const CUENTAS = [SIMPLE, MILL];
// Otro usuario: sus cuentas se llaman distinto.
const BILLETERA: Cuenta = { id: 'B', nombre: 'Mi billetera', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-10-01' };
const BOVEDA: Cuenta = { id: 'V', nombre: 'Ahorros grandes', rol: 'BOVEDA', saldoInicial: 0, desde: '2026-10-01' };
const AHORA = '2026-11-02T13:00:00.000Z';

/** Transferencia Millonaria -> Simple por S/ 300.00, 1 nov 8:51 (Lima). */
const tr = (extra: Partial<Captura> = {}): Captura => ({
  id: 't1', dedupeKey: 'tr:1', montoCentimos: 30000, moneda: 'PEN', destinatario: null, destino: null, codigoOperacion: '1',
  fechaHora: '2026-11-01T08:51:00-05:00', cuenta: 'Millonaria', cuentaDestino: 'Simple', origen: 'transferencia_correo', tipo: 'transferencia', estado: 'pendiente', ...extra,
});

describe('cuentaDeProducto: producto de Interbank -> cuenta de la app (nunca inventa)', () => {
  it('por nombre, sin distinguir mayúsculas ni espacios', () => {
    expect(cuentaDeProducto('Simple', CUENTAS)?.id).toBe('S');
    expect(cuentaDeProducto(' millonaria ', CUENTAS)?.id).toBe('M');
  });
  it('por rol: Millonaria es la BOVEDA y Simple la BILLETERA, aunque las cuentas se llamen distinto (nada atado a un usuario)', () => {
    expect(cuentaDeProducto('Simple', [BILLETERA, BOVEDA])?.id).toBe('B');
    expect(cuentaDeProducto('Millonaria', [BILLETERA, BOVEDA])?.id).toBe('V');
  });
  it('un producto en dólares, desconocido o vacío no se reconoce: no hay cuenta por defecto', () => {
    for (const p of ['Simple (USD)', 'Millonaria (USD)', 'Ahorro Sueldo', 'Premium Plus', '', '   ', null, undefined]) expect(cuentaDeProducto(p, CUENTAS)).toBeUndefined();
  });
  it('sin cuentas o sin la cuenta del rol: nada', () => {
    expect(cuentaDeProducto('Simple', [])).toBeUndefined();
    expect(cuentaDeProducto('Millonaria', [SIMPLE])).toBeUndefined();
  });
  it('cuentaDeCaptura usa el producto en una transferencia (y la billetera por defecto en lo demás)', () => {
    expect(cuentaDeCaptura(tr(), CUENTAS)?.id).toBe('M');
    expect(cuentaDeCaptura(tr({ cuenta: 'Rara' }), CUENTAS)?.id).toBe('S'); // solo para elegir una cuenta de gasto; no se usa para decidir traspasos
  });
});

describe('proponerTransferencia', () => {
  it('A. cargo y destino son mías -> TRASPASO (en cualquier sentido)', () => {
    expect(proponerTransferencia(tr(), CUENTAS)).toMatchObject({ caso: 'TRASPASO', origen: { id: 'M' }, destino: { id: 'S' } });
    expect(proponerTransferencia(tr({ cuenta: 'Simple', cuentaDestino: 'Millonaria' }), CUENTAS)).toMatchObject({ caso: 'TRASPASO', origen: { id: 'S' }, destino: { id: 'M' } });
  });
  it('B. destino mío y el cargo no trae producto -> pregunta el origen; nunca un gasto', () => {
    expect(proponerTransferencia(tr({ cuenta: null, cuentaDestino: 'Millonaria' }), CUENTAS)).toEqual({ caso: 'ORIGEN_DESCONOCIDO', destino: MILL });
  });
  it('D. Ahorro Sueldo -> mi cuenta es un INGRESO; también otro producto que no es mío', () => {
    expect(proponerTransferencia(tr({ cuenta: 'Ahorro Sueldo', cuentaDestino: 'Millonaria' }), CUENTAS)).toEqual({ caso: 'INGRESO', destino: MILL, desde: 'Ahorro Sueldo' });
    expect(proponerTransferencia(tr({ cuenta: 'Premium Plus', cuentaDestino: 'Simple' }), CUENTAS)).toEqual({ caso: 'INGRESO', destino: SIMPLE, desde: 'Premium Plus' });
    expect(proponerTransferencia(tr({ cuenta: 'Simple (USD)', cuentaDestino: 'Millonaria' }), CUENTAS)).toMatchObject({ caso: 'INGRESO', desde: 'Simple (USD)' });
  });
  it('C. cargo mío y destino que no es mío (tercero, desconocido o en dólares) -> GASTO desde mi cuenta', () => {
    expect(proponerTransferencia(tr({ cuentaDestino: 'Premium Plus' }), CUENTAS)).toEqual({ caso: 'GASTO', origen: MILL });
    expect(proponerTransferencia(tr({ cuenta: 'Millonaria', cuentaDestino: 'Simple (USD)' }), CUENTAS)).toEqual({ caso: 'GASTO', origen: MILL });
    expect(proponerTransferencia(tr({ cuenta: 'Simple', cuentaDestino: null }), CUENTAS)).toEqual({ caso: 'GASTO', origen: SIMPLE });
  });
  it('ninguna es mía, o es la misma cuenta -> AJENA (no se trata como gasto sin preguntar)', () => {
    expect(proponerTransferencia(tr({ cuenta: 'Ahorro Sueldo', cuentaDestino: 'Simple (USD)' }), CUENTAS)).toEqual({ caso: 'AJENA' });
    expect(proponerTransferencia(tr({ cuenta: null, cuentaDestino: 'Premium Plus' }), CUENTAS)).toEqual({ caso: 'AJENA' });
    expect(proponerTransferencia(tr({ cuenta: 'Simple', cuentaDestino: 'Simple' }), CUENTAS)).toEqual({ caso: 'AJENA' });
  });
  it('en dólares no hay traspaso ni ingreso entre cuentas en soles', () => {
    expect(proponerTransferencia(tr({ moneda: 'USD' }), CUENTAS)).toEqual({ caso: 'AJENA' });
    expect(proponerTransferencia(tr({ moneda: 'USD', cuentaDestino: 'Premium Plus' }), CUENTAS)).toEqual({ caso: 'GASTO', origen: MILL });
  });
  it('sin ninguna cuenta registrada nunca inventa', () => {
    expect(proponerTransferencia(tr(), [])).toEqual({ caso: 'AJENA' });
  });
  it('funciona igual con cuentas que se llaman distinto', () => {
    expect(proponerTransferencia(tr(), [BILLETERA, BOVEDA])).toMatchObject({ caso: 'TRASPASO', origen: { id: 'V' }, destino: { id: 'B' } });
  });
});

describe('confirmarTraspaso', () => {
  const ctx = { cuentas: CUENTAS, ahora: AHORA };
  it('crea el TRASPASO origen -> destino sin categoría y deja la captura clasificada', () => {
    const r = confirmarTraspaso(tr(), 'M', 'S', ctx);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ tipo: 'TRASPASO', cuentaId: 'M', destinoId: 'S', monto: 300, fecha: '2026-11-01', hora: '08:51', categoria: null, origen: 'captura', nota: null, sincronizado: false, borrado: false });
    expect(r.captura).toMatchObject({ estado: 'clasificado', categoria: null, movimientoId: r.movimiento.id, sincronizado: false });
    expect(r.regla).toBeUndefined();
  });
  it('id determinista: confirmar dos veces no duplica', () => {
    const a = confirmarTraspaso(tr(), 'M', 'S', ctx);
    const b = confirmarTraspaso(tr(), 'M', 'S', ctx);
    if (!a.ok || !b.ok) throw new Error('debían confirmarse');
    expect(a.movimiento.id).toBe(b.movimiento.id);
  });
  it('con concepto: la nota del traspaso', () => {
    const r = confirmarTraspaso(tr(), 'M', 'S', { ...ctx, nota: '  paso al diario  ' });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.nota).toBe('paso al diario');
  });
  it('rechaza lo imposible', () => {
    expect(confirmarTraspaso(tr({ estado: 'clasificado' }), 'M', 'S', ctx).ok).toBe(false);
    expect(confirmarTraspaso(tr({ tipo: 'gasto' }), 'M', 'S', ctx).ok).toBe(false);
    expect(confirmarTraspaso(tr({ moneda: 'USD' }), 'M', 'S', ctx).ok).toBe(false);
    expect(confirmarTraspaso(tr(), 'S', 'S', ctx).ok).toBe(false);
    expect(confirmarTraspaso(tr(), 'M', 'NOEXISTE', ctx).ok).toBe(false);
    expect(confirmarTraspaso(tr({ fechaHora: null }), 'M', 'S', ctx).ok).toBe(false);
    expect(confirmarTraspaso(tr({ montoCentimos: null }), 'M', 'S', ctx).ok).toBe(false);
  });
  it('B: el origen que elige el usuario completa el traspaso', () => {
    const r = confirmarTraspaso(tr({ cuenta: null, cuentaDestino: 'Millonaria' }), 'S', 'M', ctx);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ tipo: 'TRASPASO', cuentaId: 'S', destinoId: 'M' });
  });
});

describe('clasificarIngresoTransferencia (Ahorro Sueldo -> mi cuenta)', () => {
  const ctx = { cuentas: CUENTAS, ahora: AHORA };
  const sueldo = tr({ cuenta: 'Ahorro Sueldo', cuentaDestino: 'Millonaria', montoCentimos: 420057 });
  it('crea el INGRESO en la cuenta de destino con su categoría y la nota de dónde vino', () => {
    const r = clasificarIngresoTransferencia(sueldo, 'LIQUIDACION', 'M', ctx);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ tipo: 'INGRESO', categoria: 'LIQUIDACION', cuentaId: 'M', monto: 4200.57, nota: 'Transferencia desde Ahorro Sueldo', origen: 'captura', fecha: '2026-11-01', hora: '08:51' });
    expect(r.captura).toMatchObject({ estado: 'clasificado', categoria: 'LIQUIDACION', movimientoId: r.movimiento.id });
  });
  it('con concepto', () => {
    const r = clasificarIngresoTransferencia(sueldo, 'SUELDO', 'M', { ...ctx, nota: 'obra norte' });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.nota).toBe('obra norte (Transferencia desde Ahorro Sueldo)');
  });
  it('B (sin producto de cargo): "Transferencia"', () => {
    const r = clasificarIngresoTransferencia(tr({ cuenta: null, cuentaDestino: 'Millonaria' }), 'OTROS', 'M', ctx);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.nota).toBe('Transferencia');
  });
  it('en dólares pide el monto en soles', () => {
    const usd = sueldo.moneda === 'PEN' ? { ...sueldo, moneda: 'USD' as const, montoCentimos: 2360 } : sueldo;
    expect(clasificarIngresoTransferencia(usd, 'OTROS', 'M', ctx)).toEqual({ ok: false, motivo: 'Pon el monto en soles.' });
    const r = clasificarIngresoTransferencia(usd, 'OTROS', 'M', { ...ctx, montoSolesCentimos: 8149 });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ monto: 81.49, nota: 'Transferencia desde Ahorro Sueldo (US$ 23.60)' });
  });
  it('rechaza lo imposible', () => {
    expect(clasificarIngresoTransferencia(tr({ estado: 'descartado' }), 'OTROS', 'M', ctx).ok).toBe(false);
    expect(clasificarIngresoTransferencia(tr({ tipo: 'gasto' }), 'OTROS', 'M', ctx).ok).toBe(false);
    expect(clasificarIngresoTransferencia(sueldo, 'OTROS', 'NOEXISTE', ctx).ok).toBe(false);
  });
});

describe('C. una transferencia a un tercero se clasifica como gasto, sin nombre y sin aprender nada', () => {
  const ctx = { cuentas: CUENTAS, reglas: [] as ReglaCategoria[], ahora: AHORA, nuevoId: () => 'nuevo' };
  const aTercero = tr({ cuentaDestino: 'Premium Plus' });
  it('el gasto sale de la cuenta de cargo, con la nota "Transferencia a ..." y sin descriptor', () => {
    const r = clasificarCaptura(aTercero, 'COMPRAS', ctx);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ tipo: 'GASTO', categoria: 'COMPRAS', cuentaId: 'M', monto: 300, nota: 'Transferencia a Premium Plus', descriptor: null, origen: 'captura' });
  });
  it('NO aprende ninguna regla (una clave vacía envenenaría el diccionario)', () => {
    const r = clasificarCaptura(aTercero, 'COMPRAS', ctx);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.regla).toBeUndefined();
    // ni siquiera con reglas existentes y repitiendo
    const r2 = clasificarCaptura(aTercero, 'COMPRAS', { ...ctx, reglas: [{ id: 'x', clave: 'TRANSFERENCIA', tipo: 'COMERCIO', categoria: 'SALUD', vecesConfirmada: 9 }] });
    if (!r2.ok) throw new Error(r2.motivo);
    expect(r2.regla).toBeUndefined();
  });
  it('proponerCaptura no consulta el diccionario: solo las categorías de siempre', () => {
    const p = proponerCaptura(aTercero, [{ id: 'x', clave: 'TRANSFERENCIA', tipo: 'COMERCIO', categoria: 'SALUD', vecesConfirmada: 9 }]);
    expect(p).toMatchObject({ estado: 'CLASIFICAR', categoria: null });
    expect(p.sugerencias).toHaveLength(3);
  });
  it('la cuenta elegida por el usuario gana; con concepto la nota se junta', () => {
    const r = clasificarCaptura(aTercero, 'COMPRAS', { ...ctx, cuentaId: 'S', nota: 'alquiler' });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ cuentaId: 'S', nota: 'alquiler (Transferencia a Premium Plus)' });
  });
  it('notaDeTransferencia', () => {
    expect(notaDeTransferencia(tr({ cuentaDestino: 'Simple (USD)' }), 'gasto')).toBe('Transferencia a Simple (USD)');
    expect(notaDeTransferencia(tr({ cuentaDestino: null }), 'gasto')).toBe('Transferencia');
    expect(notaDeTransferencia(tr({ cuenta: 'Ahorro Sueldo' }), 'ingreso', 'x')).toBe('x (Transferencia desde Ahorro Sueldo)');
  });
  it('el enlace por nombre (Plin/Wallet) ignora las transferencias', () => {
    expect(capturaQueCoincide({ descriptor: 'YAPE-ANA', centimos: -30000, fecha: '2026-11-01', hora: '08:51' }, [aTercero])).toBeUndefined();
    expect(capturaQueCoincide({ descriptor: '229 PVEA', centimos: -30000, fecha: '2026-11-01', hora: '08:55' }, [aTercero])).toBeUndefined();
  });
});

describe('capturaTransferenciaQueCoincide: captura <-> movimiento del Conciliar', () => {
  const traspaso = (extra = {}) => ({ tipo: 'TRASPASO' as const, cuentaId: 'M', destinoId: 'S', fecha: '2026-11-01', hora: '08:51', centimos: 30000, ...extra });
  const buscar = (mov: ReturnType<typeof traspaso> | Record<string, unknown>, caps: Captura[], usadas = new Set<string>()) =>
    capturaTransferenciaQueCoincide(mov as Parameters<typeof capturaTransferenciaQueCoincide>[0], caps, CUENTAS, usadas)?.id;

  it('TRASPASO: mismo monto, mismas cuentas y fecha', () => {
    expect(buscar(traspaso(), [tr()])).toBe('t1');
  });
  it('TRASPASO: otro monto, otras cuentas o sentido contrario no coinciden', () => {
    expect(buscar(traspaso({ centimos: 30001 }), [tr()])).toBeUndefined();
    expect(buscar(traspaso({ cuentaId: 'S', destinoId: 'M' }), [tr()])).toBeUndefined();
    expect(buscar(traspaso({ destinoId: 'OTRA' }), [tr()])).toBeUndefined();
  });
  it('TRASPASO con la captura B (sin producto de cargo): vale cualquier origen mientras el destino sea el mismo', () => {
    const b = tr({ cuenta: null, cuentaDestino: 'Millonaria' });
    expect(buscar(traspaso({ cuentaId: 'S', destinoId: 'M' }), [b])).toBe('t1');
    expect(buscar(traspaso({ cuentaId: 'M', destinoId: 'S' }), [b])).toBeUndefined();
  });
  it('tolera ±3 días y compara con la fecha de Lima', () => {
    expect(buscar(traspaso({ fecha: '2026-11-04' }), [tr()])).toBe('t1');
    expect(buscar(traspaso({ fecha: '2026-11-05' }), [tr()])).toBeUndefined();
    expect(buscar(traspaso({ fecha: '2026-10-31' }), [tr({ fechaHora: '2026-11-01T03:00:00.000Z' })])).toBe('t1'); // 22:00 del 31 oct en Lima
  });
  it('GASTO desde la cuenta de cargo a un tercero (caso C)', () => {
    const c = tr({ cuentaDestino: 'Premium Plus' });
    expect(buscar({ tipo: 'GASTO', cuentaId: 'M', fecha: '2026-11-01', hora: '08:52', centimos: 30000 }, [c])).toBe('t1');
    expect(buscar({ tipo: 'GASTO', cuentaId: 'S', fecha: '2026-11-01', hora: '08:52', centimos: 30000 }, [c])).toBeUndefined(); // otra cuenta
    expect(buscar({ tipo: 'GASTO', cuentaId: 'M', fecha: '2026-11-01', hora: '08:52', centimos: 30000 }, [tr()])).toBeUndefined(); // era un traspaso
  });
  it('INGRESO a la cuenta de destino desde algo que no es mío (caso D)', () => {
    const c = tr({ cuenta: 'Ahorro Sueldo', cuentaDestino: 'Millonaria', montoCentimos: 420057 });
    expect(buscar({ tipo: 'INGRESO', cuentaId: 'M', fecha: '2026-11-01', hora: '08:51', centimos: 420057 }, [c])).toBe('t1');
    expect(buscar({ tipo: 'INGRESO', cuentaId: 'S', fecha: '2026-11-01', hora: '08:51', centimos: 420057 }, [c])).toBeUndefined();
    expect(buscar({ tipo: 'INGRESO', cuentaId: 'S', fecha: '2026-11-01', hora: '08:51', centimos: 30000 }, [tr()])).toBeUndefined(); // era un traspaso
  });
  it('solo pendientes, vivas, en soles y de tipo transferencia', () => {
    for (const x of [{ estado: 'clasificado' }, { estado: 'descartado' }, { borrado: true }, { moneda: 'USD' }, { tipo: 'gasto' }] as const) expect(buscar(traspaso(), [tr(x)])).toBeUndefined();
  });
  it('una captura no se usa dos veces; entre varias gana la más cercana', () => {
    expect(buscar(traspaso(), [tr()], new Set(['t1']))).toBeUndefined();
    const lejos = tr({ id: 'lejos', fechaHora: '2026-11-03T08:51:00-05:00' });
    expect(buscar(traspaso(), [lejos, tr()])).toBe('t1');
  });
});
