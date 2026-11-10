import { describe, it, expect } from 'vitest';
import type { Captura, ReglaCategoria } from './db';
import type { Cuenta } from './finanzas';
import {
  descriptorDeCaptura, fechaHoraLima, proponerCaptura, clasificarCaptura, duplicadoDe, resumenBandeja,
  cuentaDeCaptura, descartarCaptura, quitarMarcaDuplicado,
} from './capturas';

// Todo inventado.
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-11-02' };
const MILL: Cuenta = { id: 'M', nombre: 'Millonaria', rol: 'BOVEDA', saldoInicial: 0, desde: '2026-11-02' };
const AHORA = '2026-11-10T03:00:00.000Z';
let n = 0;
const nuevoId = () => `r${++n}`;

const cap = (extra: Partial<Captura> = {}): Captura => ({
  id: 'c1', dedupeKey: 'op:1', montoCentimos: 250, moneda: 'PEN', destinatario: 'Alonso Perez Gomez', destino: 'Plin', codigoOperacion: '1',
  fechaHora: '2026-11-09T21:39:00-05:00', cuenta: 'Simple', origen: 'plin_correo', estado: 'pendiente', ...extra,
});
const regla = (clave: string, tipo: ReglaCategoria['tipo'], categoria: string, veces: number): ReglaCategoria => ({ id: `x-${clave}`, clave, tipo, categoria, vecesConfirmada: veces, actualizado: '2026-11-01T00:00:00Z' });
const ctx = (extra: Record<string, unknown> = {}) => ({ cuentas: [SIMPLE, MILL], reglas: [] as ReglaCategoria[], ahora: AHORA, nuevoId, ...extra });

describe('descriptorDeCaptura: cómo lo escribe el banco en el PDF', () => {
  it.each([
    ['Alonso Perez Gomez', 'Plin', 'PLIN-ALONSO'],
    ['Luis Enrique Garcia', 'Yape', 'YAPE-LUIS EN'],
    ['Maria Cruz Lopez', 'Plin', 'PLIN-MARIA C'],
    ['Alexander Ramos', 'Yape', 'YAPE-ALEXAND'],
    ['Josue', 'Plin', 'PLIN-JOSUE'],
    ['María José Soto', 'Plin', 'PLIN-MARIA J'],
    ['  angel   gomez  ', 'Plin', 'PLIN-ANGEL G'],
  ] as const)('%s (%s) -> %s', (nombre, destino, esperado) => {
    expect(descriptorDeCaptura({ origen: 'plin_correo', destino, destinatario: nombre })).toBe(esperado);
  });
  it('sin destino se asume Plin; en Wallet es el comercio', () => {
    expect(descriptorDeCaptura({ origen: 'plin_correo', destino: null, destinatario: 'Ana Ruiz' })).toBe('PLIN-ANA RUI');
    expect(descriptorDeCaptura({ origen: 'wallet', destino: null, destinatario: ' Plaza  Vea ' })).toBe('PLAZA VEA');
  });
});

describe('fechaHoraLima', () => {
  it.each([
    ['2026-11-09T21:39:00-05:00', '2026-11-09', '21:39'],
    ['2026-11-10T02:39:00.000Z', '2026-11-09', '21:39'],
    ['2026-11-10T05:00:00Z', '2026-11-10', '00:00'],
    ['2026-11-10T04:59:00Z', '2026-11-09', '23:59'],
    ['2026-11-10T02:39:00+00:00', '2026-11-09', '21:39'],
  ])('%s -> %s %s', (iso, fecha, hora) => expect(fechaHoraLima(iso)).toEqual({ fecha, hora }));
});

describe('proponerCaptura (diccionario del Conciliar)', () => {
  it('sin regla: por clasificar con sugerencias', () => {
    const p = proponerCaptura(cap(), []);
    expect(p).toMatchObject({ estado: 'CLASIFICAR', tipo: 'GASTO', clase: 'PERSONA' });
    expect(p.sugerencias).toHaveLength(3);
  });
  it('persona: con 1 confirmación pide un toque; con 2 ya es automática', () => {
    expect(proponerCaptura(cap(), [regla('PLIN-ALONSO', 'PERSONA', 'TRANSPORTE', 1)])).toMatchObject({ estado: 'CONFIRMAR', categoria: 'TRANSPORTE' });
    expect(proponerCaptura(cap(), [regla('PLIN-ALONSO', 'PERSONA', 'TRANSPORTE', 2)])).toMatchObject({ estado: 'AUTO', categoria: 'TRANSPORTE' });
  });
  it('comercio de Wallet con regla: automático', () => {
    const w = cap({ origen: 'wallet', destino: null, destinatario: 'Plaza Vea' });
    expect(proponerCaptura(w, [regla('PLAZA VEA', 'COMERCIO', 'ALIMENTACION', 1)])).toMatchObject({ estado: 'AUTO', categoria: 'ALIMENTACION' });
  });
  it('un pago en dólares sugiere Suscripciones primero, sin pisar una regla ya aprendida', () => {
    const usd = cap({ moneda: 'USD', destinatario: 'Servicio Prueba' });
    expect(proponerCaptura(usd, []).sugerencias[0]).toBe('SUSCRIPCIONES');
    expect(proponerCaptura(usd, []).sugerencias).toHaveLength(3);
    expect(proponerCaptura(usd, [regla('PLIN-SERVICI', 'PERSONA', 'SERVICIOS', 2)])).toMatchObject({ estado: 'AUTO', categoria: 'SERVICIOS' });
  });
  it('reutiliza la regla que el Conciliar aprendió de la fila del PDF', () => {
    // El PDF muestra "YAPE-ALONSO": la misma clave que sale del correo de un pago a Yape.
    expect(proponerCaptura(cap({ destino: 'Yape' }), [regla('YAPE-ALONSO', 'PERSONA', 'COMPRAS', 2)])).toMatchObject({ estado: 'AUTO', categoria: 'COMPRAS' });
  });
});

describe('clasificarCaptura', () => {
  it('crea el gasto con los datos de la captura y la deja clasificada', () => {
    const r = clasificarCaptura(cap(), 'TRANSPORTE', ctx());
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({
      fecha: '2026-11-09', hora: '21:39', monto: 2.5, tipo: 'GASTO', categoria: 'TRANSPORTE', cuentaId: 'S',
      nota: 'Plin a Alonso Perez Gomez', descriptor: 'PLIN-ALONSO', origen: 'captura', borrado: false, sincronizado: false, actualizado: AHORA,
    });
    expect(r.captura).toMatchObject({ estado: 'clasificado', categoria: 'TRANSPORTE', movimientoId: r.movimiento.id, sincronizado: false });
  });
  it('el id del movimiento es determinista: clasificar dos veces no duplica', () => {
    const a = clasificarCaptura(cap(), 'TRANSPORTE', ctx());
    const b = clasificarCaptura(cap(), 'COMPRAS', ctx());
    if (!a.ok || !b.ok) throw new Error('debían clasificarse');
    expect(a.movimiento.id).toBe(b.movimiento.id);
    expect(a.movimiento.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('cuenta: la que dice la captura, la que elijas, o la billetera por defecto', () => {
    const ok = (c: Captura, extra = {}) => {
      const r = clasificarCaptura(c, 'COMPRAS', ctx(extra));
      if (!r.ok) throw new Error(r.motivo);
      return r.movimiento.cuentaId;
    };
    expect(ok(cap({ cuenta: 'Millonaria' }))).toBe('M');
    expect(ok(cap({ cuenta: null }))).toBe('S');
    expect(ok(cap({ cuenta: 'Rara' }))).toBe('S');
    expect(ok(cap({ cuenta: 'Simple' }), { cuentaId: 'M' })).toBe('M');
    expect(cuentaDeCaptura(cap({ cuenta: ' simple ' }), [MILL, SIMPLE])?.id).toBe('S');
  });
  it('aprende la categoría: persona nueva = regla con 1 confirmación; la 2ª vez sube a 2', () => {
    const a = clasificarCaptura(cap(), 'TRANSPORTE', ctx());
    if (!a.ok || !a.regla) throw new Error('debía crear regla');
    expect(a.regla).toMatchObject({ clave: 'PLIN-ALONSO', tipo: 'PERSONA', categoria: 'TRANSPORTE', vecesConfirmada: 1, sincronizado: false });
    const b = clasificarCaptura(cap({ id: 'c2', dedupeKey: 'op:2' }), 'TRANSPORTE', ctx({ reglas: [a.regla] }));
    if (!b.ok || !b.regla) throw new Error('debía actualizar la regla');
    expect(b.regla).toMatchObject({ id: a.regla.id, vecesConfirmada: 2 });
  });
  it('si la regla ya es automática no se toca; comercio de Wallet aprende solo', () => {
    const auto = clasificarCaptura(cap(), 'TRANSPORTE', ctx({ reglas: [regla('PLIN-ALONSO', 'PERSONA', 'TRANSPORTE', 2)] }));
    if (!auto.ok) throw new Error(auto.motivo);
    expect(auto.regla).toBeUndefined();
    const w = clasificarCaptura(cap({ origen: 'wallet', destino: null, destinatario: 'Plaza Vea' }), 'ALIMENTACION', ctx());
    if (!w.ok) throw new Error(w.motivo);
    expect(w.regla).toMatchObject({ clave: 'PLAZA VEA', tipo: 'COMERCIO', categoria: 'ALIMENTACION' });
    expect(w.movimiento.nota).toBe('Plaza Vea');
  });
  it('dólares: pide el monto en soles y lo deja en la nota', () => {
    const usd = cap({ moneda: 'USD', montoCentimos: 2360, destinatario: 'Servicio Prueba' });
    expect(clasificarCaptura(usd, 'SUSCRIPCIONES', ctx())).toEqual({ ok: false, motivo: 'Pon el monto en soles.' });
    expect(clasificarCaptura(usd, 'SUSCRIPCIONES', ctx({ montoSolesCentimos: 0 })).ok).toBe(false);
    const r = clasificarCaptura(usd, 'SUSCRIPCIONES', ctx({ montoSolesCentimos: 8149 }));
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.monto).toBe(81.49);
    expect(r.movimiento.nota).toBe('Plin a Servicio Prueba (US$ 23.60)');
  });
  it('rechaza lo que no se puede clasificar', () => {
    expect(clasificarCaptura(cap({ estado: 'clasificado' }), 'COMPRAS', ctx()).ok).toBe(false);
    expect(clasificarCaptura(cap({ estado: 'descartado' }), 'COMPRAS', ctx()).ok).toBe(false);
    expect(clasificarCaptura(cap({ estado: 'sin_leer', montoCentimos: null }), 'COMPRAS', ctx()).ok).toBe(false);
    expect(clasificarCaptura(cap({ fechaHora: null }), 'COMPRAS', ctx()).ok).toBe(false);
    expect(clasificarCaptura(cap(), 'COMPRAS', ctx({ cuentas: [] })).ok).toBe(false);
  });
});

describe('bandeja', () => {
  it('resumenBandeja: pendientes y sin_leer, lo más reciente primero, sin lo borrado ni lo ya resuelto', () => {
    const lista = [
      cap({ id: 'a', fechaHora: '2026-11-08T10:00:00-05:00' }),
      cap({ id: 'b', fechaHora: '2026-11-09T10:00:00-05:00' }),
      cap({ id: 'c', estado: 'clasificado' }),
      cap({ id: 'd', estado: 'descartado' }),
      cap({ id: 'e', borrado: true }),
      cap({ id: 'f', estado: 'sin_leer', montoCentimos: null, fechaHora: null }),
    ];
    const r = resumenBandeja(lista);
    expect(r.pendientes.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.sinLeer.map((x) => x.id)).toEqual(['f']);
  });
  it('duplicadoDe: la captura marcada, solo si sigue viva', () => {
    const original = cap({ id: 'o', origen: 'plin_correo' });
    const repetida = cap({ id: 'w', origen: 'wallet', posibleDuplicadoDe: 'o' });
    expect(duplicadoDe(repetida, [original, repetida])?.id).toBe('o');
    expect(duplicadoDe(repetida, [{ ...original, estado: 'descartado' }, repetida])).toBeUndefined();
    expect(duplicadoDe(repetida, [{ ...original, borrado: true }, repetida])).toBeUndefined();
    expect(duplicadoDe(original, [original])).toBeUndefined();
  });
  it('descartar y "son distintos"', () => {
    expect(descartarCaptura(cap(), AHORA)).toMatchObject({ estado: 'descartado', sincronizado: false, actualizado: AHORA });
    expect(quitarMarcaDuplicado(cap({ posibleDuplicadoDe: 'o' }), AHORA)).toMatchObject({ posibleDuplicadoDe: null, estado: 'pendiente', sincronizado: false });
  });
});
