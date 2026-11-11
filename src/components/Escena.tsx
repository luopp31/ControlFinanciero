import type { CSSProperties, ReactNode } from 'react';
import { formatearMonto } from '../lib/formato';
import { kickStyle } from './escenaEstilos';

/** Cabecera de cada pantalla: color que se funde al fondo, migas ("Hoy / Libro") y, abajo, lo que cada pantalla ponga. */
export function Escena({
  color,
  migas,
  izquierda,
  derecha,
  children,
}: {
  color: string;
  migas?: [string, string];
  /** Reemplaza las migas (el Panel pone aquí el logo). */
  izquierda?: ReactNode;
  derecha?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="escena" style={{ '--scene': color } as CSSProperties}>
      <div className="escena-in">
        {/* El hueco a la derecha es para el ícono de cuenta, que va fijo arriba. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingRight: 44 }}>
          {izquierda ?? (
            <span style={kickStyle}>
              {migas?.[0]} / <b style={{ color: 'var(--fg)', fontWeight: 600 }}>{migas?.[1]}</b>
            </span>
          )}
          {derecha}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Número grande con los decimales más chicos y apagados ("S/ 20,717" + ".50"). */
export function MontoGrande({ valor, oculto = false, tamano = 64, signo = '', color }: { valor: number; oculto?: boolean; tamano?: number; signo?: string; color?: string }) {
  const [entero, decimales] = formatearMonto(Math.abs(valor)).split('.');
  return (
    <div
      style={{
        fontSize: tamano,
        lineHeight: 0.98,
        letterSpacing: '-0.055em',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        marginTop: 6,
        color,
      }}
    >
      {signo}S/ {oculto ? '••••••' : entero}
      {!oculto && <span style={{ fontSize: tamano * 0.44, opacity: 0.6, letterSpacing: '-0.02em' }}>.{decimales}</span>}
    </div>
  );
}
