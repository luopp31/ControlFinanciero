-- Corre esto después de 002_esquema_nuevo.sql (o en cualquier momento si ya
-- lo corriste). Agrega dos cosas que quedaron pendientes de esa migración:
--
-- 1. movimientos.compromiso_id: falta desde 002 -- sin esta columna, el
--    vínculo entre un pago real y la suscripción/cuota a la que corresponde
--    (usado por "Marcar pagado este mes" en Compromisos) no viaja a la nube.
--
-- 2. config.tema y config.ocultar_saldos: la tabla config de 002 no tenía
--    estas dos columnas, aunque la app ya las guarda localmente -- sin ellas,
--    el tema elegido y la preferencia de ocultar saldos nunca se sincronizan.

alter table movimientos
  add column if not exists compromiso_id uuid references compromisos(id) on delete set null;

create index if not exists movimientos_compromiso on movimientos (compromiso_id) where compromiso_id is not null;

alter table config
  add column if not exists tema text check (tema in ('sistema', 'claro', 'oscuro')),
  add column if not exists ocultar_saldos boolean not null default false;
