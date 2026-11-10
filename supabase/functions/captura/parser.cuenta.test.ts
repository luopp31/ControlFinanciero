import { describe, it, expect } from 'vitest';
import { parsearCorreoPlin, type CapturaParseada } from './parser';
import { construirPayload } from './payload';

// Datos inventados. El número de cuenta es falso.
const NUMERO = '3613000000001';

/** El formato real: "Cuenta cargo" y su valor repartido en varias líneas (la última es el número de cuenta). */
const correoCuentaEnCuatroLineas = (cuenta = 'Simple') =>
  [
    'Hola, NOMBRE, te enviamos tu',
    'Constancia de Pago Plin',
    'Código de operación',
    '03612599',
    'Fecha y hora',
    '09 Nov 2026 09:39 PM',
    'Cuenta cargo',
    `Cuenta ${cuenta}`,
    'Soles',
    NUMERO,
    'Destinatario',
    'Nombre Apellido Apellido',
    'Destino',
    'Plin',
    'Monto y moneda',
    'S/ 1.00',
  ].join('\n');

const ok = (t: string): CapturaParseada => {
  const r = parsearCorreoPlin(t);
  if (!r.ok) throw new Error('debía leerse: ' + r.motivo);
  return r.captura;
};

describe('cuenta de cargo repartida en varias líneas', () => {
  it('lee "Simple" de "Cuenta Simple" / "Soles" / <número>', () => {
    expect(ok(correoCuentaEnCuatroLineas('Simple'))).toMatchObject({ cuenta: 'Simple', montoCentimos: 100, destinatario: 'Nombre Apellido Apellido', destino: 'Plin' });
  });
  it('lee "Millonaria"', () => {
    expect(ok(correoCuentaEnCuatroLineas('Millonaria')).cuenta).toBe('Millonaria');
  });
  it('el número de cuenta nunca se guarda: ni en la captura ni en la fila que va a la base', async () => {
    const captura = JSON.stringify(ok(correoCuentaEnCuatroLineas()));
    expect(captura).not.toContain(NUMERO);
    expect(captura).not.toMatch(/\d{9,}/);
    const c = await construirPayload({ texto: correoCuentaEnCuatroLineas() });
    if (!c.ok) throw new Error('debía aceptarse');
    expect(JSON.stringify(c.payload)).not.toContain(NUMERO);
    expect(JSON.stringify(c.payload)).not.toMatch(/\d{9,}/);
    expect(c.payload.cuenta).toBe('Simple');
  });
  it('si el correo no se puede leer por otra razón, el texto que se guarda tampoco lleva el número', () => {
    const r = parsearCorreoPlin(correoCuentaEnCuatroLineas().replace('S/ 1.00', 'abc'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.textoLimpio).not.toContain(NUMERO);
  });
  it('no confunde lo que sigue con otra etiqueta: sin cuenta legible queda null, no el destinatario', () => {
    const t = ['Constancia de Pago Plin', 'Fecha y hora', '09 Nov 2026 09:39 PM', 'Cuenta cargo', 'Destinatario', 'Nombre Apellido', 'Monto y moneda', 'S/ 1.00'].join('\n');
    expect(ok(t).cuenta).toBeNull();
  });
  it('un nombre en mayúsculas o minúsculas sale normalizado', () => {
    expect(ok(correoCuentaEnCuatroLineas('SIMPLE')).cuenta).toBe('Simple');
    expect(ok(correoCuentaEnCuatroLineas('millonaria')).cuenta).toBe('Millonaria');
  });
  it('los formatos anteriores siguen funcionando (todo en una línea, o el valor en la línea siguiente)', () => {
    const unaLinea = ['Constancia de Pago Plin', 'Fecha y hora: 09 Nov 2026 09:39 PM', `Cuenta cargo: Cuenta Simple Soles ${NUMERO}`, 'Destinatario: Nombre Apellido', 'Monto y moneda: S/ 1.00'].join('\n');
    expect(ok(unaLinea).cuenta).toBe('Simple');
    const siguiente = ['Constancia de Pago Plin', 'Fecha y hora: 09 Nov 2026 09:39 PM', 'Cuenta cargo', `Cuenta Millonaria Soles ${NUMERO}`, 'Destinatario: Nombre Apellido', 'Monto y moneda: S/ 1.00'].join('\n');
    expect(ok(siguiente).cuenta).toBe('Millonaria');
  });
});
