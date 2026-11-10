import { useLayoutEffect, useRef, useState } from 'react';
import type { Captura } from '../../lib/db';
import { CATS, CATS_ING, type Cuenta } from '../../lib/finanzas';
import { MAX_NOTA } from '../../lib/capturas';
import type { PropuestaTransferencia } from '../../lib/transferencias';
import { formatearInstanteLima, formatearMonto } from '../../lib/formato';
import { botonPrimario, chipStyle, chipStyleColor, etiquetaStyle, inputStyle } from '../../components/formStyles';

const fila_: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const enlace: React.CSSProperties = { all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' };

type Reconocida = Extract<PropuestaTransferencia, { caso: 'TRASPASO' | 'ORIGEN_DESCONOCIDO' | 'INGRESO' }>;
type Modo = null | 'ingreso' | 'gasto';

/**
 * Una transferencia cuyas cuentas se reconocen:
 *  A. TRASPASO entre mis cuentas: un toque, sin categoría.
 *  B. El cargo no trae producto y el destino es mío: ¿desde qué cuenta? (o una entrada de fuera). Nunca un gasto.
 *  D. Entra a una cuenta mía desde otro producto (Ahorro Sueldo): INGRESO con categoría de ingreso.
 * Los gastos a terceros (caso C) usan la tarjeta de siempre.
 */
export function FilaTransferencia({
  captura,
  propuesta,
  cuentas,
  ocupada,
  onTraspaso,
  onIngreso,
  onGasto,
  onNota,
  onDescartar,
}: {
  captura: Captura;
  propuesta: Reconocida;
  cuentas: Cuenta[];
  ocupada: boolean;
  onTraspaso: (origenId: string, destinoId: string, nota: string) => void;
  onIngreso: (categoria: string, destinoId: string, nota: string) => void;
  /** Solo desde A ("No es entre mis cuentas"): se registra como gasto desde la cuenta de cargo. */
  onGasto: (categoria: string, cuentaId: string, nota: string) => void;
  onNota: (texto: string) => void;
  onDescartar: () => void;
}) {
  const [modo, setModo] = useState<Modo>(propuesta.caso === 'INGRESO' ? 'ingreso' : null);
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [nota, setNota] = useState('');
  const notaRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (notaAbierta) notaRef.current?.focus();
  }, [notaAbierta]);

  const monto = (captura.montoCentimos ?? 0) / 100;
  const ingreso = propuesta.caso === 'INGRESO';
  const titulo = propuesta.caso === 'TRASPASO' ? 'Traspaso' : propuesta.caso === 'ORIGEN_DESCONOCIDO' ? `Traspaso a ${propuesta.destino.nombre}` : `Ingreso en ${propuesta.destino.nombre}`;
  const detalle =
    propuesta.caso === 'TRASPASO' ? `${propuesta.origen.nombre} → ${propuesta.destino.nombre}` : propuesta.caso === 'ORIGEN_DESCONOCIDO' ? '¿Desde qué cuenta?' : `Desde ${propuesta.desde}`;
  const gastoDesde = propuesta.caso === 'TRASPASO' ? propuesta.origen : undefined;

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{titulo}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted-fg)' }}>
            Transferencia{captura.fechaHora ? ` · ${formatearInstanteLima(captura.fechaHora)}` : ''}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: ingreso || modo === 'ingreso' ? 'var(--accent)' : 'var(--fg)', whiteSpace: 'nowrap' }}>
          {ingreso || modo === 'ingreso' ? '+ ' : ''}S/ {formatearMonto(monto)}
        </p>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)', overflowWrap: 'anywhere' }}>{detalle}</p>

      {notaAbierta && (
        <input
          ref={notaRef}
          value={nota}
          maxLength={MAX_NOTA}
          onChange={(e) => {
            setNota(e.target.value);
            onNota(e.target.value);
          }}
          placeholder="Nota (opcional)"
          aria-label="Nota"
          autoComplete="off"
          enterKeyHint="done"
          style={{ ...inputStyle, padding: '8px 12px' }}
        />
      )}

      {/* A: un toque */}
      {propuesta.caso === 'TRASPASO' && modo === null && (
        <button type="button" disabled={ocupada} onClick={() => onTraspaso(propuesta.origen.id, propuesta.destino.id, nota)} style={{ ...botonPrimario(ocupada), width: '100%' }}>
          Confirmar traspaso
        </button>
      )}

      {/* B: ¿desde qué cuenta mía? */}
      {propuesta.caso === 'ORIGEN_DESCONOCIDO' && modo === null && (
        <div style={{ ...fila_, alignItems: 'center' }}>
          <span style={etiquetaStyle}>Desde</span>
          {cuentas
            .filter((c) => c.id !== propuesta.destino.id)
            .map((c) => (
              <button key={c.id} type="button" disabled={ocupada} style={chipStyle(false)} onClick={() => onTraspaso(c.id, propuesta.destino.id, nota)}>
                {c.nombre}
              </button>
            ))}
          <button type="button" disabled={ocupada} style={chipStyle(false)} onClick={() => setModo('ingreso')}>
            Viene de fuera
          </button>
        </div>
      )}

      {/* D, o B -> "Viene de fuera": categoría de ingreso */}
      {modo === 'ingreso' && (
        <div style={fila_}>
          {CATS_ING.map((c) => (
            <button key={c.id} type="button" disabled={ocupada} style={chipStyleColor(false, c.color)} onClick={() => onIngreso(c.id, propuesta.destino.id, nota)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* A -> "No es entre mis cuentas": se registra como gasto desde la cuenta de cargo */}
      {modo === 'gasto' && gastoDesde && (
        <div style={fila_}>
          {CATS.filter((c) => c.id !== 'SINID').map((c) => (
            <button key={c.id} type="button" disabled={ocupada} style={chipStyleColor(false, c.color)} onClick={() => onGasto(c.id, gastoDesde.id, nota)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <button type="button" disabled={ocupada} onClick={onDescartar} style={{ ...enlace, color: 'var(--muted-fg)' }}>
          Descartar
        </button>
        {!notaAbierta && (
          <button type="button" disabled={ocupada} onClick={() => setNotaAbierta(true)} style={{ ...enlace, color: 'var(--primary)' }}>
            + Nota
          </button>
        )}
        {propuesta.caso === 'TRASPASO' && modo === null && (
          <button type="button" disabled={ocupada} onClick={() => setModo('gasto')} style={{ ...enlace, color: 'var(--muted-fg)' }}>
            No es entre mis cuentas
          </button>
        )}
        {modo !== null && propuesta.caso !== 'INGRESO' && (
          <button type="button" disabled={ocupada} onClick={() => setModo(null)} style={{ ...enlace, color: 'var(--muted-fg)' }}>
            Volver
          </button>
        )}
      </div>
    </div>
  );
}
