import { PrestamoCard } from '../../components/PrestamoCard';
import { PrestamoForm } from '../../components/PrestamoForm';
import { SuscripcionCard } from '../../components/SuscripcionCard';
import { SuscripcionForm } from '../../components/SuscripcionForm';
import type { CompromisosViewProps } from './types';

export function CompromisosDesktop({
  cuentas,
  movimientos,
  prestamos,
  suscripciones,
  crearPrestamo,
  actualizarPrestamo,
  borrarPrestamo,
  registrarPago,
  crearSuscripcion,
  borrarSuscripcion,
}: CompromisosViewProps) {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={eyebrow}>Greedy</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Compromisos</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)', margin: 0 }}>
          Quién te debe, a quién le debes, y qué se te cobra pronto.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={seccionTitulo}>Préstamos</p>
          <div className="glass-card">
            <PrestamoForm cuentas={cuentas} onCrear={crearPrestamo} />
          </div>
          {prestamos.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>Aún no registras préstamos.</p>
          ) : (
            prestamos.map((p) => (
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
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={seccionTitulo}>Suscripciones</p>
          <div className="glass-card">
            <SuscripcionForm onCrear={crearSuscripcion} />
          </div>
          {suscripciones.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>Aún no registras suscripciones.</p>
          ) : (
            suscripciones.map((s) => (
              <SuscripcionCard key={s.id} suscripcion={s} onBorrar={borrarSuscripcion} />
            ))
          )}
        </section>
      </div>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 8px',
};

const seccionTitulo: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--muted-fg)',
  margin: 0,
};
