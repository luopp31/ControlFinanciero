import { describe, it, expect } from 'vitest';
import type { Captura, ReglaCategoria } from './db';
import type { Cuenta } from './finanzas';
import { coincideNombre, descriptorDeCaptura, capturaQueCoincide, clasificarCaptura, proponerCaptura } from './capturas';

// Todo inventado. Etiquetas con la forma real de un PDF: "JUAN C", "ALEXAND", "MARIA C", "LUIS EN"...
const cap = (nombre: string, extra: Partial<Captura> = {}): Captura => ({
  id: 'c1', dedupeKey: 'op:1', montoCentimos: 200, moneda: 'PEN', destinatario: nombre, destino: 'Plin', codigoOperacion: '1',
  fechaHora: '2026-11-08T12:36:00-05:00', cuenta: null, origen: 'plin_correo', estado: 'pendiente', ...extra,
});
const regla = (clave: string, categoria: string, veces: number): ReglaCategoria => ({ id: `x-${clave}`, clave, tipo: 'PERSONA', categoria, vecesConfirmada: veces, actualizado: '2026-11-01T00:00:00Z' });
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-11-02' };

describe('coincideNombre: la etiqueta del banco contra el nombre completo del correo', () => {
  it.each([
    ['JUAN C', 'Juan Carlos Prueba'], // el caso que falló: el banco puso 6 caracteres, no 7
    ['JUAN C', 'Juan Cruz Soto'],
    ['JUAN P', 'Juan Carlos Perez'], // inicial de otro apellido
    ['ALEXAND', 'Alexander Ramos'],
    ['MARIA C', 'Maria Cruz Lopez'],
    ['LUIS EN', 'Luis Enrique Garcia'],
    ['LUIS E', 'Luis Enrique Garcia'],
    ['ANGEL G', 'Angel Gomez'],
    ['JOSUE', 'Josue'],
    ['MARIA J', 'María José Soto'],
    ['  juan   c ', 'JUAN CARLOS PRUEBA'],
  ])('%s ~ %s', (etiqueta, completo) => expect(coincideNombre(etiqueta, completo)).toBe(true));

  it.each([
    ['JUAN C', 'Juan Perez'], // ningún apellido empieza con C
    ['JUAN C', 'Juana Cruz'], // otro primer nombre
    ['ANGEL G', 'Angela Gomez'],
    ['LUIS EN', 'Luis Eduardo'],
    ['AB', 'Abel Soto'], // etiqueta demasiado corta
    ['', 'Juan Perez'],
    ['JUAN C', ''],
  ])('%s no ~ %s', (etiqueta, completo) => expect(coincideNombre(etiqueta, completo)).toBe(false));
});

describe('el enlace con la bandeja funciona aunque el banco recorte distinto', () => {
  const fila = (descriptor: string) => ({ descriptor, centimos: -200, fecha: '2026-11-08', hora: '12:38' });
  it('"YAPE-JUAN C" (6 letras) enlaza con "Juan Carlos Prueba"', () => {
    expect(capturaQueCoincide(fila('YAPE-JUAN C'), [cap('Juan Carlos Prueba')])?.id).toBe('c1');
  });
  it('otra persona con el mismo monto no se enlaza', () => {
    expect(capturaQueCoincide(fila('YAPE-JUAN C'), [cap('Persona Distinta')])).toBeUndefined();
    expect(capturaQueCoincide(fila('YAPE-JUAN C'), [cap('Juan Perez')])).toBeUndefined();
  });
});

describe('el diccionario usa la etiqueta que el banco ya mostró', () => {
  it('sin regla se supone "PLIN-" + 7 letras; con una regla aprendida del PDF se usa esa etiqueta', () => {
    const c = cap('Juan Carlos Prueba');
    expect(descriptorDeCaptura(c)).toBe('PLIN-JUAN CA');
    expect(descriptorDeCaptura(c, [regla('YAPE-JUAN C', 'TRANSPORTE', 1)])).toBe('YAPE-JUAN C');
  });
  it('si hay varias reglas compatibles gana la más confirmada', () => {
    const c = cap('Juan Carlos Prueba');
    expect(descriptorDeCaptura(c, [regla('YAPE-JUAN C', 'COMPRAS', 1), regla('PLIN-JUAN CA', 'TRANSPORTE', 3)])).toBe('PLIN-JUAN CA');
  });
  it('la regla aprendida en el Conciliar se aplica a la captura (AUTO con 2 confirmaciones)', () => {
    const c = cap('Juan Carlos Prueba');
    expect(proponerCaptura(c, [regla('YAPE-JUAN C', 'TRANSPORTE', 2)])).toMatchObject({ estado: 'AUTO', categoria: 'TRANSPORTE' });
    expect(proponerCaptura(c, [regla('YAPE-JUAN C', 'TRANSPORTE', 1)])).toMatchObject({ estado: 'CONFIRMAR', categoria: 'TRANSPORTE' });
    expect(proponerCaptura(c, [])).toMatchObject({ estado: 'CLASIFICAR' });
  });
  it('al clasificar, el movimiento queda con la etiqueta del banco y la confirmación suma a esa regla', () => {
    const r = clasificarCaptura(cap('Juan Carlos Prueba'), 'TRANSPORTE', {
      cuentas: [SIMPLE], reglas: [regla('YAPE-JUAN C', 'TRANSPORTE', 1)], ahora: '2026-11-10T03:00:00.000Z', nuevoId: () => 'nuevo',
    });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.movimiento.descriptor).toBe('YAPE-JUAN C');
    expect(r.regla).toMatchObject({ id: 'x-YAPE-JUAN C', clave: 'YAPE-JUAN C', vecesConfirmada: 2 });
  });
  it('una regla de comercio nunca se confunde con una persona', () => {
    const comercio: ReglaCategoria = { id: 'c', clave: 'JUAN C', tipo: 'COMERCIO', categoria: 'COMPRAS', vecesConfirmada: 5, actualizado: '2026-11-01T00:00:00Z' };
    expect(descriptorDeCaptura(cap('Juan Carlos Prueba'), [comercio])).toBe('PLIN-JUAN CA');
  });
});
