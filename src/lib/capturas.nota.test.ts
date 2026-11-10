import { describe, it, expect } from 'vitest';
import type { Captura } from './db';
import type { Cuenta } from './finanzas';
import { notaDeCaptura, limpiarNota, clasificarCaptura, MAX_NOTA } from './capturas';

// Todo inventado.
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-11-02' };
const AHORA = '2026-11-10T03:00:00.000Z';
const cap = (extra: Partial<Captura> = {}): Captura => ({
  id: 'c1', dedupeKey: 'op:1', montoCentimos: 250, moneda: 'PEN', destinatario: 'Alonso Perez Gomez', destino: 'Plin', codigoOperacion: '1',
  fechaHora: '2026-11-09T21:39:00-05:00', cuenta: null, origen: 'plin_correo', estado: 'pendiente', ...extra,
});
const wallet = (extra: Partial<Captura> = {}) => cap({ origen: 'wallet', destino: null, destinatario: 'Plaza Vea', ...extra });
const usd = (extra: Partial<Captura> = {}) => cap({ moneda: 'USD', montoCentimos: 2360, destinatario: 'Servicio Prueba', ...extra });

describe('notaDeCaptura: concepto primero y el detalle entre paréntesis', () => {
  it('sin concepto: el detalle automático de siempre', () => {
    expect(notaDeCaptura(cap())).toBe('Plin a Alonso Perez Gomez');
    expect(notaDeCaptura(cap({ destino: 'Yape' }))).toBe('Yape a Alonso Perez Gomez');
    expect(notaDeCaptura(wallet())).toBe('Plaza Vea');
    expect(notaDeCaptura(usd())).toBe('Plin a Servicio Prueba (US$ 23.60)');
  });
  it('con concepto: "pasaje (Plin a Alonso Perez Gomez)"', () => {
    expect(notaDeCaptura(cap(), 'pasaje')).toBe('pasaje (Plin a Alonso Perez Gomez)');
    expect(notaDeCaptura(cap({ destino: 'Yape' }), 'almuerzo')).toBe('almuerzo (Yape a Alonso Perez Gomez)');
    expect(notaDeCaptura(wallet(), 'almuerzo')).toBe('almuerzo (Plaza Vea)');
  });
  it('en dólares: el monto en US$ va dentro del paréntesis', () => {
    expect(notaDeCaptura(usd(), 'Claude')).toBe('Claude (Plin a Servicio Prueba · US$ 23.60)');
  });
  it('vacío, espacios o null cuentan como sin concepto', () => {
    for (const n of [undefined, null, '', '   ', '\n\t ']) expect(notaDeCaptura(cap(), n)).toBe('Plin a Alonso Perez Gomez');
  });
  it('"Sin nombre" de Wallet no se repite entre paréntesis', () => {
    expect(notaDeCaptura(wallet({ destinatario: 'Sin nombre' }), 'cena')).toBe('cena');
    expect(notaDeCaptura(wallet({ destinatario: 'Sin nombre' }))).toBe('Sin nombre');
    expect(notaDeCaptura(usd({ origen: 'wallet', destino: null, destinatario: 'Sin nombre' }), 'Claude')).toBe('Claude (US$ 23.60)');
  });
  it('sin destinatario ni concepto no hay nota', () => {
    expect(notaDeCaptura(cap({ destinatario: null, origen: 'wallet', destino: null }))).toBeNull();
  });
});

describe('limpiarNota', () => {
  it('colapsa espacios y recorta bordes', () => {
    expect(limpiarNota('  taxi   al   aeropuerto \n')).toBe('taxi al aeropuerto');
  });
  it('tiene tope de largo y no deja espacio al final del corte', () => {
    const t = limpiarNota('a'.repeat(79) + ' ' + 'b'.repeat(40));
    expect(t.length).toBeLessThanOrEqual(MAX_NOTA);
    expect(t.endsWith(' ')).toBe(false);
    expect(limpiarNota('x'.repeat(500))).toHaveLength(MAX_NOTA);
  });
  it('conserva tildes, ñ y símbolos', () => {
    expect(limpiarNota('café + niño (2×)')).toBe('café + niño (2×)');
  });
  it('null y undefined dan vacío', () => {
    expect(limpiarNota(null)).toBe('');
    expect(limpiarNota(undefined)).toBe('');
  });
});

describe('clasificarCaptura con concepto', () => {
  const ctx = (extra: Record<string, unknown> = {}) => ({ cuentas: [SIMPLE], reglas: [], ahora: AHORA, nuevoId: () => 'r1', ...extra });

  it('el movimiento guarda la nota juntada', () => {
    const r = clasificarCaptura(cap(), 'TRANSPORTE', ctx({ nota: 'pasaje' }));
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.nota).toBe('pasaje (Plin a Alonso Perez Gomez)');
  });
  it('sin concepto el movimiento queda como antes', () => {
    const r = clasificarCaptura(cap(), 'TRANSPORTE', ctx());
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.nota).toBe('Plin a Alonso Perez Gomez');
    const vacia = clasificarCaptura(cap(), 'TRANSPORTE', ctx({ nota: '   ' }));
    if (!vacia.ok) throw new Error(vacia.motivo);
    expect(vacia.movimiento.nota).toBe('Plin a Alonso Perez Gomez');
  });
  it('en dólares con concepto', () => {
    const r = clasificarCaptura(usd(), 'SUSCRIPCIONES', ctx({ nota: 'Claude', montoSolesCentimos: 8149 }));
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento).toMatchObject({ nota: 'Claude (Plin a Servicio Prueba · US$ 23.60)', monto: 81.49 });
  });
  it('la nota no cambia nada más: descriptor, categoría, id y regla aprendida son los mismos', () => {
    const con = clasificarCaptura(cap(), 'TRANSPORTE', ctx({ nota: 'pasaje' }));
    const sin = clasificarCaptura(cap(), 'TRANSPORTE', ctx());
    if (!con.ok || !sin.ok) throw new Error('debían clasificarse');
    const { nota: _a, ...restoCon } = con.movimiento;
    const { nota: _b, ...restoSin } = sin.movimiento;
    expect(restoCon).toEqual(restoSin);
    expect(con.regla).toEqual(sin.regla);
    expect(con.captura).toEqual(sin.captura);
  });
  it('una nota larga se recorta', () => {
    const r = clasificarCaptura(cap(), 'COMPRAS', ctx({ nota: 'x'.repeat(300) }));
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.nota).toBe(`${'x'.repeat(MAX_NOTA)} (Plin a Alonso Perez Gomez)`);
  });
});
