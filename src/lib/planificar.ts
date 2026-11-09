// Convierte lo que el usuario decidió en el Conciliar en las escrituras a guardar.
// Lógica pura: no toca IndexedDB ni el reloj (la hora y los ids nuevos se reciben).
// También proyecta la verificación de saldo con lo que se va a cargar, para mostrarla
// y guardar "Conciliado hasta" en la misma operación.
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';
import type { Ignorado, ReglaCategoria } from './db';
import { aprenderRegla, clasificarDescriptor, normalizarClave, proponer, reglasVigentes, sembrarReglas, type Propuesta } from './clasificador';
import { uuidDeterminista, type FilaConRef } from './emparejar';
import { nuevoConciliadoHasta, verificar, type Verificacion } from './verificar';

export type Decision =
  | { accion: 'IGNORAR' }
  | { accion: 'GASTO'; categoria: string }
  | { accion: 'INGRESO'; categoria?: string }
  | { accion: 'REEMBOLSO'; categoria: string }
  /** Entre mis cuentas. Si la otra cuenta también trae su fila, se funden en UN solo traspaso. */
  | { accion: 'TRASPASO'; cuentaContrariaId: string }
  /** Pago de la tarjeta de crédito: baja la deuda del préstamo, no es gasto. */
  | { accion: 'PAGO_PRESTAMO'; prestId: string };

export interface CuentaConciliar {
  cuenta: Cuenta;
  /** Filas del banco ya filtradas por la fecha de corte de la cuenta. */
  filas: FilaBanco[];
  consulta: { fecha: string; hora: string };
  saldoDisponibleCent: number;
  cubreDesde: boolean;
  /** Decisión por referencia de cada fila "nueva". */
  decisiones: Record<string, Decision>;
}

export interface EntradaPlan {
  cuentas: CuentaConciliar[];
  movimientos: Movimiento[];
  ignorados: Ignorado[];
  reglas: ReglaCategoria[];
  ahora: string;
  nuevoId: () => string;
}

export interface Plan {
  /** false si queda algo por resolver o hay una decisión imposible: no se guarda nada. */
  listo: boolean;
  sinResolver: { cuentaId: string; fila: FilaConRef }[];
  errores: string[];
  movimientos: Movimiento[];
  ignorados: Ignorado[];
  reglas: ReglaCategoria[];
  /** Cuentas con "Conciliado hasta" actualizado (solo las que cuadran). */
  cuentas: Cuenta[];
  /** Verificación proyectada, con lo ya existente más lo que se va a cargar. */
  verificaciones: Record<string, Verificacion>;
}

/** Decisión que sale sola de la propuesta del clasificador (para rellenar "Confirmar todo"). */
export function decisionDesdePropuesta(p: Propuesta, prestIdAmex?: string): Decision | null {
  if (p.estado === 'AUTO' || p.estado === 'CONFIRMAR') {
    if (p.tipo === 'GASTO' && p.categoria) return { accion: 'GASTO', categoria: p.categoria };
    if (p.tipo === 'INGRESO') return { accion: 'INGRESO', categoria: p.categoria ?? undefined };
    if (p.tipo === 'PRESTAMO' && prestIdAmex) return { accion: 'PAGO_PRESTAMO', prestId: prestIdAmex };
  }
  return null;
}

const monto = (centimos: number) => Math.abs(centimos) / 100;

export function planificar(e: EntradaPlan): Plan {
  const plan: Plan = { listo: false, sinResolver: [], errores: [], movimientos: [], ignorados: [], reglas: [], cuentas: [], verificaciones: {} };
  const { ahora } = e;
  const porCuenta = new Map(e.cuentas.map((c) => [c.cuenta.id, c]));

  // 1. Emparejar cada cuenta contra lo que ya hay.
  const base = e.cuentas.map((c) => ({
    c,
    emp: undefined as ReturnType<typeof verificar>['emparejo'] | undefined,
  }));
  for (const b of base) {
    b.emp = verificar({ cuenta: b.c.cuenta, filas: b.c.filas, movimientos: e.movimientos, ignorados: e.ignorados, consulta: b.c.consulta, cubreDesde: b.c.cubreDesde, saldoDisponibleCent: b.c.saldoDisponibleCent }).emparejo;
  }

  // 2. Semillas: los "ya estaban" 1 a 1 enseñan su categoría al diccionario (veces_confirmada = 1).
  const pares = base.flatMap((b) =>
    (b.emp?.yaEstaban ?? [])
      .filter((p) => p.via !== 'dividido' && p.movimientos.length === 1 && p.movimientos[0].tipo === 'GASTO')
      .map((p) => ({ descriptor: p.fila.descriptor, categoria: p.movimientos[0].categoria }))
  );
  const semillas = sembrarReglas(pares, e.reglas, e.nuevoId, ahora);
  const reglasTrabajo = [...e.reglas, ...semillas];

  // 3. Decisiones sobre las filas nuevas.
  const consumidas = new Set<string>(); // referencias absorbidas por un traspaso emparejado
  const aprender = new Map<string, { descriptor: string; clase: 'PERSONA' | 'COMERCIO'; categoria: string }>();
  const nuevosMov: Movimiento[] = [];
  const nuevosIgn: Ignorado[] = [];

  const crearMov = (cuentaId: string, fila: FilaConRef, resto: Partial<Movimiento> & Pick<Movimiento, 'tipo'>): Movimiento => ({
    id: uuidDeterminista(`mov|${cuentaId}|${fila.referencia}`),
    fecha: fila.fecha,
    monto: monto(fila.centimos),
    cuentaId,
    nota: fila.descriptor,
    referencia: fila.referencia,
    descriptor: fila.descriptor,
    origen: 'conciliar',
    hora: fila.hora,
    borrado: false,
    actualizado: ahora,
    sincronizado: false,
    ...resto,
  });

  for (const b of base) {
    for (const fila of b.emp?.nuevos ?? []) {
      if (consumidas.has(fila.referencia)) continue;
      const d = b.c.decisiones[fila.referencia];
      const cuentaId = b.c.cuenta.id;
      if (!d) {
        plan.sinResolver.push({ cuentaId, fila });
        continue;
      }
      const sale = fila.centimos < 0;
      const exige = (ok: boolean, que: string) => {
        if (!ok) plan.errores.push(`${b.c.cuenta.nombre}: «${fila.descriptor}» no puede ser ${que} (${sale ? 'es un cargo' : 'es un abono'}).`);
        return ok;
      };
      switch (d.accion) {
        case 'IGNORAR':
          nuevosIgn.push({ id: uuidDeterminista(`ign|${cuentaId}|${fila.referencia}`), cuentaId, referencia: fila.referencia, descriptor: fila.descriptor, fecha: fila.fecha, monto: fila.centimos / 100, borrado: false, actualizado: ahora, sincronizado: false });
          break;
        case 'GASTO': {
          if (!exige(sale, 'un gasto')) break;
          nuevosMov.push(crearMov(cuentaId, fila, { tipo: 'GASTO', categoria: d.categoria }));
          const clase = clasificarDescriptor(fila.descriptor);
          if ((clase === 'PERSONA' || clase === 'COMERCIO') && proponer(fila.descriptor, fila.centimos, reglasTrabajo).estado !== 'AUTO') {
            aprender.set(`${clase}|${normalizarClave(fila.descriptor)}`, { descriptor: fila.descriptor, clase, categoria: d.categoria });
          }
          break;
        }
        case 'INGRESO':
          if (exige(!sale, 'un ingreso')) nuevosMov.push(crearMov(cuentaId, fila, { tipo: 'INGRESO', categoria: d.categoria ?? 'OTROS' }));
          break;
        case 'REEMBOLSO':
          if (exige(!sale, 'un reembolso')) nuevosMov.push(crearMov(cuentaId, fila, { tipo: 'REEMBOLSO', categoria: d.categoria }));
          break;
        case 'PAGO_PRESTAMO':
          if (exige(sale, 'un pago de préstamo')) nuevosMov.push(crearMov(cuentaId, fila, { tipo: 'PRESTAMO', dir: 'PAGO', prestId: d.prestId, categoria: null }));
          break;
        case 'TRASPASO': {
          // ¿La otra cuenta trae su lado (mismo minuto, monto opuesto, apuntando de vuelta)? Entonces es UN traspaso.
          const otra = porCuenta.get(d.cuentaContrariaId);
          const contraparte = base
            .find((x) => x.c.cuenta.id === d.cuentaContrariaId)
            ?.emp?.nuevos.find((f) => !consumidas.has(f.referencia) && f.centimos === -fila.centimos && f.fecha === fila.fecha && f.hora === fila.hora && otra?.decisiones[f.referencia]?.accion === 'TRASPASO' && (otra.decisiones[f.referencia] as { cuentaContrariaId: string }).cuentaContrariaId === cuentaId);
          if (contraparte) {
            consumidas.add(fila.referencia);
            consumidas.add(contraparte.referencia);
            const [origen, destino] = sale ? [cuentaId, d.cuentaContrariaId] : [d.cuentaContrariaId, cuentaId];
            nuevosMov.push(crearMov(origen, sale ? fila : contraparte, { tipo: 'TRASPASO', destinoId: destino, categoria: null }));
          } else {
            const [origen, destino] = sale ? [cuentaId, d.cuentaContrariaId] : [d.cuentaContrariaId, cuentaId];
            nuevosMov.push({ ...crearMov(cuentaId, fila, { tipo: 'TRASPASO', destinoId: destino, categoria: null }), cuentaId: origen });
          }
          break;
        }
      }
    }
  }

  // 4. Reglas aprendidas (una confirmación por clave en cada importación) + semillas.
  const vivas = reglasVigentes(reglasTrabajo);
  const reglasFinal = new Map<string, ReglaCategoria>(semillas.map((r) => [r.id, r]));
  for (const a of aprender.values()) {
    const existente = vivas.find((r) => r.tipo === a.clase && r.clave === normalizarClave(a.descriptor));
    const r = aprenderRegla(existente, a.descriptor, a.clase, a.categoria, e.nuevoId(), ahora);
    reglasFinal.set(r.id, r);
  }

  if (plan.sinResolver.length > 0 || plan.errores.length > 0) return plan;

  // 5. Verificación proyectada y "Conciliado hasta".
  const movimientosTodos = [...e.movimientos, ...nuevosMov];
  const ignoradosTodos = [...e.ignorados, ...nuevosIgn];
  for (const c of e.cuentas) {
    const v = verificar({ cuenta: c.cuenta, filas: c.filas, movimientos: movimientosTodos, ignorados: ignoradosTodos, consulta: c.consulta, cubreDesde: c.cubreDesde, saldoDisponibleCent: c.saldoDisponibleCent });
    plan.verificaciones[c.cuenta.id] = v;
    const hasta = nuevoConciliadoHasta(c.cuenta.conciliadoHasta, c.consulta, v.cuadra);
    if (hasta) plan.cuentas.push({ ...c.cuenta, conciliadoHasta: hasta, actualizado: ahora, sincronizado: false });
  }

  plan.movimientos = nuevosMov;
  plan.ignorados = nuevosIgn;
  plan.reglas = [...reglasFinal.values()];
  plan.listo = true;
  return plan;
}
