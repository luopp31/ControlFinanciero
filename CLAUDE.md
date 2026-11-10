# Greedy · Contexto del proyecto

> Reemplaza a Networth (el código viejo se quitó del repo; sigue en el historial de git). Documento de traspaso: léelo antes de tocar el código.
> Guardar en la raíz del repo como `CLAUDE.md`. Si el repo ya tiene uno, fusionar, no pisar.
> **El repo es público: aquí no van montos, saldos, deudas, nombres de personas ni números de cuenta o de tarjeta.** Los datos reales viven en Supabase y en `datos-privados/` (ignorado por git).

Última actualización: 2026-11-09 (Fase 1 hecha: Conciliar, registro rápido y gasto del mes). La arquitectura viene de la lectura del repo hecha por Claude Code; lo marcado "a confirmar" no está verificado.

---

## Qué es

PWA de finanzas personales ("Tu plata, tus cuentas, tus deudas — todo en un solo lugar, claro y correcto"). Reescritura de Networth. Producción en Netlify: https://greedy-luopp31.netlify.app/ (despliega desde `main`). **Preview de pruebas: https://preview--greedy-luopp31.netlify.app/** (ver "Despliegue").

**Usuario principal:** Lu. Habla español informal. Desde noviembre de 2026 vive en Lima por un servicio de varias semanas, ya sin el régimen 14x7 de la mina. Necesita **medir todos sus gastos en Lima**, y en Lima casi todo lo paga por Plin. Usa iPhone 16. Todo su dinero está en Interbank.

**Estado:** app creada hace poco, le faltan muchas mejoras. Uso real de Lu y un grupo pequeño de amigos.

**Cómo se trabaja:** las decisiones de producto se discuten en el chat del Project "Networth" de claude.ai. El código lo escribe Claude Code en VS Code. Lo decidido allá llega aquí vía este archivo.

---

## Stack

React 19 + TypeScript + Vite 8, PWA con `vite-plugin-pwa`. Supabase (Postgres + Auth) como respaldo y sincronización, sin servidor propio. `pdfjs-dist` para leer las constancias del banco (solo en el navegador). Vitest cubre la lógica pura (`fecha`, `finanzas`, `simulacion`, `saludo`, `constancia`, `clasificador`, `emparejar`, `verificar`, `planificar`, `presupuesto`, migración de IndexedDB con `fake-indexeddb`). La UI no tiene tests.

## Arquitectura

- `src/App.tsx`: sin router. Una variable `vista` elige pantalla: `panel`, `movimientos`, `cuentas`, `estadisticas`, `compromisos`, `ajustes` y `conciliar`. **`conciliar` no tiene pestaña** en la barra: se entra desde la tarjeta "Conciliar con el banco" del Panel y de Cuentas. Sin sesión ni cuentas muestra `Bienvenida`.
- `src/pages/<Vista>/`: `index.tsx` reúne datos; `.mobile.tsx` y `.desktop.tsx` son la presentación (elegida con `useIsDesktop`). `pages/Conciliar/` es una sola vista responsive (`index.tsx`, `FilaPorClasificar`, `TarjetaVerificacion`).
- `src/components/`: `AppShell`, `MovimientoForm` (el más grande), `RegistroRapido` (el "+" flotante, hoja inferior arrastrable) con `RegistroRapidoForm` (gasto en pocos segundos), `GastoDelMes` (Panel), `TarjetaConciliar`, tarjetas, gráficos, `SyncPanel`.
- `src/hooks/`: `useStore` (CRUD local + sync genérico) y un hook delgado por entidad (`useCuentas`, `useMovimientos`, `usePrestamos`, `useCompromisos`, `useReglas`, `useIgnorados`), más `useConfig` y `useAuth`.
- `src/lib/`:
  - Núcleo: `finanzas.ts` (toda la matemática: saldos, valor neto, gasto por categoría, préstamos), `db.ts` (IndexedDB), `sync.ts`, `fecha.ts`, `formato.ts`, `simulacion.ts`, `presupuesto.ts`, `frecuentes.ts`.
  - Conciliar (todo puro y con tests, salvo `pdf.ts` y `guardarPlan.ts`): `pdf.ts` (lee el PDF con pdfjs, import dinámico), `constancia.ts` (parser), `clasificador.ts` (tipo de fila + diccionario), `emparejar.ts` (empareja con lo que hay), `verificar.ts` (saldo), `planificar.ts` (decisiones → escrituras), `guardarPlan.ts` (las guarda en IndexedDB).

## Modelo de datos (igual en IndexedDB y Supabase)

- **cuentas:** `rol` BILLETERA o BOVEDA, `saldo_inicial`, `desde`, `conciliado_hasta` (instante hasta el que la última conciliación cuadró). El saldo no se guarda: se calcula como saldo inicial + efecto de los movimientos con fecha igual o posterior a `desde`.
- **movimientos:** `tipo` GASTO, INGRESO, REEMBOLSO, TRASPASO, AHORRO o PRESTAMO. Traspasos usan `destino_id`; préstamos `dir` y `prest_id`; pagos de compromisos `compromiso_id`. También `categoria`, `nota`, `fecha`. Los importados del banco además llevan `referencia`, `descriptor`, `origen` y `hora` (ver Conciliar).
- **prestamos:** `tipo` PRESTE o DEBO, `persona`, `capital`, `acordado`. El pendiente se calcula a partir de los movimientos ligados por `prest_id`.
- **compromisos:** `tipo` SUSCRIPCION (`dia_cobro`) o CUOTA (`total`, `pagadas`).
- **reglas_categoria** (diccionario del Conciliar): `clave`, `tipo` PERSONA o COMERCIO, `categoria`, `veces_confirmada`.
- **conciliar_ignorados:** `cuenta_id`, `referencia`, y `descriptor`, `fecha`, `monto` solo para mostrar.
- **config:** una fila por usuario: `presupuesto` (mensual, 0 = sin presupuesto; lo usa el Panel), `nombre`, `cat_color`, `tema`, `ocultar_saldos`. `cats_extra` sigue en la tabla pero la app no lo usa (las categorías están en el código).
- Borrado lógico (`borrado`), nunca `delete`. Categorías de gasto e ingreso en `finanzas.ts` (ingreso incluye Sueldo, Extras, Trabajos aparte, Ventas, Liquidación, **Intereses** y Otros).

## Backend y sync

- RLS por `usuario_id` en cada tabla. Migraciones (todas aplicadas): `001` (renombra las tablas de la app anterior a `*_old`; **no volver a correrla**), `002` (esquema nuevo), `003` (`compromiso_id`, `tema`, `ocultar_saldos`), **`004_conciliar`** (columnas `referencia`, `descriptor`, `origen`, `hora` en `movimientos`; `cuentas.conciliado_hasta`; tablas `reglas_categoria` y `conciliar_ignorados`, con RLS, `actualizado` y borrado lógico). Las migraciones solo se aplican a mano en el SQL Editor de Supabase, **antes** de publicar el código que las usa.
- `sync.ts` es offline-first: guarda en IndexedDB y sube con 1,5 s de retraso tras cada cambio. En movimientos y demás tablas gana el `actualizado` más nuevo. En `config` gana la `version` más alta (evita que un reloj desfasado pise la config buena). Orden de subida por claves foráneas: cuentas, préstamos, compromisos, movimientos, reglas, ignorados.
- IndexedDB está en la **versión 2** (`reglas_categoria` e `ignorados` son stores nuevos); la migración solo crea los que faltan y no toca datos (test en `db.test.ts`).
- Ids deterministas: los movimientos importados y los ignorados usan un uuid derivado de cuenta + referencia, para que importar el mismo PDF desde dos dispositivos no duplique. Las reglas usan uuid aleatorio (un id derivado de la clave chocaría entre usuarios por RLS); si dos dispositivos crean la misma regla, `reglasVigentes` se queda con la más nueva.
- Credenciales de Supabase nunca en el código ni en el repo.

## Despliegue

- **Producción** (`greedy-luopp31.netlify.app`): despliega desde `main`. No se toca sin que Lu lo pida.
- **Preview** (`preview--greedy-luopp31.netlify.app`): **no se actualiza con `git push`**. Se publica a mano con `npm run build` y luego `npx netlify-cli deploy --dir=dist --alias preview` (el proyecto ya está enlazado). Es lo que Lu abre en el iPhone para probar.
- La app instalada en el iPhone guarda la versión vieja: tras publicar hay que cerrarla del todo y abrirla dos veces para que se actualice.

---

## Estado de los datos (reinicio del 2026-11-09)

- Greedy en la nube estaba vacío. El historial viejo (app anterior) está en `movimientos_old` y `prestamos_old`: **no tocar**. `prestamos_old` no se ha revisado.
- **Cuentas:** Simple (BILLETERA) y Millonaria (BOVEDA), ambas con `desde` 2026-11-02. El saldo inicial de cada una es el saldo disponible del banco al cierre del 1 nov.
- **Movimientos cargados:** los del 2 al 8 nov. Los saldos de Greedy se verificaron contra el banco y coinciden.
- **Préstamos:** uno por cobrar (PRESTE, con fecha aproximada anterior a `desde`) y la deuda de la tarjeta Amex como DEBO "Me prestaron" (compras anteriores).
- **Regla:** los préstamos pendientes cuentan en el valor neto sin importar su fecha. `desde` solo excluye movimientos del saldo de cuentas. Para registrar un préstamo viejo sin tocar saldos, fecharlo antes de `desde`.
- **Uso diario:** los pagos de la Amex son pago de préstamo (bajan la deuda, no son gasto); los cobros de un préstamo PRESTE son cobro del préstamo.
- **Efectivo no es cuenta:** un retiro de cajero cuenta completo como gasto. Uno de los retiros quedó partido en dos movimientos (Vivienda y Efectivo), y el Conciliar lo reconoce como coincidencia dividida.
- Hay una transferencia de la Millonaria del 3 nov que **no está cargada a propósito**: fue una compra que ya estaba descontada del saldo inicial. Al conciliar sale como "nueva" y se marca "Ignorar".

## Cuentas de Interbank y reglas para leer movimientos

Verificado con los correos y estados de cuenta de Lu (2026-11-09).

**Cuentas:** solo usa Simple y Millonaria. Hay dos cuentas más que siempre están en cero y no se modelan:
- **Ahorro Sueldo:** es solo una cuenta para recibir pagos de trabajos. Lo que llega ahí lo pasa a la Millonaria. Una transferencia **Ahorro Sueldo → Millonaria es un INGRESO** (así se cargó la liquidación), no un traspaso.
- **Cuenta Simple en dólares:** solo la usa para pagar cosas en dólares. Una transferencia **Millonaria → cuenta en dólares es un GASTO** (por ejemplo, una suscripción pagada en dólares). Greedy sigue sin cuentas en dólares.
- **Traspasos Simple ↔ Millonaria:** TRASPASO. Se emparejan por el mismo minuto y monto opuesto en las constancias de ambas cuentas.

**Constancia de movimientos (PDF de la app):** es texto. Trae saldo contable y disponible, y las columnas "Cargo realizado por / Fecha y hora / Monto". No trae saldo por movimiento. Los movimientos "en proceso" salen arriba, con la fecha real de la compra, pero el saldo contable aún no los incluye: **conciliar contra el saldo disponible**. Un movimiento en proceso se asienta días después con otra fecha. Los nombres vienen cortados: `YAPE-<nombre>` es un Plin hacia el Yape de una persona y `PLIN-<nombre>` es un Plin hacia Plin. Cada fila trae día de la semana, día, mes, hora y monto con signo; el año no viene (se toma el de la consulta y se valida con el día de la semana). El PDF puede traer 20 o 60 filas según cómo se exporte.

**Correos de Interbank** (remitente `servicioalcliente@netinterbank.com.pe`):
- "Constancia de Pago Plin": código de operación, fecha y hora, cuenta de cargo, destinatario con nombre completo, destino (Yape o Plin) y monto. No trae concepto.
- "Constancia de transferencia" (entre cuentas propias) y "Constancia de Pago" (QR y pagos online). Algún pago llegó duplicado (aviso de consumo + constancia).
- **No llegan correos** por compras con tarjeta en tienda (farmacias, supermercados, Oxxo) ni por el retiro del cajero. En una semana de prueba, 15 de 21 gastos tenían correo.

---

## Conciliar (hecho): cómo funciona

Flujo: Lu sube la constancia (PDF) de cada cuenta (puede subir varias a la vez; la cuenta se detecta por el nombre que escribe el banco y, si no la reconoce, pregunta). El PDF **se lee solo en el navegador**: no se sube a Supabase ni a Netlify, y el número de cuenta se descarta al leer (nunca se guarda ni se muestra). Si hay dos constancias de la misma cuenta vale la más reciente.

1. **Resumen** por PDF: filas leídas, anteriores a `desde` (se descartan y se cuentan) y líneas que no se pudieron leer (nunca se ignoran en silencio).
2. **Tres grupos:** "ya estaban", "nuevos" (los conocidos se rellenan solos; el resto va a la cola "por clasificar") y "solo en Greedy" (el banco no los muestra: posible duplicado o error).
3. **Cola por clasificar:** monto, nombre, fecha, 3 categorías como chips, "Confirmar sugeridas" e "Ignorar esta línea".
4. **Cierre:** tarjeta grande **Cuadra** o **Difiere S/ X** (con lo que falta o sobra) por cuenta, y botón "Cargar N movimientos" / "Guardar conciliación". **No hay botón de cuadrar a mano.** Si cuadra, la cuenta guarda `conciliado_hasta`, que se ve en el Panel, en Cuentas y en la propia pantalla de Conciliar.

**Qué es cada fila del banco** (`clasificador.ts`):
- `YAPE-<nombre>` / `PLIN-<nombre>`: Plin a una persona. Cargo = gasto; abono = se pregunta si es ingreso o reembolso.
- `Transf Web/App`: si la otra cuenta trae el lado opuesto (mismo monto, mismo minuto) se funde en **un solo TRASPASO**; si no, se pregunta (entre mis cuentas / ingreso (sueldo) / pago en dólares (gasto) / otro).
- `RETIRO CAJERO`: gasto, categoría Efectivo, monto completo. `INTERES GANADO`: ingreso, categoría **Intereses**, automático.
- `PAGO MI TC`: pago de la tarjeta de crédito = movimiento de préstamo `dir PAGO` ligado al préstamo "Amex" pendiente (no es gasto); pide confirmar.
- Cualquier otra cosa (supermercados, farmacias, Oxxo, IZI, CULQI, BCP*…): comercio, es un gasto.

**Reglas del emparejador** (`emparejar.ts`; se hace por cuenta, y el TRASPASO de Greedy empareja sus dos lados por separado porque `efecto()` ya da el efecto sobre cada cuenta):
1. Mismo `referencia` del banco: coincide sin más.
2. Si no, mismo monto exacto (en céntimos), misma cuenta y fecha a ±3 días, 1 a 1, primero el más cercano en tiempo. **El nombre del banco solo desempata**: las notas que escribe Lu a mano (por ejemplo "Corte de cabello (Yape a …)") no contienen el descriptor del banco, así que no puede ser requisito.
3. Coincidencia **dividida**: si una fila no empareja 1 a 1, se prueban 2 o 3 movimientos sin emparejar, del mismo signo y a ±3 días, cuya suma sea igual (un retiro de cajero partido en dos categorías).
4. Un movimiento solo coincide con una fila. Lo que queda: "nuevos" (banco sin Greedy) y "solo en Greedy" (dentro del rango del PDF; si el PDF no llega hasta `desde`, el primer día no se juzga porque viene cortado a medias; lo posterior a la hora de la consulta tampoco).
- **Idempotencia:** `referencia` = hash de cuenta + fecha + hora + monto + descriptor (+ ordinal si hay filas idénticas). Subir el mismo PDF dos veces no cambia nada. Si el banco asienta una compra "en proceso" con otra fecha, sigue coincidiendo por monto/fecha y queda marcada `referenciaDistinta`.

**Ignorar:** guarda la fila en `conciliar_ignorados` (cuenta + referencia) y no se vuelve a proponer ni se empareja.

**Hora:** los movimientos importados guardan `hora` (HH:MM). Los manuales no la tienen. La verificación cuenta, el mismo día de la consulta, solo los que se sabe que son anteriores a la hora de la consulta (los sin hora cuentan). `conciliado_hasta` se guarda en hora de Lima (UTC-5, sin horario de verano) y nunca retrocede.

**Diccionario** (`reglas_categoria`): al clasificar una fila, se aprende la clave (descriptor en mayúsculas, sin dígitos). **Comercios:** automáticos desde la primera vez; coinciden por clave exacta o por las palabras iniciales en común (así dos sucursales de la misma cadena comparten regla). **Personas:** solo clave exacta (los nombres vienen cortados) y la regla se sugiere rellenada pero pide un toque hasta que se confirmó **2 veces** con la misma categoría; otra categoría la reinicia en 1. Dos filas de la misma persona en una importación cuentan como una sola confirmación. Cada conciliación también **siembra** reglas desde los "ya estaban" con `veces_confirmada = 1`, sin pisar las existentes.

**Dinero en céntimos enteros** dentro del parser, el emparejador y la verificación (evita errores de coma flotante).

## Registro rápido y gasto del mes (hecho)

- **Registro rápido:** el "+" abre una hoja con monto (teclado numérico enfocado), las 6 categorías más usadas en los últimos 60 días, cuenta Simple (la billetera) y fecha de hoy por defecto, y nota opcional. Sin categoría se guarda como "Sin identificar". "Más opciones" abre `MovimientoForm` con el monto ya escrito. Escribir solo cambia el estado local de ese bloque (en iOS repintar toda la vista cierra el teclado).
- **Gasto del mes en el Panel:** tarjeta "Gasto de <mes>" con "Llevas S/ X de S/ Y, te quedan S/ Z" y barra (verde, ámbar al 85 %, rojo si te pasas). El gasto es neto: el reembolso resta, igual que en Estadísticas. Sin presupuesto, invita a fijarlo con un campo simple (`config.presupuesto`).

---

## Principios heredados de Networth (a confirmar con Lu)

No están en el repo; vienen del diseño anterior. Si contradicen una feature, la feature está mal.

1. **No registres lo que no vas a cambiar.** Si un dato no puede modificar una decisión, no se registra.
2. **Un gasto es dinero que sale hacia otra persona.** Entre cuentas propias es traspaso: no se categoriza ni suma al gasto.
3. **Un caño, no cuatro.** Todo gasto sale de una billetera.
4. **Concilia por transacción, no por saldo.** El saldo es solo la verificación final.
5. **El saldo total es exacto; las categorías son aproximadas.** Perseguir el céntimo hace que la gente abandone.

Reglas de negocio vigentes en el modelo: el reembolso resta de la categoría (no es ingreso); el préstamo no cambia el valor neto al registrarse; retiro de cajero = el gasto completo, sin perseguir vueltos; máximo ~10 categorías visibles.

## Lecciones que ya costaron (de Networth y de esta fase)

- Un dispositivo nuevo nunca debe subir un valor vacío encima de uno bueno (ya pasó una vez con la config).
- Al agregar un campo a `movimientos`, agregar también la columna en Supabase o el sync falla con 400. Aplicar el SQL **antes** de publicar el código.
- Un `oninput` que repinta toda la vista cierra el teclado en iOS. Actualizar solo el bloque afectado.
- En iOS, enfocar un input fuera de un toque directo puede no abrir el teclado; el registro rápido enfoca el monto con un retraso de 320 ms (después de la animación de la hoja): **probar en el iPhone real**.
- Hay usuarios reales: un cambio roto les llega a todos a la vez.
- Un dispositivo con datos locales viejos sin subir puede mezclarlos con los nuevos al volver el sync. Revisar antes de reiniciar datos.
- El preview de Netlify se publica a mano (ver "Despliegue"); un `git push` no lo actualiza.
- El repo es público: no subir PDFs, CSV ni notas con datos reales (ni siquiera en tests o documentación).

## Decisiones de diseño tomadas

- Barra de navegación siempre visible (Conciliar es una vista sin pestaña).
- Sin cuentas en dólares por ahora.
- Sin localStorage/sessionStorage (la persistencia es IndexedDB).
- Tema oscuro azul pizarra (`#0F172A`).
- **Conciliar = importar la constancia de movimientos** (decisión de Lu). Ya implementado.
- Privacidad: los PDFs y el CSV de datos reales viven en `datos-privados/` y `movimientos_greedy_*.csv`, ambos en `.gitignore`; los tests usan fixtures sintéticas. Nunca guardar ni imprimir números de cuenta o de tarjeta.

---

## Prioridades actuales

Hecho en la Fase 1: registro rápido, gasto del mes con presupuesto en el Panel y Conciliar con la constancia (parser, diccionario, emparejador, verificación, "ignorar", "Conciliado hasta").

**Falta / siguiente:**
1. **Probar con gastos reales de Lu durante una semana** antes de agregar nada más: conciliar en el preview con los PDFs reales, usar el "+" a diario y fijar el presupuesto. Revisar en el iPhone que el teclado del registro rápido abra bien.
2. **Revisar el sync de lo nuevo contra Supabase** tras la primera conciliación real (que aparezcan `conciliar_ignorados`, `conciliado_hasta` en las dos cuentas y `reglas_categoria`).
3. **Fase 2 — captura automática al instante** (después de probar): una PWA no puede leer notificaciones ni otras apps. Vías evaluadas:
   - **Correo de Interbank:** cubre Plin, QR y transferencias. Se leería desde Gmail y entraría por un punto de entrada protegido con clave propia, a una bandeja "por clasificar".
   - **Atajos de iOS con disparador de Wallet:** cubriría compras en tienda, solo si Lu paga con Apple Pay (agregar la tarjeta Interbank a Wallet). Atajos también puede reaccionar a correos de un remitente.
   - Alerta de consumo de la app de Interbank: Lu debe revisar si tiene un monto mínimo, porque algunos consumos sí llegan por correo.
4. Publicar en producción cuando Lu lo decida (hoy producción tiene una versión vieja).

**No hacer ahora:** importar el estado de cuenta de la tarjeta Amex; usar las marcas sin uso (`evitable`, `compartido`, `emergencia`, `etiqueta`: están en la tabla pero la app no las usa ni las sube); modo mina/descanso (Lu ya no está en rotación 14x7); mejoras de la versión web (Fase 3).

## Cómo trabajar

- Un cambio a la vez, verificado, antes del siguiente.
- Probar la lógica con datos reales (en local, sin subirlos al repo); agregar tests con datos inventados cuando se toque la lógica pura. La UI se puede probar con Edge sin ventana (`--headless=new --remote-debugging-port`) manejándolo por el protocolo CDP.
- Al terminar, decir qué archivos cambiaron y si hace falta SQL en Supabase (nueva migración numerada, solo aditiva).
- No tocar las tablas `*_old`. Nada destructivo sin confirmar.
- Si una idea no vale la pena, decirlo en vez de solo construirla.
