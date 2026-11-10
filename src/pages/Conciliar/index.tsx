import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { usePrestamos } from '../../hooks/usePrestamos';
import { useReglas } from '../../hooks/useReglas';
import { useIgnorados } from '../../hooks/useIgnorados';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { parsearConstancia, filtrarDesde, type ConstanciaLeida, type FilaBanco } from '../../lib/constancia';
import { emparejar, type FilaConRef, type ResultadoEmparejo } from '../../lib/emparejar';
import { proponer, reglasVigentes, type Propuesta } from '../../lib/clasificador';
import { planificar, decisionDesdePropuesta, type CuentaConciliar, type Decision } from '../../lib/planificar';
import { instanteConsulta } from '../../lib/verificar';
import { guardarPlan } from '../../lib/guardarPlan';
import { leerItemsPdf } from '../../lib/pdf';
import { CATS, CATS_ING, estadoPrestamo, type Cuenta } from '../../lib/finanzas';
import { formatearFechaCorta, formatearInstanteLima, formatearMonto } from '../../lib/formato';
import { botonPrimario, botonSecundario } from '../../components/formStyles';
import { IconUpload } from '../../components/icons';
import { FilaPorClasificar } from './FilaPorClasificar';
import { TarjetaVerificacion } from './TarjetaVerificacion';
import { cuentaPorNombre } from './util';

interface Pdf {
  key: string;
  nombre: string;
  leida?: ConstanciaLeida;
  error?: string;
  /** Cuenta elegida a mano cuando el banco la nombra de una forma que no reconozco. */
  cuentaId?: string;
}

interface Grupo {
  cuenta: Cuenta;
  leida: ConstanciaLeida;
  pdf: Pdf;
  vigentes: FilaBanco[];
  descartadas: number;
  emp: ResultadoEmparejo;
}

const CATS_TODAS = [...CATS, ...CATS_ING];
const nombreCat = (id?: string | null) => CATS_TODAS.find((c) => c.id === id)?.nombre ?? 'Otros';
const money = (c: number) => `S/ ${formatearMonto(Math.abs(c) / 100)}`;

export function Conciliar({ onVolver }: { onVolver: () => void }) {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs } = useMovimientos();
  const { prestamos } = usePrestamos();
  const { reglas } = useReglas();
  const { ignorados } = useIgnorados();

  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  /** undefined = sin decidir (puede resolverse sola); null = reabierta por el usuario; Decision = elegida. */
  const [decisiones, setDecisiones] = useState<Record<string, Decision | null>>({});
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const amexId = useMemo(
    () => prestamos.find((p) => p.tipo === 'DEBO' && /amex/i.test(p.persona) && !estadoPrestamo(p, movimientos).saldado)?.id,
    [prestamos, movimientos]
  );

  async function agregar(lista: FileList | File[]) {
    setLeyendo(true);
    setGuardado(false);
    const nuevos: Pdf[] = [];
    for (const f of Array.from(lista)) {
      const key = `${f.name}|${f.size}|${f.lastModified}`;
      try {
        nuevos.push({ key, nombre: f.name, leida: parsearConstancia(await leerItemsPdf(f)) });
      } catch {
        nuevos.push({ key, nombre: f.name, error: 'No pude abrir este archivo como PDF.' });
      }
    }
    setPdfs((prev) => [...prev.filter((p) => !nuevos.some((n) => n.key === p.key)), ...nuevos]);
    setLeyendo(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  // Cada PDF a su cuenta (por nombre, o la que elijas); si hay dos de la misma cuenta, vale el más reciente.
  const { grupos, sinCuenta, reemplazados } = useMemo(() => {
    const mejor = new Map<string, { pdf: Pdf; leida: ConstanciaLeida; cuenta: Cuenta; instante: string }>();
    const sinCuenta: Pdf[] = [];
    const reemplazados: Pdf[] = [];
    for (const pdf of pdfs) {
      const { leida } = pdf;
      if (!leida?.consulta) continue;
      const cuenta = pdf.cuentaId ? cuentas.find((c) => c.id === pdf.cuentaId) : cuentaPorNombre(cuentas, leida.cuenta);
      if (!cuenta) {
        sinCuenta.push(pdf);
        continue;
      }
      const instante = instanteConsulta(leida.consulta);
      const previo = mejor.get(cuenta.id);
      if (!previo || instante > previo.instante) {
        if (previo) reemplazados.push(previo.pdf);
        mejor.set(cuenta.id, { pdf, leida, cuenta, instante });
      } else reemplazados.push(pdf);
    }
    const grupos: Grupo[] = [...mejor.values()].map(({ pdf, leida, cuenta }) => {
      const { vigentes, descartadas } = filtrarDesde(leida.filas, cuenta.desde);
      const emp = emparejar({ cuenta, filas: vigentes, movimientos, ignorados, consulta: leida.consulta!, cubreDesde: descartadas.length > 0 });
      return { cuenta, leida, pdf, vigentes, descartadas: descartadas.length, emp };
    });
    return { grupos, sinCuenta, reemplazados };
  }, [pdfs, cuentas, movimientos, ignorados]);

  const vivas = useMemo(() => reglasVigentes(reglas), [reglas]);

  // Para cada fila nueva: su propuesta, y su decisión efectiva (la tuya, o la que sale sola).
  const { filas, plan } = useMemo(() => {
    const traspasoAuto = new Map<string, Decision>();
    for (const g of grupos) {
      for (const f of g.emp.nuevos) {
        if (!/^TRANSF/i.test(f.descriptor)) continue;
        for (const o of grupos) {
          if (o === g) continue;
          if (o.emp.nuevos.some((x) => x.centimos === -f.centimos && x.fecha === f.fecha && x.hora === f.hora && /^TRANSF/i.test(x.descriptor))) {
            traspasoAuto.set(f.referencia, { accion: 'TRASPASO', cuentaContrariaId: o.cuenta.id });
          }
        }
      }
    }
    const filas: { cuentaId: string; fila: FilaConRef; propuesta: Propuesta; decision: Decision | null }[] = [];
    const entradas: CuentaConciliar[] = grupos.map((g) => {
      const dec: Record<string, Decision> = {};
      for (const fila of g.emp.nuevos) {
        const propuesta = proponer(fila.descriptor, fila.centimos, vivas);
        const elegida = decisiones[fila.referencia];
        const decision =
          elegida !== undefined ? elegida : propuesta.estado === 'AUTO' ? decisionDesdePropuesta(propuesta, amexId) : (traspasoAuto.get(fila.referencia) ?? null);
        if (decision) dec[fila.referencia] = decision;
        filas.push({ cuentaId: g.cuenta.id, fila, propuesta, decision });
      }
      return { cuenta: g.cuenta, filas: g.vigentes, consulta: g.leida.consulta!, saldoDisponibleCent: g.leida.saldoDisponibleCent ?? 0, cubreDesde: g.descartadas > 0, decisiones: dec };
    });
    const plan = planificar({ cuentas: entradas, movimientos, ignorados, reglas, ahora: new Date().toISOString(), nuevoId: () => crypto.randomUUID() });
    return { filas, plan };
  }, [grupos, decisiones, vivas, reglas, movimientos, ignorados, amexId]);

  if (cargandoCuentas || cargandoMovs) return null;

  const decidir = (ref: string, d: Decision | null) => {
    setGuardado(false);
    setDecisiones((prev) => ({ ...prev, [ref]: d }));
  };
  const pendientes = filas.filter((f) => !f.decision);
  const confirmables = pendientes.filter((f) => f.propuesta.estado === 'CONFIRMAR' && decisionDesdePropuesta(f.propuesta, amexId));
  const hayEscrituras = plan.movimientos.length + plan.ignorados.length + plan.reglas.length + plan.cuentas.length > 0;
  const sinPdf = grupos.length === 0;

  async function cargar() {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await guardarPlan(plan);
      setGuardado(true);
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : 'No pude guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: isDesktop ? '48px 32px 64px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <button type="button" onClick={onVolver} style={{ all: 'unset', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          ← Volver
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 6px' }}>Conciliar con el banco</h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted-fg)', margin: 0 }}>
          Sube la constancia de movimientos (PDF) de cada cuenta. Se lee en este dispositivo y no se sube a ningún lado.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
          {cuentas.map((c) => (
            <p key={c.id} style={{ margin: 0, fontSize: 13.5, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--muted-fg)' }}>{c.nombre}</span>
              <b style={{ color: c.conciliadoHasta ? 'var(--fg)' : 'var(--muted-fg)' }}>
                {c.conciliadoHasta ? `Conciliado hasta ${formatearInstanteLima(c.conciliadoHasta)}` : 'Sin conciliar'}
              </b>
            </p>
          ))}
        </div>
      </div>

      <div
        className="glass-card"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void agregar(e.dataTransfer.files);
        }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}
      >
        <input ref={inputRef} type="file" accept="application/pdf" multiple hidden onChange={(e) => e.target.files && void agregar(e.target.files)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={leyendo} style={{ ...botonPrimario(leyendo), display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <IconUpload width={16} height={16} />
          {leyendo ? 'Leyendo…' : pdfs.length ? 'Agregar más constancias' : 'Subir constancias'}
        </button>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>Puedes elegir varios a la vez (Simple y Millonaria).</p>
      </div>

      {pdfs.map((p) => (
        <ResumenPdf key={p.key} pdf={p} cuentas={cuentas} grupo={grupos.find((g) => g.pdf === p)} reemplazado={reemplazados.includes(p)} sinCuenta={sinCuenta.includes(p)}
          onElegir={(id) => setPdfs((prev) => prev.map((x) => (x.key === p.key ? { ...x, cuentaId: id } : x)))} />
      ))}

      {!sinPdf && (
        <>
          {pendientes.length > 0 && (
            <section className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <p style={tituloSeccion}>Por clasificar ({pendientes.length})</p>
                {confirmables.length > 0 && (
                  <button
                    type="button"
                    style={botonSecundario}
                    onClick={() => {
                      setGuardado(false);
                      setDecisiones((prev) => {
                        const sig = { ...prev };
                        for (const f of confirmables) sig[f.fila.referencia] = decisionDesdePropuesta(f.propuesta, amexId);
                        return sig;
                      });
                    }}
                  >
                    Confirmar sugeridas ({confirmables.length})
                  </button>
                )}
              </div>
              {pendientes.map((f) => (
                <FilaPorClasificar
                  key={f.fila.referencia}
                  fila={f.fila}
                  propuesta={f.propuesta}
                  otrasCuentas={cuentas.filter((c) => c.id !== f.cuentaId)}
                  amexId={amexId}
                  onDecidir={(d) => decidir(f.fila.referencia, d)}
                />
              ))}
            </section>
          )}

          {filas.some((f) => f.decision) && (
            <Plegable titulo={`Listas para cargar (${filas.filter((f) => f.decision).length})`} abierto={pendientes.length === 0}>
              {filas.filter((f) => f.decision).map((f) => (
                <LineaSimple key={f.fila.referencia} izq={f.fila.descriptor} meta={`${formatearFechaCorta(f.fila.fecha)} · ${etiqueta(f.decision!, cuentas)}`} cent={f.fila.centimos}
                  accion={<button type="button" onClick={() => decidir(f.fila.referencia, null)} style={enlace}>Cambiar</button>} />
              ))}
            </Plegable>
          )}

          {grupos.some((g) => g.emp.yaEstaban.length > 0) && (
            <Plegable titulo={`Ya estaban (${grupos.reduce((n, g) => n + g.emp.yaEstaban.length, 0)})`}>
              {grupos.flatMap((g) => g.emp.yaEstaban).map((p) => (
                <LineaSimple key={p.fila.referencia} izq={p.fila.descriptor} meta={`${formatearFechaCorta(p.fila.fecha)}${p.via === 'dividido' ? ` · en ${p.movimientos.length} partes` : ''}`} cent={p.fila.centimos} />
              ))}
            </Plegable>
          )}

          {grupos.some((g) => g.emp.soloEnGreedy.length > 0) && (
            <Plegable titulo={`Solo en Greedy (${grupos.reduce((n, g) => n + g.emp.soloEnGreedy.length, 0)})`} abierto>
              <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--muted-fg)' }}>El banco no los muestra: posible duplicado o error.</p>
              {grupos.flatMap((g) => g.emp.soloEnGreedy.map((m) => ({ g, m }))).map(({ g, m }) => (
                <LineaSimple key={m.id} izq={m.nota || nombreCat(m.categoria)} meta={`${g.cuenta.nombre} · ${formatearFechaCorta(m.fecha)}`} cent={Math.round((m.tipo === 'INGRESO' || m.tipo === 'REEMBOLSO' ? 1 : -1) * m.monto * 100)} />
              ))}
            </Plegable>
          )}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pendientes.length > 0 || plan.errores.length > 0 ? (
              <>
                {plan.errores.map((e) => (
                  <p key={e} style={{ margin: 0, fontSize: 13, color: 'var(--destructive)' }}>{e}</p>
                ))}
                {pendientes.length > 0 && (
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)' }}>
                    Faltan {pendientes.length} por clasificar para cargar y verificar el saldo.
                  </p>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isDesktop && grupos.length > 1 ? '1fr 1fr' : '1fr', gap: 16 }}>
                  {grupos.map((g) => plan.verificaciones[g.cuenta.id] && <TarjetaVerificacion key={g.cuenta.id} cuenta={g.cuenta} v={plan.verificaciones[g.cuenta.id]} />)}
                </div>
                {hayEscrituras && !guardado ? (
                  <button type="button" onClick={() => void cargar()} disabled={guardando} style={{ ...botonPrimario(guardando), width: '100%' }}>
                    {guardando ? 'Guardando…' : plan.movimientos.length > 0 ? `Cargar ${plan.movimientos.length} movimiento${plan.movimientos.length === 1 ? '' : 's'}` : 'Guardar conciliación'}
                  </button>
                ) : (
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>{guardado ? 'Guardado.' : 'Todo está al día: no hay nada que cargar.'}</p>
                )}
                {errorGuardar && <p style={{ margin: 0, fontSize: 13, color: 'var(--destructive)' }}>{errorGuardar}</p>}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function etiqueta(d: Decision, cuentas: Cuenta[]): string {
  switch (d.accion) {
    case 'GASTO': return `Gasto · ${nombreCat(d.categoria)}`;
    case 'INGRESO': return `Ingreso · ${nombreCat(d.categoria ?? 'OTROS')}`;
    case 'REEMBOLSO': return `Reembolso · ${nombreCat(d.categoria)}`;
    case 'TRASPASO': return `Traspaso con ${cuentas.find((c) => c.id === d.cuentaContrariaId)?.nombre ?? 'otra cuenta'}`;
    case 'PAGO_PRESTAMO': return 'Pago de tarjeta (Amex)';
    case 'IGNORAR': return 'Se ignorará';
  }
}

function ResumenPdf({ pdf, cuentas, grupo, reemplazado, sinCuenta, onElegir }: { pdf: Pdf; cuentas: Cuenta[]; grupo?: Grupo; reemplazado: boolean; sinCuenta: boolean; onElegir: (id: string) => void }) {
  const { leida } = pdf;
  const noLeidas = leida?.avisos.length ?? 0;
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>
        {grupo ? grupo.cuenta.nombre : leida?.cuenta ?? pdf.nombre}
        {leida?.consulta && <span style={{ fontWeight: 600, color: 'var(--muted-fg)' }}> · {formatearFechaCorta(leida.consulta.fecha)} {leida.consulta.hora}</span>}
      </p>
      {pdf.error && <p style={{ margin: 0, fontSize: 13, color: 'var(--destructive)' }}>{pdf.error}</p>}
      {leida && !leida.consulta && <p style={{ margin: 0, fontSize: 13, color: 'var(--destructive)' }}>No pude leer la fecha de la consulta; este archivo no se puede usar.</p>}
      {leida?.consulta && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>
          Leí {leida.filas.length} fila{leida.filas.length === 1 ? '' : 's'}
          {grupo && ` · ${grupo.descartadas} anterior${grupo.descartadas === 1 ? '' : 'es'} al ${formatearFechaCorta(grupo.cuenta.desde)} (descartada${grupo.descartadas === 1 ? '' : 's'})`}
          {` · ${noLeidas} no pude leer`}
        </p>
      )}
      {reemplazado && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>Hay una constancia más reciente de esta cuenta: uso esa.</p>}
      {sinCuenta && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>No reconozco la cuenta «{leida?.cuenta ?? '—'}». ¿Cuál es?</span>
          {cuentas.map((c) => (
            <button key={c.id} type="button" style={botonSecundario} onClick={() => onElegir(c.id)}>{c.nombre}</button>
          ))}
        </div>
      )}
      {noLeidas > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--destructive)' }}>Ver lo que no pude leer</summary>
          {leida!.avisos.map((a) => (
            <p key={a} style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted-fg)', overflowWrap: 'anywhere' }}>{a}</p>
          ))}
        </details>
      )}
    </div>
  );
}

function Plegable({ titulo, abierto, children }: { titulo: string; abierto?: boolean; children: ReactNode }) {
  return (
    <details className="glass-card" open={abierto}>
      <summary style={{ cursor: 'pointer', ...tituloSeccion }}>{titulo}</summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

function LineaSimple({ izq, meta, cent, accion }: { izq: string; meta: string; cent: number; accion?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--card-border)', alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{izq}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-fg)' }}>{meta}</p>
      </div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cent < 0 ? 'var(--destructive)' : 'var(--accent)' }}>
          {cent < 0 ? '−' : '+'} {money(cent)}
        </p>
        {accion}
      </div>
    </div>
  );
}

const tituloSeccion: React.CSSProperties = { fontSize: 14, fontWeight: 800, margin: 0 };
const enlace: React.CSSProperties = { all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline' };

