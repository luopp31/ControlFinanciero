import { useCallback, useEffect, useState } from 'react';
import { getAll, put } from '../lib/db';
import type { Prestamo } from '../lib/finanzas';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';

export function usePrestamos() {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const todos = await getAll<Prestamo>('prestamos');
    setPrestamos(todos.filter((p) => !p.borrado));
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

  const crearPrestamo = useCallback(
    async (datos: Omit<Prestamo, 'id' | 'borrado'>) => {
      const prestamo: Prestamo = {
        id: crypto.randomUUID(),
        ...datos,
        actualizado: new Date().toISOString(),
        sincronizado: false,
      };
      await put('prestamos', prestamo);
      await recargar();
      avisarCambioDeDatos();
      return prestamo;
    },
    [recargar]
  );

  const actualizarPrestamo = useCallback(
    async (id: string, cambios: Partial<Omit<Prestamo, 'id'>>) => {
      const actual = prestamos.find((p) => p.id === id);
      if (!actual) return;
      await put('prestamos', { ...actual, ...cambios, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
    },
    [prestamos, recargar]
  );

  const borrarPrestamo = useCallback(
    async (id: string) => {
      const actual = prestamos.find((p) => p.id === id);
      if (!actual) return;
      await put('prestamos', { ...actual, borrado: true, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
    },
    [prestamos, recargar]
  );

  return { prestamos, cargando, crearPrestamo, actualizarPrestamo, borrarPrestamo };
}
