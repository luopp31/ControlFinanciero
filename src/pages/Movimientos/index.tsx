import { useMemo, useState } from 'react';
import { ConfirmarBorrado } from '../../components/ConfirmarBorrado';
import { DetalleMovimiento } from '../../components/DetalleMovimiento';
import { Escena } from '../../components/Escena';
import { ESCENA, colorMonto, subEscenaStyle, tituloEscenaStyle } from '../../components/escenaEstilos';
import { MovimientoForm } from '../../components/MovimientoForm';
import { MovimientoRow } from '../../components/MovimientoRow';
import { SelectorMes } from '../../components/SelectorMes';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { hoyISO, isoDe, mesActualISO, sumarMeses } from '../../lib/fecha';
import { formatearMonto } from '../../lib/formato';
import type { Movimiento } from '../../lib/finanzas';
import { textoBorradoMovimiento } from '../../lib/textoBorrado';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Hoy", "Ayer" o "Domingo 8 nov". */
function etiquetaDia(fecha: string): string {
  const hoy = hoyISO();
  if (fecha === hoy) return 'Hoy';
  const [a, m, d] = fecha.split('-').map(Number);
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === isoDe(ayer)) return 'Ayer';
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d} ${MESES[m - 1]}`;
}

export function Movimientos() {
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs, actualizarMovimiento, borrarMovimiento } = useMovimientos();
  const [mes, setMes] = useState(() => mesActualISO());
  // Tocar una fila abre el detalle; de ahí se edita o se elimina.
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Borrar pide confirmación: primero se elige qué borrar, y recién al confirmar se borra.
  const [porBorrarId, setPorBorrarId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  const movimientosDelMes = useMemo(() => movimientos.filter((m) => m.fecha.startsWith(mes)), [movimientos, mes]);
  const dias = useMemo(() => {
    const grupos: { fecha: string; items: Movimiento[]; gasto: number }[] = [];
    for (const m of movimientosDelMes) {
      let g = grupos[grupos.length - 1];
      if (!g || g.fecha !== m.fecha) {
        g = { fecha: m.fecha, items: [], gasto: 0 };
        grupos.push(g);
      }
      g.items.push(m);
      if (m.tipo === 'GASTO') g.gasto += m.monto;
      else if (m.tipo === 'REEMBOLSO') g.gasto -= m.monto;
    }
    return grupos;
  }, [movimientosDelMes]);

  if (cargandoCuentas || cargandoMovs) return null;

  const abierto = abiertoId ? movimientos.find((m) => m.id === abiertoId) : undefined;
  const porBorrar = porBorrarId ? movimientos.find((m) => m.id === porBorrarId) : undefined;

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: '120px 20px 32px', maxWidth: 480 }}>
        <p style={{ fontSize: 14.5, color: 'var(--muted-fg)' }}>Primero crea al menos una cuenta en "Cuentas" para poder registrar movimientos.</p>
      </div>
    );
  }

  return (
    <div>
      <Escena color={ESCENA.libro} migas={['Hoy', 'Libro']}>
        <h1 style={tituloEscenaStyle}>Libro</h1>
        <p style={subEscenaStyle}>
          {movimientosDelMes.length === 1 ? '1 movimiento' : `${movimientosDelMes.length} movimientos`} este mes.
        </p>
        <div style={{ marginTop: 14 }}>
          <SelectorMes mes={mes} onCambiar={(delta) => setMes((m) => sumarMeses(m, delta))} deshabilitarSiguiente={mes >= mesActualISO()} />
        </div>
      </Escena>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>
        {dias.length === 0 ? (
          <p style={{ fontSize: 14.5, color: 'var(--muted-fg)', margin: '24px 0 0' }}>Sin movimientos este mes.</p>
        ) : (
          dias.map((g) => (
            <section key={g.fecha}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '26px 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--muted-fg)' }}>
                <span>{etiquetaDia(g.fecha)}</span>
                {g.gasto > 0 && <span style={{ color: colorMonto('GASTO'), fontVariantNumeric: 'tabular-nums' }}>− S/ {formatearMonto(g.gasto)}</span>}
              </div>
              {g.items.map((m) =>
                editandoId === m.id ? (
                  <div key={m.id} style={{ padding: '14px 0' }}>
                    <MovimientoForm
                      cuentas={cuentas}
                      valoresIniciales={m}
                      etiquetaGuardar="Guardar cambios"
                      onCrear={async (datos) => {
                        const r = await actualizarMovimiento(m.id, datos);
                        setEditandoId(null);
                        return r;
                      }}
                      onCancelar={() => setEditandoId(null)}
                    />
                  </div>
                ) : (
                  <MovimientoRow key={m.id} movimiento={m} cuentas={cuentas} onAbrir={setAbiertoId} />
                )
              )}
            </section>
          ))
        )}
      </div>

      {abierto && (
        <DetalleMovimiento
          movimiento={abierto}
          cuentas={cuentas}
          onCerrar={() => setAbiertoId(null)}
          onEditar={() => {
            setEditandoId(abierto.id);
            setAbiertoId(null);
          }}
          onEliminar={() => {
            setPorBorrarId(abierto.id);
            setAbiertoId(null);
          }}
        />
      )}

      {porBorrar && (
        <ConfirmarBorrado
          texto={textoBorradoMovimiento(porBorrar, cuentas)}
          borrando={borrando}
          onCancelar={() => !borrando && setPorBorrarId(null)}
          onConfirmar={async () => {
            setBorrando(true);
            try {
              await borrarMovimiento(porBorrar.id);
            } finally {
              setBorrando(false);
              setPorBorrarId(null);
            }
          }}
        />
      )}
    </div>
  );
}
