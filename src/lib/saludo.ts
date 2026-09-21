/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora local. */
export function saludoPorHora(ahora: Date = new Date()): string {
  const hora = ahora.getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
