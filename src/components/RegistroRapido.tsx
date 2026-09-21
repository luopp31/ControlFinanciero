import { useRef, useState } from 'react';
import { useCuentas } from '../hooks/useCuentas';
import { useMovimientos } from '../hooks/useMovimientos';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { MovimientoForm } from './MovimientoForm';
import { IconPlus, IconX } from './icons';

const UMBRAL_CIERRE_PX = 90;

export function RegistroRapido() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando } = useCuentas();
  const { crearMovimiento } = useMovimientos();
  const [abierto, setAbierto] = useState(false);
  const [arrastreY, setArrastreY] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const inicioY = useRef(0);

  if (cargando || cuentas.length === 0) return null;

  function cerrar() {
    // Igual que en onPointerDown: quitamos el foco ANTES de que la hoja se
    // mueva (por arrastre, por el botón X o por el fondo) — si el teclado
    // sigue abierto mientras la hoja anima con `transform`, el cursor/selección
    // nativo de iOS (una capa aparte, no parte del layout) se queda atrás y
    // luego "salta" a su posición real cuando la hoja termina de moverse.
    (document.activeElement as HTMLElement | null)?.blur();
    setAbierto(false);
    setArrastreY(0);
  }

  function onPointerDown(e: React.PointerEvent) {
    (document.activeElement as HTMLElement | null)?.blur();
    inicioY.current = e.clientY;
    setArrastrando(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arrastrando) return;
    const delta = e.clientY - inicioY.current;
    if (delta > 0) setArrastreY(delta);
  }

  function onPointerUp() {
    if (!arrastrando) return;
    setArrastrando(false);
    if (arrastreY > UMBRAL_CIERRE_PX) {
      cerrar();
    } else {
      setArrastreY(0);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Registrar movimiento"
        style={{
          all: 'unset',
          cursor: 'pointer',
          position: 'fixed',
          right: isDesktop ? 24 : 16,
          bottom: isDesktop ? 24 : 'calc(92px + env(safe-area-inset-bottom))',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#FFC107',
          color: '#14274E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(255,193,7,0.4)',
          zIndex: 50,
        }}
      >
        <IconPlus width={26} height={26} />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar movimiento"
          onClick={cerrar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
            animation: arrastrando ? 'none' : 'greedy-hoja-fondo 0.22s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              maxWidth: 480,
              margin: '0 auto',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--card)',
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              transform: `translateY(${arrastreY}px)`,
              transition: arrastrando ? 'none' : 'transform 0.25s ease',
              animation: arrastrando ? 'none' : 'greedy-hoja-subir 0.28s cubic-bezier(.2,.9,.3,1)',
            }}
          >
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px 0 4px',
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              <span style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--card-border)' }} />
            </div>

            <div style={{ padding: '2px 20px 6px' }}>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--muted)',
                  color: 'var(--fg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconX width={16} height={16} />
              </button>
            </div>

            <div style={{ padding: '0 20px 24px', overflowY: 'auto' }}>
              <MovimientoForm
                cuentas={cuentas}
                onCrear={async (datos) => {
                  const r = await crearMovimiento(datos);
                  cerrar();
                  return r;
                }}
                onCancelar={cerrar}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
