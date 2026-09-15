-- Archiva (no borra) las tablas de la app anterior "Sol". Corre esto primero,
-- en el SQL editor de tu proyecto de Supabase, antes de la migración 002.
-- Si alguna tabla no existe en tu proyecto, comenta esa línea y sigue con las demás.

alter table if exists movimientos rename to movimientos_old;
alter table if exists prestamos   rename to prestamos_old;
alter table if exists compromisos rename to compromisos_old;
alter table if exists config      rename to config_old;
