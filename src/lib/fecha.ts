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

function isoDe(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function diasEnMes(anio: number, mesIndice0: number): number {
  return new Date(anio, mesIndice0 + 1, 0).getDate();
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
