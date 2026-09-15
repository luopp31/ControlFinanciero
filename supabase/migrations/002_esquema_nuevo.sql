-- Esquema limpio para Greedy. Corre esto después de 001_archivar_tablas_viejas.sql.
-- Todas las tablas usan Row Level Security: cada usuario solo ve/escribe sus propias filas.

create or replace function set_actualizado()
returns trigger as $$
begin
  new.actualizado = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------- cuentas
create table cuentas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre        text not null,
  rol           text not null check (rol in ('BILLETERA', 'BOVEDA')),
  saldo_inicial numeric not null default 0,
  -- Fecha desde la que los movimientos afectan el saldo. Se fija una sola vez al
  -- crear la cuenta; la app no debe exponer edición libre de este campo (ver plan).
  desde         date not null default current_date,
  borrado       boolean not null default false,
  actualizado   timestamptz not null default now()
);

alter table cuentas enable row level security;
create policy "cuentas: dueño" on cuentas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create trigger cuentas_actualizado before update on cuentas
  for each row execute function set_actualizado();

-- ---------------------------------------------------------------- prestamos
create table prestamos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('PRESTE', 'DEBO')),
  persona     text not null,
  capital     numeric not null,
  acordado    numeric,
  fecha       date not null default current_date,
  borrado     boolean not null default false,
  actualizado timestamptz not null default now()
);

alter table prestamos enable row level security;
create policy "prestamos: dueño" on prestamos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create trigger prestamos_actualizado before update on prestamos
  for each row execute function set_actualizado();

-- ---------------------------------------------------------------- movimientos
create table movimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha       date not null,
  monto       numeric not null,
  tipo        text not null check (tipo in ('GASTO', 'INGRESO', 'REEMBOLSO', 'TRASPASO', 'AHORRO', 'PRESTAMO')),
  categoria   text,
  cuenta_id   uuid not null references cuentas(id) on delete cascade,
  destino_id  uuid references cuentas(id) on delete set null,
  dir         text check (dir in ('PRESTE', 'DEBO', 'COBRO', 'PAGO')),
  prest_id    uuid references prestamos(id) on delete set null,
  evitable    boolean not null default false,
  compartido  boolean not null default false,
  emergencia  boolean not null default false,
  etiqueta    text,
  nota        text,
  borrado     boolean not null default false,
  actualizado timestamptz not null default now()
);

alter table movimientos enable row level security;
create policy "movimientos: dueño" on movimientos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create trigger movimientos_actualizado before update on movimientos
  for each row execute function set_actualizado();

create index movimientos_cuenta_fecha on movimientos (cuenta_id, fecha);
create index movimientos_prest on movimientos (prest_id) where prest_id is not null;

-- ---------------------------------------------------------------- compromisos
-- Cubre dos cosas distintas bajo un mismo "panel de consulta": suscripciones
-- recurrentes (Spotify, Claude...) y compras a cuotas. "tipo" decide qué
-- columnas aplican: SUSCRIPCION usa dia_cobro; CUOTA usa total/pagadas.
create table compromisos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('SUSCRIPCION', 'CUOTA')),
  nombre      text not null,
  monto       numeric not null,
  dia_cobro   integer check (dia_cobro between 1 and 31),
  total       integer,
  pagadas     integer default 0,
  categoria   text,
  borrado     boolean not null default false,
  actualizado timestamptz not null default now()
);

alter table compromisos enable row level security;
create policy "compromisos: dueño" on compromisos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create trigger compromisos_actualizado before update on compromisos
  for each row execute function set_actualizado();

-- ---------------------------------------------------------------- config
-- Un solo documento por usuario. "version" reemplaza el merge por timestamp de reloj
-- local que causó el bug original (un dispositivo recién instalado podía pisar la
-- config buena con un timestamp "más nuevo"). La app debe:
--   1. Leer config y guardar su "version".
--   2. Al escribir: update ... set version = version + 1 where usuario_id = auth.uid()
--      and version = <version leída>.
--   3. Si la actualización afecta 0 filas, hubo un cambio concurrente: releer y
--      reintentar en vez de sobrescribir a ciegas.
create table config (
  usuario_id  uuid primary key references auth.users(id) on delete cascade,
  presupuesto numeric not null default 0,
  nombre      text not null default '',
  cats_extra  jsonb not null default '[]'::jsonb,
  cat_color   jsonb not null default '{}'::jsonb,
  version     integer not null default 0,
  actualizado timestamptz not null default now()
);

alter table config enable row level security;
create policy "config: dueño" on config
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create trigger config_actualizado before update on config
  for each row execute function set_actualizado();
