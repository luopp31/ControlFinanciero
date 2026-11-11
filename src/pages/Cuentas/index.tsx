import { useState } from 'react';
import { CuentaFila } from '../../components/CuentaFila';
import { CuentaForm } from '../../components/CuentaForm';
import { Escena, MontoGrande } from '../../components/Escena';
import { ESCENA, kickStyle, seccionTituloStyle, subEscenaStyle, tituloEscenaStyle } from '../../components/escenaEstilos';
import { IconBank, IconPlus } from '../../components/icons';
import { useConfig } from '../../hooks/useConfig';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { saldoTotal } from '../../lib/finanzas';
import { Compromisos } from '../Compromisos';

/** Cuentas: el total arriba (la suma de todas), cada cuenta como fila, conciliar con el banco, y debajo deudas y pagos fijos. */
export function Cuentas({ onAbrirConciliar }: { onAbrirConciliar: () => void }) {
  const { cuentas, cargando, crearCuenta } = useCuentas();
  const { movimientos } = useMovimientos();
  const { config } = useConfig();
  const [mostrarForm, setMostrarForm] = useState(false);

  if (cargando) return null;

  const vacio = cuentas.length === 0;
  const oculto = !!config.ocultarSaldos;
  const total = saldoTotal(cuentas, movimientos);

  return (
    <div>
      <Escena
        color={ESCENA.cuentas}
        migas={['Hoy', 'Cuentas']}
        derecha={
          !vacio && (
            <button type="button" onClick={() => setMostrarForm((v) => !v)} aria-label="Agregar cuenta" style={{ all: 'unset', cursor: 'pointer', width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--fg)' }}>
              <IconPlus width={22} height={22} />
            </button>
          )
        }
      >
        {vacio ? (
          <>
            <h1 style={tituloEscenaStyle}>Empecemos con tus cuentas</h1>
            <p style={subEscenaStyle}>Pon el saldo real que tienes hoy. No hace falta reconstruir historial pasado.</p>
          </>
        ) : (
          <>
            <div style={{ ...kickStyle, marginTop: 30 }}>Total en cuentas</div>
            <MontoGrande valor={total} oculto={oculto} signo={total < 0 ? '−' : ''} />
            <p style={subEscenaStyle}>{cuentas.map((c) => c.nombre).join(' + ')}</p>
          </>
        )}
      </Escena>

      <div className="pagina pagina-pad">
        {!vacio && (
          <div style={{ paddingTop: 6 }}>
            {cuentas.map((c) => (
              <CuentaFila key={c.id} cuenta={c} movimientos={movimientos} oculto={oculto} conCaption />
            ))}
            <button type="button" onClick={onAbrirConciliar} className="pildora borde chica" style={{ marginTop: 10 }}>
              <IconBank width={18} height={18} />
              Conciliar con el banco
            </button>
          </div>
        )}

        {(vacio || mostrarForm) && (
          <div className="glass-card" style={{ marginTop: 20 }}>
            <CuentaForm
              onCrear={async (datos) => {
                const r = await crearCuenta(datos);
                setMostrarForm(false);
                return r;
              }}
              onCancelar={vacio ? undefined : () => setMostrarForm(false)}
            />
          </div>
        )}

        {!vacio && (
          <section style={{ paddingTop: 34 }}>
            <h3 style={{ ...seccionTituloStyle, marginBottom: 6 }}>Deudas y pagos fijos</h3>
            <Compromisos embebido />
          </section>
        )}
      </div>
    </div>
  );
}
