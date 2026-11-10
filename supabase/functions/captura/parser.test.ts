import { describe, it, expect } from 'vitest';
import { parsearCorreoPlin, quitarNumerosDeCuenta, claveDedupe, claveDedupeSinLeer, type CapturaParseada } from './parser';

// Todo inventado. El número de cuenta de las fixtures es falso.
const CUENTA = '361-0000000000';

const correo = (extra: { fecha?: string; monto?: string; destino?: string; cuenta?: string; destinatario?: string } = {}) =>
  [
    'Hola, NOMBRE, te enviamos tu',
    'Constancia de Pago Plin',
    'Código de operación: 03612599',
    `Fecha y hora: ${extra.fecha ?? '09 Nov 2026 09:39 PM'}`,
    `Cuenta cargo: ${extra.cuenta ?? 'Cuenta Simple Soles'} ${CUENTA}`,
    `Destinatario: ${extra.destinatario ?? 'Nombre Apellido Apellido'}`,
    `Destino: ${extra.destino ?? 'Plin'}`,
    `Monto y moneda: ${extra.monto ?? 'S/ 1.00'}`,
  ].join('\n');

const ok = (texto: string): CapturaParseada => {
  const r = parsearCorreoPlin(texto);
  if (!r.ok) throw new Error('debía leerse: ' + r.motivo);
  return r.captura;
};

describe('parsearCorreoPlin: formato real', () => {
  it('lee todos los campos', () => {
    expect(ok(correo())).toEqual({
      codigoOperacion: '03612599',
      fechaHora: '2026-11-09T21:39:00-05:00',
      cuenta: 'Simple',
      destinatario: 'Nombre Apellido Apellido',
      destino: 'Plin',
      montoCentimos: 100,
      moneda: 'PEN',
    });
  });
  it('las etiquetas pueden venir en líneas separadas de sus valores', () => {
    const c = ok(
      ['Constancia de Pago Plin', 'Código de operación', '03612599', 'Fecha y hora', '09 Nov 2026 09:39 PM', 'Cuenta cargo', `Cuenta Millonaria Soles ${CUENTA}`, 'Destinatario', 'Nombre Apellido', 'Destino', 'Yape', 'Monto y moneda', 'S/ 25.50'].join('\n')
    );
    expect(c).toMatchObject({ codigoOperacion: '03612599', fechaHora: '2026-11-09T21:39:00-05:00', cuenta: 'Millonaria', destinatario: 'Nombre Apellido', destino: 'Yape', montoCentimos: 2550 });
  });
  it('tolera CRLF, espacios raros y mayúsculas en las etiquetas', () => {
    const t = correo().replace(/\n/g, '\r\n').replace('Destinatario:', 'DESTINATARIO :').replace('Fecha y hora:', 'fecha y hora:  ');
    expect(ok(t)).toMatchObject({ destinatario: 'Nombre Apellido Apellido', fechaHora: '2026-11-09T21:39:00-05:00' });
  });
});

describe('fecha y hora', () => {
  it.each([
    ['01 Ene 2026 08:05 AM', '2026-01-01T08:05:00-05:00'],
    ['15 Feb 2026 01:00 PM', '2026-02-15T13:00:00-05:00'],
    ['03 Mar 2026 11:59 PM', '2026-03-03T23:59:00-05:00'],
    ['30 Abr 2026 07:30 AM', '2026-04-30T07:30:00-05:00'],
    ['09 May 2026 10:10 PM', '2026-05-09T22:10:00-05:00'],
    ['09 Jun 2026 06:00 PM', '2026-06-09T18:00:00-05:00'],
    ['09 Jul 2026 06:00 PM', '2026-07-09T18:00:00-05:00'],
    ['31 Ago 2026 05:45 PM', '2026-08-31T17:45:00-05:00'],
    ['09 Set 2026 04:20 PM', '2026-09-09T16:20:00-05:00'],
    ['09 Sep 2026 04:20 PM', '2026-09-09T16:20:00-05:00'],
    ['09 Oct 2026 03:15 PM', '2026-10-09T15:15:00-05:00'],
    ['09 Dic 2026 09:00 AM', '2026-12-09T09:00:00-05:00'],
  ])('%s -> %s', (f, esperado) => expect(ok(correo({ fecha: f })).fechaHora).toBe(esperado));

  it('12 AM es medianoche y 12 PM es mediodía', () => {
    expect(ok(correo({ fecha: '10 Nov 2026 12:05 AM' })).fechaHora).toBe('2026-11-10T00:05:00-05:00');
    expect(ok(correo({ fecha: '10 Nov 2026 12:05 PM' })).fechaHora).toBe('2026-11-10T12:05:00-05:00');
  });
  it('acepta "p. m." y 24 horas sin AM/PM', () => {
    expect(ok(correo({ fecha: '09 Nov 2026 9:39 p. m.' })).fechaHora).toBe('2026-11-09T21:39:00-05:00');
    expect(ok(correo({ fecha: '09 Nov 2026 21:39' })).fechaHora).toBe('2026-11-09T21:39:00-05:00');
  });
  it('fecha imposible o mes desconocido: no se adivina', () => {
    expect(parsearCorreoPlin(correo({ fecha: '31 Feb 2026 09:00 AM' })).ok).toBe(false);
    expect(parsearCorreoPlin(correo({ fecha: '09 Xyz 2026 09:00 AM' })).ok).toBe(false);
    expect(parsearCorreoPlin(correo({ fecha: '09 Nov 2026 13:00 PM' })).ok).toBe(false);
  });
});

describe('monto y moneda', () => {
  it.each([
    ['S/ 1.00', 100, 'PEN'],
    ['S/ 12.5', 1250, 'PEN'],
    ['S/ 1,234.50', 123450, 'PEN'],
    ['S/ 12,345', 1234500, 'PEN'],
    ['S/ 99,999.99', 9999999, 'PEN'],
    ['S/ 0.05', 5, 'PEN'],
    ['US$ 23.60', 2360, 'USD'],
    ['USD 1,000.00', 100000, 'USD'],
    ['S/ 12,50', 1250, 'PEN'],
  ])('%s -> %i céntimos %s', (m, c, mon) => {
    const r = ok(correo({ monto: m }));
    expect(r.montoCentimos).toBe(c);
    expect(r.moneda).toBe(mon);
  });
  it('cero, negativo, ilegible o fuera de rango: no se guarda como captura', () => {
    for (const m of ['S/ 0.00', 'S/ abc', '1.00', 'S/ 100,000.00', 'S/ 1.2.3']) expect(parsearCorreoPlin(correo({ monto: m })).ok).toBe(false);
  });
});

describe('número de cuenta: nunca sale', () => {
  it('la captura leída no lo contiene', () => {
    const json = JSON.stringify(ok(correo()));
    expect(json).not.toContain(CUENTA);
    expect(json).not.toContain('0000000000');
    expect(json).not.toMatch(/\d{9,}/); // ninguna cifra larga en lo que se guarda
  });
  it('el texto de un correo que no se pudo leer sale sin el número de cuenta', () => {
    const r = parsearCorreoPlin(`Constancia de transferencia\nCuenta cargo: Cuenta Simple Soles ${CUENTA}\nCuenta destino: 3610000000001\nMonto: S/ 5.00`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.textoLimpio).not.toContain('0000000000');
    expect(r.textoLimpio).not.toContain('3610000000001');
    expect(r.textoLimpio).toContain('Monto: S/ 5.00');
    expect(r.textoLimpio).toContain('[número]');
  });
});

describe('quitarNumerosDeCuenta', () => {
  it('quita cuentas largas, con guiones o espacios, y máscaras de tarjeta', () => {
    expect(quitarNumerosDeCuenta('Cuenta 3613000000000 fin')).toBe('Cuenta [número] fin');
    expect(quitarNumerosDeCuenta('Cuenta 361-3000000000')).toBe('Cuenta [número]');
    expect(quitarNumerosDeCuenta('Tarjeta 4111 1111 1111 1111')).toBe('Tarjeta [número]');
    expect(quitarNumerosDeCuenta('Tarjeta **** 1234 y ****5678')).toBe('Tarjeta [tarjeta] y [tarjeta]');
  });
  it('conserva códigos de 8 dígitos, montos, fechas y horas', () => {
    const t = 'Código de operación: 03612599\nFecha y hora: 09 Nov 2026 09:39 PM\nMonto y moneda: S/ 1,234.50';
    expect(quitarNumerosDeCuenta(t)).toBe(t);
  });
});

describe('no es un correo que se sepa leer', () => {
  it('otro tipo de correo -> sin_leer con el motivo', () => {
    const r = parsearCorreoPlin('Constancia de transferencia\nMonto: S/ 3.00');
    expect(r).toMatchObject({ ok: false, motivo: 'No es una "Constancia de Pago Plin".' });
  });
  it('faltan campos -> sin_leer', () => {
    expect(parsearCorreoPlin('Constancia de Pago Plin\nDestinatario: Nombre Apellido\nMonto y moneda: S/ 2.00')).toMatchObject({ ok: false, motivo: 'Falta "Fecha y hora".' });
    expect(parsearCorreoPlin('Constancia de Pago Plin\nFecha y hora: 09 Nov 2026 09:39 PM\nMonto y moneda: S/ 2.00')).toMatchObject({ ok: false, motivo: 'Falta "Destinatario".' });
  });
  it('texto vacío o basura no revienta', () => {
    expect(parsearCorreoPlin('').ok).toBe(false);
    expect(parsearCorreoPlin('\n\n    ').ok).toBe(false);
    expect(parsearCorreoPlin('x'.repeat(50_000)).ok).toBe(false);
  });
  it('el texto limpio que se guarda tiene tope de largo', () => {
    const r = parsearCorreoPlin('y'.repeat(50_000));
    if (r.ok) throw new Error('no debía leerse');
    expect(r.textoLimpio.length).toBeLessThanOrEqual(8000);
  });
});

describe('claves de idempotencia', () => {
  it('con código: op:<código>', async () => {
    expect(await claveDedupe(ok(correo()))).toBe('op:03612599');
  });
  it('sin código: hash de monto + destinatario + minuto, estable', async () => {
    const sinCodigo = correo().replace('Código de operación: 03612599\n', '');
    const a = await claveDedupe(ok(sinCodigo));
    expect(a).toMatch(/^h:[0-9a-f]{32}$/);
    expect(await claveDedupe(ok(sinCodigo.replace('Nombre Apellido Apellido', '  nombre   APELLIDO apellido ')))).toBe(a);
    expect(await claveDedupe(ok(sinCodigo.replace('S/ 1.00', 'S/ 2.00')))).not.toBe(a);
    expect(await claveDedupe(ok(sinCodigo.replace('09:39 PM', '09:40 PM')))).not.toBe(a);
  });
  it('sin_leer: el mismo texto da la misma clave', async () => {
    const a = await claveDedupeSinLeer('Constancia de transferencia  Monto: S/ 3.00');
    expect(a).toMatch(/^s:[0-9a-f]{32}$/);
    expect(await claveDedupeSinLeer(' Constancia de transferencia Monto: S/ 3.00 ')).toBe(a);
  });
});
