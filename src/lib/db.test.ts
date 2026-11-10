// Migración de IndexedDB v1 -> v2: no debe borrar nada y debe crear los stores nuevos.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';


describe('IndexedDB v1 -> v2', () => {
  it('conserva los datos existentes y agrega los stores nuevos', async () => {
    // 1. Base como la dejaba la versión anterior de la app (v1, 5 stores) con datos.
    const v1 = await new Promise<IDBDatabase>((ok, ko) => {
      const req = indexedDB.open('greedy', 1);
      req.onupgradeneeded = () => {
        for (const s of ['cuentas', 'movimientos', 'prestamos', 'compromisos']) req.result.createObjectStore(s, { keyPath: 'id' });
        req.result.createObjectStore('config');
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ko(req.error);
    });
    const t = v1.transaction(['cuentas', 'movimientos', 'config'], 'readwrite');
    t.objectStore('cuentas').put({ id: 'c1', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 229.33, desde: '2026-11-02' });
    t.objectStore('movimientos').put({ id: 'm1', fecha: '2026-11-03', monto: 25, tipo: 'GASTO', cuentaId: 'c1', sincronizado: false });
    t.objectStore('config').put({ nombre: 'Lu', catColor: {}, version: 3 }, 'config');
    await new Promise((ok) => { t.oncomplete = ok; });
    v1.close();

    // 2. La app nueva abre la misma base (v2).
    const db = await import('./db');
    expect(await db.getAll('cuentas')).toHaveLength(1);
    expect(await db.getAll('movimientos')).toEqual([expect.objectContaining({ id: 'm1', monto: 25, sincronizado: false })]);
    expect((await db.getConfig())?.version).toBe(3);

    // 3. Los stores nuevos existen y funcionan.
    expect(await db.getAll('reglas_categoria')).toEqual([]);
    expect(await db.getAll('ignorados')).toEqual([]);
    expect(await db.getAll('capturas')).toEqual([]);
    await db.put('ignorados', { id: 'i1', cuentaId: 'c1', referencia: 'abc' });
    expect(await db.getAll('ignorados')).toHaveLength(1);
  });
});
