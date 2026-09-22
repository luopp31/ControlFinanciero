import { useMemo, useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useMovimientos } from '../../hooks/useMovimientos';
import { compararPeriodos } from '../../components/ComparacionPeriodo';
import { gastoPorCategoria, totalGastos, totalIngresos, totalesPorMes } from '../../lib/finanzas';
import { hoyISO, inicioAnioISO, inicioMesISO, menosDiasISO, rangoAnteriorIgualDuracion, ultimosMesesISO } from '../../lib/fecha';
import { EstadisticasDesktop } from './Estadisticas.desktop';
import { EstadisticasMobile } from './Estadisticas.mobile';
import type { Periodo } from './types';

const MESES_TENDENCIA = 6;

function desdeDe(periodo: Periodo): string {
  if (periodo === 'mes') return inicioMesISO();
  if (periodo === '3meses') return menosDiasISO(89);
  if (periodo === 'anio') return inicioAnioISO();
  return '0000-01-01';
}

export function Estadisticas() {
  const isDesktop = useIsDesktop();
  const { movimientos, cargando } = useMovimientos();
  const { config, cargando: cargandoConfig } = useConfig();
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  const datos = useMemo(() => {
    const desde = desdeDe(periodo);
    const hasta = hoyISO();

    const categorias = gastoPorCategoria(movimientos, desde, hasta);
    const total = categorias.reduce((s, c) => s + c.monto, 0);
    const ingresos = totalIngresos(movimientos, desde, hasta);

    const anterior = rangoAnteriorIgualDuracion(desde, hasta);
    const comparacionGasto = compararPeriodos(total, anterior ? totalGastos(movimientos, anterior.desde, anterior.hasta) : null);
    const comparacionIngreso = compararPeriodos(
      ingresos,
      anterior ? totalIngresos(movimientos, anterior.desde, anterior.hasta) : null
    );

    const tendencia = totalesPorMes(movimientos, ultimosMesesISO(MESES_TENDENCIA));

    return { categorias, total, ingresos, comparacionGasto, comparacionIngreso, tendencia };
  }, [movimientos, periodo]);

  if (cargando || cargandoConfig) return null;

  const props = { periodo, onCambiarPeriodo: setPeriodo, catColor: config.catColor, ...datos };
  return isDesktop ? <EstadisticasDesktop {...props} /> : <EstadisticasMobile {...props} />;
}
