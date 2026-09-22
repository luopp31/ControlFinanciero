import { supabase } from './supabase';
import { getAll, put, getConfig, putConfig, type Compromiso, type Config } from './db';
import type { Cuenta, Movimiento, Prestamo } from './finanzas';
import { avisarCambioDeDatos } from './eventos';

// Cada tabla remota usa snake_case y usuario_id (RLS ya filtra por dueño);
// estas funciones traducen hacia/desde nuestros tipos locales en camelCase.
interface TablaSync<Local extends { id: string; actualizado?: string; sincronizado?: boolean }> {
  store: 'cuentas' | 'movimientos' | 'prestamos' | 'compromisos';
  tabla: string;
  subir: (l: Local) => Record<string, unknown>;
  bajar: (r: Record<string, unknown>) => Local;
}

const cuentasSync: TablaSync<Cuenta> = {
  store: 'cuentas',
  tabla: 'cuentas',
  subir: (c) => ({
    id: c.id,
    nombre: c.nombre,
    rol: c.rol,
    saldo_inicial: c.saldoInicial,
    desde: c.desde,
    borrado: !!c.borrado,
  }),
  bajar: (r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    rol: r.rol as Cuenta['rol'],
    saldoInicial: Number(r.saldo_inicial),
    desde: r.desde as string,
    borrado: !!r.borrado,
    actualizado: r.actualizado as string,
    sincronizado: true,
  }),
};

const movimientosSync: TablaSync<Movimiento> = {
  store: 'movimientos',
  tabla: 'movimientos',
  subir: (m) => ({
    id: m.id,
    fecha: m.fecha,
    monto: m.monto,
    tipo: m.tipo,
    categoria: m.categoria ?? null,
    cuenta_id: m.cuentaId,
    destino_id: m.destinoId ?? null,
    dir: m.dir ?? null,
    prest_id: m.prestId ?? null,
    compromiso_id: m.compromisoId ?? null,
    nota: m.nota ?? null,
    borrado: !!m.borrado,
  }),
  bajar: (r) => ({
    id: r.id as string,
    fecha: r.fecha as string,
    monto: Number(r.monto),
    tipo: r.tipo as Movimiento['tipo'],
    categoria: (r.categoria as string) ?? null,
    cuentaId: r.cuenta_id as string,
    destinoId: (r.destino_id as string) ?? null,
    dir: (r.dir as Movimiento['dir']) ?? null,
    prestId: (r.prest_id as string) ?? null,
    compromisoId: (r.compromiso_id as string) ?? null,
    nota: (r.nota as string) ?? null,
    borrado: !!r.borrado,
    actualizado: r.actualizado as string,
    sincronizado: true,
  }),
};

const prestamosSync: TablaSync<Prestamo> = {
  store: 'prestamos',
  tabla: 'prestamos',
  subir: (p) => ({
    id: p.id,
    tipo: p.tipo,
    persona: p.persona,
    capital: p.capital,
    acordado: p.acordado ?? null,
    fecha: p.fecha,
    borrado: !!p.borrado,
  }),
  bajar: (r) => ({
    id: r.id as string,
    tipo: r.tipo as Prestamo['tipo'],
    persona: r.persona as string,
    capital: Number(r.capital),
    acordado: r.acordado != null ? Number(r.acordado) : null,
    fecha: r.fecha as string,
    borrado: !!r.borrado,
    actualizado: r.actualizado as string,
    sincronizado: true,
  }),
};

const compromisosSync: TablaSync<Compromiso> = {
  store: 'compromisos',
  tabla: 'compromisos',
  subir: (c) => ({
    id: c.id,
    tipo: c.tipo,
    nombre: c.nombre,
    monto: c.monto,
    dia_cobro: c.diaCobro ?? null,
    total: c.total ?? null,
    pagadas: c.pagadas ?? null,
    categoria: c.categoria ?? null,
    borrado: !!c.borrado,
  }),
  bajar: (r) => ({
    id: r.id as string,
    tipo: r.tipo as Compromiso['tipo'],
    nombre: r.nombre as string,
    monto: Number(r.monto),
    diaCobro: r.dia_cobro != null ? Number(r.dia_cobro) : null,
    total: r.total != null ? Number(r.total) : null,
    pagadas: r.pagadas != null ? Number(r.pagadas) : null,
    categoria: (r.categoria as string) ?? null,
    borrado: !!r.borrado,
    actualizado: r.actualizado as string,
    sincronizado: true,
  }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLAS: TablaSync<any>[] = [cuentasSync, movimientosSync, prestamosSync, compromisosSync];

async function sincronizarTabla<L extends { id: string; actualizado?: string; sincronizado?: boolean }>(
  t: TablaSync<L>
): Promise<void> {
  if (!supabase) return;

  // 1. Subir lo pendiente (creado/editado localmente desde el último sync).
  const locales = await getAll<L>(t.store);
  const pendientes = locales.filter((l) => !l.sincronizado);
  if (pendientes.length > 0) {
    const { error } = await supabase.from(t.tabla).upsert(pendientes.map(t.subir), { onConflict: 'id' });
    if (error) throw new Error(`${t.tabla}: ${error.message}`);
    for (const l of pendientes) {
      await put(t.store, { ...l, sincronizado: true });
    }
  }

  // 2. Bajar lo remoto y quedarnos con lo más reciente, fila por fila.
  const { data, error } = await supabase.from(t.tabla).select('*');
  if (error) throw new Error(`${t.tabla}: ${error.message}`);

  const locasActualizadas = await getAll<L>(t.store);
  const porId = new Map(locasActualizadas.map((l) => [l.id, l]));

  for (const fila of data ?? []) {
    const remoto = t.bajar(fila as Record<string, unknown>);
    const local = porId.get(remoto.id);
    const remotoEsMasNuevo =
      !local || !local.actualizado || (remoto.actualizado && remoto.actualizado > local.actualizado);
    // Si hay cambios locales sin subir todavía, no los pisamos con lo remoto.
    if (remotoEsMasNuevo && local?.sincronizado !== false) {
      await put(t.store, remoto);
    }
  }
}

function bajarConfig(r: Record<string, unknown>, version: number): Config {
  return {
    presupuesto: Number(r.presupuesto ?? 0),
    nombre: (r.nombre as string) ?? '',
    catsExtra: (r.cats_extra as unknown[]) ?? [],
    catColor: (r.cat_color as Record<string, string>) ?? {},
    ocultarSaldos: !!r.ocultar_saldos,
    tema: (r.tema as Config['tema']) ?? undefined,
    version,
  };
}

function subirConfig(c: Config, usuarioId: string) {
  return {
    usuario_id: usuarioId,
    presupuesto: c.presupuesto,
    nombre: c.nombre,
    cats_extra: c.catsExtra,
    cat_color: c.catColor,
    ocultar_saldos: !!c.ocultarSaldos,
    tema: c.tema ?? null,
    version: c.version,
  };
}

/**
 * Sincroniza la config (perfil, tema, saldos ocultos, colores) con la fila
 * única del usuario en Supabase, usando "version" en vez del timestamp local
 * para decidir quién gana -- ese fue el bug de la app anterior: un
 * dispositivo recién instalado, con hora de reloj más "nueva" pero cero
 * datos reales, podía pisar la config buena. Con version, gana quien de
 * verdad tiene más cambios acumulados, sin importar la hora de cada reloj.
 */
async function sincronizarConfig(): Promise<void> {
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const local = (await getConfig()) ?? { presupuesto: 0, nombre: '', catsExtra: [], catColor: {}, version: 0 };

  const { data: remoto, error: errLeer } = await supabase.from('config').select('*').eq('usuario_id', user.id).maybeSingle();
  if (errLeer) throw new Error(`config: ${errLeer.message}`);

  if (!remoto) {
    const { error: errInsert } = await supabase.from('config').insert(subirConfig(local, user.id));
    if (errInsert) throw new Error(`config: ${errInsert.message}`);
    return;
  }

  const versionRemota = Number(remoto.version ?? 0);

  if (local.version > versionRemota) {
    const { data: filasActualizadas, error: errUpdate } = await supabase
      .from('config')
      .update(subirConfig(local, user.id))
      .eq('usuario_id', user.id)
      .eq('version', versionRemota)
      .select();
    if (errUpdate) throw new Error(`config: ${errUpdate.message}`);
    // 0 filas = alguien más escribió entre medio (carrera) -- nos quedamos
    // con lo remoto en vez de arriesgarnos a pisar ese cambio a ciegas.
    if (!filasActualizadas || filasActualizadas.length === 0) {
      await putConfig(bajarConfig(remoto, versionRemota));
    }
  } else if (versionRemota > local.version) {
    await putConfig(bajarConfig(remoto, versionRemota));
  }
}

export async function sincronizarTodo(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' };
  try {
    for (const t of TABLAS) {
      await sincronizarTabla(t);
    }
    await sincronizarConfig();
    avisarCambioDeDatos();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' };
  }
}

let temporizadorAutoSync: ReturnType<typeof setTimeout> | null = null;
const ESPERA_AUTO_SYNC_MS = 1500;

/**
 * Programa una sincronización unos segundos después del último cambio
 * local, si hay sesión activa — para no depender de que alguien se acuerde
 * de tocar "Sincronizar ahora". Los hooks (useCuentas, useMovimientos, etc.)
 * llaman esto después de cada crear/editar/borrar; varios cambios seguidos
 * (ej. crear un préstamo dispara dos escrituras) se agrupan en una sola
 * sincronización en vez de disparar una por cada una.
 */
export function programarSyncAutomatico(): void {
  if (!supabase) return;
  if (temporizadorAutoSync) clearTimeout(temporizadorAutoSync);
  temporizadorAutoSync = setTimeout(async () => {
    temporizadorAutoSync = null;
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await sincronizarTodo();
  }, ESPERA_AUTO_SYNC_MS);
}
