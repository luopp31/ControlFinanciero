import { useState } from 'react';
import { BuscadorPrestamos, filtrarPrestamosPorPersona } from '../../components/BuscadorPrestamos';
import { PrestamoCard } from '../../components/PrestamoCard';
import { PrestamoForm } from '../../components/PrestamoForm';
import { SuscripcionCard } from '../../components/SuscripcionCard';
import { SuscripcionForm } from '../../components/SuscripcionForm';
import { IconPlus } from '../../components/icons';
import type { CompromisosViewProps } from './types';

type Subtab = 'prestamos' | 'suscripciones';

export function CompromisosMobile({
  cuentas,
  movimientos,
  prestamos,
  suscripciones,
  crearPrestamo,
  actualizarPrestamo,
  borrarPrestamo,
  registrarPago,
  crearSuscripcion,
  actualizarSuscripcion,
  registrarPagoSuscripcion,
  borrarSuscripcion,
}: CompromisosViewProps) {
  const [subtab, setSubtab] = useState<Subtab>('prestamos');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const prestamosFiltrados = filtrarPrestamosPorPersona(prestamos, busqueda);

  return (
    <div style={{ padding: '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Compromisos</h1>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['prestamos', 'suscripciones'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setSubtab(t);
              setMostrarForm(false);
            }}
            aria-pressed={subtab === t}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: 10,
              border: `1px solid ${subtab === t ? 'var(--primary)' : 'var(--card-border)'}`,
              background: subtab === t ? 'var(--primary-soft)' : 'var(--muted)',
              color: subtab === t ? 'var(--primary)' : 'var(--muted-fg)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {t === 'prestamos' ? 'Préstamos' : 'Suscripciones'}
          </button>
        ))}
      </div>

      {subtab === 'prestamos' ? (
        <>
          {mostrarForm ? (
            <div className="glass-card">
              <PrestamoForm
                cuentas={cuentas}
                onCrear={async (datos, cuentaId) => {
                  const r = await crearPrestamo(datos, cuentaId);
                  setMostrarForm(false);
                  return r;
                }}
                onCancelar={() => setMostrarForm(false)}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setMostrarForm(true)} style={botonAgregar}>
              <IconPlus width={16} height={16} />
              Registrar préstamo
            </button>
          )}
          {prestamos.length > 0 && (
            <BuscadorPrestamos
              busqueda={busqueda}
              onBuscarChange={setBusqueda}
              prestamosFiltrados={prestamosFiltrados}
              movimientos={movimientos}
            />
          )}
          {prestamos.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>Aún no registras préstamos.</p>
          ) : prestamosFiltrados.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>Sin préstamos con ese nombre.</p>
          ) : (
            prestamosFiltrados.map((p) => (
              <PrestamoCard
                key={p.id}
                prestamo={p}
                movimientos={movimientos}
                cuentas={cuentas}
                onRegistrarPago={(monto, cuentaId) => registrarPago(p, monto, cuentaId)}
                onEditar={actualizarPrestamo}
                onBorrar={borrarPrestamo}
              />
            ))
          )}
        </>
      ) : (
        <>
          {mostrarForm ? (
            <div className="glass-card">
              <SuscripcionForm
                onCrear={async (datos) => {
                  const r = await crearSuscripcion(datos);
                  setMostrarForm(false);
                  return r;
                }}
                onCancelar={() => setMostrarForm(false)}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setMostrarForm(true)} style={botonAgregar}>
              <IconPlus width={16} height={16} />
              Registrar suscripción
            </button>
          )}
          {suscripciones.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>Aún no registras suscripciones.</p>
          ) : (
            suscripciones.map((s) => (
              <SuscripcionCard
                key={s.id}
                suscripcion={s}
                movimientos={movimientos}
                cuentas={cuentas}
                onRegistrarPago={(monto, cuentaId) => registrarPagoSuscripcion(s, monto, cuentaId)}
                onEditar={actualizarSuscripcion}
                onBorrar={borrarSuscripcion}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 6px',
};

const botonAgregar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px 16px',
  borderRadius: 14,
  border: '1px dashed var(--card-border)',
  background: 'transparent',
  color: 'var(--primary)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
