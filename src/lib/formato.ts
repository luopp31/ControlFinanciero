/** "0,000.00" — coma de miles, punto decimal, siempre 2 decimales. */
export function formatearMonto(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
