import { IconReceipt } from './icons';
import { botonPrimario } from './formStyles';

/** Aviso en el Panel: gastos que llegaron solos y esperan clasificarse. No se muestra si no hay nada. */
export function TarjetaBandeja({ pendientes, sinLeer, onAbrir }: { pendientes: number; sinLeer: number; onAbrir: () => void }) {
  if (pendientes + sinLeer === 0) return null;
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'var(--primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconReceipt width={20} height={20} style={{ color: 'var(--primary)' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
          {pendientes > 0 ? `${pendientes} gasto${pendientes === 1 ? '' : 's'} por clasificar` : 'Correos que no pude leer'}
        </p>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
        {pendientes > 0 ? 'Llegaron solos por el correo de Interbank o por Wallet.' : 'Revisa el formato para que los aprenda.'}
        {pendientes > 0 && sinLeer > 0 ? ` Además, ${sinLeer} correo${sinLeer === 1 ? '' : 's'} que no pude leer.` : ''}
      </p>
      <button type="button" onClick={onAbrir} style={{ ...botonPrimario(false), width: '100%' }}>
        Revisar
      </button>
    </div>
  );
}
