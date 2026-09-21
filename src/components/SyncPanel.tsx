import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { borrarTodoLocal } from '../lib/db';
import { sincronizarTodo } from '../lib/sync';
import { IconCloudArrowUp, IconCloudCheck, IconCloudSlash } from './icons';
import { botonPrimario, botonSecundario, etiquetaStyle, inputStyle } from './formStyles';

type EstadoSync = 'inactivo' | 'sincronizando' | 'ok' | 'error';

export function SyncPanel({ mostrarEtiqueta = true }: { mostrarEtiqueta?: boolean }) {
  const { configurado, session, cargando, iniciarSesion, registrarse, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [modoRegistro, setModoRegistro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');
  const [estadoSync, setEstadoSync] = useState<EstadoSync>('inactivo');
  const [errorSync, setErrorSync] = useState('');
  const [ultimaVez, setUltimaVez] = useState<string | null>(null);
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);

  async function reiniciarLocal() {
    if (!confirmandoReinicio) {
      setConfirmandoReinicio(true);
      return;
    }
    setReiniciando(true);
    if (session) await cerrarSesion();
    await borrarTodoLocal();
    window.location.reload();
  }

  async function sincronizar() {
    setEstadoSync('sincronizando');
    setErrorSync('');
    const r = await sincronizarTodo();
    if (r.ok) {
      setEstadoSync('ok');
      setUltimaVez(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setEstadoSync('error');
      setErrorSync(r.error);
    }
  }

  useEffect(() => {
    if (!abierto) setConfirmandoReinicio(false);
  }, [abierto]);

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

  async function enviarLogin(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrorLogin('');
    try {
      if (modoRegistro) await registrarse(email, password);
      else await iniciarSesion(email, password);
      setAbierto(false);
    } catch (err) {
      setErrorLogin(err instanceof Error ? err.message : 'No se pudo continuar');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return null;

  const Icono = !configurado ? IconCloudSlash : estadoSync === 'sincronizando' ? IconCloudArrowUp : IconCloudCheck;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Cuenta y sesión"
        title="Cuenta, sincronización y cerrar sesión"
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

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {!configurado ? (
              <>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>Sincronización no configurada</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
                  Falta el archivo .env con tu URL y anon key de Supabase. Tus datos siguen guardándose en este
                  dispositivo mientras tanto.
                </p>
              </>
            ) : session ? (
              <>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{session.user.email}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
                  {estadoSync === 'sincronizando' && 'Sincronizando…'}
                  {estadoSync === 'ok' && `Sincronizado${ultimaVez ? ' · ' + ultimaVez : ''}`}
                  {estadoSync === 'error' && `No se pudo sincronizar: ${errorSync}`}
                  {estadoSync === 'inactivo' && 'Sin sincronizar todavía'}
                </p>
                <button type="button" onClick={sincronizar} disabled={estadoSync === 'sincronizando'} style={botonPrimario(estadoSync === 'sincronizando')}>
                  Sincronizar ahora
                </button>
                <button type="button" onClick={cerrarSesion} style={botonSecundario}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <form onSubmit={enviarLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>
                  {modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="sp-email" style={etiquetaStyle}>
                    Correo
                  </label>
                  <input
                    id="sp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="sp-pass" style={etiquetaStyle}>
                    Contraseña
                  </label>
                  <input
                    id="sp-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                {errorLogin && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--destructive)' }}>{errorLogin}</p>}
                <button type="submit" disabled={enviando} style={botonPrimario(enviando)}>
                  {modoRegistro ? 'Crear cuenta' : 'Entrar'}
                </button>
                <button
                  type="button"
                  onClick={() => setModoRegistro((v) => !v)}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', textAlign: 'center' }}
                >
                  {modoRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                </button>
              </form>
            )}

            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-fg)' }}>
                {confirmandoReinicio
                  ? 'Se borra todo lo guardado en este dispositivo (cuentas, movimientos, préstamos, compromisos) — no se puede deshacer.'
                  : 'Para ver la bienvenida de nuevo o probar con otra cuenta desde cero.'}
              </p>
              <button
                type="button"
                onClick={reiniciarLocal}
                disabled={reiniciando}
                style={{
                  padding: '11px 16px',
                  borderRadius: 12,
                  border: `1px solid ${confirmandoReinicio ? 'var(--destructive)' : 'var(--card-border)'}`,
                  background: confirmandoReinicio ? 'var(--destructive-soft)' : 'transparent',
                  color: confirmandoReinicio ? 'var(--destructive)' : 'var(--muted-fg)',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: reiniciando ? 'not-allowed' : 'pointer',
                }}
              >
                {reiniciando ? 'Borrando…' : confirmandoReinicio ? 'Sí, borrar y empezar de nuevo' : 'Empezar de nuevo'}
              </button>
            </div>

            <button type="button" onClick={() => setAbierto(false)} style={botonSecundario}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
