import { useId, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useConfig } from '../../hooks/useConfig';
import { useCuentas } from '../../hooks/useCuentas';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { borrarTodoLocal, type Tema } from '../../lib/db';
import { CATS, CATS_ING, colorCategoria, type Categoria, type Cuenta, type RolCuenta } from '../../lib/finanzas';
import { sincronizarTodo } from '../../lib/sync';
import { formatearMonto } from '../../lib/formato';
import { IconArrowUUpLeft, IconEye, IconEyeSlash } from '../../components/icons';
import { botonPrimario, botonSecundario, chipStyle, etiquetaStyle, inputStyle } from '../../components/formStyles';

type EstadoSync = 'inactivo' | 'sincronizando' | 'ok' | 'error';

const TEMAS: { id: Tema; nombre: string }[] = [
  { id: 'sistema', nombre: 'Sistema' },
  { id: 'claro', nombre: 'Claro' },
  { id: 'oscuro', nombre: 'Oscuro' },
];

const ROLES: { id: RolCuenta; etiqueta: string }[] = [
  { id: 'BILLETERA', etiqueta: 'Billetera' },
  { id: 'BOVEDA', etiqueta: 'Bóveda' },
];

export function Ajustes({ onVolver }: { onVolver: () => void }) {
  const isDesktop = useIsDesktop();
  const { configurado, session, cargando: cargandoAuth, iniciarSesion, registrarse, cerrarSesion } = useAuth();
  const { config, cargando: cargandoConfig, guardarNombre, alternarOcultarSaldos, guardarTema, guardarColorCategoria } = useConfig();
  const { cuentas, cargando: cargandoCuentas, actualizarCuenta, borrarCuenta } = useCuentas();

  if (cargandoAuth || cargandoConfig || cargandoCuentas) return null;

  return (
    <div style={{ maxWidth: isDesktop ? 640 : undefined, margin: isDesktop ? '0 auto' : undefined, padding: isDesktop ? '48px 32px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver" style={{ all: 'unset', cursor: 'pointer', display: 'flex', color: 'var(--muted-fg)' }}>
          <IconArrowUUpLeft width={20} height={20} />
        </button>
        <h1 style={{ fontSize: isDesktop ? 26 : 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Ajustes</h1>
      </div>

      <SeccionPerfil
        nombre={config.nombre}
        guardarNombre={guardarNombre}
        configurado={configurado}
        session={session}
        iniciarSesion={iniciarSesion}
        registrarse={registrarse}
        cerrarSesion={cerrarSesion}
      />

      {configurado && session && <SeccionSincronizacion />}

      <SeccionPreferencias
        ocultarSaldos={!!config.ocultarSaldos}
        onAlternarOcultarSaldos={alternarOcultarSaldos}
        tema={config.tema ?? 'sistema'}
        onCambiarTema={guardarTema}
        catColor={config.catColor}
        onCambiarColorCategoria={guardarColorCategoria}
      />

      <SeccionCuentas cuentas={cuentas} onActualizar={actualizarCuenta} onArchivar={borrarCuenta} />

      <SeccionDatos session={session} cerrarSesion={cerrarSesion} />
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {titulo}
      </p>
      {children}
    </div>
  );
}

function SeccionPerfil({
  nombre,
  guardarNombre,
  configurado,
  session,
  iniciarSesion,
  registrarse,
  cerrarSesion,
}: {
  nombre: string;
  guardarNombre: (n: string) => Promise<void>;
  configurado: boolean;
  session: { user: { email?: string } } | null;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  registrarse: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}) {
  const nombreId = useId();
  const [valorNombre, setValorNombre] = useState(nombre);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [modoRegistro, setModoRegistro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');

  async function guardar() {
    if (!valorNombre.trim() || valorNombre.trim() === nombre) return;
    setGuardandoNombre(true);
    try {
      await guardarNombre(valorNombre.trim());
    } finally {
      setGuardandoNombre(false);
    }
  }

  async function enviarLogin(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrorLogin('');
    try {
      if (modoRegistro) await registrarse(email, password);
      else await iniciarSesion(email, password);
      // Sincroniza apenas hay sesión, sin esperar a que toquen "Sincronizar
      // ahora" a mano — si no, lo que ya tenías en este dispositivo se queda
      // sin subir hasta que alguien se acuerde de tocar ese botón.
      const r = await sincronizarTodo();
      if (!r.ok) setErrorLogin(`Conectado, pero no se pudo sincronizar: ${r.error}`);
    } catch (err) {
      setErrorLogin(err instanceof Error ? err.message : 'No se pudo continuar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo="Perfil">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={nombreId} style={etiquetaStyle}>
          Tu nombre
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id={nombreId} value={valorNombre} onChange={(e) => setValorNombre(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button
            type="button"
            onClick={guardar}
            disabled={guardandoNombre || !valorNombre.trim() || valorNombre.trim() === nombre}
            style={botonPrimario(guardandoNombre || !valorNombre.trim() || valorNombre.trim() === nombre)}
          >
            Guardar
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 14 }}>
        {!configurado ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
            Sincronización no configurada — falta el archivo .env con tu URL y anon key de Supabase. Tus datos siguen
            guardándose en este dispositivo mientras tanto.
          </p>
        ) : session ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{session.user.email}</p>
            <button type="button" onClick={cerrarSesion} style={botonSecundario}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={enviarLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</p>
            <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
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
      </div>
    </Tarjeta>
  );
}

function SeccionSincronizacion() {
  const [estado, setEstado] = useState<EstadoSync>('inactivo');
  const [error, setError] = useState('');
  const [ultimaVez, setUltimaVez] = useState<string | null>(null);

  async function sincronizar() {
    setEstado('sincronizando');
    setError('');
    const r = await sincronizarTodo();
    if (r.ok) {
      setEstado('ok');
      setUltimaVez(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setEstado('error');
      setError(r.error);
    }
  }

  return (
    <Tarjeta titulo="Sincronización">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
        {estado === 'sincronizando' && 'Sincronizando…'}
        {estado === 'ok' && `Sincronizado${ultimaVez ? ' · ' + ultimaVez : ''}`}
        {estado === 'error' && `No se pudo sincronizar: ${error}`}
        {estado === 'inactivo' && 'Sin sincronizar todavía en esta pantalla.'}
      </p>
      <button type="button" onClick={sincronizar} disabled={estado === 'sincronizando'} style={botonPrimario(estado === 'sincronizando')}>
        Sincronizar ahora
      </button>
    </Tarjeta>
  );
}

function SeccionPreferencias({
  ocultarSaldos,
  onAlternarOcultarSaldos,
  tema,
  onCambiarTema,
  catColor,
  onCambiarColorCategoria,
}: {
  ocultarSaldos: boolean;
  onAlternarOcultarSaldos: () => Promise<void>;
  tema: Tema;
  onCambiarTema: (t: Tema) => Promise<void>;
  catColor: Record<string, string>;
  onCambiarColorCategoria: (id: string, color: string) => Promise<void>;
}) {
  return (
    <Tarjeta titulo="Preferencias">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Ocultar saldos</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-fg)' }}>Muestra •••• en vez de los montos.</p>
        </div>
        <button
          type="button"
          onClick={onAlternarOcultarSaldos}
          aria-pressed={ocultarSaldos}
          aria-label="Alternar ocultar saldos"
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: ocultarSaldos ? 'var(--primary-soft)' : 'var(--muted)',
            color: ocultarSaldos ? 'var(--primary)' : 'var(--muted-fg)',
            flex: '0 0 auto',
          }}
        >
          {ocultarSaldos ? <IconEyeSlash width={18} height={18} /> : <IconEye width={18} height={18} />}
        </button>
      </div>

      <div>
        <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700 }}>Tema</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {TEMAS.map((t) => (
            <button key={t.id} type="button" onClick={() => onCambiarTema(t.id)} aria-pressed={tema === t.id} style={chipStyle(tema === t.id)}>
              {t.nombre}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700 }}>Color de categorías</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...CATS, ...CATS_ING].map((c) => (
            <FilaColorCategoria key={c.id} categoria={c} color={colorCategoria(c, catColor)} onCambiar={(color) => onCambiarColorCategoria(c.id, color)} />
          ))}
        </div>
      </div>
    </Tarjeta>
  );
}

function FilaColorCategoria({ categoria, color, onCambiar }: { categoria: Categoria; color: string; onCambiar: (color: string) => void }) {
  const inputId = useId();
  return (
    <label htmlFor={inputId} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{categoria.nombre}</span>
      <input
        id={inputId}
        type="color"
        value={color}
        onChange={(e) => onCambiar(e.target.value)}
        style={{ width: 30, height: 30, padding: 0, border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer' }}
      />
    </label>
  );
}

function SeccionCuentas({
  cuentas,
  onActualizar,
  onArchivar,
}: {
  cuentas: Cuenta[];
  onActualizar: (id: string, cambios: Partial<Omit<Cuenta, 'id'>>) => Promise<void>;
  onArchivar: (id: string) => Promise<void>;
}) {
  return (
    <Tarjeta titulo="Cuentas">
      {cuentas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>Todavía no tienes cuentas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cuentas.map((c) => (
            <FilaCuenta key={c.id} cuenta={c} onActualizar={onActualizar} onArchivar={onArchivar} />
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

function FilaCuenta({
  cuenta,
  onActualizar,
  onArchivar,
}: {
  cuenta: Cuenta;
  onActualizar: (id: string, cambios: Partial<Omit<Cuenta, 'id'>>) => Promise<void>;
  onArchivar: (id: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [rol, setRol] = useState(cuenta.rol);
  const [saldo, setSaldo] = useState(String(cuenta.saldoInicial));
  const [guardando, setGuardando] = useState(false);
  const [confirmandoArchivar, setConfirmandoArchivar] = useState(false);

  const saldoValido = saldo.trim() !== '' && !Number.isNaN(Number(saldo));

  async function guardar() {
    if (!nombre.trim() || !saldoValido) return;
    setGuardando(true);
    try {
      await onActualizar(cuenta.id, { nombre: nombre.trim(), rol, saldoInicial: Number(saldo) });
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function cancelar() {
    setNombre(cuenta.nombre);
    setRol(cuenta.rol);
    setSaldo(String(cuenta.saldoInicial));
    setEditando(false);
  }

  async function archivar() {
    if (!confirmandoArchivar) {
      setConfirmandoArchivar(true);
      return;
    }
    await onArchivar(cuenta.id);
  }

  if (!editando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--muted)' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cuenta.nombre}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted-fg)' }}>
            {cuenta.rol === 'BOVEDA' ? 'Bóveda' : 'Billetera'} · S/ {formatearMonto(cuenta.saldoInicial)}
          </p>
        </div>
        <button type="button" onClick={() => setEditando(true)} style={{ ...botonSecundario, padding: '8px 14px', fontSize: 12.5, flex: '0 0 auto' }}>
          Editar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 12, background: 'var(--muted)' }}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
      <div style={{ display: 'flex', gap: 8 }}>
        {ROLES.map((r) => (
          <button key={r.id} type="button" onClick={() => setRol(r.id)} aria-pressed={rol === r.id} style={chipStyle(rol === r.id)}>
            {r.etiqueta}
          </button>
        ))}
      </div>
      <input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={archivar}
          style={{
            padding: '9px 12px',
            borderRadius: 10,
            border: `1px solid ${confirmandoArchivar ? 'var(--destructive)' : 'var(--card-border)'}`,
            background: confirmandoArchivar ? 'var(--destructive-soft)' : 'transparent',
            color: confirmandoArchivar ? 'var(--destructive)' : 'var(--muted-fg)',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {confirmandoArchivar ? 'Sí, archivar' : 'Archivar'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={cancelar} style={{ ...botonSecundario, padding: '9px 14px', fontSize: 12.5 }}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !nombre.trim() || !saldoValido} style={{ ...botonPrimario(guardando || !nombre.trim() || !saldoValido), padding: '9px 14px', fontSize: 12.5 }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function SeccionDatos({ session, cerrarSesion }: { session: unknown; cerrarSesion: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function reiniciar() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setBorrando(true);
    if (session) await cerrarSesion();
    await borrarTodoLocal();
    window.location.reload();
  }

  return (
    <Tarjeta titulo="Datos">
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-fg)' }}>
        {confirmando
          ? 'Se borra todo lo guardado en este dispositivo (cuentas, movimientos, préstamos, compromisos) — no se puede deshacer.'
          : 'Para ver la bienvenida de nuevo o probar con otra cuenta desde cero.'}
      </p>
      <button
        type="button"
        onClick={reiniciar}
        disabled={borrando}
        style={{
          padding: '11px 16px',
          borderRadius: 12,
          border: `1px solid ${confirmando ? 'var(--destructive)' : 'var(--card-border)'}`,
          background: confirmando ? 'var(--destructive-soft)' : 'transparent',
          color: confirmando ? 'var(--destructive)' : 'var(--muted-fg)',
          fontWeight: 700,
          fontSize: 13.5,
          cursor: borrando ? 'not-allowed' : 'pointer',
        }}
      >
        {borrando ? 'Borrando…' : confirmando ? 'Sí, borrar y empezar de nuevo' : 'Empezar de nuevo'}
      </button>
    </Tarjeta>
  );
}
