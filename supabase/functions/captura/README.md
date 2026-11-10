# Edge Function `captura`

Recibe lo que manda el Atajo de iOS (correo de Interbank o pago de Wallet) y lo deja en `captura_pendiente`
(migración `005_captura.sql`). El Atajo **no interpreta nada**: manda el texto crudo y el servidor lo lee.

**Solo inserta**, y lo hace llamando a una única función SQL (`captura_registrar`, con límite de 20 por minuto y
300 por día e idempotente). No lee ni borra otros datos. **El número de cuenta y de tarjeta nunca se guarda.**

## Lo que debe mandar el Atajo

```
POST https://<REF>.supabase.co/functions/v1/captura
Content-Type: application/json
x-captura-key: <la clave secreta, 64 caracteres hexadecimales>
```

`<REF>` es la primera parte de la URL de tu proyecto de Supabase (`https://<REF>.supabase.co`).

**Correo de Interbank** (el cuerpo completo, sin tocar):
```json
{ "texto": "<cuerpo completo del correo>" }
```

**Wallet** (solo la tarjeta de débito Interbank):
```json
{ "origen": "wallet", "monto": 12.5, "comercio": "Nombre del comercio",
  "fecha_hora": "2026-11-09T21:39:00-05:00", "tarjeta": "interbank" }
```
- `monto` acepta un número (`12.5`), texto con o sin símbolo (`"S/ 12.50"`, `"12,50"`, `"1,234.50"`, `"12.50 PEN"`) o una lista de un solo valor (`[12.5]`). Sin símbolo o con `S/` es en soles; con `US$`, `USD` o `$` es en dólares (la bandeja pedirá el monto en soles). Se rechaza 0, negativos y desde S/ 100,000 (400 `monto`).
- `comercio` es opcional: si falta o viene vacío se guarda como "Sin nombre" y la captura entra igual.
- `fecha_hora` en ISO 8601 con zona (`2026-11-09T21:39:00-05:00`, `...Z`, `...+00:00`, con fracción de segundos o con la zona pegada `-0500`). Si falta, viene vacía o **no es un ISO válido** (`09/11/2026`, `9 nov 2026`, `ayer`, un día imposible como el 31 de febrero) se usa la hora actual de Lima: el Atajo corre al pagar, así que no se pierde la compra y no se adivina una fecha que podría salir equivocada. Sin zona se toma como hora de Lima. Un ISO **válido pero fuera de rango** (más de un día en el futuro o de 400 días atrás) sí se rechaza con 400 `fecha_hora`. Esto es solo para Wallet: el correo Plin sigue estricto (si su fecha no se puede leer, queda `sin_leer`).
- `tarjeta` es opcional; si viene y no es `interbank` (por ejemplo la Amex) se rechaza con 422.

**Respuestas**

| Código | Significa |
|---|---|
| `200 {"ok":true,"creado":true,"estado":"pendiente"}` | Guardado en la bandeja |
| `200 {"ok":true,"creado":false,...}` | Ya estaba (mismo código de operación o mismo gasto): no se duplica |
| `200 {"ok":true,"creado":true,"estado":"sin_leer"}` | No supe leer el correo: se guardó sin números de cuenta para revisarlo |
| `400` | JSON o campos inválidos (`json`, `formato`, `monto`, `comercio`, `fecha_hora`, `texto_vacio`) |
| `401 {"ok":false}` | Clave incorrecta o ausente |
| `405` | No es POST |
| `413` | Cuerpo de más de 16 KB |
| `422 {"motivo":"tarjeta_no_soportada"}` | Wallet con otra tarjeta |
| `429` | Más de 20 por minuto o 300 por día |
| `500 {"motivo":"configuracion"}` | Faltan los secretos de la función |
| `502` | Error al escribir en la base |

## Desplegar (en este orden, PowerShell, desde la raíz del repo)

No hace falta instalar nada: se usa `npx supabase`. **Nunca pegues la clave en el chat.**

```powershell
# 1. Iniciar sesión (abre el navegador)
npx supabase login

# 2. Enlazar el proyecto. Si pide la contraseña de la base de datos, déjala en blanco (Enter).
npx supabase link --project-ref <REF>

# 3. Secretos de la función
#    Tu id de usuario: Supabase -> Authentication -> Users -> columna UID de tu cuenta.
npx supabase secrets set CAPTURA_USUARIO=<tu-uid>
#    La clave: se genera, se guarda como secreto y se copia al portapapeles (no se imprime).
$k = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx supabase secrets set CAPTURA_KEY=$k
Set-Clipboard $k

# 4. Desplegar SIN verificación de JWT (Atajos no puede mandar uno; la protección es la clave).
npx supabase functions deploy captura --no-verify-jwt
#    Si pide Docker, agrega --use-api

# 5. Probar la seguridad (no inserta nada)
$env:CAPTURA_KEY = Get-Clipboard
node supabase/functions/captura/probar.mjs https://<REF>.supabase.co/functions/v1/captura
#    Y, si quieres, con filas de prueba (4):  ... --completo
```

Los secretos son `CAPTURA_USUARIO`, `CAPTURA_KEY` y, solo al rotar, `CAPTURA_KEY_ANTERIOR`. `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` los pone Supabase automáticamente.

## Rotar la clave si se filtra

```powershell
$vieja = <la clave actual>        # si la perdiste, salta este paso y usa el apagado de abajo
$k = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx supabase secrets set CAPTURA_KEY_ANTERIOR=$vieja CAPTURA_KEY=$k      # las dos valen un rato
Set-Clipboard $k
# Cambia la clave en el Atajo (cabecera x-captura-key) y prueba que sigue funcionando. Luego:
npx supabase secrets unset CAPTURA_KEY_ANTERIOR                          # la vieja deja de servir
```
**Apagado de emergencia:** `npx supabase secrets unset CAPTURA_KEY` (la función responde 500 a todo) o borrar la función.
Lo peor que puede hacer quien tenga la clave es meter filas basura (máximo 20 por minuto y 300 por día); se descartan
desde la Bandeja.

## Armar el Atajo en el iPhone

Los nombres pueden variar un poco según tu versión de iOS. La clave pásala al iPhone por un canal privado tuyo
(p. ej. Notas de iCloud desde icloud.com), **no por el chat**.

**Correo de Interbank**
1. App Atajos -> pestaña **Automatización** -> **+** -> **Correo electrónico**.
2. **Remitente**: `servicioalcliente@netinterbank.com.pe`. Marca **Ejecutar inmediatamente**; desactiva **Notificar al ejecutarse**. Siguiente.
3. Acción **Obtener contenido de URL**:
   - **URL**: `https://<REF>.supabase.co/functions/v1/captura`
   - Toca la flecha para ver las opciones. **Método**: `POST`.
   - **Encabezados** -> *Añadir encabezado*: `Content-Type` = `application/json` y `x-captura-key` = tu clave.
   - **Cuerpo de la solicitud**: `JSON` -> *Añadir nuevo campo* -> tipo **Texto**, clave `texto`, y como valor la variable **Entrada del atajo** (el correo). Si te deja elegir, usa su **Cuerpo**.
4. Listo. Para probarlo sin esperar un correo, ejecuta la automatización a mano con un correo de prueba.

**Wallet (solo la tarjeta de débito Interbank)**
1. Automatización -> **+** -> **Transacción** (Wallet). Elige **solo** la tarjeta de débito Interbank. **Ejecutar inmediatamente**.
2. **Obtener contenido de URL**, mismo URL, método `POST` y mismos dos encabezados.
3. Cuerpo **JSON**, con estos campos:
   - `origen` (Texto): `wallet`
   - `monto`: la variable *Importe*, tal como llegue (número, o texto como "S/ 12.50"); no hace falta convertirla.
   - `comercio` (Texto): la variable *Comercio* (opcional).
   - `fecha_hora` (Texto): *Fecha actual* con **Dar formato a la fecha** -> ISO 8601 (opcional: si no se manda, se usa la hora actual).
   - `tarjeta` (Texto): `interbank`
