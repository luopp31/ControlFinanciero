import type { CSSProperties, ReactNode, SVGProps } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { IconNavAnalisis, IconNavCuentas, IconNavHoy, IconNavLibro } from './icons';
import { SyncPanel } from './SyncPanel';
import { RegistroRapido } from './RegistroRapido';

export type Vista = 'panel' | 'movimientos' | 'cuentas' | 'compromisos' | 'estadisticas' | 'ajustes' | 'conciliar' | 'bandeja';

type IconComp = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

// Isla flotante solo con íconos. El hueco del medio es del "+" (lo dibuja RegistroRapido, que lleva el teclado de iOS).
const ITEMS: ({ id: Vista; nombre: string; Icono: IconComp } | null)[] = [
  { id: 'panel', nombre: 'Hoy', Icono: IconNavHoy },
  { id: 'movimientos', nombre: 'Libro', Icono: IconNavLibro },
  null,
  { id: 'estadisticas', nombre: 'Análisis', Icono: IconNavAnalisis },
  { id: 'cuentas', nombre: 'Cuentas', Icono: IconNavCuentas },
];

/** Qué ícono de la isla se ilumina según la pantalla (Compromisos y Conciliar viven dentro de Cuentas; la bandeja, dentro de Hoy). */
function activoDe(vista: Vista): Vista | null {
  if (vista === 'bandeja') return 'panel';
  if (vista === 'compromisos' || vista === 'conciliar') return 'cuentas';
  if (vista === 'ajustes') return null;
  return vista;
}

export function AppShell({
  vista,
  onCambiarVista,
  children,
}: {
  vista: Vista;
  onCambiarVista: (v: Vista) => void;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const activa = activoDe(vista);

  const islaStyle: CSSProperties = isDesktop
    ? { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', width: 360, height: 60, borderRadius: 30 }
    : { position: 'fixed', left: 20, right: 20, bottom: 'calc(18px + env(safe-area-inset-bottom))', height: 68, borderRadius: 34 };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Degradado "amanecer" para el ícono activo (sigue el tema). */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="amanecer-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--am1)' }} />
            <stop offset="0.4" style={{ stopColor: 'var(--am2)' }} />
            <stop offset="0.72" style={{ stopColor: 'var(--am3)' }} />
            <stop offset="1" style={{ stopColor: 'var(--am4)' }} />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ position: 'fixed', top: 'calc(10px + env(safe-area-inset-top))', right: isDesktop ? 24 : 8, zIndex: 40 }}>
        <SyncPanel mostrarEtiqueta={false} onAbrirAjustes={() => onCambiarVista('ajustes')} />
      </div>

      <div style={{ paddingBottom: isDesktop ? 56 : 'calc(120px + env(safe-area-inset-bottom))' }}>{children}</div>

      <nav
        aria-label="Navegación principal"
        style={{
          ...islaStyle,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
          padding: '0 8px',
          background: 'var(--nav-glass)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.3), 0 0 0 1px var(--card-border)',
          zIndex: 30,
        }}
      >
        {ITEMS.map((item, i) => {
          if (!item) return <span key={`hueco-${i}`} aria-hidden="true" />;
          const activo = activa === item.id;
          const { Icono } = item;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCambiarVista(item.id)}
              aria-label={item.nombre}
              aria-current={activo ? 'page' : undefined}
              title={item.nombre}
              style={{
                all: 'unset',
                cursor: 'pointer',
                height: 56,
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
                color: activo ? 'var(--fg)' : 'var(--muted-fg)',
              }}
            >
              <Icono width={27} height={27} style={activo ? { stroke: 'url(#amanecer-grad)' } : undefined} />
              {activo && <span style={{ position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: '50%', background: 'var(--amanecer)' }} />}
            </button>
          );
        })}
      </nav>

      <RegistroRapido />
    </div>
  );
}
