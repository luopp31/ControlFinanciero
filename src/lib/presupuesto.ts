/** Estado del presupuesto del mes frente al gasto neto (el mismo que muestra Estadísticas: REEMBOLSO resta). */
export interface ProgresoPresupuesto {
  /** Puede ser negativo: lo que te pasaste. */
  restante: number;
  /** 0 a 100 para la barra (se corta en 100 aunque te hayas pasado). */
  porcentaje: number;
  excedido: boolean;
}

export function progresoPresupuesto(gasto: number, presupuesto: number): ProgresoPresupuesto {
  const restante = Math.round((presupuesto - gasto) * 100) / 100;
  return {
    restante,
    porcentaje: presupuesto > 0 ? Math.max(0, Math.min(100, (gasto / presupuesto) * 100)) : 0,
    excedido: restante < 0,
  };
}

/** "2030,5" o "2,030.50" -> 2030.5; null si no es un monto válido mayor que 0. */
export function leerMonto(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '');
  // Coma como decimal ("12,5") o como miles ("2,030.50").
  const normal = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  const n = Number(normal);
  return normal !== '' && Number.isFinite(n) && n > 0 ? n : null;
}
