import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { formatearMes, formatearMontoOcultable } from '../lib/formato';
import { leerMonto, progresoPresupuesto } from '../lib/presupuesto';
import { botonPrimario, inputStyle } from './formStyles';

const kick: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: 'var(--muted-fg)' };
const cap: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted-fg)' };

/** Tarjeta pequeña del Hoy: gasto neto del mes frente al presupuesto. Sin presupuesto, invita a fijarlo. */
export function GastoDelMes({ gasto, mes }: { gasto: number; mes: string }) {
  const { config, guardarPresupuesto } = useConfig();
  const oculto = !!config.ocultarSaldos;
  const presupuesto = config.presupuesto ?? 0;
  const [editando, setEditando] = useState(false);
  // Texto local: escribir no repinta el Panel (en iOS eso cierra el teclado).
  const [texto, setTexto] = useState('');
  const valido = leerMonto(texto) !== null;
  const p = progresoPresupuesto(gasto, presupuesto);
  const color = p.excedido ? 'var(--destructive)' : p.porcentaje >= 85 ? 'var(--yellow)' : 'var(--fg)';
  const s = (n: number) => formatearMontoOcultable(Math.abs(n), oculto);

  function fijar() {
    const n = leerMonto(texto);
    if (n === null) return;
    void guardarPresupuesto(n);
    setEditando(false);
    setTexto('');
  }

  const mostrarCampo = editando;

  return (
    <div className="mini" style={mostrarCampo ? { width: 300 } : undefined}>
      <div style={{ ...kick, textTransform: 'capitalize' }}>{formatearMes(mes)}</div>
      <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>S/ {s(gasto)}</div>

      {mostrarCampo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <input
            inputMode="decimal"
            enterKeyHint="done"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fijar()}
            placeholder="Presupuesto mensual, ej. 3000"
            aria-label="Presupuesto mensual"
            autoComplete="off"
            style={{ ...inputStyle, minWidth: 0 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={fijar} disabled={!valido} style={{ ...botonPrimario(!valido), flex: 1 }}>
              Fijar
            </button>
            {presupuesto > 0 && (
              <button type="button" onClick={() => setEditando(false)} className="pildora borde chica">
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : presupuesto > 0 ? (
        <>
          <div style={cap}>de {s(presupuesto)}</div>
          <div role="progressbar" aria-valuenow={Math.round(p.porcentaje)} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden', marginTop: 'auto' }}>
            <div style={{ width: `${p.porcentaje}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .25s ease' }} />
          </div>
          <button
            type="button"
            onClick={() => {
              setTexto(String(presupuesto));
              setEditando(true);
            }}
            style={{ all: 'unset', cursor: 'pointer', ...cap, minHeight: 24, color: p.excedido ? 'var(--destructive)' : 'var(--muted-fg)' }}
          >
            {p.excedido ? `Te pasaste ${s(p.restante)}` : `Quedan ${s(p.restante)}`}
          </button>
        </>
      ) : (
        <>
          <div style={cap}>Sin presupuesto</div>
          <button type="button" onClick={() => setEditando(true)} className="pildora amarilla chica" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
            Fijar
          </button>
        </>
      )}
    </div>
  );
}
