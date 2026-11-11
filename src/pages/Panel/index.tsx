import { useMemo } from 'react';
import { CuentaFila } from '../../components/CuentaFila';
import { Escena } from '../../components/Escena';
import { ESCENA, seccionTituloStyle } from '../../components/escenaEstilos';
import { GastoDelMes } from '../../components/GastoDelMes';
import { HeroPatrimonio } from '../../components/HeroPatrimonio';
import { IconEye, IconEyeSlash, IconReceipt } from '../../components/icons';
import { MovimientoRow } from '../../components/MovimientoRow';
import { TarjetaAhorro } from '../../components/TarjetaAhorro';
import { TarjetaBandeja } from '../../components/TarjetaBandeja';
import { useCapturas } from '../../hooks/useCapturas';
import { useCompromisos } from '../../hooks/useCompromisos';
import { useConfig } from '../../hooks/useConfig';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { usePrestamos } from '../../hooks/usePrestamos';
import { resumenBandeja } from '../../lib/capturas';
import { diasEnMes, hoyISO, mesActualISO, menosDiasISO, proximoCobroISO } from '../../lib/fecha';
import { serieValorNeto, totalGastos, totalIngresos, valorNeto } from '../../lib/finanzas';
import { formatearFechaCorta, formatearMes, formatearMonto, formatearMontoOcultable } from '../../lib/formato';
import { saludoPorHora } from '../../lib/saludo';

const DIAS_SERIE = 90;

const cap: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted-fg)' };

function Dato({ etiqueta, valor, color, detalle }: { etiqueta: string; valor: string; color?: string; detalle?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={cap}>{etiqueta}</span>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color }}>{valor}</span>
      {detalle && <span style={cap}>{detalle}</span>}
    </div>
  );
}

/** Hoy: el patrimonio como paisaje, tres datos que sirven para decidir, tarjetas pequeñas, cuentas y lo último que pasó. */
export function Panel({ onAbrirBandeja }: { onAbrirConciliar: () => void; onAbrirBandeja: () => void }) {
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs } = useMovimientos();
  const { config, cargando: cargandoConfig, alternarOcultarSaldos } = useConfig();
  const { prestamos } = usePrestamos();
  const { compromisos } = useCompromisos();
  const { capturas } = useCapturas();

  const datos = useMemo(() => {
    const hoy = hoyISO();
    const mes = mesActualISO();
    const fechas = Array.from({ length: DIAS_SERIE }, (_, i) => menosDiasISO(DIAS_SERIE - 1 - i));
    const [anio, mesNum] = mes.split('-').map(Number);
    const diaDelMes = Number(hoy.slice(8, 10));
    const diasRestantes = diasEnMes(anio, mesNum - 1) - diaDelMes + 1;
    const proximos = compromisos
      .filter((c) => !c.borrado && c.tipo === 'SUSCRIPCION' && c.diaCobro)
      .map((c) => ({ c, fecha: proximoCobroISO(c.diaCobro as number) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return {
      mes,
      serie: serieValorNeto(cuentas, movimientos, prestamos, fechas),
      gastoMes: totalGastos(movimientos, `${mes}-01`, `${mes}-31`),
      ingresosMes: totalIngresos(movimientos, `${mes}-01`, `${mes}-31`),
      gastoHoy: totalGastos(movimientos, hoy, hoy),
      diasRestantes,
      proximo: proximos[0] ?? null,
      netoActual: valorNeto(cuentas, movimientos, prestamos),
    };
  }, [cuentas, movimientos, prestamos, compromisos]);

  if (cargandoCuentas || cargandoMovs || cargandoConfig) return null;

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: '120px 20px 32px', maxWidth: 480 }}>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)' }}>Crea al menos una cuenta en "Cuentas" para ver tu panel.</p>
      </div>
    );
  }

  const oculto = !!config.ocultarSaldos;
  const presupuesto = config.presupuesto ?? 0;
  const pendientes = resumenBandeja(capturas).pendientes.length;
  const alDia = presupuesto > 0 ? Math.max(0, presupuesto - datos.gastoMes) / datos.diasRestantes : null;
  const saludo = `${saludoPorHora()}${config.nombre ? `, ${config.nombre.split(' ')[0]}` : ''}`;
  const recientes = movimientos.slice(0, 5);

  return (
    <div>
      <Escena
        color={ESCENA.hoy}
        izquierda={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, letterSpacing: '-0.02em' }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, color: '#3A2A00', background: 'radial-gradient(circle at 32% 28%, #FFE9A0, #F9C846 60%, #B98A1E)' }}>G</span>
            Greedy
          </span>
        }
        derecha={
          <div style={{ display: 'flex' }}>
            <button type="button" onClick={alternarOcultarSaldos} aria-label={oculto ? 'Mostrar saldos' : 'Ocultar saldos'} style={botonIcono}>
              {oculto ? <IconEyeSlash width={22} height={22} /> : <IconEye width={22} height={22} />}
            </button>
            <button type="button" onClick={onAbrirBandeja} aria-label={pendientes ? `${pendientes} por clasificar` : 'Bandeja de capturas'} style={botonIcono}>
              <IconReceipt width={24} height={24} />
              {pendientes > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--yellow)', color: '#000', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{pendientes}</span>
              )}
            </button>
          </div>
        }
      >
        <HeroPatrimonio serie={datos.serie} oculto={oculto} saludo={saludo}>
          <div className="datos-clave">
            {alDia !== null ? (
              <Dato etiqueta="Puedes gastar al día" valor={`S/ ${formatearMontoOcultable(alDia, oculto)}`} />
            ) : (
              <Dato etiqueta={`Gastado en ${formatearMes(datos.mes)}`} valor={`S/ ${formatearMontoOcultable(datos.gastoMes, oculto)}`} />
            )}
            <Dato etiqueta="Gastado hoy" valor={`S/ ${formatearMontoOcultable(datos.gastoHoy, oculto)}`} color={datos.gastoHoy > 0 ? 'var(--destructive)' : undefined} />
            {datos.proximo ? (
              <Dato etiqueta="Próximo pago" valor={formatearFechaCorta(datos.proximo.fecha)} detalle={`${datos.proximo.c.nombre} · ${formatearMonto(datos.proximo.c.monto)}`} />
            ) : (
              <Dato etiqueta="Próximo pago" valor="—" detalle="Sin pagos fijos" />
            )}
          </div>
        </HeroPatrimonio>
      </Escena>

      <div className="pagina">
        <div className="carrusel">
          <GastoDelMes gasto={datos.gastoMes} mes={datos.mes} />
          <TarjetaAhorro ingresos={datos.ingresosMes} gastos={datos.gastoMes} oculto={oculto} />
          <TarjetaBandeja pendientes={pendientes} onAbrir={onAbrirBandeja} />
        </div>

        <div className="dos-col pagina-pad">
          <section style={{ paddingTop: 28 }}>
            <h3 style={seccionTituloStyle}>Cuentas</h3>
            <div style={{ marginTop: 6 }}>
              {cuentas.map((c) => (
                <CuentaFila key={c.id} cuenta={c} movimientos={movimientos} oculto={oculto} />
              ))}
            </div>
          </section>
          <section style={{ paddingTop: 28 }}>
            <h3 style={seccionTituloStyle}>Recientes</h3>
            <div style={{ marginTop: 6 }}>
              {recientes.length === 0 ? (
                <p style={{ fontSize: 14.5, color: 'var(--muted-fg)', margin: '10px 0 0' }}>Aún no registras movimientos.</p>
              ) : (
                recientes.map((m) => <MovimientoRow key={m.id} movimiento={m} cuentas={cuentas} />)
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const botonIcono: React.CSSProperties = { all: 'unset', cursor: 'pointer', width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative', color: 'var(--fg)' };
