import { CATS, CATS_ING, type Cuenta, type Movimiento } from '../lib/finanzas';
import { formatearFechaCorta, formatearMonto } from '../lib/formato';
import { CATEGORIA_ICONOS, IconQuestion, TIPO_COLOR, TIPO_ICONOS } from './icons';

const TIPO_NOMBRE: Record<string, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  REEMBOLSO: 'Reembolso',
  TRASPASO: 'Traspaso',
  AHORRO: 'Ahorro',
};

function infoVisual(m: Movimiento) {
  if (m.categoria) {
    const cat = [...CATS, ...CATS_ING].find((c) => c.id === m.categoria);
    if (cat) return { nombre: cat.nombre, Icono: CATEGORIA_ICONOS[cat.icono] ?? IconQuestion, color: cat.color };
  }
  return {
    nombre: TIPO_NOMBRE[m.tipo] ?? m.tipo,
    Icono: TIPO_ICONOS[m.tipo] ?? IconQuestion,
    color: TIPO_COLOR[m.tipo] ?? 'var(--primary)',
  };
}

function signoYColor(tipo: Movimiento['tipo']): { signo: string; color: string } {
  if (tipo === 'INGRESO' || tipo === 'REEMBOLSO') return { signo: '+', color: 'var(--accent)' };
  if (tipo === 'GASTO' || tipo === 'AHORRO') return { signo: '−', color: 'var(--destructive)' };
  return { signo: '', color: 'var(--fg)' }; // TRASPASO: neutral, no gana ni pierde en conjunto
}

/** Fondo suave del ícono a partir de su color de identidad (hex con alpha, o
 * el token azul por defecto cuando no hay color específico). */
function fondoIcono(color: string): string {
  return color.startsWith('#') ? `${color}26` : 'var(--primary-soft)';
}

export function MovimientoRow({
  movimiento,
  cuentas,
  onBorrar,
  onEditar,
}: {
  movimiento: Movimiento;
  cuentas: Cuenta[];
  onBorrar?: (id: string) => void;
  onEditar?: (id: string) => void;
}) {
  const { nombre, Icono, color: colorIcono } = infoVisual(movimiento);
  const { signo, color } = signoYColor(movimiento.tipo);
  const cuenta = cuentas.find((c) => c.id === movimiento.cuentaId);
  const destino = movimiento.destinoId ? cuentas.find((c) => c.id === movimiento.destinoId) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--card-border)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: fondoIcono(colorIcono),
          color: colorIcono,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <Icono width={17} height={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{nombre}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted-fg)' }}>
          {cuenta?.nombre ?? '—'}
          {destino ? ` → ${destino.nombre}` : ''} · {formatearFechaCorta(movimiento.fecha)}
          {movimiento.nota ? ` · ${movimiento.nota}` : ''}
        </div>
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13.5, color, whiteSpace: 'nowrap' }}>
        {signo} S/ {formatearMonto(movimiento.monto)}
      </div>
      {(onEditar || onBorrar) && (
        <div style={{ display: 'flex', gap: 10, flex: '0 0 auto' }}>
          {onEditar && (
            <button
              type="button"
              onClick={() => onEditar(movimiento.id)}
              aria-label="Editar movimiento"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--primary)', fontSize: 12 }}
            >
              Editar
            </button>
          )}
          {onBorrar && (
            <button
              type="button"
              onClick={() => onBorrar(movimiento.id)}
              aria-label="Eliminar movimiento"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--muted-fg)', fontSize: 12 }}
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
