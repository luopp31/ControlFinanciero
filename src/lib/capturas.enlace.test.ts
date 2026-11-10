import { describe, it, expect } from 'vitest';
import type { Captura } from './db';
import { capturaQueCoincide, enlazarCaptura } from './capturas';

// Todo inventado. Captura: Plin a "Alonso Perez Gomez", S/ 2.50, 9 nov 21:39 (Lima).
// En el PDF aparece como "PLIN-ALONSO" o "YAPE-ALONSO".
const AHORA = '2026-11-10T03:00:00.000Z';
const cap = (extra: Partial<Captura> = {}): Captura => ({
  id: 'c1', dedupeKey: 'op:1', montoCentimos: 250, moneda: 'PEN', destinatario: 'Alonso Perez Gomez', destino: 'Plin', codigoOperacion: '1',
  fechaHora: '2026-11-09T21:39:00-05:00', cuenta: null, origen: 'plin_correo', estado: 'pendiente', ...extra,
});
const fila = (extra: Record<string, unknown> = {}) => ({ descriptor: 'PLIN-ALONSO', centimos: -250, fecha: '2026-11-09', hora: '21:41', ...extra });

describe('capturaQueCoincide: captura pendiente <-> fila del banco', () => {
  it('mismo monto, mismo nombre y misma fecha: coincide', () => {
    expect(capturaQueCoincide(fila(), [cap()])?.id).toBe('c1');
  });
  it('el prefijo PLIN-/YAPE- del banco no importa, solo el nombre', () => {
    expect(capturaQueCoincide(fila({ descriptor: 'YAPE-ALONSO' }), [cap()])?.id).toBe('c1');
    expect(capturaQueCoincide(fila({ descriptor: 'YAPE-alonso' }), [cap()])?.id).toBe('c1');
  });
  it('tolera ±3 días (el banco asienta después)', () => {
    expect(capturaQueCoincide(fila({ fecha: '2026-11-12' }), [cap()])?.id).toBe('c1');
    expect(capturaQueCoincide(fila({ fecha: '2026-11-13' }), [cap()])).toBeUndefined();
    expect(capturaQueCoincide(fila({ fecha: '2026-11-06' }), [cap()])?.id).toBe('c1');
  });
  it('compara con la fecha de Lima, no la UTC (21:39 en Lima ya es el día siguiente en UTC)', () => {
    expect(capturaQueCoincide(fila({ fecha: '2026-11-09' }), [cap({ fechaHora: '2026-11-10T02:39:00.000Z' })])?.id).toBe('c1');
  });
  it('otro monto, otro nombre, abono o fila sin nombre de persona: no coincide', () => {
    expect(capturaQueCoincide(fila({ centimos: -251 }), [cap()])).toBeUndefined();
    expect(capturaQueCoincide(fila({ descriptor: 'PLIN-ANGEL G' }), [cap()])).toBeUndefined();
    expect(capturaQueCoincide(fila({ centimos: 250 }), [cap()])).toBeUndefined();
    expect(capturaQueCoincide(fila({ descriptor: 'OXXO' }), [cap()])).toBeUndefined();
  });
  it('solo pendientes, vivas y en soles', () => {
    for (const x of [{ estado: 'clasificado' }, { estado: 'descartado' }, { estado: 'sin_leer' }, { borrado: true }, { moneda: 'USD' }] as const) {
      expect(capturaQueCoincide(fila(), [cap(x)])).toBeUndefined();
    }
  });
  it('una captura no se usa dos veces y entre varias gana la más cercana', () => {
    const lejos = cap({ id: 'lejos', fechaHora: '2026-11-07T21:39:00-05:00' });
    const cerca = cap({ id: 'cerca' });
    expect(capturaQueCoincide(fila(), [lejos, cerca])?.id).toBe('cerca');
    expect(capturaQueCoincide(fila(), [cerca], new Set(['cerca']))).toBeUndefined();
  });
  it('Wallet: mismo monto, el mismo día y a 30 minutos o menos (el comercio no se llama igual en el banco)', () => {
    const w = cap({ id: 'w', origen: 'wallet', destino: null, destinatario: 'Plaza Vea', fechaHora: '2026-11-09T14:08:00-05:00' });
    const compra = (extra: Record<string, unknown> = {}) => ({ descriptor: '229 PVEA SALAVERRY', centimos: -250, fecha: '2026-11-09', hora: '14:20', ...extra });
    expect(capturaQueCoincide(compra(), [w])?.id).toBe('w');
    expect(capturaQueCoincide(compra({ hora: '15:00' }), [w])).toBeUndefined();
    expect(capturaQueCoincide(compra({ fecha: '2026-11-10' }), [w])).toBeUndefined();
    expect(capturaQueCoincide(compra({ hora: null }), [w])).toBeUndefined();
  });
  it('enlazarCaptura: queda clasificada y apunta al movimiento', () => {
    expect(enlazarCaptura(cap(), { id: 'm1', categoria: 'TRANSPORTE' }, AHORA)).toMatchObject({
      estado: 'clasificado', categoria: 'TRANSPORTE', movimientoId: 'm1', sincronizado: false, actualizado: AHORA,
    });
  });
});
