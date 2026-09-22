export function hoyISO(): string {
  return isoDe(new Date());
}

/** Fecha ISO de hace `n` días (0 = hoy), en hora local — nunca UTC, para evitar
 * el desfase de un día que sufrió la app anterior cerca de la medianoche. */
export function menosDiasISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDe(d);
}

/** Primer día del mes actual, en ISO — para filtrar "este mes". */
export function inicioMesISO(desde: Date = new Date()): string {
  return isoDe(new Date(desde.getFullYear(), desde.getMonth(), 1));
}

/** Primer día del año actual, en ISO — para filtrar "este año". */
export function inicioAnioISO(desde: Date = new Date()): string {
  return isoDe(new Date(desde.getFullYear(), 0, 1));
}

function isoDe(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function parsearISO(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function diasEnMes(anio: number, mesIndice0: number): number {
  return new Date(anio, mesIndice0 + 1, 0).getDate();
}

/**
 * El rango [desde, hasta] (ISO) inmediatamente anterior a [desde, hasta] y de
 * su misma duración — para comparar "este período" contra el equivalente
 * previo (ej. últimos 30 días vs los 30 antes de esos). `null` cuando
 * `desde` es el centinela de "todo" (no hay período anterior que comparar).
 */
export function rangoAnteriorIgualDuracion(desde: string, hasta: string): { desde: string; hasta: string } | null {
  if (desde <= '0000-01-01') return null;
  const dDesde = parsearISO(desde);
  const dHasta = parsearISO(hasta);
  const duracionDias = Math.round((dHasta.getTime() - dDesde.getTime()) / 86400000) + 1;
  const hastaAnterior = new Date(dDesde);
  hastaAnterior.setDate(hastaAnterior.getDate() - 1);
  const desdeAnterior = new Date(hastaAnterior);
  desdeAnterior.setDate(desdeAnterior.getDate() - duracionDias + 1);
  return { desde: isoDe(desdeAnterior), hasta: isoDe(hastaAnterior) };
}

/** Los últimos `n` meses como claves 'YYYY-MM', ascendente (el más viejo
 * primero, hoy al final) — para armar una tendencia mes a mes. */
export function ultimosMesesISO(n: number, desde: Date = new Date()): string[] {
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(desde.getFullYear(), desde.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

/**
 * Próxima fecha (ISO) en que se cobra una suscripción con día fijo del mes.
 * Si hoy mismo es el día de cobro, cuenta como "hoy". Si el mes no tiene ese
 * día (ej. día 31 en febrero), usa el último día del mes.
 * `desde` es explícito para que la función sea pura y testeable.
 */
export function proximoCobroISO(diaCobro: number, desde: Date = new Date()): string {
  const anio = desde.getFullYear();
  const mes = desde.getMonth();
  const diaEsteMes = Math.min(diaCobro, diasEnMes(anio, mes));
  if (desde.getDate() <= diaEsteMes) {
    return isoDe(new Date(anio, mes, diaEsteMes));
  }
  const mesSiguiente = mes + 1;
  const diaMesSiguiente = Math.min(diaCobro, diasEnMes(anio, mesSiguiente));
  return isoDe(new Date(anio, mesSiguiente, diaMesSiguiente));
}
