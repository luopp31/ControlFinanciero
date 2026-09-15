import { supabase } from './supabase';
import { getAll, put, type Compromiso } from './db';
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

export async function sincronizarTodo(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' };
  try {
    for (const t of TABLAS) {
      await sincronizarTabla(t);
    }
    avisarCambioDeDatos();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' };
  }
}
