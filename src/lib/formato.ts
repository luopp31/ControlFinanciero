/** "0,000.00" — coma de miles, punto decimal, siempre 2 decimales. */
export function formatearMonto(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Igual que formatearMonto, pero lo enmascara cuando el usuario activó
 * "ocultar saldos" (el ojo del panel) — mismo ancho aproximado para que el
 * layout no salte al alternar. */
export function formatearMontoOcultable(n: number, oculto: boolean): string {
  return oculto ? '••••.••' : formatearMonto(n);
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "22 sep" a partir de una fecha ISO (YYYY-MM-DD). */
export function formatearFechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${Number(dia)} ${MESES_CORTOS[Number(mes) - 1]}`;
}

/** "sep" a partir de una clave de mes 'YYYY-MM'. */
export function formatearMesCorto(mesISO: string): string {
  const [, mes] = mesISO.split('-');
  return MESES_CORTOS[Number(mes) - 1];
}
