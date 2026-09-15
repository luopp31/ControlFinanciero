import type { ReactNode } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { IconHandshake, IconHouse, IconReceipt, IconWallet } from './icons';
import { SyncPanel } from './SyncPanel';
import { RegistroRapido } from './RegistroRapido';

export type Vista = 'panel' | 'cuentas' | 'movimientos' | 'compromisos';

const ITEMS: { id: Vista; nombre: string; Icono: typeof IconWallet }[] = [
  { id: 'panel', nombre: 'Panel', Icono: IconHouse },
  { id: 'cuentas', nombre: 'Cuentas', Icono: IconWallet },
  { id: 'movimientos', nombre: 'Movimientos', Icono: IconReceipt },
  { id: 'compromisos', nombre: 'Compromisos', Icono: IconHandshake },
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
            gap: 14,
            paddingTop: 20,
          }}
        >
          {ITEMS.map(({ id, nombre, Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => onCambiarVista(id)}
              aria-pressed={vista === id}
              aria-label={nombre}
              title={nombre}
              style={{
                all: 'unset',
                cursor: 'pointer',
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: vista === id ? 'var(--primary-soft)' : 'transparent',
                color: vista === id ? 'var(--primary)' : 'var(--muted-fg)',
                border: vista === id ? '1px solid var(--primary)' : '1px solid transparent',
              }}
            >
              <Icono width={20} height={20} />
            </button>
          ))}
          <div style={{ marginTop: 'auto', paddingBottom: 12 }}>
            <SyncPanel />
          </div>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        <RegistroRapido />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 40 }}>
        <SyncPanel />
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '10px 8px calc(10px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--card-border)',
          background: 'var(--muted)',
          position: 'sticky',
          bottom: 0,
        }}
      >
        {ITEMS.map(({ id, nombre, Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => onCambiarVista(id)}
            aria-pressed={vista === id}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '4px 14px',
              color: vista === id ? 'var(--primary)' : 'var(--muted-fg)',
            }}
          >
            <Icono width={20} height={20} />
            <span style={{ fontSize: 10.5, fontWeight: 700 }}>{nombre}</span>
          </button>
        ))}
      </nav>
      <RegistroRapido />
    </div>
  );
}
