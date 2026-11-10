// Prueba de la Edge Function ya desplegada. Uso (PowerShell, desde la raíz del repo):
//   $env:CAPTURA_KEY = Get-Clipboard
//   node supabase/functions/captura/probar.mjs https://<REF>.supabase.co/functions/v1/captura            # solo seguridad (no inserta nada)
//   node supabase/functions/captura/probar.mjs https://<REF>.supabase.co/functions/v1/captura --completo # además inserta 4 filas de prueba
// La clave se lee del entorno y NUNCA se imprime.
const url = process.argv[2];
const completo = process.argv.includes('--completo');
const clave = process.env.CAPTURA_KEY;
if (!url || !clave) {
  console.log('Falta la URL o la variable de entorno CAPTURA_KEY.');
  process.exit(1);
}

let fallos = 0;
async function probar(nombre, { cabeceras = { 'x-captura-key': clave }, cuerpo, metodo = 'POST' }, esperado, extra) {
  let estado = 'sin respuesta';
  let json = null;
  try {
    const r = await fetch(url, { method: metodo, headers: { 'content-type': 'application/json', ...cabeceras }, body: metodo === 'GET' ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });
    estado = r.status;
    json = await r.json().catch(() => null);
  } catch (e) {
    estado = `error de red (${e.name})`;
  }
  const ok = estado === esperado && (!extra || extra(json));
  if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✘'} ${nombre} → ${estado}${json ? ' ' + JSON.stringify(json) : ''}${ok ? '' : `   (esperaba ${esperado})`}`);
}

// "09 Nov 2026 09:39 PM" en hora de Lima, como lo escribe el banco.
function fechaLima(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(d).map((x) => [x.type, x.value]));
  const mes = { Jan: 'Ene', Apr: 'Abr', Aug: 'Ago', Dec: 'Dic' }[p.month] ?? p.month;
  return `${p.day} ${mes} ${p.year} ${p.hour}:${p.minute} ${p.dayPeriod}`;
}
const correo = (codigo, monto) =>
  ['Hola, PRUEBA, te enviamos tu', 'Constancia de Pago Plin', `Código de operación: ${codigo}`, `Fecha y hora: ${fechaLima()}`, 'Cuenta cargo: Cuenta Simple Soles', 'Destinatario: Prueba Prueba', 'Destino: Plin', `Monto y moneda: S/ ${monto}`].join('\n');

console.log('— Seguridad (no inserta nada) —');
await probar('sin clave', { cabeceras: {}, cuerpo: { texto: 'x' } }, 401);
await probar('clave incorrecta', { cabeceras: { 'x-captura-key': 'no-es-la-clave-' + 'z'.repeat(20) }, cuerpo: { texto: 'x' } }, 401);
await probar('GET no permitido', { metodo: 'GET' }, 405);
await probar('cuerpo de más de 16 KB', { cuerpo: { texto: 'x'.repeat(20_000) } }, 413);
await probar('JSON inválido', { cuerpo: 'esto no es json' }, 400);
await probar('formato desconocido', { cuerpo: { hola: 1 } }, 400);
await probar('Wallet con tarjeta Amex', { cuerpo: { origen: 'wallet', monto: 1, comercio: 'x', fecha_hora: new Date().toISOString(), tarjeta: 'amex' } }, 422);

if (completo) {
  console.log('— Inserta 4 filas de prueba —');
  const ok = (creado, estado = 'pendiente') => (j) => j?.ok === true && j.creado === creado && j.estado === estado;
  await probar('correo Plin de prueba (S/ 1.00)', { cuerpo: { texto: correo('PRUEBA01', '1.00') } }, 200, ok(true));
  await probar('el mismo correo otra vez (idempotente)', { cuerpo: { texto: correo('PRUEBA01', '1.00') } }, 200, ok(false));
  await probar('Wallet de prueba que coincide en monto y hora con el correo (queda marcada "¿es el mismo gasto?")', {
    cuerpo: { origen: 'wallet', monto: 1, comercio: 'Comercio Prueba', fecha_hora: new Date().toISOString(), tarjeta: 'interbank' },
  }, 200, ok(true));
  await probar('correo que no se sabe leer (queda sin_leer, sin números de cuenta)', { cuerpo: { texto: 'Constancia de transferencia\nPRUEBA-SIN-LEER\nMonto: S/ 3.00' } }, 200, ok(true, 'sin_leer'));
  console.log('\nLimpieza (SQL Editor) cuando termines de revisar:');
  console.log("  delete from captura_pendiente where destinatario in ('Prueba Prueba','Comercio Prueba') or texto_crudo like '%PRUEBA-SIN-LEER%';");
  console.log('Revisión: la fila de Wallet debe tener posible_duplicado_de con el id de la fila del correo.');
}

console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} prueba(s) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
