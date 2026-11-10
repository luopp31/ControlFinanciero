import { describe, it, expect } from 'vitest';
import { describirError } from './pdf';

describe('describirError (se muestra en pantalla: sin rutas ni URLs)', () => {
  it('nombre y mensaje', () => {
    const e = new Error('a.toHex is not a function');
    e.name = 'UnknownErrorException';
    expect(describirError(e)).toBe('UnknownErrorException: a.toHex is not a function');
  });
  it('un Error genérico no repite el nombre', () => {
    expect(describirError(new Error('abriendo el PDF · algo falló'))).toBe('abriendo el PDF · algo falló');
  });
  it('quita URLs', () => {
    const t = describirError(new Error('Failed to fetch https://ejemplo.netlify.app/assets/pdf.worker.min-ABC.mjs?x=1 now'));
    expect(t).toBe('Failed to fetch [url] now');
  });
  it('quita rutas de Windows y de Unix', () => {
    expect(describirError(new Error('no abre C:\\Users\\alguien\\Documentos\\archivo.pdf'))).toBe('no abre [ruta]');
    expect(describirError(new Error('no abre /var/mobile/Containers/archivo.pdf ya'))).toBe('no abre [ruta] ya');
  });
  it('una sola línea y con tope de largo', () => {
    const t = describirError(new Error(`línea 1\n\n   línea 2 ${'x'.repeat(400)}`));
    expect(t).not.toContain('\n');
    expect(t.length).toBeLessThanOrEqual(201);
    expect(t.endsWith('…')).toBe(true);
  });
  it('acepta cosas que no son Error', () => {
    expect(describirError('texto suelto')).toBe('texto suelto');
    expect(describirError(undefined)).toBe('undefined');
  });
});
