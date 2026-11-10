-- Captura automática (Fase 2a): bandeja de gastos que llegan por correo de Interbank (Atajo de iOS) o por Wallet.
-- Solo aditivo, salvo ampliar el check de movimientos.origen. Aplicar ANTES de publicar el código de la app que lo usa.
-- NO agrega movimientos.codigo_operacion (se agregará el día que el PDF del banco traiga el código).

-- 1. movimientos.origen admite 'captura' (los movimientos creados desde la bandeja).
--    Se busca el check por su definición para no depender del nombre que le puso Postgres.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'movimientos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%origen%';
  if c is not null then execute format('alter table movimientos drop constraint %I', c); end if;
end $$;
alter table movimientos
  add constraint movimientos_origen_check check (origen in ('manual', 'conciliar', 'captura'));

-- 2. Bandeja de capturas pendientes.
create table if not exists captura_pendiente (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dedupe_key           text not null,                 -- 'op:<código>' o 'h:<hash monto|destinatario|minuto>' o 's:<hash>' (sin_leer)
  monto_centimos       bigint check (monto_centimos > 0 and monto_centimos < 10000000),
  moneda               text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  destinatario         text,
  destino              text check (destino in ('Plin', 'Yape')),
  codigo_operacion     text,
  fecha_hora           timestamptz,                   -- hora de Lima (UTC-5)
  cuenta               text,                          -- 'Simple' o 'Millonaria' (por nombre)
  origen               text not null check (origen in ('plin_correo', 'wallet')),
  categoria            text,
  estado               text not null default 'pendiente' check (estado in ('pendiente', 'clasificado', 'descartado', 'sin_leer')),
  movimiento_id        uuid references movimientos(id) on delete set null,
  posible_duplicado_de uuid references captura_pendiente(id) on delete set null,
  texto_crudo          text check (char_length(texto_crudo) <= 8000),   -- solo si sin_leer, ya sin números de cuenta
  borrado              boolean not null default false,
  creado               timestamptz not null default now(),
  actualizado          timestamptz not null default now(),
  unique (usuario_id, dedupe_key)
);

alter table captura_pendiente enable row level security;
create policy "captura_pendiente: dueño" on captura_pendiente
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create trigger captura_pendiente_actualizado before update on captura_pendiente
  for each row execute function set_actualizado();

create index if not exists captura_pendiente_estado on captura_pendiente (usuario_id, estado) where not borrado;

-- 3. Único punto de escritura de la Edge Function: idempotente, con límite de ritmo y marca de posible duplicado.
--    La función solo puede ejecutar esto (no lee ni borra otros datos).
create or replace function captura_registrar(p jsonb, p_usuario uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dup uuid;
begin
  if (select count(*) from captura_pendiente where usuario_id = p_usuario and creado > now() - interval '1 minute') >= 20
  or (select count(*) from captura_pendiente where usuario_id = p_usuario and creado > now() - interval '1 day') >= 300
  then return jsonb_build_object('ok', false, 'motivo', 'limite'); end if;

  select id into v_dup from captura_pendiente
   where usuario_id = p_usuario and not borrado and estado in ('pendiente', 'clasificado')
     and (p->>'monto_centimos') is not null and monto_centimos = (p->>'monto_centimos')::bigint
     and origen <> p->>'origen' and fecha_hora is not null and (p->>'fecha_hora') is not null
     and abs(extract(epoch from (fecha_hora - (p->>'fecha_hora')::timestamptz))) <= 600
   limit 1;

  insert into captura_pendiente (usuario_id, dedupe_key, monto_centimos, moneda, destinatario, destino, codigo_operacion,
                                 fecha_hora, cuenta, origen, estado, texto_crudo, posible_duplicado_de)
  values (p_usuario, p->>'dedupe_key', (p->>'monto_centimos')::bigint, coalesce(p->>'moneda', 'PEN'), p->>'destinatario',
          p->>'destino', p->>'codigo_operacion', (p->>'fecha_hora')::timestamptz, p->>'cuenta', p->>'origen',
          coalesce(p->>'estado', 'pendiente'), p->>'texto_crudo', v_dup)
  on conflict (usuario_id, dedupe_key) do nothing
  returning id into v_id;
  return jsonb_build_object('ok', true, 'creado', v_id is not null);
end $$;

revoke all on function captura_registrar(jsonb, uuid) from public, anon, authenticated;
grant execute on function captura_registrar(jsonb, uuid) to service_role;
