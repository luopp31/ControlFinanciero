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
