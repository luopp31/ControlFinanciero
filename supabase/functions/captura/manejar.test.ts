import { describe, it, expect } from 'vitest';
import { manejar, claveValida, compararConstante, MAX_CUERPO, type Entorno, type Registrar } from './manejar';
import { construirPayload } from './payload';

// Todo inventado. Las claves son de mentira.
const CLAVE = 'a'.repeat(32);
const ANTERIOR = 'b'.repeat(32);
const USUARIO = '11111111-2222-3333-4444-555555555555';
const ENTORNO: Entorno = { CAPTURA_KEY: CLAVE, CAPTURA_USUARIO: USUARIO };
const CUENTA = '361-0000000000';

const CORREO = [
  'Hola, NOMBRE, te enviamos tu',
  'Constancia de Pago Plin',
  'Código de operación: 03612599',
  'Fecha y hora: 09 Nov 2026 09:39 PM',
  `Cuenta cargo: Cuenta Simple Soles ${CUENTA}`,
  'Destinatario: Nombre Apellido Apellido',
  'Destino: Plin',
  'Monto y moneda: S/ 1.00',
].join('\n');

function espia(respuesta: { status: number; cuerpo: unknown } = { status: 200, cuerpo: { ok: true, creado: true } }) {
  const llamadas: Record<string, unknown>[] = [];
  const registrar: Registrar = async (p) => {
    llamadas.push(p);
    return respuesta;
  };
  return { llamadas, registrar };
}

const pedir = (cuerpo: unknown, cabeceras: Record<string, string> = { 'x-captura-key': CLAVE }, metodo = 'POST') =>
  new Request('https://ejemplo.test/functions/v1/captura', {
    method: metodo,
    headers: { 'content-type': 'application/json', ...cabeceras },
    body: metodo === 'GET' ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });

describe('autenticación', () => {
  it('sin clave, con clave mala o vacía: 401 y no se toca la base', async () => {
    for (const h of [{}, { 'x-captura-key': 'otra' }, { 'x-captura-key': '' }, { 'x-captura-key': CLAVE + 'x' }, { 'x-captura-key': CLAVE.slice(1) }]) {
      const { llamadas, registrar } = espia();
      const r = await manejar(pedir({ texto: CORREO }, h), ENTORNO, registrar);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ ok: false });
      expect(llamadas).toHaveLength(0);
    }
  });
  it('acepta la clave actual y la anterior (rotación sin cortar el Atajo)', async () => {
    const env = { ...ENTORNO, CAPTURA_KEY_ANTERIOR: ANTERIOR };
    for (const k of [CLAVE, ANTERIOR]) {
      const { registrar } = espia();
      expect((await manejar(pedir({ texto: CORREO }, { 'x-captura-key': k }), env, registrar)).status).toBe(200);
    }
  });
  it('una clave anterior vieja ya no sirve cuando se quita del entorno', async () => {
    const { llamadas, registrar } = espia();
    expect((await manejar(pedir({ texto: CORREO }, { 'x-captura-key': ANTERIOR }), ENTORNO, registrar)).status).toBe(401);
    expect(llamadas).toHaveLength(0);
  });
  it('compararConstante y claveValida', () => {
    expect(compararConstante('abc', 'abc')).toBe(true);
    expect(compararConstante('abc', 'abd')).toBe(false);
    expect(compararConstante('abc', 'abcd')).toBe(false);
    expect(claveValida(null, ENTORNO)).toBe(false);
    expect(claveValida(CLAVE, { CAPTURA_KEY: CLAVE })).toBe(true);
  });
  it('una clave corta en el entorno nunca autentica (mala configuración)', async () => {
    const { registrar } = espia();
    const r = await manejar(pedir({ texto: CORREO }, { 'x-captura-key': 'corta' }), { CAPTURA_KEY: 'corta', CAPTURA_USUARIO: USUARIO }, registrar);
    expect(r.status).toBe(500);
  });
  it('sin configuración responde 500 genérico, sin decir qué falta', async () => {
    for (const env of [{}, { CAPTURA_KEY: CLAVE }, { CAPTURA_KEY: CLAVE, CAPTURA_USUARIO: 'no-es-uuid' }]) {
      const { registrar } = espia();
      const r = await manejar(pedir({ texto: CORREO }), env, registrar);
      expect(r.status).toBe(500);
      expect(await r.json()).toEqual({ ok: false, motivo: 'configuracion' });
    }
  });
  it('solo POST', async () => {
    const { registrar } = espia();
    const r = await manejar(pedir(null, { 'x-captura-key': CLAVE }, 'GET'), ENTORNO, registrar);
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
  });
});

describe('tamaño y formato del cuerpo', () => {
  it('413 si el cuerpo pasa de 16 KB (declarado o real)', async () => {
    const { llamadas, registrar } = espia();
    const grande = JSON.stringify({ texto: 'x'.repeat(MAX_CUERPO + 10) });
    expect((await manejar(pedir(grande), ENTORNO, registrar)).status).toBe(413);
    const declarado = new Request('https://ejemplo.test/', { method: 'POST', headers: { 'x-captura-key': CLAVE, 'content-length': String(MAX_CUERPO + 1) }, body: '{}' });
    expect((await manejar(declarado, ENTORNO, registrar)).status).toBe(413);
    expect(llamadas).toHaveLength(0);
  });
  it('400 si no es JSON, o es un arreglo, o no trae ni texto ni Wallet', async () => {
    for (const cuerpo of ['no es json', '[]', '"texto"', '{}', '{"texto": 5}', '{"origen":"otro"}']) {
      const { llamadas, registrar } = espia();
      expect((await manejar(pedir(cuerpo), ENTORNO, registrar)).status).toBe(400);
      expect(llamadas).toHaveLength(0);
    }
  });
  it('400 si el texto viene vacío', async () => {
    const { registrar } = espia();
    expect((await manejar(pedir({ texto: '   ' }), ENTORNO, registrar)).status).toBe(400);
  });
});

describe('correo Plin', () => {
  it('lo lee, manda UNA fila a la base y responde 200 sin eco del contenido', async () => {
    const { llamadas, registrar } = espia();
    const r = await manejar(pedir({ texto: CORREO }), ENTORNO, registrar);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, creado: true, estado: 'pendiente' });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toEqual({
      dedupe_key: 'op:03612599',
      monto_centimos: 100,
      moneda: 'PEN',
      destinatario: 'Nombre Apellido Apellido',
      destino: 'Plin',
      codigo_operacion: '03612599',
      fecha_hora: '2026-11-09T21:39:00-05:00',
      cuenta: 'Simple',
      origen: 'plin_correo',
      estado: 'pendiente',
    });
  });
  it('el número de cuenta nunca llega a la base ni a la respuesta', async () => {
    const { llamadas, registrar } = espia();
    const r = await manejar(pedir({ texto: CORREO }), ENTORNO, registrar);
    for (const t of [JSON.stringify(llamadas), await r.text()]) {
      expect(t).not.toContain(CUENTA);
      expect(t).not.toContain('0000000000');
    }
  });
  it('el mismo correo dos veces: la base responde creado:false y se informa', async () => {
    const { registrar } = espia({ status: 200, cuerpo: { ok: true, creado: false } });
    const r = await manejar(pedir({ texto: CORREO }), ENTORNO, registrar);
    expect(await r.json()).toEqual({ ok: true, creado: false, estado: 'pendiente' });
  });
  it('un correo que no se sabe leer se guarda como sin_leer, ya sin números de cuenta', async () => {
    const { llamadas, registrar } = espia();
    const raro = `Constancia de transferencia\nCuenta cargo: Cuenta Simple Soles ${CUENTA}\nMonto: S/ 5.00`;
    const r = await manejar(pedir({ texto: raro }), ENTORNO, registrar);
    expect(await r.json()).toEqual({ ok: true, creado: true, estado: 'sin_leer' });
    expect(llamadas[0]).toMatchObject({ estado: 'sin_leer', origen: 'plin_correo' });
    expect(llamadas[0].dedupe_key).toMatch(/^s:[0-9a-f]{32}$/);
    expect(llamadas[0]).not.toHaveProperty('monto_centimos');
    expect(String(llamadas[0].texto_crudo)).not.toContain('0000000000');
    expect(String(llamadas[0].texto_crudo)).toContain('Monto: S/ 5.00');
  });
});

describe('errores de la base', () => {
  it('límite de ritmo -> 429', async () => {
    const { registrar } = espia({ status: 200, cuerpo: { ok: false, motivo: 'limite' } });
    const r = await manejar(pedir({ texto: CORREO }), ENTORNO, registrar);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ ok: false, motivo: 'limite' });
  });
  it('si la base falla o responde raro: 502 genérico, sin filtrar el detalle', async () => {
    for (const reg of [
      async () => ({ status: 500, cuerpo: { message: 'relation "captura_pendiente" violates ...' } }) as { status: number; cuerpo: unknown },
      async () => {
        throw new Error('connection refused secreto-interno');
      },
      async () => ({ status: 200, cuerpo: null }) as { status: number; cuerpo: unknown },
    ]) {
      const r = await manejar(pedir({ texto: CORREO }), ENTORNO, reg);
      expect(r.status).toBe(502);
      const t = await r.text();
      expect(t).toBe('{"ok":false,"motivo":"error"}');
    }
  });
});

describe('Wallet (solo débito Interbank)', () => {
  const wallet = (extra: Record<string, unknown> = {}) => ({ origen: 'wallet', monto: 12.5, comercio: 'Tienda Prueba', fecha_hora: '2026-11-09T21:39:00-05:00', tarjeta: 'interbank', ...extra });
  const AHORA = Date.parse('2026-11-10T00:00:00-05:00');

  it('crea la captura con el comercio como destinatario y sin cuenta', async () => {
    const { llamadas, registrar } = espia();
    const r = await manejar(pedir(wallet()), ENTORNO, registrar);
    expect(await r.json()).toEqual({ ok: true, creado: true, estado: 'pendiente' });
    expect(llamadas[0]).toMatchObject({ origen: 'wallet', monto_centimos: 1250, moneda: 'PEN', destinatario: 'Tienda Prueba', destino: null, cuenta: null, fecha_hora: '2026-11-10T02:39:00.000Z', estado: 'pendiente' });
    expect(llamadas[0].dedupe_key).toMatch(/^h:[0-9a-f]{32}$/);
  });
  it('no acepta la Amex ni otra tarjeta: 422 y no se toca la base', async () => {
    const { llamadas, registrar } = espia();
    for (const t of ['amex', 'Amex', 'otra']) expect((await manejar(pedir(wallet({ tarjeta: t })), ENTORNO, registrar)).status).toBe(422);
    expect(llamadas).toHaveLength(0);
  });
  it('la tarjeta es opcional y no distingue mayúsculas', async () => {
    const { registrar } = espia();
    expect((await manejar(pedir(wallet({ tarjeta: 'INTERBANK' })), ENTORNO, registrar)).status).toBe(200);
    const sin = wallet();
    delete (sin as Record<string, unknown>).tarjeta;
    expect((await manejar(pedir(sin), ENTORNO, registrar)).status).toBe(200);
  });
  it.each([
    ['monto en texto', { monto: '12.5' }],
    ['monto cero', { monto: 0 }],
    ['monto negativo', { monto: -3 }],
    ['monto enorme', { monto: 100000 }],
    ['sin comercio', { comercio: '   ' }],
    ['comercio no texto', { comercio: 5 }],
    ['fecha ilegible', { fecha_hora: 'ayer' }],
    ['fecha sin huso horario', { fecha_hora: '2026-11-09T21:39:00' }],
    ['fecha en el futuro lejano', { fecha_hora: '2027-12-01T10:00:00-05:00' }],
    ['fecha muy vieja', { fecha_hora: '2024-01-01T10:00:00-05:00' }],
  ])('rechaza: %s', async (_, extra) => {
    const r = await construirPayload(wallet(extra), AHORA);
    expect(r.ok).toBe(false);
  });
  it('el comercio sale sin cifras largas y con tope de largo', async () => {
    const r = await construirPayload(wallet({ comercio: `Tienda ${'9'.repeat(13)} ${'x'.repeat(200)}` }), AHORA);
    if (!r.ok) throw new Error('debía aceptarse');
    const d = String(r.payload.destinatario);
    expect(d).not.toMatch(/\d{9,}/);
    expect(d.length).toBeLessThanOrEqual(80);
  });
  it('el mismo gasto da la misma clave; otro minuto o monto, otra', async () => {
    const a = await construirPayload(wallet(), AHORA);
    const b = await construirPayload(wallet({ comercio: '  tienda   prueba ' }), AHORA);
    const c = await construirPayload(wallet({ monto: 13 }), AHORA);
    const d = await construirPayload(wallet({ fecha_hora: '2026-11-09T21:40:00-05:00' }), AHORA);
    if (!a.ok || !b.ok || !c.ok || !d.ok) throw new Error('debían aceptarse');
    expect(b.payload.dedupe_key).toBe(a.payload.dedupe_key);
    expect(c.payload.dedupe_key).not.toBe(a.payload.dedupe_key);
    expect(d.payload.dedupe_key).not.toBe(a.payload.dedupe_key);
  });
});
