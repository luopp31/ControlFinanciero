import { useCallback, useEffect, useState } from 'react';
import { getAll, put } from '../lib/db';
import type { Movimiento } from '../lib/finanzas';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';
import { programarSyncAutomatico } from '../lib/sync';

export function useMovimientos() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const todos = await getAll<Movimiento>('movimientos');
    const activos = todos
      .filter((m) => !m.borrado)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    setMovimientos(activos);
  }, []);

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

  const crearMovimiento = useCallback(
    async (datos: Omit<Movimiento, 'id' | 'borrado'>) => {
      const movimiento: Movimiento = {
        id: crypto.randomUUID(),
        ...datos,
        actualizado: new Date().toISOString(),
        sincronizado: false,
      };
      await put('movimientos', movimiento);
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
      return movimiento;
    },
    [recargar]
  );

  const actualizarMovimiento = useCallback(
    async (id: string, cambios: Partial<Omit<Movimiento, 'id'>>) => {
      const actual = movimientos.find((m) => m.id === id);
      if (!actual) return;
      await put('movimientos', { ...actual, ...cambios, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
    },
    [movimientos, recargar]
  );

  const borrarMovimiento = useCallback(
    async (id: string) => {
      const actual = movimientos.find((m) => m.id === id);
      if (!actual) return;
      await put('movimientos', { ...actual, borrado: true, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
    },
    [movimientos, recargar]
  );

  return { movimientos, cargando, crearMovimiento, actualizarMovimiento, borrarMovimiento };
}
