import type { Cuenta, Movimiento, Prestamo } from './finanzas';

const DB_NAME = 'greedy';
const DB_VERSION = 1;

export type TipoCompromiso = 'SUSCRIPCION' | 'CUOTA';

export interface Compromiso {
  id: string;
  tipo: TipoCompromiso;
  nombre: string;
  monto: number;
  /** Solo SUSCRIPCION: día del mes (1-31) en que se cobra. */
  diaCobro?: number | null;
  /** Solo CUOTA: número total de cuotas y cuántas van pagadas. */
  total?: number | null;
  pagadas?: number | null;
  categoria?: string | null;
  borrado?: boolean;
  actualizado?: string;
  sincronizado?: boolean;
}

export interface Config {
  presupuesto: number;
  nombre: string;
  catsExtra: unknown[];
  catColor: Record<string, string>;
  version: number;
}

const STORES = ['cuentas', 'movimientos', 'prestamos', 'compromisos', 'config'] as const;
type Store = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: store === 'config' ? undefined : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function getAll<T>(store: Store): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll());
}

export function put<T>(store: Store, value: T): Promise<IDBValidKey> {
  return tx<IDBValidKey>(store, 'readwrite', (s) => s.put(value));
}

export function remove(store: Store, id: IDBValidKey): Promise<undefined> {
  return tx<undefined>(store, 'readwrite', (s) => s.delete(id));
}

const CONFIG_KEY = 'config';

export async function getConfig(): Promise<Config | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('config', 'readonly');
    const req = t.objectStore('config').get(CONFIG_KEY);
    req.onsuccess = () => resolve((req.result as Config) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function putConfig(config: Config): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('config', 'readwrite');
    const req = t.objectStore('config').put(config, CONFIG_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function cargarTodo(): Promise<{
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  prestamos: Prestamo[];
  compromisos: Compromiso[];
  config: Config | null;
}> {
  const [cuentas, movimientos, prestamos, compromisos, config] = await Promise.all([
    getAll<Cuenta>('cuentas'),
    getAll<Movimiento>('movimientos'),
    getAll<Prestamo>('prestamos'),
    getAll<Compromiso>('compromisos'),
    getConfig(),
  ]);
  return {
    cuentas: cuentas.filter((c) => !(c as unknown as { borrado?: boolean }).borrado),
    movimientos: movimientos.filter((m) => !m.borrado),
    prestamos: prestamos.filter((p) => !p.borrado),
    compromisos: compromisos.filter((c) => !c.borrado),
    config,
  };
}
