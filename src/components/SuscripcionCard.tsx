import { useState } from 'react';
import type { Compromiso } from '../lib/db';
import { pagosDeCompromiso, totalPagadoDeCompromiso, type Cuenta, type Movimiento } from '../lib/finanzas';
import { hoyISO, inicioAnioISO, proximoCobroISO } from '../lib/fecha';
import { formatearFechaCorta, formatearMonto } from '../lib/formato';
import { iconoDeMarca } from './marcas';
import { IconArrowsClockwise, IconHandshake } from './icons';
import { botonPrimario, botonSecundario, inputStyle } from './formStyles';

export function SuscripcionCard({
  suscripcion,
  movimientos,
  cuentas,
  onRegistrarPago,
  onBorrar,
}: {
  suscripcion: Compromiso;
  movimientos: Movimiento[];
  cuentas: Cuenta[];
  onRegistrarPago: (monto: number, cuentaId: string) => Promise<unknown>;
  onBorrar: (id: string) => void;
}) {
  const [mostrarPago, setMostrarPago] = useState(false);
  const [monto, setMonto] = useState('');
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [guardando, setGuardando] = useState(false);

  const marca = iconoDeMarca(suscripcion.nombre);
  const Icono = marca?.Icono ?? IconArrowsClockwise;
  const proximo = suscripcion.diaCobro ? proximoCobroISO(suscripcion.diaCobro) : null;
  const pagos = pagosDeCompromiso(suscripcion.id, movimientos);
  const pagadoEsteAnio = totalPagadoDeCompromiso(suscripcion.id, movimientos, inicioAnioISO(), hoyISO());

  function abrirPago() {
    setMonto(String(suscripcion.monto));
    setMostrarPago(true);
  }

  async function enviarPago(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(monto);
    if (!valor || valor <= 0 || !cuentaId || guardando) return;
    setGuardando(true);
    try {
      await onRegistrarPago(valor, cuentaId);
      setMostrarPago(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: marca ? `${marca.color}1A` : 'var(--primary-soft)',
            color: marca ? marca.color : 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          <Icono width={18} height={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{suscripcion.nombre}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted-fg)' }}>
            {proximo ? `Próximo cobro: ${formatearFechaCorta(proximo)}` : 'Sin día de cobro'}
          </div>
        </div>
        <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap' }}>
          S/ {formatearMonto(suscripcion.monto)}
        </div>
        <button
          type="button"
          onClick={() => onBorrar(suscripcion.id)}
          aria-label="Eliminar suscripción"
          style={{ all: 'unset', cursor: 'pointer', color: 'var(--muted-fg)', fontSize: 12 }}
        >
          Eliminar
        </button>
      </div>

      {pagos.length > 0 && (
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-fg)' }}>
            Pagado este año: <b style={{ color: 'var(--fg)' }}>S/ {formatearMonto(pagadoEsteAnio)}</b> · {pagos.length} pago
            {pagos.length !== 1 ? 's' : ''} en total
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {pagos.slice(0, 5).map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted-fg)' }}>
                <span>{formatearFechaCorta(m.fecha)}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>S/ {formatearMonto(m.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrarPago ? (
        <form onSubmit={enviarPago} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
            placeholder="0.00"
          />
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={inputStyle}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setMostrarPago(false)} style={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} style={botonPrimario(guardando)}>
              Confirmar pago
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={abrirPago}
          style={{ ...botonSecundario, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <IconHandshake width={15} height={15} />
          Marcar pagado este mes
        </button>
      )}
    </div>
  );
}
