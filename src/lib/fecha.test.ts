import { describe, it, expect } from 'vitest';
import { proximoCobroISO, rangoAnteriorIgualDuracion, ultimosMesesISO } from './fecha';

describe('proximoCobroISO', () => {
  it('devuelve este mes si el día de cobro no ha pasado aún', () => {
    expect(proximoCobroISO(20, new Date(2026, 8, 15))).toBe('2026-09-20');
  });

  it('cuenta hoy mismo como el día de cobro', () => {
    expect(proximoCobroISO(15, new Date(2026, 8, 15))).toBe('2026-09-15');
  });

  it('salta al mes siguiente si el día ya pasó', () => {
    expect(proximoCobroISO(5, new Date(2026, 8, 15))).toBe('2026-10-05');
  });

  it('usa el último día del mes si este no tiene el día pedido (31 en febrero)', () => {
    expect(proximoCobroISO(31, new Date(2026, 0, 20))).toBe('2026-01-31');
    expect(proximoCobroISO(31, new Date(2026, 0, 31))).toBe('2026-01-31');
    // 1 de feb ya pasó el 31 de enero -> salta a febrero, que en 2026 tiene 28 días
    expect(proximoCobroISO(31, new Date(2026, 1, 1))).toBe('2026-02-28');
  });
});

describe('rangoAnteriorIgualDuracion', () => {
  it('devuelve el tramo inmediatamente anterior, de la misma duración', () => {
    expect(rangoAnteriorIgualDuracion('2026-09-01', '2026-09-22')).toEqual({
      desde: '2026-08-10',
      hasta: '2026-08-31',
    });
  });

  it('un solo día compara contra el día anterior', () => {
    expect(rangoAnteriorIgualDuracion('2026-09-22', '2026-09-22')).toEqual({
      desde: '2026-09-21',
      hasta: '2026-09-21',
    });
  });

  it('devuelve null para el centinela de "todo" (sin período anterior)', () => {
    expect(rangoAnteriorIgualDuracion('0000-01-01', '2026-09-22')).toBeNull();
  });
});

describe('ultimosMesesISO', () => {
  it('devuelve los últimos n meses en orden ascendente, terminando en el mes de referencia', () => {
    expect(ultimosMesesISO(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('n=1 devuelve solo el mes de referencia', () => {
    expect(ultimosMesesISO(1, new Date(2026, 8, 15))).toEqual(['2026-09']);
  });
});
