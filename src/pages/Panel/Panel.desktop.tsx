import { CuentaCard } from '../../components/CuentaCard';
import { MovimientoRow } from '../../components/MovimientoRow';
import { GraficoTendencia } from '../../components/GraficoTendencia';
import { IconEye, IconEyeSlash } from '../../components/icons';
import { useConfig } from '../../hooks/useConfig';
import { formatearMontoOcultable } from '../../lib/formato';
import { saludoPorHora } from '../../lib/saludo';
import type { PanelViewProps } from './types';

export function PanelDesktop({ nombre, cuentas, movimientos, valorNetoActual, serie, recientes }: PanelViewProps) {
  const { config, alternarOcultarSaldos } = useConfig();
  const oculto = !!config.ocultarSaldos;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {saludoPorHora()}
        {nombre ? `, ${nombre.split(' ')[0]}` : ''}
      </h1>

      <div className="hero-valor">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
            Greedy · Valor neto
          </p>
          <button
            type="button"
            onClick={alternarOcultarSaldos}
            aria-label={oculto ? 'Mostrar saldos' : 'Ocultar saldos'}
            style={{ all: 'unset', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex' }}
          >
            {oculto ? <IconEyeSlash width={20} height={20} /> : <IconEye width={20} height={20} />}
          </button>
        </div>
        <p style={{ fontSize: 44, fontWeight: 800, fontVariantNumeric: 'tabular-nums', margin: '0 0 22px', letterSpacing: '-0.02em' }}>
          S/ {formatearMontoOcultable(valorNetoActual, oculto)}
        </p>
        <GraficoTendencia puntos={serie} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <p style={seccionTitulo}>Cuentas</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {cuentas.map((c) => (
              <CuentaCard key={c.id} cuenta={c} movimientos={movimientos} />
            ))}
          </div>
        </div>

        <div>
          <p style={seccionTitulo}>Movimientos recientes</p>
          <div className="glass-card">
            {recientes.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>Aún no registras movimientos.</p>
            ) : (
              recientes.map((m) => <MovimientoRow key={m.id} movimiento={m} cuentas={cuentas} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const seccionTitulo: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--muted-fg)',
  margin: '0 0 12px',
};
