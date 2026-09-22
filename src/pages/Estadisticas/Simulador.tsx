import { useMemo, useState } from 'react';
import { GraficoSimulacion } from '../../components/GraficoSimulacion';
import { botonSecundario, etiquetaStyle, inputStyle } from '../../components/formStyles';
import { IconPlus, IconX } from '../../components/icons';
import { hoyISO } from '../../lib/fecha';
import { formatearMonto } from '../../lib/formato';
import { simular, type IngresoExtra } from '../../lib/simulacion';

interface ExtraForm {
  id: string;
  monto: string;
  fecha: string;
}

export function Simulador({ valorNetoActual, promedioSugerido }: { valorNetoActual: number; promedioSugerido: number }) {
  const [gastoMensual, setGastoMensual] = useState(promedioSugerido > 0 ? String(Math.round(promedioSugerido)) : '');
  const [extras, setExtras] = useState<ExtraForm[]>([]);

  const resultado = useMemo(() => {
    const gastoNum = Number(gastoMensual) || 0;
    const extrasValidos: IngresoExtra[] = extras
      .filter((e) => Number(e.monto) > 0 && e.fecha)
      .map((e) => ({ monto: Number(e.monto), fecha: e.fecha }));
    return simular(valorNetoActual, gastoNum, extrasValidos);
  }, [valorNetoActual, gastoMensual, extras]);

  function agregarExtra() {
    setExtras((prev) => [...prev, { id: crypto.randomUUID(), monto: '', fecha: hoyISO() }]);
  }

  function quitarExtra(id: string) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  function cambiarExtra(id: string, cambios: Partial<Pick<ExtraForm, 'monto' | 'fecha'>>) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)));
  }

  const finalNegativo = resultado.valorFinal < 0;
  const mesFinNombre = resultado.puntos[resultado.puntos.length - 1]?.mes;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)' }}>
        Si desde hoy dejás de generar ingreso regular y solo salen tus gastos típicos, ¿con cuánto quedarías al 31 de diciembre?
      </p>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={etiquetaStyle}>Valor neto hoy</span>
          <b style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>S/ {formatearMonto(valorNetoActual)}</b>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={etiquetaStyle}>Gasto típico mensual</label>
          <input
            inputMode="decimal"
            value={gastoMensual}
            onChange={(e) => setGastoMensual(e.target.value)}
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
          {promedioSugerido > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--muted-fg)' }}>
              Promedio de tus últimos meses: S/ {formatearMonto(promedioSugerido)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={etiquetaStyle}>
              Ingresos extra <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional, ej. servicios que te paguen)</span>
            </span>
          </div>
          {extras.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                inputMode="decimal"
                placeholder="Monto"
                value={e.monto}
                onChange={(ev) => cambiarExtra(e.id, { monto: ev.target.value })}
                style={{ ...inputStyle, flex: 1, fontVariantNumeric: 'tabular-nums' }}
              />
              <input
                type="date"
                value={e.fecha}
                onChange={(ev) => cambiarExtra(e.id, { fecha: ev.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => quitarExtra(e.id)}
                aria-label="Quitar ingreso extra"
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'var(--muted)',
                  color: 'var(--muted-fg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                }}
              >
                <IconX width={14} height={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={agregarExtra}
            style={{ ...botonSecundario, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <IconPlus width={15} height={15} />
            Agregar ingreso extra
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Te quedarían el 31 de diciembre
        </p>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: 32,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: finalNegativo ? 'var(--destructive)' : 'var(--fg)',
          }}
        >
          S/ {formatearMonto(resultado.valorFinal)}
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted-fg)' }}>
          Vas a gastar en total: S/ {formatearMonto(resultado.totalGastadoProyectado)}
          {resultado.totalExtrasProyectado > 0 && <> · Ingresos extra: S/ {formatearMonto(resultado.totalExtrasProyectado)}</>}
        </p>
        {finalNegativo && (
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--destructive)', fontWeight: 600 }}>
            A este ritmo te quedarías sin plata antes de fin de año.
          </p>
        )}
        <GraficoSimulacion puntos={resultado.puntos} />
      </div>

      {mesFinNombre && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-fg)' }}>
          Proyección hipotética, no se guarda nada — los ingresos extra son solo para este cálculo.
        </p>
      )}
    </div>
  );
}
