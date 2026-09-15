import type { Compromiso } from '../lib/db';
import { proximoCobroISO } from '../lib/fecha';
import { formatearMonto } from '../lib/formato';
import { iconoDeMarca } from './marcas';
import { IconArrowsClockwise } from './icons';

function formatearFechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(dia)} ${meses[Number(mes) - 1]}`;
}

export function SuscripcionCard({
  suscripcion,
  onBorrar,
}: {
  suscripcion: Compromiso;
  onBorrar: (id: string) => void;
}) {
  const marca = iconoDeMarca(suscripcion.nombre);
  const Icono = marca?.Icono ?? IconArrowsClockwise;
  const proximo = suscripcion.diaCobro ? proximoCobroISO(suscripcion.diaCobro) : null;

  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
  );
}
