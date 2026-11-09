import type { Cuenta } from '../../lib/finanzas';

export const cuentaNombreDe = (cuentas: Cuenta[], id: string) => cuentas.find((c) => c.id === id)?.nombre ?? 'la cuenta';

const norm = (t: string) => t.trim().toLowerCase();

/** Cuenta de Greedy que corresponde al nombre que escribe el banco ("Simple", "Millonaria"). */
export function cuentaPorNombre(cuentas: Cuenta[], nombreBanco: string | null): Cuenta | undefined {
  if (!nombreBanco) return undefined;
  const n = norm(nombreBanco);
  return cuentas.find((c) => norm(c.nombre) === n) ?? cuentas.find((c) => norm(c.nombre).includes(n) || n.includes(norm(c.nombre)));
}
