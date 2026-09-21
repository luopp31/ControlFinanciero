import { useCallback, useEffect, useState } from 'react';
import { getConfig, putConfig, type Config } from '../lib/db';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';

const CONFIG_DEFAULT: Config = { presupuesto: 0, nombre: '', catsExtra: [], catColor: {}, version: 0 };

export function useConfig() {
  const [config, setConfig] = useState<Config>(CONFIG_DEFAULT);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const actual = await getConfig();
    setConfig(actual ?? CONFIG_DEFAULT);
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

  const guardarNombre = useCallback(
    async (nombre: string) => {
      await putConfig({ ...config, nombre, version: config.version + 1 });
      await recargar();
      avisarCambioDeDatos();
    },
    [config, recargar]
  );

  const alternarOcultarSaldos = useCallback(async () => {
    await putConfig({ ...config, ocultarSaldos: !config.ocultarSaldos, version: config.version + 1 });
    await recargar();
    avisarCambioDeDatos();
  }, [config, recargar]);

  return { config, cargando, guardarNombre, alternarOcultarSaldos };
}
