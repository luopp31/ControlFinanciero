import { useId } from 'react';
import { porCobrar, porPagar, type Movimiento, type Prestamo } from '../lib/finanzas';
import { formatearMonto } from '../lib/formato';
import { inputStyle } from './formStyles';

export function filtrarPrestamosPorPersona(prestamos: Prestamo[], busqueda: string): Prestamo[] {
  const q = busqueda.trim().toLowerCase();
  if (!q) return prestamos;
  return prestamos.filter((p) => p.persona.toLowerCase().includes(q));
}

export function BuscadorPrestamos({
  busqueda,
  onBuscarChange,
  prestamosFiltrados,
  movimientos,
}: {
  busqueda: string;
  onBuscarChange: (v: string) => void;
  prestamosFiltrados: Prestamo[];
  movimientos: Movimiento[];
}) {
  const inputId = useId();
  const activa = busqueda.trim() !== '';
  const teDeben = porCobrar(prestamosFiltrados, movimientos);
  const leDebes = porPagar(prestamosFiltrados, movimientos);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor={inputId} style={{ display: 'none' }}>
        Buscar préstamo por persona
      </label>
      <input
        id={inputId}
        value={busqueda}
        onChange={(e) => onBuscarChange(e.target.value)}
        placeholder="Buscar por persona…"
        autoComplete="off"
        style={inputStyle}
      />
      {activa && (
        <div style={{ fontSize: 12, color: 'var(--muted-fg)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>
            {prestamosFiltrados.length} préstamo{prestamosFiltrados.length !== 1 ? 's' : ''} con "{busqueda.trim()}"
          </span>
          {prestamosFiltrados.length > 0 && (teDeben > 0 || leDebes > 0) && (
            <span>
              {teDeben > 0 && <>Te deben S/ {formatearMonto(teDeben)}</>}
              {teDeben > 0 && leDebes > 0 && ' · '}
              {leDebes > 0 && <>Le debes S/ {formatearMonto(leDebes)}</>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
