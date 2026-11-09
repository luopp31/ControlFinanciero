import { describe, it, expect } from 'vitest';
import type { ReglaCategoria } from './db';
import {
  clasificarDescriptor, normalizarClave, buscarRegla, reglasVigentes, esAutomatica,
  aprenderRegla, sembrarReglas, proponer,
} from './clasificador';

const regla = (clave: string, tipo: ReglaCategoria['tipo'], categoria: string, veces = 1, extra: Partial<ReglaCategoria> = {}): ReglaCategoria => ({
  id: `${tipo}-${clave}-${categoria}-${veces}`, clave, tipo, categoria, vecesConfirmada: veces, actualizado: '2026-11-01T00:00:00Z', ...extra,
});
const AHORA = '2026-11-09T12:00:00Z';

describe('clasificarDescriptor', () => {
  it.each([
    ['YAPE-ALONSO', 'PERSONA'],
    ['PLIN-JOSUE', 'PERSONA'],
    ['Transf Web/App', 'TRANSFERENCIA'],
    ['RETIRO CAJERO', 'RETIRO'],
    ['INTERES GANADO', 'INTERES'],
    ['PAGO MI TC', 'PAGO_TC'],
    ['SUPERM METRO SN FELIPE', 'COMERCIO'],
    ['229 PVEA SALAVERRY', 'COMERCIO'],
    ['OXXO', 'COMERCIO'],
    ['IZI*MARKET NELVA 2', 'COMERCIO'],
    ['CULQI QR', 'COMERCIO'],
    ['BCP*LUCHA PLAZA LIMA NO', 'COMERCIO'],
    ['NOA NOA CLU', 'COMERCIO'],
  ])('%s -> %s', (d, c) => expect(clasificarDescriptor(d)).toBe(c));
});

describe('normalizarClave', () => {
  it('mayúsculas, sin dígitos ni signos al final', () => {
    expect(normalizarClave('229 PVEA SALAVERRY')).toBe('PVEA SALAVERRY');
    expect(normalizarClave('IZI*MARKET NELVA 2')).toBe('IZI*MARKET NELVA');
    expect(normalizarClave('IZI*FELCOR*0')).toBe('IZI*FELCOR');
    expect(normalizarClave('Yape-Luis E')).toBe('YAPE-LUIS E');
  });
});

describe('buscarRegla', () => {
  const reglas = [regla('SUPERM METRO', 'COMERCIO', 'ALIMENTACION', 3), regla('OXXO', 'COMERCIO', 'ALIMENTACION'), regla('NOA NOA CLU', 'COMERCIO', 'DIVERSION'), regla('YAPE-ALONSO', 'PERSONA', 'TRANSPORTE')];
  it('comercio: clave exacta o misma cadena con otra sucursal', () => {
    expect(buscarRegla('SUPERM METRO SN FELIPE', 'COMERCIO', reglas)?.categoria).toBe('ALIMENTACION');
    expect(buscarRegla('SUPERM METRO MIRAFLORES', 'COMERCIO', reglas)?.clave).toBe('SUPERM METRO');
    expect(buscarRegla('OXXO MIRAFLORES 12', 'COMERCIO', reglas)?.clave).toBe('OXXO');
  });
  it('una sola palabra en común no basta cuando las claves tienen 2 o más', () => {
    expect(buscarRegla('NOA PLAZA', 'COMERCIO', reglas)).toBeUndefined();
    expect(buscarRegla('SUPERM OTRO', 'COMERCIO', reglas)).toBeUndefined();
  });
  it('persona: solo clave exacta', () => {
    expect(buscarRegla('YAPE-ALONSO', 'PERSONA', reglas)?.categoria).toBe('TRANSPORTE');
    expect(buscarRegla('YAPE-ALONSO P', 'PERSONA', reglas)).toBeUndefined();
  });
  it('ignora reglas borradas y duplicadas: gana la más nueva', () => {
    const dup = [
      regla('OXXO', 'COMERCIO', 'COMPRAS', 1, { id: 'a', actualizado: '2026-11-02T00:00:00Z' }),
      regla('OXXO', 'COMERCIO', 'ALIMENTACION', 1, { id: 'b', actualizado: '2026-11-05T00:00:00Z' }),
      regla('X', 'COMERCIO', 'SALUD', 1, { borrado: true }),
    ];
    expect(reglasVigentes(dup)).toHaveLength(1);
    expect(buscarRegla('OXXO', 'COMERCIO', dup)?.categoria).toBe('ALIMENTACION');
    expect(buscarRegla('X', 'COMERCIO', dup)).toBeUndefined();
  });
});

describe('persona: 2 confirmaciones con la misma categoría', () => {
  it('1ª = sugiere y pide toque; 2ª = ya es automática; otra categoría reinicia', () => {
    let reglas: ReglaCategoria[] = [];
    expect(proponer('YAPE-ANGEL G', -250, reglas).estado).toBe('CLASIFICAR');

    reglas = [aprenderRegla(undefined, 'YAPE-ANGEL G', 'PERSONA', 'TRANSPORTE', 'id1', AHORA)];
    expect(reglas[0]).toMatchObject({ clave: 'YAPE-ANGEL G', vecesConfirmada: 1, sincronizado: false, actualizado: AHORA });
    expect(proponer('YAPE-ANGEL G', -250, reglas)).toMatchObject({ estado: 'CONFIRMAR', categoria: 'TRANSPORTE' });

    reglas = [aprenderRegla(reglas[0], 'YAPE-ANGEL G', 'PERSONA', 'TRANSPORTE', 'x', AHORA)];
    expect(reglas[0].vecesConfirmada).toBe(2);
    expect(esAutomatica(reglas[0])).toBe(true);
    expect(proponer('YAPE-ANGEL G', -250, reglas)).toMatchObject({ estado: 'AUTO', categoria: 'TRANSPORTE', tipo: 'GASTO' });

    reglas = [aprenderRegla(reglas[0], 'YAPE-ANGEL G', 'PERSONA', 'ALIMENTACION', 'x', AHORA)];
    expect(reglas[0]).toMatchObject({ categoria: 'ALIMENTACION', vecesConfirmada: 1 });
    expect(proponer('YAPE-ANGEL G', -250, reglas).estado).toBe('CONFIRMAR');
  });
  it('comercio con regla: automático desde la primera vez', () => {
    const reglas = [aprenderRegla(undefined, 'OXXO', 'COMERCIO', 'ALIMENTACION', 'id', AHORA)];
    expect(proponer('OXXO', -690, reglas)).toMatchObject({ estado: 'AUTO', categoria: 'ALIMENTACION' });
  });
});

describe('proponer: casos especiales', () => {
  it('INTERES GANADO -> ingreso Intereses, automático', () => {
    expect(proponer('INTERES GANADO', 12, [])).toMatchObject({ estado: 'AUTO', tipo: 'INGRESO', categoria: 'INTERESES' });
  });
  it('RETIRO CAJERO -> gasto Efectivo completo, automático', () => {
    expect(proponer('RETIRO CAJERO', -85000, [])).toMatchObject({ estado: 'AUTO', tipo: 'GASTO', categoria: 'EFECTIVO' });
  });
  it('PAGO MI TC -> pago de préstamo, pide confirmar, no es gasto', () => {
    expect(proponer('PAGO MI TC', -17841, [])).toMatchObject({ estado: 'CONFIRMAR', tipo: 'PRESTAMO', dir: 'PAGO' });
  });
  it('Transf Web/App sin emparejar -> pregunta con opciones según el signo', () => {
    const sale = proponer('Transf Web/App', -32866, []);
    expect(sale.estado).toBe('PREGUNTAR');
    expect(sale.opciones?.map((o) => o.id)).toEqual(['ENTRE_CUENTAS', 'PAGO_DOLARES', 'OTRO']);
    expect(proponer('Transf Web/App', 420057, []).opciones?.map((o) => o.id)).toEqual(['ENTRE_CUENTAS', 'INGRESO_SUELDO', 'OTRO']);
  });
  it('abono de una persona -> pregunta ingreso o reembolso', () => {
    const p = proponer('YAPE-LUIS EN', 3370, []);
    expect(p.estado).toBe('PREGUNTAR');
    expect(p.opciones?.map((o) => o.id)).toEqual(['INGRESO', 'REEMBOLSO']);
  });
  it('comercio desconocido -> por clasificar con 3 sugerencias', () => {
    const p = proponer('MIFARMA', -2100, [regla('OXXO', 'COMERCIO', 'ALIMENTACION', 4), regla('INKAFARMA', 'COMERCIO', 'SALUD', 2)]);
    expect(p).toMatchObject({ estado: 'CLASIFICAR', tipo: 'GASTO', categoria: null });
    expect(p.sugerencias).toEqual(['ALIMENTACION', 'SALUD', 'TRANSPORTE']);
  });
  it('si hay regla, su categoría va primera entre las sugerencias', () => {
    const p = proponer('YAPE-ANGEL G', -250, [regla('YAPE-ANGEL G', 'PERSONA', 'COMPRAS')]);
    expect(p.sugerencias[0]).toBe('COMPRAS');
    expect(p.sugerencias).toHaveLength(3);
  });
});

describe('sembrarReglas', () => {
  let n = 0;
  const id = () => `s${++n}`;
  it('crea reglas con veces=1 desde los "ya estaban", sin tocar las existentes', () => {
    const existentes = [regla('OXXO', 'COMERCIO', 'COMPRAS', 5)];
    const nuevas = sembrarReglas(
      [
        { descriptor: 'OXXO', categoria: 'ALIMENTACION' }, // ya existe: no se toca
        { descriptor: 'YAPE-JUAN C', categoria: 'TRANSPORTE' },
        { descriptor: 'YAPE-JUAN C', categoria: 'TRANSPORTE' },
        { descriptor: 'YAPE-JUAN C', categoria: 'ALIMENTACION' },
        { descriptor: 'SUPERM METRO SN FELIPE', categoria: 'ALIMENTACION' },
        { descriptor: 'Transf Web/App', categoria: null },
        { descriptor: 'RETIRO CAJERO', categoria: 'EFECTIVO' }, // no es persona ni comercio
        { descriptor: 'INKAFARMA', categoria: undefined },
      ],
      existentes, id, AHORA
    );
    expect(nuevas.map((r) => [r.clave, r.tipo, r.categoria, r.vecesConfirmada]).sort()).toEqual([
      ['SUPERM METRO SN FELIPE', 'COMERCIO', 'ALIMENTACION', 1],
      ['YAPE-JUAN C', 'PERSONA', 'TRANSPORTE', 1],
    ]);
    expect(nuevas.every((r) => r.sincronizado === false)).toBe(true);
  });
});
