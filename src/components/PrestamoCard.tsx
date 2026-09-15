import { useState } from 'react';
import { estadoPrestamo, type Cuenta, type Movimiento, type Prestamo, type TipoPrestamo } from '../lib/finanzas';
import { formatearMonto } from '../lib/formato';
import { IconHandshake, IconUser } from './icons';
import { botonPrimario, botonSecundario, inputStyle } from './formStyles';
import { PrestamoForm } from './PrestamoForm';

export function PrestamoCard({
  prestamo,
  movimientos,
  cuentas,
  onRegistrarPago,
  onEditar,
  onBorrar,
}: {
  prestamo: Prestamo;
  movimientos: Movimiento[];
  cuentas: Cuenta[];
  onRegistrarPago: (monto: number, cuentaId: string) => Promise<unknown>;
  onEditar: (id: string, datos: { persona: string; tipo: TipoPrestamo; capital: number; fecha: string }) => Promise<unknown>;
  onBorrar: (id: string) => void;
}) {
  const [mostrarPago, setMostrarPago] = useState(false);
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState('');
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [guardando, setGuardando] = useState(false);

  const estado = estadoPrestamo(prestamo, movimientos);
  const esCobrar = prestamo.tipo === 'PRESTE';

  if (editando) {
    return (
      <div className="glass-card">
        <PrestamoForm
          valoresIniciales={{
            persona: prestamo.persona,
            tipo: prestamo.tipo,
            capital: prestamo.capital,
            fecha: prestamo.fecha,
          }}
          etiquetaGuardar="Guardar cambios"
          onCrear={(datos) => onEditar(prestamo.id, datos)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  function abrirPago() {
    setMonto(estado.pendienteCapital.toFixed(2));
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
            }}
          >
            <IconUser width={17} height={17} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{prestamo.persona}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{esCobrar ? 'Te debe' : 'Le debes'}</div>
          </div>
        </div>
        {estado.saldado && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            Saldado
          </span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        S/ {formatearMonto(estado.pendienteCapital)}
      </p>
      {estado.devuelto > 0 && !estado.saldado && (
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-fg)' }}>
          Ya {esCobrar ? 'te pagó' : 'pagaste'} S/ {formatearMonto(estado.devuelto)} de S/ {formatearMonto(estado.meta)}
        </p>
      )}

      {!estado.saldado &&
        (mostrarPago ? (
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
                {esCobrar ? 'Registrar cobro' : 'Registrar pago'}
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
            {esCobrar ? 'Registrar cobro' : 'Registrar pago'}
          </button>
        ))}

      <div style={{ display: 'flex', gap: 14 }}>
        <button
          type="button"
          onClick={() => setEditando(true)}
          style={{ all: 'unset', cursor: 'pointer', color: 'var(--primary)', fontSize: 11.5 }}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onBorrar(prestamo.id)}
          style={{ all: 'unset', cursor: 'pointer', color: 'var(--muted-fg)', fontSize: 11.5 }}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
