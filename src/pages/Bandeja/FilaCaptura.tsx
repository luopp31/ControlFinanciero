import { useLayoutEffect, useRef, useState } from 'react';
import type { Captura } from '../../lib/db';
import type { Propuesta } from '../../lib/clasificador';
import { CATS, type Cuenta } from '../../lib/finanzas';
import { MAX_NOTA, cuentaDeCaptura } from '../../lib/capturas';
import { formatearInstanteLima, formatearMonto } from '../../lib/formato';
import { leerMonto } from '../../lib/presupuesto';
import { chipStyle, chipStyleColor, etiquetaStyle, inputStyle } from '../../components/formStyles';

const fila_: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const enlace: React.CSSProperties = { all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' };

const ORIGEN: Record<string, string> = { Plin: 'Plin', Yape: 'Yape', wallet: 'Wallet' };

/** Una captura por clasificar: quién, cuánto, cuándo, categorías sugeridas como chips, descartar y la pregunta del posible duplicado. */
export function FilaCaptura({
  captura,
  propuesta,
  cuentas,
  duplicado,
  ocupada,
  onClasificar,
  onNota,
  onDescartar,
  onEsElMismo,
  onSonDistintos,
  aviso,
}: {
  captura: Captura;
  propuesta: Propuesta;
  cuentas: Cuenta[];
  duplicado?: Captura;
  ocupada: boolean;
  onClasificar: (categoria: string, cuentaId: string, montoSolesCentimos: number | null, nota: string) => void;
  /** Avisa al padre del texto escrito sin que este se repinte (lo usa "Confirmar sugeridas"). */
  onNota: (texto: string) => void;
  onDescartar: () => void;
  onEsElMismo: () => void;
  onSonDistintos: () => void;
  /** Texto de ayuda bajo el encabezado (p. ej. una transferencia que quizá no mueve tu plata). */
  aviso?: string;
}) {
  const usd = captura.moneda === 'USD';
  const [todas, setTodas] = useState(false);
  const [cuentaId, setCuentaId] = useState(() => cuentaDeCaptura(captura, cuentas)?.id ?? '');
  const [solesTxt, setSolesTxt] = useState('');
  const soles = leerMonto(solesTxt);
  const listo = !ocupada && (!usd || soles !== null);
  // La nota (concepto) es opcional y vive solo aquí: escribir no repinta la lista, y el teclado no se cierra.
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [nota, setNota] = useState('');
  const notaRef = useRef<HTMLInputElement>(null);
  // Se enfoca en el mismo toque que abre el campo (el layout effect corre dentro del evento): así iOS abre el teclado.
  useLayoutEffect(() => {
    if (notaAbierta) notaRef.current?.focus();
  }, [notaAbierta]);

  const ids = todas ? CATS.map((c) => c.id) : propuesta.sugerencias.length ? propuesta.sugerencias : ['ALIMENTACION', 'TRANSPORTE', 'COMPRAS'];
  const etiquetaOrigen = captura.origen === 'wallet' ? ORIGEN.wallet : captura.origen === 'transferencia_correo' ? 'Transferencia' : ORIGEN[captura.destino ?? 'Plin'];
  const monto = (captura.montoCentimos ?? 0) / 100;

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{captura.destinatario || (captura.tipo === 'transferencia' ? 'Transferencia' : 'Sin nombre')}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted-fg)' }}>
            {etiquetaOrigen}
            {captura.fechaHora ? ` · ${formatearInstanteLima(captura.fechaHora)}` : ''}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--destructive)', whiteSpace: 'nowrap' }}>
          − {usd ? 'US$' : 'S/'} {formatearMonto(monto)}
        </p>
      </div>

      {aviso && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>{aviso}</p>}

      {duplicado && (
        <div style={{ borderRadius: 12, padding: '10px 12px', background: 'var(--primary-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            ¿Es el mismo gasto que «{duplicado.destinatario}» de S/ {formatearMonto((duplicado.montoCentimos ?? 0) / 100)}
            {duplicado.fechaHora ? ` (${formatearInstanteLima(duplicado.fechaHora)})` : ''}?
          </p>
          <div style={fila_}>
            <button type="button" disabled={ocupada} onClick={onEsElMismo} style={chipStyle(true)}>
              Es el mismo
            </button>
            <button type="button" disabled={ocupada} onClick={onSonDistintos} style={chipStyle(false)}>
              Son distintos
            </button>
          </div>
        </div>
      )}

      {usd && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={etiquetaStyle}>Es en dólares: ¿cuánto fue en soles?</span>
          <input
            inputMode="decimal"
            value={solesTxt}
            onChange={(e) => setSolesTxt(e.target.value)}
            placeholder="Monto en soles, ej. 81.49"
            aria-label="Monto en soles"
            autoComplete="off"
            style={inputStyle}
          />
        </div>
      )}

      {cuentas.length > 1 && (
        <div style={{ ...fila_, alignItems: 'center' }}>
          <span style={etiquetaStyle}>Desde</span>
          {cuentas.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === cuentaId} style={chipStyle(c.id === cuentaId)} onClick={() => setCuentaId(c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {notaAbierta && (
        <input
          ref={notaRef}
          value={nota}
          maxLength={MAX_NOTA}
          onChange={(e) => {
            setNota(e.target.value);
            onNota(e.target.value);
          }}
          placeholder="Nota (opcional), ej. pasaje"
          aria-label="Nota"
          autoComplete="off"
          enterKeyHint="done"
          style={{ ...inputStyle, padding: '8px 12px' }}
        />
      )}

      <div style={fila_}>
        {ids.map((id, i) => {
          const c = CATS.find((x) => x.id === id);
          if (!c) return null;
          return (
            <button
              key={id}
              type="button"
              disabled={!listo}
              style={{ ...chipStyleColor(i === 0 && !!propuesta.categoria && !todas, c.color), opacity: listo ? 1 : 0.5, cursor: listo ? 'pointer' : 'not-allowed' }}
              onClick={() => onClasificar(id, cuentaId, usd && soles !== null ? Math.round(soles * 100) : null, nota)}
            >
              {c.nombre}
            </button>
          );
        })}
        {!todas && (
          <button type="button" style={chipStyle(false)} onClick={() => setTodas(true)}>
            Otra…
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <button type="button" disabled={ocupada} onClick={onDescartar} style={{ ...enlace, color: 'var(--muted-fg)' }}>
          Descartar
        </button>
        {!notaAbierta && (
          <button type="button" disabled={ocupada} onClick={() => setNotaAbierta(true)} style={{ ...enlace, color: 'var(--primary)' }}>
            + Nota
          </button>
        )}
      </div>
    </div>
  );
}

