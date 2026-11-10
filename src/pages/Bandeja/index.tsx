import { useMemo, useState } from 'react';
import { useCapturas } from '../../hooks/useCapturas';
import { useCuentas } from '../../hooks/useCuentas';
import { useReglas } from '../../hooks/useReglas';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { reglasVigentes } from '../../lib/clasificador';
import { clasificarCaptura, descartarCaptura, duplicadoDe, proponerCaptura, quitarMarcaDuplicado, resumenBandeja } from '../../lib/capturas';
import { guardarCaptura, guardarClasificacion } from '../../lib/guardarCaptura';
import type { Captura } from '../../lib/db';
import { botonSecundario } from '../../components/formStyles';
import { FilaCaptura } from './FilaCaptura';

/** Bandeja de la captura automática: gastos que llegaron solos (correo de Interbank y Wallet) por clasificar. Sin pestaña. */
export function Bandeja({ onVolver }: { onVolver: () => void }) {
  const isDesktop = useIsDesktop();
  const { capturas, cargando: cargandoCaps } = useCapturas();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { reglas } = useReglas();
  const [ocupada, setOcupada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { pendientes, sinLeer } = useMemo(() => resumenBandeja(capturas), [capturas]);
  const vivas = useMemo(() => reglasVigentes(reglas), [reglas]);
  const propuestas = useMemo(() => new Map(pendientes.map((c) => [c.id, proponerCaptura(c, vivas)])), [pendientes, vivas]);

  if (cargandoCaps || cargandoCuentas) return null;

  // Las que el diccionario ya sabe (automáticas o con un toque pendiente) y se pueden confirmar de una vez.
  const sugeridas = pendientes.filter((c) => {
    const p = propuestas.get(c.id);
    return c.moneda === 'PEN' && p && (p.estado === 'AUTO' || p.estado === 'CONFIRMAR') && p.categoria;
  });

  async function hacer(accion: () => Promise<void>) {
    setOcupada(true);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude guardar.');
    } finally {
      setOcupada(false);
    }
  }

  function clasificar(c: Captura, categoria: string, cuentaId: string, montoSolesCentimos: number | null, reglasActuales = reglas) {
    const r = clasificarCaptura(c, categoria, { cuentas, reglas: reglasActuales, ahora: new Date().toISOString(), nuevoId: () => crypto.randomUUID(), cuentaId, montoSolesCentimos });
    if (!r.ok) throw new Error(r.motivo);
    return r;
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: isDesktop ? '48px 32px 64px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <button type="button" onClick={onVolver} style={{ all: 'unset', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          ← Volver
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 6px' }}>Gastos por clasificar</h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>Llegaron solos por el correo de Interbank o por Wallet. Elige la categoría y se cargan como gasto.</p>
      </div>

      {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--destructive)' }}>{error}</p>}

      {pendientes.length === 0 ? (
        <div className="glass-card">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-fg)' }}>No hay gastos por clasificar.</p>
        </div>
      ) : (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Pendientes ({pendientes.length})</p>
            {sugeridas.length > 0 && (
              <button
                type="button"
                disabled={ocupada}
                style={botonSecundario}
                onClick={() =>
                  void hacer(async () => {
                    // En orden, pasando las reglas ya aprendidas a la siguiente (dos pagos a la misma persona = dos confirmaciones).
                    let acumuladas = reglas;
                    for (const c of sugeridas) {
                      const p = propuestas.get(c.id)!;
                      const r = clasificar(c, p.categoria!, '', null, acumuladas);
                      await guardarClasificacion(r);
                      if (r.regla) acumuladas = [...acumuladas.filter((x) => x.id !== r.regla!.id), r.regla];
                    }
                  })
                }
              >
                Confirmar sugeridas ({sugeridas.length})
              </button>
            )}
          </div>
          {pendientes.map((c) => (
            <FilaCaptura
              key={c.id}
              captura={c}
              propuesta={propuestas.get(c.id)!}
              cuentas={cuentas}
              duplicado={duplicadoDe(c, capturas)}
              ocupada={ocupada}
              onClasificar={(cat, cuentaId, soles) => void hacer(async () => guardarClasificacion(clasificar(c, cat, cuentaId, soles)))}
              onDescartar={() => void hacer(() => guardarCaptura(descartarCaptura(c, new Date().toISOString())))}
              onEsElMismo={() => void hacer(() => guardarCaptura(descartarCaptura(c, new Date().toISOString())))}
              onSonDistintos={() => void hacer(() => guardarCaptura(quitarMarcaDuplicado(c, new Date().toISOString())))}
            />
          ))}
        </section>
      )}

      {sinLeer.length > 0 && (
        <details className="glass-card">
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 800 }}>No pude leer ({sinLeer.length})</summary>
          <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--muted-fg)' }}>
            Llegaron con un formato que todavía no sé leer (ya sin números de cuenta). Pásale este texto a Claude Code para que lo aprenda y luego descártalo.
          </p>
          {sinLeer.map((c) => (
            <div key={c.id} style={{ padding: '10px 0', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <pre style={{ margin: 0, fontSize: 11.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'auto', color: 'var(--muted-fg)' }}>{c.textoCrudo}</pre>
              <div>
                <button type="button" disabled={ocupada} style={botonSecundario} onClick={() => void hacer(() => guardarCaptura(descartarCaptura(c, new Date().toISOString())))}>
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
