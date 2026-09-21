import type { ReactNode, SVGProps } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import {
  IconChartBar,
  IconChartBarFill,
  IconHandshake,
  IconHandshakeFill,
  IconHouse,
  IconHouseFill,
  IconReceipt,
  IconReceiptFill,
  IconWallet,
  IconWalletFill,
} from './icons';
import { SyncPanel } from './SyncPanel';
import { RegistroRapido } from './RegistroRapido';

export type Vista = 'panel' | 'movimientos' | 'cuentas' | 'compromisos' | 'estadisticas';

type IconComp = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

// Orden por frecuencia de uso real: Panel y Movimientos son lo que más se toca.
// Referencia real de Instagram (captura del usuario): barra flotante en forma de
// píldora, no pegada a los bordes, con la pestaña activa resaltada por un fondo
// propio además de pasar de ícono de contorno a relleno.
const ITEMS: { id: Vista; nombre: string; Outline: IconComp; Fill: IconComp }[] = [
  { id: 'panel', nombre: 'Panel', Outline: IconHouse, Fill: IconHouseFill },
  { id: 'movimientos', nombre: 'Movimientos', Outline: IconReceipt, Fill: IconReceiptFill },
  { id: 'cuentas', nombre: 'Cuentas', Outline: IconWallet, Fill: IconWalletFill },
  { id: 'estadisticas', nombre: 'Estadísticas', Outline: IconChartBar, Fill: IconChartBarFill },
  { id: 'compromisos', nombre: 'Compromisos', Outline: IconHandshake, Fill: IconHandshakeFill },
];

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

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <nav
          style={{
            width: 76,
            flex: '0 0 auto',
            background: 'var(--muted)',
            borderRight: '1px solid var(--card-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            paddingTop: 24,
          }}
        >
          {ITEMS.map(({ id, nombre, Outline, Fill }) => {
            const activo = vista === id;
            const Icono = activo ? Fill : Outline;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCambiarVista(id)}
                aria-pressed={activo}
                aria-label={nombre}
                title={nombre}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activo ? 'var(--primary)' : 'var(--muted-fg)',
                  transition: 'color .15s ease, transform .15s ease',
                  transform: activo ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <Icono width={24} height={24} />
              </button>
            );
          })}
          <div style={{ marginTop: 'auto', paddingBottom: 12 }}>
            <SyncPanel mostrarEtiqueta={false} />
          </div>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {vista !== 'movimientos' && <RegistroRapido />}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          position: 'fixed',
          top: 'calc(14px + env(safe-area-inset-top))',
          right: 14,
          zIndex: 40,
          background: 'var(--muted)',
          borderRadius: 999,
          boxShadow: 'var(--shadow)',
        }}
      >
        <SyncPanel />
      </div>
      <div style={{ flex: 1, paddingTop: 'calc(24px + env(safe-area-inset-top))', paddingBottom: 92 }}>{children}</div>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          gap: 4,
          padding: '8px 14px',
          margin: '0 16px calc(16px + env(safe-area-inset-bottom))',
          borderRadius: 999,
          background: 'var(--nav-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow)',
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
        }}
      >
        {ITEMS.map(({ id, nombre, Outline, Fill }) => {
          const activo = vista === id;
          const Icono = activo ? Fill : Outline;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onCambiarVista(id)}
              aria-pressed={activo}
              aria-label={nombre}
              title={nombre}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: activo ? 52 : 44,
                height: 44,
                borderRadius: 999,
                background: activo ? 'var(--primary-soft)' : 'transparent',
                color: activo ? 'var(--primary)' : 'var(--muted-fg)',
                transition: 'background .18s ease, color .18s ease, width .18s ease',
              }}
            >
              <Icono width={24} height={24} />
            </button>
          );
        })}
      </nav>
      {vista !== 'movimientos' && <RegistroRapido />}
    </div>
  );
}
