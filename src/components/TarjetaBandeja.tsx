import { IconCaretRight } from './icons';

/**
 * Tarjeta pequeña del Hoy: gastos que llegaron solos y esperan clasificarse. Solo cuenta los pendientes: los correos que
 * todavía no se saben leer (sin_leer) no entran en el contador ni hacen aparecer esta tarjeta. No se muestra si no hay nada.
 */
export function TarjetaBandeja({ pendientes, onAbrir }: { pendientes: number; onAbrir: () => void }) {
  if (pendientes === 0) return null;
  return (
    <div className="mini">
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted-fg)' }}>Por clasificar</div>
      <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, marginTop: 4 }}>{pendientes}</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted-fg)' }}>Llegaron solos</div>
      <button type="button" onClick={onAbrir} className="pildora amarilla chica" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
        Revisar <IconCaretRight width={14} height={14} />
      </button>
    </div>
  );
}
