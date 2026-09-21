import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfig, putConfig, type Config, type Tema } from '../lib/db';
import { avisarCambioDeDatos, suscribirCambiosDeDatos } from '../lib/eventos';

const CONFIG_DEFAULT: Config = { presupuesto: 0, nombre: '', catsExtra: [], catColor: {}, version: 0 };

export function useConfig() {
  const [config, setConfig] = useState<Config>(CONFIG_DEFAULT);
  const [cargando, setCargando] = useState(true);
  // Espejo síncrono de `config`, para que dos mutaciones disparadas antes de
  // que la primera termine su `await putConfig` se encadenen sobre el mismo
  // valor en vez de partir ambas del `config` (posiblemente ya viejo) que
  // capturó el closure al momento del render.
  const configRef = useRef(config);
  configRef.current = config;

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

  const mutar = useCallback(async (cambios: Partial<Omit<Config, 'version'>>) => {
    const actualizado = { ...configRef.current, ...cambios, version: configRef.current.version + 1 };
    configRef.current = actualizado;
    setConfig(actualizado);
    await putConfig(actualizado);
    avisarCambioDeDatos();
  }, []);

  const guardarNombre = useCallback((nombre: string) => mutar({ nombre }), [mutar]);

  const alternarOcultarSaldos = useCallback(
    () => mutar({ ocultarSaldos: !configRef.current.ocultarSaldos }),
    [mutar]
  );

  const guardarTema = useCallback((tema: Tema) => mutar({ tema }), [mutar]);

  const guardarColorCategoria = useCallback(
    (categoriaId: string, color: string) => mutar({ catColor: { ...configRef.current.catColor, [categoriaId]: color } }),
    [mutar]
  );

  return { config, cargando, guardarNombre, alternarOcultarSaldos, guardarTema, guardarColorCategoria };
}
