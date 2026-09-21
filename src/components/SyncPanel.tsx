import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sincronizarTodo } from '../lib/sync';
import { IconCloudArrowUp, IconCloudCheck, IconCloudSlash } from './icons';

type EstadoSync = 'inactivo' | 'sincronizando' | 'ok' | 'error';

export function SyncPanel({
  mostrarEtiqueta = true,
  onAbrirAjustes,
}: {
  mostrarEtiqueta?: boolean;
  onAbrirAjustes: () => void;
}) {
  const { configurado, session, cargando } = useAuth();
  const [estadoSync, setEstadoSync] = useState<EstadoSync>('inactivo');

  async function sincronizar() {
    setEstadoSync('sincronizando');
    const r = await sincronizarTodo();
    setEstadoSync(r.ok ? 'ok' : 'error');
  }

  useEffect(() => {
    if (session) sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const intervalo = setInterval(sincronizar, 5 * 60 * 1000);
    const alVolver = () => {
      if (!document.hidden) sincronizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (cargando) return null;

  const Icono = !configurado ? IconCloudSlash : estadoSync === 'sincronizando' ? IconCloudArrowUp : IconCloudCheck;

  return (
    <button
      type="button"
      onClick={onAbrirAjustes}
      aria-label="Ajustes"
      title="Cuenta, sincronización y ajustes"
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: mostrarEtiqueta ? '8px 12px 8px 10px' : '8px',
        borderRadius: 999,
        color: session && estadoSync === 'ok' ? 'var(--accent)' : 'var(--muted-fg)',
      }}
    >
      <Icono width={17} height={17} />
      {mostrarEtiqueta && <span style={{ fontSize: 12.5, fontWeight: 700 }}>Cuenta</span>}
    </button>
  );
}
