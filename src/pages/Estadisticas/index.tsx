import { useMemo, useState } from 'react';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useMovimientos } from '../../hooks/useMovimientos';
import { gastoPorCategoria } from '../../lib/finanzas';
import { hoyISO, inicioAnioISO, inicioMesISO, menosDiasISO } from '../../lib/fecha';
import { EstadisticasDesktop } from './Estadisticas.desktop';
import { EstadisticasMobile } from './Estadisticas.mobile';
import type { Periodo } from './types';

function desdeDe(periodo: Periodo): string {
  if (periodo === 'mes') return inicioMesISO();
  if (periodo === '3meses') return menosDiasISO(89);
  if (periodo === 'anio') return inicioAnioISO();
  return '0000-01-01';
}

export function Estadisticas() {
  const isDesktop = useIsDesktop();
  const { movimientos, cargando } = useMovimientos();
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  const { categorias, total } = useMemo(() => {
    const categorias = gastoPorCategoria(movimientos, desdeDe(periodo), hoyISO());
    const total = categorias.reduce((s, c) => s + c.monto, 0);
    return { categorias, total };
  }, [movimientos, periodo]);

  if (cargando) return null;

  const props = { periodo, onCambiarPeriodo: setPeriodo, categorias, total };
  return isDesktop ? <EstadisticasDesktop {...props} /> : <EstadisticasMobile {...props} />;
}
