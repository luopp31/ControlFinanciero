import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { formatearMes, formatearMontoOcultable } from '../lib/formato';
import { leerMonto, progresoPresupuesto } from '../lib/presupuesto';
import { botonPrimario, inputStyle } from './formStyles';

/** Gasto neto del mes junto al presupuesto: "Llevas S/ X de S/ Y, te quedan S/ Z". Sin presupuesto, invita a fijarlo. */
export function GastoDelMes({ gasto, mes }: { gasto: number; mes: string }) {
  const { config, guardarPresupuesto } = useConfig();
  const oculto = !!config.ocultarSaldos;
  const presupuesto = config.presupuesto ?? 0;
  const [editando, setEditando] = useState(false);
  // Texto local: escribir no repinta el Panel (en iOS eso cierra el teclado).
  const [texto, setTexto] = useState('');
  const valido = leerMonto(texto) !== null;
  const mostrarCampo = editando || presupuesto <= 0;
  const p = progresoPresupuesto(gasto, presupuesto);
  const color = p.excedido ? 'var(--destructive)' : p.porcentaje >= 85 ? '#FFB020' : 'var(--accent)';
  const s = (n: number) => `S/ ${formatearMontoOcultable(Math.abs(n), oculto)}`;

  function fijar() {
    const n = leerMonto(texto);
    if (n === null) return;
    void guardarPresupuesto(n);
    setEditando(false);
    setTexto('');
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--muted-fg)' }}>Gasto de {formatearMes(mes)}</p>
        {presupuesto > 0 && !editando && (
          <button type="button" onClick={() => { setTexto(String(presupuesto)); setEditando(true); }} style={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline' }}>
            Cambiar presupuesto
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s(gasto)}</p>

      {presupuesto > 0 && (
        <>
          <div role="progressbar" aria-valuenow={Math.round(p.porcentaje)} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 999, background: 'var(--muted)', overflow: 'hidden' }}>
            <div style={{ width: `${p.porcentaje}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .25s ease' }} />
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)' }}>
            Llevas {s(gasto)} de {s(presupuesto)},{' '}
            <b style={{ color, whiteSpace: 'nowrap' }}>{p.excedido ? `te pasaste por ${s(p.restante)}` : `te quedan ${s(p.restante)}`}</b>
          </p>
        </>
      )}

      {mostrarCampo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {presupuesto <= 0 && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)' }}>Fija cuánto quieres gastar al mes para ver cuánto te queda.</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              inputMode="decimal"
              enterKeyHint="done"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fijar()}
              placeholder="Presupuesto mensual, ej. 3000"
              aria-label="Presupuesto mensual"
              autoComplete="off"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            <button type="button" onClick={fijar} disabled={!valido} style={botonPrimario(!valido)}>
              Fijar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
