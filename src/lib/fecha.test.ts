import { describe, it, expect } from 'vitest';
import { proximoCobroISO } from './fecha';

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
