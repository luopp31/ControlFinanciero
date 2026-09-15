import { CuentaCard } from '../../components/CuentaCard';
import { MovimientoRow } from '../../components/MovimientoRow';
import { GraficoTendencia } from '../../components/GraficoTendencia';
import { formatearMonto } from '../../lib/formato';
import type { PanelViewProps } from './types';

export function PanelDesktop({ cuentas, movimientos, valorNetoActual, serie, recientes }: PanelViewProps) {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Valor neto</h1>
        <p style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', margin: 0 }}>
          S/ {formatearMonto(valorNetoActual)}
        </p>
      </div>

      <div className="glass-card">
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

const eyebrow: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 8px',
};

const seccionTitulo: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--muted-fg)',
  margin: '0 0 12px',
};
