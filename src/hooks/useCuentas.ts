import { useCallback, useEffect, useState } from 'react';
import { getAll, put } from '../lib/db';
import type { Cuenta } from '../lib/finanzas';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';

export function useCuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const todas = await getAll<Cuenta>('cuentas');
    setCuentas(todas.filter((c) => !c.borrado));
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

  const crearCuenta = useCallback(
    async (datos: { nombre: string; rol: Cuenta['rol']; saldoInicial: number; desde: string }) => {
      const cuenta: Cuenta = {
        id: crypto.randomUUID(),
        ...datos,
        actualizado: new Date().toISOString(),
        sincronizado: false,
      };
      await put('cuentas', cuenta);
      await recargar();
      avisarCambioDeDatos();
      return cuenta;
    },
    [recargar]
  );

  const actualizarCuenta = useCallback(
    async (id: string, cambios: Partial<Omit<Cuenta, 'id'>>) => {
      const actual = cuentas.find((c) => c.id === id);
      if (!actual) return;
      await put('cuentas', { ...actual, ...cambios, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
    },
    [cuentas, recargar]
  );

  // Borrado suave: deja un "tombstone" para que el sync sepa que debe borrarla
  // también en la nube, en vez de solo desaparecer localmente.
  const borrarCuenta = useCallback(
    async (id: string) => {
      const actual = cuentas.find((c) => c.id === id);
      if (!actual) return;
      await put('cuentas', { ...actual, borrado: true, actualizado: new Date().toISOString(), sincronizado: false });
      await recargar();
      avisarCambioDeDatos();
    },
    [cuentas, recargar]
  );

  return { cuentas, cargando, crearCuenta, actualizarCuenta, borrarCuenta };
}
