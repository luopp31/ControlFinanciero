import { describe, it, expect } from 'vitest';
import { construirPayload } from './payload';
import { manejar, type Registrar } from './manejar';

// Todo inventado. "Ahora" fijo: 10 nov 2026, 03:00 UTC = 9 nov, 22:00 en Lima.
const AHORA = Date.parse('2026-11-10T03:00:00Z');
const AHORA_ISO = '2026-11-10T03:00:00.000Z';

const wallet = (extra: Record<string, unknown> = {}) => ({ origen: 'wallet', monto: 12.5, comercio: 'Tienda Prueba', tarjeta: 'interbank', fecha_hora: '2026-11-09T21:39:00-05:00', ...extra });
const fechaDe = async (cuerpo: unknown) => {
  const r = await construirPayload(cuerpo, AHORA);
  if (!r.ok) throw new Error(`debía aceptarse: ${r.status} ${r.motivo}`);
  return r.payload.fecha_hora;
};

describe('Wallet: fecha_hora que no es ISO válido -> la hora actual (no se pierde la compra)', () => {
  it.each([
    ['texto suelto', 'ayer'],
    ['dd/mm/aaaa', '09/11/2026 21:39'],
    ['mm/dd/aaaa', '11/09/2026 21:39'],
    ['fecha larga en español', '9 nov 2026 21:39'],
    ['fecha larga con coma', '9 de noviembre de 2026, 9:39 p. m.'],
    ['solo la fecha', '2026-11-09'],
    ['solo la hora', '21:39'],
    ['día imposible', '2026-02-31T10:00:00-05:00'],
    ['mes imposible', '2026-13-01T10:00:00-05:00'],
    ['hora imposible', '2026-11-09T25:00:00-05:00'],
    ['un número', 1789000000],
    ['un booleano', true],
    ['un objeto', { fecha: 'x' }],
    ['una lista de dos', ['2026-11-09T21:39:00-05:00', '2026-11-09T21:40:00-05:00']],
    ['una lista anidada', [['2026-11-09T21:39:00-05:00']]],
  ])('%s -> hora actual', async (_, fecha_hora) => {
    expect(await fechaDe(wallet({ fecha_hora }))).toBe(AHORA_ISO);
  });

  it('la hora actual en Lima es la del momento del pago (9 nov, 22:00)', async () => {
    const iso = String(await fechaDe(wallet({ fecha_hora: '09/11/2026' })));
    expect(new Date(Date.parse(iso) - 5 * 3_600_000).toISOString().slice(0, 16)).toBe('2026-11-09T22:00');
  });

  it('el resto de la captura no cambia: monto, comercio y demás se guardan normal', async () => {
    const r = await construirPayload(wallet({ fecha_hora: 'ayer' }), AHORA);
    if (!r.ok) throw new Error('debía aceptarse');
    expect(r.payload).toMatchObject({ origen: 'wallet', monto_centimos: 1250, moneda: 'PEN', destinatario: 'Tienda Prueba', estado: 'pendiente' });
  });

  it('por la función completa: responde 200 y manda UNA fila con la hora actual', async () => {
    const filas: Record<string, unknown>[] = [];
    const registrar: Registrar = async (p) => {
      filas.push(p);
      return { status: 200, cuerpo: { ok: true, creado: true } };
    };
    const env = { CAPTURA_KEY: 'a'.repeat(32), CAPTURA_USUARIO: '11111111-2222-3333-4444-555555555555' };
    const antes = Date.now();
    const r = await manejar(new Request('https://ejemplo.test/', { method: 'POST', headers: { 'x-captura-key': env.CAPTURA_KEY }, body: JSON.stringify(wallet({ fecha_hora: 'ayer' })) }), env, registrar);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, creado: true, estado: 'pendiente' });
    expect(filas).toHaveLength(1);
    const usada = Date.parse(String(filas[0].fecha_hora));
    expect(usada).toBeGreaterThanOrEqual(antes - 1000);
    expect(usada).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('Wallet: un ISO válido pero fuera de rango sigue rechazándose', () => {
  it.each([
    ['más de un día en el futuro', '2026-11-12T10:00:00-05:00'],
    ['un año en el futuro', '2027-11-09T10:00:00-05:00'],
    ['más de 400 días atrás', '2024-01-01T10:00:00-05:00'],
    ['en UTC también', '2024-01-01T10:00:00Z'],
    ['sin zona (hora de Lima) fuera de rango', '2027-12-01T10:00:00'],
  ])('%s -> 400 fecha_hora', async (_, fecha_hora) => {
    expect(await construirPayload(wallet({ fecha_hora }), AHORA)).toEqual({ ok: false, status: 400, motivo: 'fecha_hora' });
  });

  it('los límites: hasta un día adelante y hasta 400 días atrás entran', async () => {
    expect(await fechaDe(wallet({ fecha_hora: '2026-11-11T02:59:00Z' }))).toBe('2026-11-11T02:59:00.000Z'); // 23 h 59 min en el futuro
    expect(await fechaDe(wallet({ fecha_hora: '2025-10-07T03:00:00Z' }))).toBe('2025-10-07T03:00:00.000Z'); // 399 días atrás
    expect(await construirPayload(wallet({ fecha_hora: '2026-11-11T03:01:00Z' }), AHORA)).toMatchObject({ ok: false });
    expect(await construirPayload(wallet({ fecha_hora: '2025-10-05T03:00:00Z' }), AHORA)).toMatchObject({ ok: false });
  });

  it('un ISO válido dentro de rango se respeta tal cual (no se reemplaza por la hora actual)', async () => {
    expect(await fechaDe(wallet({ fecha_hora: '2026-11-09T21:39:00-05:00' }))).toBe('2026-11-10T02:39:00.000Z');
    expect(await fechaDe(wallet({ fecha_hora: ['2026-11-09T21:39:00-05:00'] }))).toBe('2026-11-10T02:39:00.000Z');
  });
});

describe('Correo Plin: sigue estricto (no cambia nada)', () => {
  const correo = (fecha: string) =>
    ['Constancia de Pago Plin', 'Código de operación: 03612599', `Fecha y hora: ${fecha}`, 'Cuenta cargo: Cuenta Simple Soles', 'Destinatario: Nombre Apellido', 'Destino: Plin', 'Monto y moneda: S/ 1.00'].join('\n');

  it('una fecha que no se puede leer NO se reemplaza por la hora actual: queda sin_leer', async () => {
    for (const fecha of ['ayer', '09/11/2026 21:39', '31 Feb 2026 09:00 AM', '09 Xyz 2026 09:00 AM']) {
      const r = await construirPayload({ texto: correo(fecha) }, AHORA);
      if (!r.ok) throw new Error('debía guardarse como sin_leer');
      expect(r.estado).toBe('sin_leer');
      expect(r.payload).not.toHaveProperty('monto_centimos');
      expect(r.payload).not.toHaveProperty('fecha_hora');
    }
  });

  it('una fecha válida del correo se lee como siempre', async () => {
    const r = await construirPayload({ texto: correo('09 Nov 2026 09:39 PM') }, AHORA);
    if (!r.ok) throw new Error('debía leerse');
    expect(r.estado).toBe('pendiente');
    expect(r.payload).toMatchObject({ fecha_hora: '2026-11-09T21:39:00-05:00', monto_centimos: 100, origen: 'plin_correo' });
  });

  it('un correo sin "Fecha y hora" tampoco usa la hora actual', async () => {
    const sin = correo('x').replace('Fecha y hora: x\n', '');
    const r = await construirPayload({ texto: sin }, AHORA);
    if (!r.ok) throw new Error('debía guardarse como sin_leer');
    expect(r.estado).toBe('sin_leer');
  });
});
