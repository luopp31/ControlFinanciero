import { useState } from 'react';
import type { TotalMensual } from '../lib/finanzas';
import { formatearMesCorto, formatearMonto } from '../lib/formato';

const ANCHO = 640;
const ALTO = 220;
const PAD_ARR = 14;
const PAD_ABAJO = 24;
const ANCHO_BARRA = 11;
const GAP_BARRAS = 4;

interface Hover {
  mesIdx: number;
  serie: 'ingreso' | 'gasto';
}

/**
 * Gráfico de barras agrupadas (ingreso vs gasto por mes) — dos series de
 * identidad fija, siempre en el mismo orden y color: ingreso en
 * var(--accent), gasto en var(--destructive), los mismos tokens que ya usa
 * el resto de la app para "entra plata" / "sale plata" (MovimientoRow,
 * segmentos del formulario). Con leyenda porque son 2 series, y un tooltip
 * por barra al pasar el mouse.
 */
export function TendenciaMensual({ datos }: { datos: TotalMensual[] }) {
  const [hover, setHover] = useState<Hover | null>(null);

  const maxVal = Math.max(1, ...datos.flatMap((d) => [d.ingreso, d.gasto]));
  const altoDisponible = ALTO - PAD_ARR - PAD_ABAJO;
  const anchoGrupo = ANCHO / datos.length;

  function alturaBarra(valor: number): number {
    return maxVal > 0 ? (valor / maxVal) * altoDisponible : 0;
  }

  const hayDatos = datos.some((d) => d.ingreso > 0 || d.gasto > 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <Leyenda color="var(--accent)" etiqueta="Ingresos" />
        <Leyenda color="var(--destructive)" etiqueta="Gastos" />
      </div>

      {!hayDatos ? (
        <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>Sin movimientos en estos meses.</p>
      ) : (
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          role="img"
          aria-label={`Ingresos y gastos por mes: ${datos.map((d) => `${formatearMesCorto(d.mes)} ingreso S/ ${formatearMonto(d.ingreso)}, gasto S/ ${formatearMonto(d.gasto)}`).join('; ')}`}
        >
          <line x1={0} y1={ALTO - PAD_ABAJO} x2={ANCHO} y2={ALTO - PAD_ABAJO} stroke="var(--card-border)" strokeWidth={1} />

          {datos.map((d, i) => {
            const cx = i * anchoGrupo + anchoGrupo / 2;
            const xIngreso = cx - GAP_BARRAS / 2 - ANCHO_BARRA;
            const xGasto = cx + GAP_BARRAS / 2;
            const altoIngreso = alturaBarra(d.ingreso);
            const altoGasto = alturaBarra(d.gasto);
            const baseY = ALTO - PAD_ABAJO;

            return (
              <g key={d.mes}>
                <rect
                  x={xIngreso}
                  y={baseY - altoIngreso}
                  width={ANCHO_BARRA}
                  height={Math.max(altoIngreso, 1)}
                  rx={3}
                  fill="var(--accent)"
                  opacity={hover && hover.mesIdx === i && hover.serie !== 'ingreso' ? 0.35 : 1}
                  onMouseEnter={() => setHover({ mesIdx: i, serie: 'ingreso' })}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${formatearMesCorto(d.mes)}: ingresaste S/ ${formatearMonto(d.ingreso)}`}</title>
                </rect>
                <rect
                  x={xGasto}
                  y={baseY - altoGasto}
                  width={ANCHO_BARRA}
                  height={Math.max(altoGasto, 1)}
                  rx={3}
                  fill="var(--destructive)"
                  opacity={hover && hover.mesIdx === i && hover.serie !== 'gasto' ? 0.35 : 1}
                  onMouseEnter={() => setHover({ mesIdx: i, serie: 'gasto' })}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${formatearMesCorto(d.mes)}: gastaste S/ ${formatearMonto(d.gasto)}`}</title>
                </rect>
                <text x={cx} y={ALTO - 6} textAnchor="middle" fontSize={11} fill="var(--muted-fg)">
                  {formatearMesCorto(d.mes)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {hover && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--fg)' }}>
          {formatearMesCorto(datos[hover.mesIdx].mes)} · {hover.serie === 'ingreso' ? 'Ingreso' : 'Gasto'}: S/{' '}
          {formatearMonto(datos[hover.mesIdx][hover.serie])}
        </p>
      )}
    </div>
  );
}

function Leyenda({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-fg)', fontWeight: 600 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flex: '0 0 auto' }} />
      {etiqueta}
    </span>
  );
}
