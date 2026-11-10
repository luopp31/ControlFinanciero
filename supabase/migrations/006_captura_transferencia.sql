-- Captura automática: "Constancia de transferencia" de Interbank. Aditivo: columnas nuevas y un origen más.
-- Aplicar ANTES de publicar la app y de desplegar la Edge Function que lo usan.
--
-- El servidor guarda los nombres de producto tal cual los escribe el banco ("Millonaria", "Simple", "Ahorro Sueldo")
-- y NO sabe qué cuentas tiene el usuario: la app decide si es traspaso, ingreso o gasto. Por eso `tipo` es
-- 'gasto' (Plin, Wallet) o 'transferencia' (a resolver en la app). El número de cuenta nunca llega aquí.

-- 1. Columnas nuevas.
alter table captura_pendiente
  add column if not exists tipo           text not null default 'gasto' check (tipo in ('gasto', 'transferencia')),
  add column if not exists cuenta_destino text;   -- producto de destino ("Simple"); "Simple (USD)" si es en dólares

-- 2. origen admite 'transferencia_correo'. El check se busca por su definición para no depender de su nombre.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'captura_pendiente'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%origen%';
  if c is not null then execute format('alter table captura_pendiente drop constraint %I', c); end if;
end $$;
alter table captura_pendiente
  add constraint captura_pendiente_origen_check check (origen in ('plin_correo', 'wallet', 'transferencia_correo'));

-- 3. captura_registrar: igual que en la 005, con tres cambios:
--    (a) inserta tipo y cuenta_destino;
--    (b) la marca de posible duplicado solo compara capturas de tipo 'gasto' (una transferencia no se confunde con un gasto);
--    (c) mismo límite de ritmo (20 por minuto, 300 por día) e idempotencia por (usuario, dedupe_key).
create or replace function captura_registrar(p jsonb, p_usuario uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dup uuid; v_tipo text := coalesce(p->>'tipo', 'gasto');
begin
  if (select count(*) from captura_pendiente where usuario_id = p_usuario and creado > now() - interval '1 minute') >= 20
  or (select count(*) from captura_pendiente where usuario_id = p_usuario and creado > now() - interval '1 day') >= 300
  then return jsonb_build_object('ok', false, 'motivo', 'limite'); end if;

  if v_tipo = 'gasto' then
    select id into v_dup from captura_pendiente
     where usuario_id = p_usuario and not borrado and estado in ('pendiente', 'clasificado') and tipo = 'gasto'
       and (p->>'monto_centimos') is not null and monto_centimos = (p->>'monto_centimos')::bigint
       and origen <> p->>'origen' and fecha_hora is not null and (p->>'fecha_hora') is not null
       and abs(extract(epoch from (fecha_hora - (p->>'fecha_hora')::timestamptz))) <= 600
     limit 1;
  end if;

  insert into captura_pendiente (usuario_id, dedupe_key, monto_centimos, moneda, destinatario, destino, codigo_operacion,
                                 fecha_hora, cuenta, cuenta_destino, tipo, origen, estado, texto_crudo, posible_duplicado_de)
  values (p_usuario, p->>'dedupe_key', (p->>'monto_centimos')::bigint, coalesce(p->>'moneda', 'PEN'), p->>'destinatario',
          p->>'destino', p->>'codigo_operacion', (p->>'fecha_hora')::timestamptz, p->>'cuenta', p->>'cuenta_destino', v_tipo,
          p->>'origen', coalesce(p->>'estado', 'pendiente'), p->>'texto_crudo', v_dup)
  on conflict (usuario_id, dedupe_key) do nothing
  returning id into v_id;
  return jsonb_build_object('ok', true, 'creado', v_id is not null);
end $$;

revoke all on function captura_registrar(jsonb, uuid) from public, anon, authenticated;
grant execute on function captura_registrar(jsonb, uuid) to service_role;
