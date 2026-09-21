import { describe, it, expect } from 'vitest';
import { saludoPorHora } from './saludo';

describe('saludoPorHora', () => {
  it('mañana antes de las 12', () => {
    expect(saludoPorHora(new Date(2026, 0, 1, 8))).toBe('Buenos días');
  });
  it('tarde entre 12 y 19', () => {
    expect(saludoPorHora(new Date(2026, 0, 1, 15))).toBe('Buenas tardes');
  });
  it('noche desde las 19', () => {
    expect(saludoPorHora(new Date(2026, 0, 1, 20))).toBe('Buenas noches');
  });
});
