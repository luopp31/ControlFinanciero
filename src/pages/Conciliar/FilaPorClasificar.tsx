import { useState } from 'react';
import type { FilaConRef } from '../../lib/emparejar';
import type { Propuesta } from '../../lib/clasificador';
import type { Decision } from '../../lib/planificar';
import { CATS, CATS_ING, type Cuenta } from '../../lib/finanzas';
import { formatearFechaCorta, formatearMonto } from '../../lib/formato';
import { chipStyle, chipStyleColor } from '../../components/formStyles';

type Modo = null | 'GASTO' | 'INGRESO' | 'REEMBOLSO' | 'ENTRE';

const fila_: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

/** Una fila del banco que falta clasificar: monto, nombre, fecha, categorías sugeridas como chips e "Ignorar". */
export function FilaPorClasificar({
  fila,
  propuesta,
  otrasCuentas,
  amexId,
  onDecidir,
}: {
  fila: FilaConRef;
  propuesta: Propuesta;
  otrasCuentas: Cuenta[];
  amexId?: string;
  onDecidir: (d: Decision) => void;
}) {
  const sale = fila.centimos < 0;
  const [modo, setModo] = useState<Modo>(null);
  const [todas, setTodas] = useState(false);

  // Sin opciones que elegir antes (persona/comercio que sale, o cualquier otro caso sin pregunta), se muestran las categorías.
  const esPersonaOComercio = propuesta.clase === 'PERSONA' || propuesta.clase === 'COMERCIO';
  const directo: Modo = esPersonaOComercio && sale ? 'GASTO' : null;
  const generico: Modo = !propuesta.opciones && propuesta.clase !== 'PAGO_TC' && !directo ? (sale ? 'GASTO' : 'INGRESO') : null;
  const activo: Modo = modo ?? directo ?? generico;

  const sugeridas = propuesta.sugerencias.length ? propuesta.sugerencias : ['ALIMENTACION', 'TRANSPORTE', 'COMPRAS'];
  const idsGasto = todas
    ? CATS.map((c) => c.id)
    : propuesta.clase === 'TRANSFERENCIA'
      ? ['SUSCRIPCIONES', ...sugeridas.filter((i) => i !== 'SUSCRIPCIONES')].slice(0, 3)
      : sugeridas;

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{fila.descriptor}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted-fg)' }}>
            {formatearFechaCorta(fila.fecha)} · {fila.hora}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sale ? 'var(--destructive)' : 'var(--accent)', whiteSpace: 'nowrap' }}>
          {sale ? '−' : '+'} S/ {formatearMonto(Math.abs(fila.centimos) / 100)}
        </p>
      </div>

      {propuesta.clase === 'PAGO_TC' &&
        (amexId ? (
          <div style={fila_}>
            <button type="button" style={chipStyle(true)} onClick={() => onDecidir({ accion: 'PAGO_PRESTAMO', prestId: amexId })}>
              Pago de mi tarjeta Amex
            </button>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>No hay un préstamo "Amex" pendiente. Créalo en Compromisos o ignora la fila.</p>
        ))}

      {propuesta.opciones && !modo && (
        <div style={fila_}>
          {propuesta.opciones.map((o) => (
            <button
              key={o.id}
              type="button"
              style={chipStyle(false)}
              onClick={() => {
                if (o.id === 'ENTRE_CUENTAS') {
                  if (otrasCuentas.length === 1) onDecidir({ accion: 'TRASPASO', cuentaContrariaId: otrasCuentas[0].id });
                  else setModo('ENTRE');
                } else if (o.id === 'INGRESO_SUELDO' || o.id === 'INGRESO') setModo('INGRESO');
                else if (o.id === 'REEMBOLSO') setModo('REEMBOLSO');
                else if (o.id === 'PAGO_DOLARES') setModo('GASTO');
                else setModo(sale ? 'GASTO' : 'INGRESO');
              }}
            >
              {o.nombre}
            </button>
          ))}
        </div>
      )}

      {activo === 'ENTRE' && (
        <div style={fila_}>
          {otrasCuentas.map((c) => (
            <button key={c.id} type="button" style={chipStyle(false)} onClick={() => onDecidir({ accion: 'TRASPASO', cuentaContrariaId: c.id })}>
              Con {c.nombre}
            </button>
          ))}
        </div>
      )}

      {(activo === 'GASTO' || activo === 'REEMBOLSO') && (
        <div style={fila_}>
          {idsGasto.map((id, i) => {
            const c = CATS.find((x) => x.id === id);
            if (!c) return null;
            return (
              <button
                key={id}
                type="button"
                style={chipStyleColor(i === 0 && !!propuesta.categoria && !todas, c.color)}
                onClick={() => onDecidir(activo === 'REEMBOLSO' ? { accion: 'REEMBOLSO', categoria: id } : { accion: 'GASTO', categoria: id })}
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
      )}

      {activo === 'INGRESO' && (
        <div style={fila_}>
          {CATS_ING.map((c) => (
            <button key={c.id} type="button" style={chipStyleColor(false, c.color)} onClick={() => onDecidir({ accion: 'INGRESO', categoria: c.id })}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <div>
        <button type="button" onClick={() => onDecidir({ accion: 'IGNORAR' })} style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--muted-fg)', textDecoration: 'underline' }}>
          Ignorar esta línea
        </button>
      </div>
    </div>
  );
}
