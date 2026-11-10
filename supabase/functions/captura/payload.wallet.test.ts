import { describe, it, expect } from 'vitest';
import { construirPayload, leerComercio, leerFechaHora, leerMontoWallet } from './payload';
import { manejar, type Registrar } from './manejar';

// Todo inventado. "Ahora" fijo: 10 nov 2026, 03:00 UTC = 9 nov, 22:00 en Lima.
const AHORA = Date.parse('2026-11-10T03:00:00Z');

const wallet = (extra: Record<string, unknown> = {}) => ({ origen: 'wallet', monto: 12.5, comercio: 'Tienda Prueba', fecha_hora: '2026-11-09T21:39:00-05:00', tarjeta: 'interbank', ...extra });
const ok = async (cuerpo: unknown) => {
  const r = await construirPayload(cuerpo, AHORA);
  if (!r.ok) throw new Error(`debía aceptarse: ${r.motivo}`);
  return r.payload;
};

describe('monto de Wallet: número, texto con símbolo o lista de un valor', () => {
  it.each([
    [12.5, 1250],
    [12, 1200],
    [0.05, 5],
    [1234.5, 123450],
    ['12.5', 1250],
    ['12', 1200],
    ['S/ 12.50', 1250],
    ['S/12.50', 1250],
    ['S/. 12.50', 1250],
    ['s/ 12.50', 1250],
    ['12,50', 1250],
    ['S/ 12,50', 1250],
    ['1,234.50', 123450],
    ['S/ 1,234.50', 123450],
    ['1.234,50', 123450],
    ['12.50 PEN', 1250],
    ['  S/ 12.50  ', 1250],
    ['S/ 99,999.99', 9999999],
    [[12.5], 1250],
    [['S/ 12.50'], 1250],
    [['12,50'], 1250],
  ])('%j -> %i céntimos (soles)', (entrada, centimos) => {
    expect(leerMontoWallet(entrada)).toEqual({ centimos, moneda: 'PEN' });
  });

  it('con US$, USD o $ es en dólares', () => {
    expect(leerMontoWallet('US$ 23.60')).toEqual({ centimos: 2360, moneda: 'USD' });
    expect(leerMontoWallet('USD 1,000.00')).toEqual({ centimos: 100000, moneda: 'USD' });
    expect(leerMontoWallet('$5')).toEqual({ centimos: 500, moneda: 'USD' });
    expect(leerMontoWallet('23.60 USD')).toEqual({ centimos: 2360, moneda: 'USD' });
  });

  it.each([
    [0], [-3], [-0.5], [100000], [99999.999], [Number.NaN], [Number.POSITIVE_INFINITY],
    ['0'], ['0.00'], ['S/ 0.00'], ['-12.50'], ['S/ -12.50'], ['S/ 100,000.00'], ['100000'],
    ['abc'], [''], ['   '], ['S/'], ['12.5.3'], ['1,2,3'], ['12 50'], ['S/ 12.50 y 3.00'],
    [[]], [[1, 2]], [[[12.5]]], [[null]], [[{}]],
    [null], [undefined], [true], [{}], [{ monto: 12.5 }],
  ])('rechaza %j', (entrada) => {
    expect(leerMontoWallet(entrada)).toBeNull();
  });

  it('por la función completa: el monto malo da 400 "monto" y no se guarda nada', async () => {
    const registrados: unknown[] = [];
    const registrar: Registrar = async (p) => {
      registrados.push(p);
      return { status: 200, cuerpo: { ok: true, creado: true } };
    };
    const env = { CAPTURA_KEY: 'a'.repeat(32), CAPTURA_USUARIO: '11111111-2222-3333-4444-555555555555' };
    for (const monto of [0, -1, 'S/ 0.00', 'S/ 100,000.00', 'abc', [1, 2]]) {
      const r = await manejar(new Request('https://ejemplo.test/', { method: 'POST', headers: { 'x-captura-key': env.CAPTURA_KEY }, body: JSON.stringify(wallet({ monto })) }), env, registrar);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ ok: false, motivo: 'monto' });
    }
    expect(registrados).toHaveLength(0);
  });

  it('el payload lleva los céntimos y la moneda leídos', async () => {
    expect(await ok(wallet({ monto: 'S/ 1,234.50' }))).toMatchObject({ monto_centimos: 123450, moneda: 'PEN' });
    expect(await ok(wallet({ monto: [12.5] }))).toMatchObject({ monto_centimos: 1250, moneda: 'PEN' });
    expect(await ok(wallet({ monto: 'US$ 23.60' }))).toMatchObject({ monto_centimos: 2360, moneda: 'USD' });
  });

  it('el mismo gasto en otra forma de escribir el monto es la misma captura (idempotente)', async () => {
    const claves = await Promise.all([12.5, '12.50', 'S/ 12.50', '12,50', [12.5]].map(async (m) => (await ok(wallet({ monto: m }))).dedupe_key));
    expect(new Set(claves).size).toBe(1);
  });
});

describe('comercio vacío o ausente: entra como "Sin nombre"', () => {
  it.each([[undefined], [null], [''], ['   '], [5], [true], [{}], [[]], [['a', 'b']], [[null]]])('%j -> Sin nombre', (entrada) => {
    expect(leerComercio(entrada)).toBe('Sin nombre');
  });
  it('un texto normal se limpia y se conserva; una lista de uno también', () => {
    expect(leerComercio('  Plaza   Vea ')).toBe('Plaza Vea');
    expect(leerComercio(['Plaza Vea'])).toBe('Plaza Vea');
  });
  it('sin cifras largas y con tope de largo', () => {
    const t = leerComercio(`Tienda ${'9'.repeat(13)} ${'x'.repeat(200)}`);
    expect(t).not.toMatch(/\d{9,}/);
    expect(t.length).toBeLessThanOrEqual(80);
  });
  it('la captura entra igual, con "Sin nombre" como destinatario', async () => {
    for (const comercio of [undefined, null, '', '   ', 5]) {
      const cuerpo = wallet({ comercio });
      if (comercio === undefined) delete (cuerpo as Record<string, unknown>).comercio;
      expect(await ok(cuerpo)).toMatchObject({ destinatario: 'Sin nombre', origen: 'wallet', estado: 'pendiente' });
    }
  });
});

describe('fecha_hora: ISO con zona, y si viene vacía la hora actual', () => {
  it.each([
    ['2026-11-09T21:39:00-05:00', '2026-11-10T02:39:00.000Z'],
    ['2026-11-10T02:39:00Z', '2026-11-10T02:39:00.000Z'],
    ['2026-11-10T02:39:00+00:00', '2026-11-10T02:39:00.000Z'],
    ['2026-11-09T21:39:00.123-05:00', '2026-11-10T02:39:00.123Z'],
    ['2026-11-09T21:39:00-0500', '2026-11-10T02:39:00.000Z'], // zona pegada
    ['2026-11-09 21:39:00 -0500', '2026-11-10T02:39:00.000Z'], // espacios
    ['2026-11-09 21:39:00 -05:00', '2026-11-10T02:39:00.000Z'],
    ['  2026-11-09T21:39:00-05:00  ', '2026-11-10T02:39:00.000Z'],
    ['2026-11-09T21:39:00', '2026-11-10T02:39:00.000Z'], // sin zona: se toma como hora de Lima
    ['2026-11-09T21:39', '2026-11-10T02:39:00.000Z'],
    [['2026-11-09T21:39:00-05:00'], '2026-11-10T02:39:00.000Z'], // lista de un valor
  ])('%j -> %s', (entrada, esperado) => {
    expect(new Date(leerFechaHora(entrada, AHORA)!).toISOString()).toBe(esperado);
  });

  it.each([[undefined], [null], [''], ['   '], ['\n']])('vacía (%j) -> la hora actual', (entrada) => {
    expect(leerFechaHora(entrada, AHORA)).toBe(AHORA);
  });

  it('ausente en el cuerpo: usa la hora actual, que en Lima es 9 nov 22:00', async () => {
    const cuerpo = wallet();
    delete (cuerpo as Record<string, unknown>).fecha_hora;
    const p = await ok(cuerpo);
    expect(p.fecha_hora).toBe('2026-11-10T03:00:00.000Z');
    // misma hora en Lima: 22:00 del 9 de nov
    expect(new Date(Date.parse(String(p.fecha_hora)) - 5 * 3_600_000).toISOString().slice(0, 16)).toBe('2026-11-09T22:00');
  });

  it.each([
    ['ayer'], ['2026-11-09'], ['09/11/2026 21:39'], ['11/09/2026 21:39'], ['9 nov 2026 21:39'], ['2026-02-31T10:00:00-05:00'],
    ['2026-13-01T10:00:00-05:00'], ['2026-11-09T25:00:00-05:00'], [5], [true], [{}], [[1, 2]],
  ])('ilegible (%j) -> null', (entrada) => {
    expect(leerFechaHora(entrada, AHORA)).toBeNull();
  });

  it('fuera de rango (más de un día en el futuro o de 400 días atrás) sigue dando 400', async () => {
    for (const fecha_hora of ['2026-11-12T10:00:00-05:00', '2024-01-01T10:00:00-05:00']) {
      expect(await construirPayload(wallet({ fecha_hora }), AHORA)).toEqual({ ok: false, status: 400, motivo: 'fecha_hora' });
    }
  });

  it('un gasto de hace unos minutos entra', async () => {
    expect(await ok(wallet({ fecha_hora: '2026-11-09T21:50:00-05:00' }))).toMatchObject({ fecha_hora: '2026-11-10T02:50:00.000Z' });
  });
});

describe('Wallet: lo que no cambia', () => {
  it('la Amex y otras tarjetas siguen rechazadas con 422', async () => {
    expect(await construirPayload(wallet({ tarjeta: 'amex' }), AHORA)).toEqual({ ok: false, status: 422, motivo: 'tarjeta_no_soportada' });
  });
  it('el caso mínimo (solo origen y monto) entra: Sin nombre, hora actual, sin cuenta', async () => {
    expect(await ok({ origen: 'wallet', monto: 5 })).toMatchObject({
      origen: 'wallet', monto_centimos: 500, moneda: 'PEN', destinatario: 'Sin nombre', cuenta: null, destino: null, fecha_hora: '2026-11-10T03:00:00.000Z', estado: 'pendiente',
    });
  });
  it('sin monto no hay captura', async () => {
    expect(await construirPayload({ origen: 'wallet', comercio: 'x' }, AHORA)).toEqual({ ok: false, status: 400, motivo: 'monto' });
  });
});
