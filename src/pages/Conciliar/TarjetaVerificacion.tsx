import type { ReactNode } from 'react';
import type { Verificacion } from '../../lib/verificar';
import type { Cuenta } from '../../lib/finanzas';
import { formatearFechaCorta, formatearMonto } from '../../lib/formato';

const s = (cent: number) => `S/ ${formatearMonto(Math.abs(cent) / 100)}`;

/** Verificación final de una cuenta: "Cuadra" o "Difiere S/ X" con la lista de lo que no coincide. Sin botón de cuadrar a mano. */
export function TarjetaVerificacion({ cuenta, v }: { cuenta: Cuenta; v: Verificacion }) {
  const color = v.cuadra ? 'var(--accent)' : 'var(--destructive)';
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 14, borderColor: color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--muted-fg)' }}>{cuenta.nombre}</p>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>contra el saldo disponible</p>
      </div>
      <p style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color }}>
        {v.cuadra ? 'Cuadra' : `Difiere ${s(v.diferenciaCent)}`}
      </p>
      <div style={{ display: 'flex', gap: 24, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
        <span>
          Greedy <b>{s(v.greedyCent)}</b>
        </span>
        <span>
          Banco <b>{s(v.bancoCent)}</b>
        </span>
      </div>
      {!v.cuadra && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
          <p style={{ margin: 0, color: 'var(--muted-fg)' }}>
            {v.diferenciaCent > 0 ? 'El banco tiene más plata que Greedy.' : 'Greedy tiene más plata que el banco.'}
          </p>
          {v.faltanEnGreedy.length > 0 && (
            <Lista titulo="El banco lo muestra y Greedy no">
              {v.faltanEnGreedy.map((f) => (
                <Fila key={f.referencia} izq={`${f.descriptor} · ${formatearFechaCorta(f.fecha)}`} der={`${f.centimos < 0 ? '−' : '+'} ${s(f.centimos)}`} />
              ))}
            </Lista>
          )}
          {v.sobranEnGreedy.length > 0 && (
            <Lista titulo="Greedy lo tiene y el banco no">
              {v.sobranEnGreedy.map((m) => (
                <Fila key={m.id} izq={`${m.nota || m.categoria || m.tipo} · ${formatearFechaCorta(m.fecha)}`} der={`S/ ${formatearMonto(m.monto)}`} />
              ))}
            </Lista>
          )}
          {v.sinExplicarCent !== 0 && (
            <p style={{ margin: 0, color: 'var(--destructive)' }}>
              Quedan {s(v.sinExplicarCent)} que ninguna fila explica: revisa el saldo inicial y la fecha de corte de {cuenta.nombre}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Lista({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--muted-fg)' }}>{titulo}</p>
      {children}
    </div>
  );
}

function Fila({ izq, der }: { izq: string; der: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
      <span style={{ overflowWrap: 'anywhere' }}>{izq}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{der}</span>
    </div>
  );
}
