import { IconReceipt } from './icons';
import { botonPrimario } from './formStyles';

/**
 * Aviso en el Panel: gastos que llegaron solos y esperan clasificarse. Solo cuenta los pendientes: los correos que
 * todavía no se saben leer (sin_leer) no entran en el contador ni hacen aparecer esta tarjeta. No se muestra si no hay nada.
 */
export function TarjetaBandeja({ pendientes, onAbrir }: { pendientes: number; onAbrir: () => void }) {
  if (pendientes === 0) return null;
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'var(--primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconReceipt width={20} height={20} style={{ color: 'var(--primary)' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
          {pendientes} gasto{pendientes === 1 ? '' : 's'} por clasificar
        </p>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>Llegaron solos por el correo de Interbank o por Wallet.</p>
      <button type="button" onClick={onAbrir} style={{ ...botonPrimario(false), width: '100%' }}>
        Revisar
      </button>
    </div>
  );
}
