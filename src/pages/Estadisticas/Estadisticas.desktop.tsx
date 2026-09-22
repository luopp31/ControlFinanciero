import { PildoraComparacion } from '../../components/ComparacionPeriodo';
import { TendenciaMensual } from '../../components/TendenciaMensual';
import { CATS, colorCategoria } from '../../lib/finanzas';
import { formatearMonto } from '../../lib/formato';
import { CATEGORIA_ICONOS } from '../../components/icons';
import { chipStyle, segmentoStyle, segmentoTrackStyle } from '../../components/formStyles';
import { Simulador } from './Simulador';
import type { EstadisticasViewProps, Modo, Periodo } from './types';

const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: 'mes', nombre: 'Este mes' },
  { id: '3meses', nombre: '3 meses' },
  { id: 'anio', nombre: 'Este año' },
  { id: 'todo', nombre: 'Todo' },
];

const MODOS: { id: Modo; nombre: string }[] = [
  { id: 'historial', nombre: 'Historial' },
  { id: 'simular', nombre: 'Simular' },
];

function infoCategoria(id: string) {
  return CATS.find((c) => c.id === id) ?? { id, nombre: id, icono: 'question' as const, color: '#5A5368' };
}

export function EstadisticasDesktop({
  periodo,
  onCambiarPeriodo,
  modo,
  onCambiarModo,
  categorias,
  total,
  ingresos,
  comparacionGasto,
  comparacionIngreso,
  tendencia,
  valorNetoActual,
  promedioGastoSugerido,
  catColor,
}: EstadisticasViewProps) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={eyebrow}>Greedy</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Estadísticas</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODOS.map((m) => (
            <button key={m.id} type="button" onClick={() => onCambiarModo(m.id)} style={chipStyle(modo === m.id)}>
              {m.nombre}
            </button>
          ))}
        </div>
      </div>

      {modo === 'simular' ? (
        <Simulador valorNetoActual={valorNetoActual} promedioSugerido={promedioGastoSugerido} />
      ) : (
        <>
          <div style={{ ...segmentoTrackStyle, maxWidth: 420 }}>
            {PERIODOS.map((p) => (
              <button key={p.id} type="button" onClick={() => onCambiarPeriodo(p.id)} style={segmentoStyle(periodo === p.id, 'var(--primary)')}>
                {p.nombre}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="glass-card">
              <p style={tituloStat}>Ingresos</p>
              <p style={{ margin: '2px 0 8px', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                S/ {formatearMonto(ingresos)}
              </p>
              <PildoraComparacion comparacion={comparacionIngreso} subirEsBueno={true} />
            </div>
            <div className="glass-card">
              <p style={tituloStat}>Gastos</p>
              <p style={{ margin: '2px 0 8px', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                S/ {formatearMonto(total)}
              </p>
              <PildoraComparacion comparacion={comparacionGasto} subirEsBueno={false} />
            </div>
          </div>

          <div className="glass-card">
            <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Gasto por categoría</p>
            {categorias.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>Sin gastos en este periodo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {categorias.map((c) => {
                  const info = infoCategoria(c.categoria);
                  const color = colorCategoria(info, catColor);
                  const Icono = CATEGORIA_ICONOS[info.icono];
                  const pct = total > 0 ? (c.monto / total) * 100 : 0;
                  return (
                    <div key={c.categoria} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 11,
                          flex: '0 0 38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${color}26`,
                          color,
                        }}
                      >
                        {Icono ? <Icono width={19} height={19} /> : null}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>
                          <span>{info.nombre}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>S/ {formatearMonto(c.monto)}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: 'var(--muted)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, background: color, borderRadius: 4 }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--muted-fg)', flex: '0 0 36px', textAlign: 'right' }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card">
            <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Tendencia mensual</p>
            <TendenciaMensual datos={tendencia} />
          </div>
        </>
      )}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-fg)',
  margin: '0 0 8px',
};

const tituloStat: React.CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--muted-fg)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};
