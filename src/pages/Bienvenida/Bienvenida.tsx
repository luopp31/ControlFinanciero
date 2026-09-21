import { useEffect, useId, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useConfig } from '../../hooks/useConfig';
import { useCuentas } from '../../hooks/useCuentas';
import { getAll } from '../../lib/db';
import type { Cuenta } from '../../lib/finanzas';
import { formatearMonto } from '../../lib/formato';
import { sincronizarTodo } from '../../lib/sync';
import { IconPlus, IconWallet } from '../../components/icons';
import { CuentaForm } from '../../components/CuentaForm';
import { botonPrimario, botonSecundario, etiquetaStyle, inputStyle } from '../../components/formStyles';

type Paso = 'inicio' | 'login' | 'registro' | 'nombre' | 'cuenta';

export function Bienvenida({ onContinuar }: { onContinuar: () => void }) {
  const { configurado, iniciarSesion, registrarse } = useAuth();
  const { config, cargando: cargandoConfig, guardarNombre } = useConfig();
  const { cuentas, crearCuenta } = useCuentas();
  const nombreId = useId();
  const [agregandoCuenta, setAgregandoCuenta] = useState(false);
  // Si ya habías puesto tu nombre pero cerraste antes de agregar una cuenta,
  // retoma justo ahí en vez de preguntarte todo de nuevo.
  const [paso, setPaso] = useState<Paso>('inicio');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cargandoConfig && config.nombre) {
      setNombre(config.nombre);
      setPaso((p) => (p === 'inicio' ? 'cuenta' : p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoConfig, config.nombre]);

  function terminar() {
    onContinuar();
  }

  async function cuentasLocalesVacias(): Promise<boolean> {
    const todas = await getAll<Cuenta>('cuentas');
    return todas.filter((c) => !c.borrado).length === 0;
  }

  async function enviarLogin(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await iniciarSesion(email, password);
      // Puede ser una cuenta con datos ya sincronizados en otro dispositivo —
      // sincronizamos antes de decidir si hace falta pedir nombre/cuenta de nuevo.
      await sincronizarTodo();
      if (await cuentasLocalesVacias()) {
        setPaso('nombre');
      } else {
        terminar();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo continuar');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarRegistro(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await registrarse(email, password);
      // Cuenta recién creada: no puede tener datos remotos todavía.
      setPaso('nombre');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo continuar');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarNombre(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await guardarNombre(nombre.trim());
    setPaso('cuenta');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {(paso === 'inicio' || paso === 'login' || paso === 'registro') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                background: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 28px rgba(20,39,78,0.35)',
              }}
            >
              <IconWallet width={30} height={30} />
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Greedy</h1>
            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--muted-fg)', maxWidth: '30ch' }}>
              Tu plata, tus cuentas, tus deudas — todo en un solo lugar, claro y correcto.
            </p>
          </div>
        )}

        {paso === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {configurado && (
              <>
                <button type="button" onClick={() => setPaso('login')} style={botonPrimario(false)}>
                  Iniciar sesión
                </button>
                <button type="button" onClick={() => setPaso('registro')} style={botonSecundario}>
                  Crear cuenta
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setPaso('nombre')}
              style={{
                all: 'unset',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--muted-fg)',
                padding: '8px 0',
              }}
            >
              Continuar sin cuenta
            </button>
          </div>
        )}

        {(paso === 'login' || paso === 'registro') && (
          <form
            onSubmit={paso === 'registro' ? enviarRegistro : enviarLogin}
            className="glass-card"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>
              {paso === 'registro' ? 'Crear cuenta' : 'Iniciar sesión'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="bv-email" style={etiquetaStyle}>
                Correo
              </label>
              <input id="bv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="bv-pass" style={etiquetaStyle}>
                Contraseña
              </label>
              <input
                id="bv-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
            {error && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--destructive)' }}>{error}</p>}
            <button type="submit" disabled={enviando} style={botonPrimario(enviando)}>
              {enviando ? 'Un momento…' : paso === 'registro' ? 'Crear cuenta' : 'Entrar'}
            </button>
            <button type="button" onClick={() => setPaso('inicio')} style={botonSecundario}>
              Atrás
            </button>
          </form>
        )}

        {paso === 'nombre' && (
          <form onSubmit={enviarNombre} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>¿Cómo te llamamos?</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
                Así te saluda Greedy cada vez que abres la app.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={nombreId} style={etiquetaStyle}>
                Tu nombre
              </label>
              <input
                id={nombreId}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Luis"
                autoFocus
                style={inputStyle}
              />
            </div>
            <button type="submit" disabled={!nombre.trim()} style={botonPrimario(!nombre.trim())}>
              Continuar
            </button>
          </form>
        )}

        {paso === 'cuenta' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
                {cuentas.length === 0 ? `Una última cosa, ${nombre.split(' ')[0]}` : 'Tus cuentas'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
                {cuentas.length === 0
                  ? 'Agrega tu primera cuenta con el saldo real que tienes hoy — así tu panel ya arranca con algo real que mostrarte.'
                  : 'Puedes agregar más cuentas ahora, o continuar cuando quieras.'}
              </p>
            </div>

            {cuentas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cuentas.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 13px',
                      borderRadius: 12,
                      background: 'var(--muted)',
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{c.nombre}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted-fg)', fontVariantNumeric: 'tabular-nums' }}>
                      S/ {formatearMonto(c.saldoInicial)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {agregandoCuenta || cuentas.length === 0 ? (
              <CuentaForm
                onCrear={async (datos) => {
                  const r = await crearCuenta(datos);
                  setAgregandoCuenta(false);
                  return r;
                }}
                onCancelar={cuentas.length > 0 ? () => setAgregandoCuenta(false) : undefined}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAgregandoCuenta(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 16px',
                  borderRadius: 14,
                  border: '1px dashed var(--card-border)',
                  background: 'transparent',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <IconPlus width={16} height={16} />
                Agregar otra cuenta
              </button>
            )}

            {cuentas.length > 0 && (
              <button type="button" onClick={terminar} style={botonPrimario(false)}>
                Continuar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
