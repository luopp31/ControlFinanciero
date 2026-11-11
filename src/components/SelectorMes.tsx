import { IconCaretRight } from './icons';
import { formatearMesLargo } from '../lib/formato';

export function SelectorMes({
  mes,
  onCambiar,
  deshabilitarSiguiente,
}: {
  mes: string;
  onCambiar: (delta: number) => void;
  deshabilitarSiguiente: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
      <button
        type="button"
        onClick={() => onCambiar(-1)}
        aria-label="Mes anterior"
        style={botonFlechaStyle}
      >
        <IconCaretRight width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', minWidth: '14ch', textAlign: 'center' }}>
        {formatearMesLargo(mes)}
      </p>
      <button
        type="button"
        onClick={() => onCambiar(1)}
        disabled={deshabilitarSiguiente}
        aria-label="Mes siguiente"
        style={{ ...botonFlechaStyle, opacity: deshabilitarSiguiente ? 0.35 : 1, cursor: deshabilitarSiguiente ? 'default' : 'pointer' }}
      >
        <IconCaretRight width={16} height={16} />
      </button>
    </div>
  );
}

const botonFlechaStyle: React.CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  width: 44,
  height: 44,
  borderRadius: 999,
  background: 'var(--muted)',
  color: 'var(--fg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};
