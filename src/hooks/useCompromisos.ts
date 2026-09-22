import { useCallback, useEffect, useState } from 'react';
import { getAll, put, type Compromiso } from '../lib/db';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';
import { programarSyncAutomatico } from '../lib/sync';

export function useCompromisos() {
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const todos = await getAll<Compromiso>('compromisos');
    setCompromisos(todos.filter((c) => !c.borrado));
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

  const crearCompromiso = useCallback(
    async (datos: Omit<Compromiso, 'id' | 'borrado'>) => {
      const compromiso: Compromiso = {
        id: crypto.randomUUID(),
        ...datos,
        actualizado: new Date().toISOString(),
        sincronizado: false,
      };
      await put('compromisos', compromiso);
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
      return compromiso;
    },
    [recargar]
  );

  const actualizarCompromiso = useCallback(
    async (id: string, cambios: Partial<Omit<Compromiso, 'id'>>) => {
      const actual = compromisos.find((c) => c.id === id);
      if (!actual) return;
      await put('compromisos', { ...actual, ...cambios, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
    },
    [compromisos, recargar]
  );

  const borrarCompromiso = useCallback(
    async (id: string) => {
      const actual = compromisos.find((c) => c.id === id);
      if (!actual) return;
      await put('compromisos', { ...actual, borrado: true, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
      programarSyncAutomatico();
    },
    [compromisos, recargar]
  );

  return { compromisos, cargando, crearCompromiso, actualizarCompromiso, borrarCompromiso };
}
