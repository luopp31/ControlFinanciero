import { describe, it, expect } from 'vitest';
import { emparejar } from './emparejar';
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';

// Movimientos creados desde la bandeja (origen 'captura', con hora). Todo inventado.
const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 0, desde: '2026-11-02' };
let n = 0;
const fila = (descriptor: string, fecha: string, hora: string, soles: number): FilaBanco => ({ descriptor, fecha, hora, centimos: Math.round(soles * 100), pagina: 1 });
const desdeBandeja = (fecha: string, monto: number, hora: string, descriptor: string): Movimiento => ({ id: `m${++n}`, cuentaId: 'S', fecha, monto, tipo: 'GASTO', origen: 'captura', hora, descriptor });
const correr = (filas: FilaBanco[], movimientos: Movimiento[]) =>
  emparejar({ cuenta: SIMPLE, filas, movimientos, ignorados: [], consulta: { fecha: '2026-11-10', hora: '08:00' }, cubreDesde: true });

describe('movimientos creados desde la bandeja', () => {
  it('la hora desempata dos filas del mismo monto y día', () => {
    const manana = desdeBandeja('2026-11-08', 2, '09:10', 'PLIN-ANA');
    const noche = desdeBandeja('2026-11-08', 2, '21:40', 'PLIN-LUIS');
    const r = correr([fila('YAPE-LUIS', '2026-11-08', '21:41', -2), fila('YAPE-ANA', '2026-11-08', '09:11', -2)], [manana, noche]);
    const porHora = Object.fromEntries(r.yaEstaban.map((p) => [p.fila.hora, p.movimientos[0].id]));
    expect(porHora).toEqual({ '21:41': noche.id, '09:11': manana.id });
    expect(r.nuevos).toEqual([]);
  });

  it('conciliar no los duplica: la fila ya estaba por monto y fecha, aunque el banco la asiente al día siguiente', () => {
    const m = desdeBandeja('2026-11-08', 6.9, '21:42', 'PLIN-ANA');
    const r = correr([fila('YAPE-ANA', '2026-11-09', '00:03', -6.9)], [m]);
    expect(r.yaEstaban).toHaveLength(1);
    expect(r.nuevos).toEqual([]);
    expect(r.soloEnGreedy).toEqual([]);
  });
});
