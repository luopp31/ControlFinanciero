import { useCallback, useEffect, useState } from 'react';
import { getAll, put } from '../lib/db';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';
import { programarSyncAutomatico } from '../lib/sync';

type Store = 'cuentas' | 'movimientos' | 'prestamos' | 'compromisos' | 'reglas_categoria' | 'ignorados' | 'capturas';
type Fila = { id: string; borrado?: boolean };

/** CRUD local + sync para cualquier store con borrado suave. Los hooks por entidad lo envuelven. */
export function useStore<T extends Fila>(store: Store, ordenar?: (a: T, b: T) => number) {
  const [items, setItems] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const activos = (await getAll<T>(store)).filter((x) => !x.borrado);
    setItems(ordenar ? activos.sort(ordenar) : activos);
  }, [store, ordenar]);

  useEffect(() => {
    let activo = true;
    recargar().finally(() => {
      if (activo) setCargando(false);
    });
    const cancelar = suscribirCambiosDeDatos(recargar);
    return () => {
      activo = false;
      cancelar();
    };
  }, [recargar]);

  const guardar = useCallback(
    async (fila: T) => {
      await put(store, { ...fila, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
    },
    [store, recargar]
  );

  const crear = useCallback(
    async (datos: Omit<T, 'id' | 'borrado'>) => {
      const fila = { id: crypto.randomUUID(), ...datos } as T;
      await guardar(fila);
      return fila;
    },
    [guardar]
  );

  const actualizar = useCallback(
    async (id: string, cambios: Partial<Omit<T, 'id'>>) => {
      const actual = items.find((x) => x.id === id);
      if (actual) await guardar({ ...actual, ...cambios });
    },
    [items, guardar]
  );

  // Borrado suave: deja un "tombstone" para que el sync también lo borre en la nube.
  const borrar = useCallback((id: string) => actualizar(id, { borrado: true } as Partial<Omit<T, 'id'>>), [actualizar]);

  return { items, cargando, crear, actualizar, borrar };
}
