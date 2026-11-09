import type { Cuenta } from '../lib/finanzas';
import { formatearInstanteLima } from '../lib/formato';
import { IconCloudCheck } from './icons';
import { botonPrimario } from './formStyles';

/** Entrada al Conciliar desde el Panel y Cuentas: hasta cuándo está al día cada cuenta. */
export function TarjetaConciliar({ cuentas, onAbrir }: { cuentas: Cuenta[]; onAbrir: () => void }) {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconCloudCheck width={20} height={20} style={{ color: 'var(--primary)' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Conciliar con el banco</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cuentas.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
            <span style={{ color: 'var(--muted-fg)' }}>{c.nombre}</span>
            <span style={{ fontWeight: 700, color: c.conciliadoHasta ? 'var(--fg)' : 'var(--muted-fg)' }}>
              {c.conciliadoHasta ? `Conciliado hasta ${formatearInstanteLima(c.conciliadoHasta)}` : 'Sin conciliar'}
            </span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAbrir} style={{ ...botonPrimario(false), width: '100%' }}>
        Conciliar
      </button>
    </div>
  );
}
