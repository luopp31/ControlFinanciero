import type { CSSProperties } from 'react';
import { Escena, MontoGrande } from '../../components/Escena';
import { ESCENA, colorMonto, kickStyle, seccionTituloStyle, subEscenaStyle } from '../../components/escenaEstilos';
import { chipStyle, segmentoStyle, segmentoTrackStyle } from '../../components/formStyles';
import { CATEGORIA_ICONOS, IconQuestion } from '../../components/icons';
import { TileCategoria } from '../../components/MovimientoRow';
import { TendenciaMensual } from '../../components/TendenciaMensual';
import { CATS, colorCategoria } from '../../lib/finanzas';
import { formatearMonto } from '../../lib/formato';
import { Simulador } from './Simulador';
import type { EstadisticasViewProps, Modo, Periodo } from './types';

const PERIODOS: { id: Periodo; nombre: string; frase: string }[] = [
  { id: 'mes', nombre: 'Este mes', frase: 'este mes' },
  { id: '3meses', nombre: '3 meses', frase: 'en 3 meses' },
  { id: 'anio', nombre: 'Este año', frase: 'este año' },
  { id: 'todo', nombre: 'Todo', frase: 'en total' },
];

const MODOS: { id: Modo; nombre: string }[] = [
  { id: 'historial', nombre: 'Historial' },
  { id: 'simular', nombre: 'Simular' },
];

function infoCategoria(id: string) {
  return CATS.find((c) => c.id === id) ?? { id, nombre: id, icono: 'question' as const, color: '#C9C6D6' };
}

/** Análisis: un número (lo gastado), una barra con el reparto por categoría en pasteles y, debajo, lo que entra y sale por mes. */
export function EstadisticasVista({
  periodo,
  onCambiarPeriodo,
  modo,
  onCambiarModo,
  categorias,
  total,
  ingresos,
  comparacionGasto,
  tendencia,
  valorNetoActual,
  promedioGastoSugerido,
  catColor,
}: EstadisticasViewProps) {
  const frase = PERIODOS.find((p) => p.id === periodo)?.frase ?? '';
  return (
    <div>
      <Escena color={ESCENA.analisis} migas={['Hoy', 'Análisis']}>
        {modo === 'historial' ? (
          <>
            <div style={{ ...kickStyle, marginTop: 30 }}>Gastado {frase}</div>
            <MontoGrande valor={total} />
            <p style={subEscenaStyle}>
              {comparacionGasto && comparacionGasto.diff !== 0
                ? `S/ ${formatearMonto(Math.abs(comparacionGasto.diff))} ${comparacionGasto.diff > 0 ? 'más' : 'menos'} que el período anterior.`
                : 'Sin período anterior con qué comparar.'}
            </p>
            <p style={{ ...subEscenaStyle, marginTop: 4, color: ingresos > 0 ? 'var(--accent)' : 'var(--muted-fg)' }}>
              {ingresos > 0 ? `Entraron S/ ${formatearMonto(ingresos)}` : 'Sin ingresos en este período.'}
            </p>
          </>
        ) : (
          <>
            <div style={{ ...kickStyle, marginTop: 30 }}>Simulador</div>
            <p style={{ ...subEscenaStyle, color: 'var(--fg)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', maxWidth: '22ch' }}>
              ¿Cuánto te dura tu plata si cambias lo que gastas?
            </p>
          </>
        )}
      </Escena>

      <div className="pagina pagina-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODOS.map((m) => (
            <button key={m.id} type="button" onClick={() => onCambiarModo(m.id)} aria-pressed={modo === m.id} style={{ ...chipStyle(modo === m.id), minHeight: 44, paddingInline: 20 }}>
              {m.nombre}
            </button>
          ))}
        </div>

        {modo === 'simular' ? (
          <Simulador valorNetoActual={valorNetoActual} promedioSugerido={promedioGastoSugerido} />
        ) : (
          <>
            <div style={segmentoTrackStyle}>
              {PERIODOS.map((p) => (
                <button key={p.id} type="button" onClick={() => onCambiarPeriodo(p.id)} style={{ ...segmentoStyle(periodo === p.id, 'var(--fg)'), minHeight: 44, fontSize: 13 }}>
                  {p.nombre}
                </button>
              ))}
            </div>

            <section>
              <h3 style={seccionTituloStyle}>Por categoría</h3>
              {categorias.length === 0 ? (
                <p style={{ fontSize: 14.5, color: 'var(--muted-fg)', margin: '10px 0 0' }}>Sin gastos en este período.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 4, height: 14, margin: '16px 0 10px' }} role="img" aria-label="Reparto del gasto por categoría">
                    {categorias.map((c) => (
                      <i key={c.categoria} style={{ flex: c.monto, background: colorCategoria(infoCategoria(c.categoria), catColor), borderRadius: 7, display: 'block' }} />
                    ))}
                  </div>
                  {categorias.map((c) => {
                    const info = infoCategoria(c.categoria);
                    const color = colorCategoria(info, catColor);
                    const pct = total > 0 ? Math.round((c.monto / total) * 100) : 0;
                    return (
                      <div key={c.categoria} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64 }}>
                        <TileCategoria color={color} Icono={CATEGORIA_ICONOS[info.icono] ?? IconQuestion} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.015em' }}>{info.nombre}</div>
                          <div className="txt-cat" style={{ '--c': color, fontSize: 13 } as CSSProperties}>
                            {pct}% del gasto
                          </div>
                        </div>
                        <div style={{ fontSize: 16.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em', color: colorMonto('GASTO'), whiteSpace: 'nowrap' }}>
                          − S/ {formatearMonto(c.monto)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </section>

            <section style={{ paddingTop: 12 }}>
              <h3 style={{ ...seccionTituloStyle, marginBottom: 12 }}>Entra y sale</h3>
              <div className="glass-card">
                <TendenciaMensual datos={tendencia} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
