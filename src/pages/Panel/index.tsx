import { useMemo } from 'react';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { useConfig } from '../../hooks/useConfig';
import { usePrestamos } from '../../hooks/usePrestamos';
import { useCapturas } from '../../hooks/useCapturas';
import { resumenBandeja } from '../../lib/capturas';
import { mesActualISO, menosDiasISO } from '../../lib/fecha';
import { serieValorNeto, totalGastos, valorNeto } from '../../lib/finanzas';
import { PanelDesktop } from './Panel.desktop';
import { PanelMobile } from './Panel.mobile';

const DIAS_SERIE = 30;

export function Panel({ onAbrirConciliar, onAbrirBandeja }: { onAbrirConciliar: () => void; onAbrirBandeja: () => void }) {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs } = useMovimientos();
  const { config, cargando: cargandoConfig } = useConfig();
  const { prestamos } = usePrestamos();
  const { capturas } = useCapturas();

  const { valorNetoActual, serie, recientes, gastoMes, mes } = useMemo(() => {
    const mes = mesActualISO();
    const fechas = Array.from({ length: DIAS_SERIE }, (_, i) => menosDiasISO(DIAS_SERIE - 1 - i));
    return {
      valorNetoActual: valorNeto(cuentas, movimientos, prestamos),
      serie: serieValorNeto(cuentas, movimientos, prestamos, fechas),
      recientes: movimientos.slice(0, 5),
      mes,
      gastoMes: totalGastos(movimientos, `${mes}-01`, `${mes}-31`),
    };
  }, [cuentas, movimientos, prestamos]);

  if (cargandoCuentas || cargandoMovs || cargandoConfig) return null;

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: 32, maxWidth: 480 }}>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)' }}>
          Crea al menos una cuenta en "Cuentas" para ver tu panel.
        </p>
      </div>
    );
  }

  const props = { nombre: config.nombre, cuentas, movimientos, prestamos, valorNetoActual, serie, recientes, gastoMes, mes, onAbrirConciliar, onAbrirBandeja, bandeja: { pendientes: resumenBandeja(capturas).pendientes.length } };
  return isDesktop ? <PanelDesktop {...props} /> : <PanelMobile {...props} />;
}
