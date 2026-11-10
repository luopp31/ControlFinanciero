import { describe, it, expect } from 'vitest';
import { parsearCorreoTransferencia, leerProducto, claveDedupeTransferencia, esTransferencia, type TransferenciaParseada } from './transferencia';
import { quitarNumerosDeCuenta } from './parser';
import { construirPayload } from './payload';
import { manejar, type Registrar } from './manejar';

// Todo inventado. Los números de cuenta son falsos (o enmascarados, como en el formato real de ejemplo).
const NUM_CARGO = '8980000000011';
const NUM_DESTINO = '3610000000022';

/** Formato nuevo: etiquetas y valores en líneas separadas; la fecha y la hora en líneas distintas. */
const formatoNuevo = (extra: { cargo?: string[]; destino?: string[]; monto?: string; codigo?: string; hora?: string } = {}) =>
  [
    'Hola LUIS, te enviamos tu',
    '',
    'Constancia de transferencia',
    '',
    'Código de operación',
    '',
    extra.codigo ?? '01739610',
    '',
    'Fecha y hora',
    '',
    '01 Nov 2026',
    '',
    extra.hora ?? '8:51 AM',
    '',
    'Cuenta cargo',
    '',
    ...(extra.cargo ?? ['Millonaria', 'Soles', NUM_CARGO]),
    '',
    'Cuenta destino',
    '',
    ...(extra.destino ?? ['Cuenta Simple', 'Soles', NUM_DESTINO]),
    '',
    'Moneda y monto',
    '',
    extra.monto ?? 'S/ 300.00',
  ].join('\n');

const ok = (t: string): TransferenciaParseada => {
  const r = parsearCorreoTransferencia(t);
  if (!r.ok) throw new Error('debía leerse: ' + r.motivo);
  return r.transferencia;
};

describe('formato nuevo (etiquetas en líneas separadas)', () => {
  it('lee código, fecha y hora de Lima, monto, producto de cargo y de destino', () => {
    expect(ok(formatoNuevo())).toEqual({
      codigoOperacion: '01739610',
      fechaHora: '2026-11-01T08:51:00-05:00',
      montoCentimos: 30000,
      moneda: 'PEN',
      cuentaCargo: 'Millonaria',
      cuentaDestino: 'Simple',
    });
  });
  it('no trae destinatario: no se asume uno', () => {
    expect(JSON.stringify(ok(formatoNuevo()))).not.toMatch(/destinatario/i);
  });
  it('la fecha y la hora en líneas distintas se unen (8:51 AM y 05:10 PM, código de 7 u 8 dígitos)', () => {
    expect(ok(formatoNuevo({ hora: '05:10 PM' })).fechaHora).toBe('2026-11-01T17:10:00-05:00');
    expect(ok(formatoNuevo({ hora: '12:05 AM' })).fechaHora).toBe('2026-11-01T00:05:00-05:00');
    expect(ok(formatoNuevo({ codigo: '1739610' })).codigoOperacion).toBe('1739610');
    expect(ok(formatoNuevo({ codigo: '01739610' })).codigoOperacion).toBe('01739610');
  });
  it('lee Ahorro Sueldo como producto', () => {
    expect(ok(formatoNuevo({ cargo: ['Ahorro Sueldo', 'Soles', NUM_CARGO], destino: ['Millonaria', 'Soles', NUM_DESTINO] }))).toMatchObject({ cuentaCargo: 'Ahorro Sueldo', cuentaDestino: 'Millonaria' });
  });
});

describe('formato viejo (todo en una línea)', () => {
  const viejo = `Hola LUIS, te enviamos tu Constancia de transferencia Código de operación: 1739610 Fecha y hora: 01 Nov 2026 8:51 AM Cuenta cargo: Millonaria Soles ${NUM_CARGO}. Cuenta destino: Cuenta Simple Soles ${NUM_DESTINO}. Moneda y monto: S/ 300.00`;
  it('lee los mismos campos', () => {
    expect(ok(viejo)).toEqual({ codigoOperacion: '1739610', fechaHora: '2026-11-01T08:51:00-05:00', montoCentimos: 30000, moneda: 'PEN', cuentaCargo: 'Millonaria', cuentaDestino: 'Simple' });
  });
  it('también con una etiqueta por línea y el valor en la misma (con dos puntos)', () => {
    const t = ['Constancia de transferencia', 'Código de operación: 01739610', 'Fecha y hora: 01 Nov 2026 8:51 AM', `Cuenta cargo: Millonaria Soles ${NUM_CARGO}`, `Cuenta destino: Cuenta Simple Soles ${NUM_DESTINO}`, 'Moneda y monto: S/ 300.00'].join('\n');
    expect(ok(t)).toMatchObject({ cuentaCargo: 'Millonaria', cuentaDestino: 'Simple', montoCentimos: 30000 });
  });
});

describe('cargo sin nombre de producto', () => {
  it('"Soles 898 …" hacia Millonaria: el cargo queda null (no se adivina, ni por el prefijo del número)', () => {
    const t = ok(formatoNuevo({ cargo: ['Soles', NUM_CARGO], destino: ['Millonaria', 'Soles', NUM_DESTINO] }));
    expect(t.cuentaCargo).toBeNull();
    expect(t.cuentaDestino).toBe('Millonaria');
  });
  it('también en el formato de una línea', () => {
    const t = ok(`Constancia de transferencia Código de operación: 1739610 Fecha y hora: 01 Nov 2026 8:51 AM Cuenta cargo: Soles ${NUM_CARGO}. Cuenta destino: Millonaria Soles ${NUM_DESTINO}. Moneda y monto: S/ 300.00`);
    expect(t).toMatchObject({ cuentaCargo: null, cuentaDestino: 'Millonaria' });
  });
});

describe('monto', () => {
  it.each([
    ['S/ 300.00', 30000],
    ['S/ 1,250.00', 125000],
    ['S/ 4,200.57', 420057],
    ['S/ 0.50', 50],
    ['S/ 99,999.99', 9999999],
  ])('%s -> %i céntimos', (m, c) => expect(ok(formatoNuevo({ monto: m })).montoCentimos).toBe(c));
  it('en dólares queda moneda USD', () => {
    expect(ok(formatoNuevo({ monto: 'US$ 23.60' }))).toMatchObject({ montoCentimos: 2360, moneda: 'USD' });
  });
  it('cero, ilegible o desde S/ 100,000: no se guarda', () => {
    for (const m of ['S/ 0.00', 'abc', 'S/ 100,000.00']) expect(parsearCorreoTransferencia(formatoNuevo({ monto: m })).ok).toBe(false);
  });
});

describe('producto desconocido y dólares', () => {
  it('un producto que no conozco se guarda tal cual (la app decidirá)', () => {
    expect(ok(formatoNuevo({ destino: ['Cuenta Premium Plus', 'Soles', NUM_DESTINO] })).cuentaDestino).toBe('Premium Plus');
  });
  it('un producto en dólares sale con "(USD)" para no confundirlo con la cuenta en soles', () => {
    expect(ok(formatoNuevo({ cargo: ['Simple', 'Dólares', NUM_CARGO], destino: ['Cuenta Simple', 'Soles', NUM_DESTINO] }))).toMatchObject({ cuentaCargo: 'Simple (USD)', cuentaDestino: 'Simple' });
    expect(ok(formatoNuevo({ destino: ['Cuenta Simple', 'Dolares', NUM_DESTINO] })).cuentaDestino).toBe('Simple (USD)');
  });
  it('mayúsculas y minúsculas salen normalizadas', () => {
    expect(ok(formatoNuevo({ cargo: ['MILLONARIA', 'SOLES', NUM_CARGO], destino: ['ahorro sueldo', 'soles', NUM_DESTINO] }))).toMatchObject({ cuentaCargo: 'Millonaria', cuentaDestino: 'Ahorro Sueldo' });
  });
  it('sin ningún producto no hay con qué decidir: queda para revisar', () => {
    const r = parsearCorreoTransferencia(formatoNuevo({ cargo: ['Soles', NUM_CARGO], destino: ['Soles', NUM_DESTINO] }));
    expect(r).toMatchObject({ ok: false, motivo: 'No pude identificar las cuentas de la transferencia.' });
  });
  it('leerProducto', () => {
    expect(leerProducto('Millonaria Soles 898 XXXXXXXXXX')).toEqual({ producto: 'Millonaria', moneda: 'PEN' });
    expect(leerProducto('Cuenta Simple Soles 361XXXXXXXXXX')).toEqual({ producto: 'Simple', moneda: 'PEN' });
    expect(leerProducto('Soles 898 XXXXXXXXXX')).toEqual({ producto: null, moneda: 'PEN' });
    expect(leerProducto('Cuenta Soles 898')).toEqual({ producto: null, moneda: 'PEN' });
    expect(leerProducto('Simple Dólares 123')).toEqual({ producto: 'Simple', moneda: 'USD' });
    expect(leerProducto('Cuenta Simple')).toEqual({ producto: 'Simple', moneda: null });
    expect(leerProducto(null)).toEqual({ producto: null, moneda: null });
  });
});

describe('el número de cuenta nunca se guarda', () => {
  it('ni en lo que se lee, ni en el payload, ni en la respuesta', async () => {
    for (const t of [formatoNuevo(), formatoNuevo({ cargo: ['Soles', NUM_CARGO] })]) {
      expect(JSON.stringify(ok(t))).not.toMatch(/\d{9,}/);
      const p = await construirPayload({ texto: t });
      if (!p.ok) throw new Error('debía aceptarse');
      const json = JSON.stringify(p.payload);
      expect(json).not.toContain(NUM_CARGO);
      expect(json).not.toContain(NUM_DESTINO);
      expect(json).not.toMatch(/\d{9,}/);
    }
  });
  it('con los números enmascarados con X (el formato de ejemplo) tampoco queda ni el prefijo', () => {
    const t = ['Constancia de transferencia', 'Código de operación', '01739610', 'Fecha y hora', '01 Nov 2026', '8:51 AM', 'Cuenta cargo', 'Millonaria', 'Soles', '898 XXXXXXXXXX', 'Cuenta destino', 'Cuenta Simple', 'Soles', '361XXXXXXXXXX', 'Moneda y monto'].join('\n'); // falta el monto
    const r = parsearCorreoTransferencia(t);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.textoLimpio).not.toMatch(/898|361|XXXX/);
    expect(r.textoLimpio).toContain('[número]');
  });
  it('quitarNumerosDeCuenta cubre las formas enmascaradas', () => {
    expect(quitarNumerosDeCuenta('Soles 898 XXXXXXXXXX')).toBe('Soles [número]');
    expect(quitarNumerosDeCuenta('361XXXXXXXXXX')).toBe('[número]');
    expect(quitarNumerosDeCuenta('Tarjeta **** 1234')).toBe('Tarjeta [tarjeta]');
    expect(quitarNumerosDeCuenta('Código 01739610 y monto 1,250.00')).toBe('Código 01739610 y monto 1,250.00');
  });
  it('un correo de transferencia que no se puede leer se guarda sin_leer, ya sin números', async () => {
    const p = await construirPayload({ texto: formatoNuevo().replace('01 Nov 2026\n\n8:51 AM', 'ayer') });
    if (!p.ok) throw new Error('debía guardarse como sin_leer');
    expect(p.estado).toBe('sin_leer');
    expect(p.payload).toMatchObject({ origen: 'transferencia_correo', estado: 'sin_leer' });
    expect(String(p.payload.texto_crudo)).not.toMatch(/898|361|\d{9,}/);
  });
});

describe('payload y función completa', () => {
  it('arma la fila con tipo transferencia, cuenta_destino y origen transferencia_correo, y dedupe tr:<código>', async () => {
    const p = await construirPayload({ texto: formatoNuevo() });
    if (!p.ok) throw new Error('debía aceptarse');
    expect(p.estado).toBe('pendiente');
    expect(p.payload).toEqual({
      dedupe_key: 'tr:01739610',
      monto_centimos: 30000,
      moneda: 'PEN',
      destinatario: null,
      destino: null,
      codigo_operacion: '01739610',
      fecha_hora: '2026-11-01T08:51:00-05:00',
      cuenta: 'Millonaria',
      cuenta_destino: 'Simple',
      tipo: 'transferencia',
      origen: 'transferencia_correo',
      estado: 'pendiente',
    });
  });
  it('el código de una transferencia nunca choca con el de un Plin: prefijo tr: y no op:', async () => {
    const tr = await construirPayload({ texto: formatoNuevo({ codigo: '03612599' }) });
    const plin = await construirPayload({ texto: ['Constancia de Pago Plin', 'Código de operación: 03612599', 'Fecha y hora: 01 Nov 2026 8:51 AM', 'Destinatario: Nombre Apellido', 'Monto y moneda: S/ 300.00'].join('\n') });
    if (!tr.ok || !plin.ok) throw new Error('debían aceptarse');
    expect(tr.payload.dedupe_key).toBe('tr:03612599');
    expect(plin.payload.dedupe_key).toBe('op:03612599');
  });
  it('sin código: hash estable por monto, cargo, destino y minuto', async () => {
    const sin = (t: string) => t.replace(/Código de operación\n\n01739610\n\n/, '');
    const a = await claveDedupeTransferencia(ok(sin(formatoNuevo())));
    expect(a).toMatch(/^t:[0-9a-f]{32}$/);
    expect(await claveDedupeTransferencia(ok(sin(formatoNuevo())))).toBe(a);
    expect(await claveDedupeTransferencia(ok(sin(formatoNuevo({ monto: 'S/ 301.00' }))))).not.toBe(a);
  });
  it('un Plin sigue leyéndose como siempre y una transferencia ya no cae en sin_leer', async () => {
    expect(esTransferencia(formatoNuevo())).toBe(true);
    expect(esTransferencia('Constancia de Pago Plin')).toBe(false);
    const p = await construirPayload({ texto: formatoNuevo() });
    expect(p.ok && p.estado).toBe('pendiente');
  });
  it('por la función completa: responde 200 con estado pendiente y manda UNA fila', async () => {
    const filas: Record<string, unknown>[] = [];
    const registrar: Registrar = async (x) => {
      filas.push(x);
      return { status: 200, cuerpo: { ok: true, creado: true } };
    };
    const env = { CAPTURA_KEY: 'a'.repeat(32), CAPTURA_USUARIO: '11111111-2222-3333-4444-555555555555' };
    const r = await manejar(new Request('https://ejemplo.test/', { method: 'POST', headers: { 'x-captura-key': env.CAPTURA_KEY }, body: JSON.stringify({ texto: formatoNuevo() }) }), env, registrar);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, creado: true, estado: 'pendiente' });
    expect(filas).toHaveLength(1);
    expect(JSON.stringify(filas[0])).not.toMatch(/\d{9,}/);
  });
});

describe('lo que no es (o no se lee) se deja para revisar', () => {
  it('otro tipo de correo', () => {
    expect(parsearCorreoTransferencia('Constancia de Pago Plin\nMonto y moneda: S/ 1.00')).toMatchObject({ ok: false, motivo: 'No es una "Constancia de transferencia".' });
  });
  it('faltan etiquetas', () => {
    expect(parsearCorreoTransferencia('Constancia de transferencia\nCuenta destino\nSimple\nSoles\nMoneda y monto\nS/ 5.00')).toMatchObject({ ok: false, motivo: 'Falta "Fecha y hora".' });
    expect(parsearCorreoTransferencia('Constancia de transferencia\nFecha y hora\n01 Nov 2026\n8:51 AM\nCuenta destino\nSimple\nSoles\nMoneda y monto\nS/ 5.00')).toMatchObject({ ok: false, motivo: 'Falta "Cuenta cargo".' });
    expect(parsearCorreoTransferencia('Constancia de transferencia\nFecha y hora\n01 Nov 2026\n8:51 AM\nCuenta cargo\nSimple\nSoles\nMoneda y monto\nS/ 5.00')).toMatchObject({ ok: false, motivo: 'Falta "Cuenta destino".' });
  });
  it('fecha imposible: no se adivina', () => {
    expect(parsearCorreoTransferencia(formatoNuevo().replace('01 Nov 2026', '31 Feb 2026')).ok).toBe(false);
  });
  it('texto vacío o basura no revienta', () => {
    expect(parsearCorreoTransferencia('').ok).toBe(false);
    expect(parsearCorreoTransferencia('Constancia de transferencia' + ' x'.repeat(30_000)).ok).toBe(false);
  });
});
