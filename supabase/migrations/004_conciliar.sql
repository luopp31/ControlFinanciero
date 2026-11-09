-- Conciliar (importar la constancia de movimientos). Solo aditivo: no toca datos
-- existentes ni las tablas *_old. Corre esto ANTES de publicar la versión nueva de
-- la app, o el sync fallará con 400 (la app enviaría columnas que aún no existen).

-- 1. Datos del banco en cada movimiento importado.
alter table movimientos
  add column if not exists referencia text,   -- hash estable de la fila del banco (idempotencia)
  add column if not exists descriptor text,   -- texto original del banco
  add column if not exists origen text check (origen in ('manual', 'conciliar')),
  add column if not exists hora text check (hora ~ '^\d{2}:\d{2}$');

create index if not exists movimientos_referencia on movimientos (cuenta_id, referencia)
  where referencia is not null;

-- 2. Hasta cuándo está conciliada cada cuenta.
alter table cuentas add column if not exists conciliado_hasta timestamptz;

-- 3. Diccionario de categorías aprendidas. Sin unique por clave: dos dispositivos
--    pueden crear la misma regla sin bloquear el sync; la app queda con la más nueva.
create table if not exists reglas_categoria (
  id                uuid primary key,
  usuario_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave             text not null,
  tipo              text not null check (tipo in ('PERSONA', 'COMERCIO')),
  categoria         text not null,
  veces_confirmada  int  not null default 1,
  borrado           boolean not null default false,
  actualizado       timestamptz not null default now()
);
alter table reglas_categoria enable row level security;
create policy "reglas_categoria: dueño" on reglas_categoria
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create trigger reglas_categoria_actualizado before update on reglas_categoria
  for each row execute function set_actualizado();

-- 4. Filas del banco que el usuario marcó "ignorar" (nunca se vuelven a proponer).
create table if not exists conciliar_ignorados (
  id           uuid primary key,   -- determinista: hash(cuenta_id + referencia)
  usuario_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cuenta_id    uuid not null references cuentas(id) on delete cascade,
  referencia   text not null,
  descriptor   text,
  fecha        date,
  monto        numeric,
  borrado      boolean not null default false,
  actualizado  timestamptz not null default now()
);
alter table conciliar_ignorados enable row level security;
create policy "conciliar_ignorados: dueño" on conciliar_ignorados
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create trigger conciliar_ignorados_actualizado before update on conciliar_ignorados
  for each row execute function set_actualizado();
create index if not exists conciliar_ignorados_cuenta on conciliar_ignorados (cuenta_id, referencia);
