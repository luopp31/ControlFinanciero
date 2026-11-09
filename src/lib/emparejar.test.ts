import { describe, it, expect } from 'vitest';
import { emparejar, conReferencias, hash128, uuidDeterminista, type EntradaEmparejar } from './emparejar';
import type { Cuenta, Movimiento } from './finanzas';
import type { FilaBanco } from './constancia';

const SIMPLE: Cuenta = { id: 'S', nombre: 'Simple', rol: 'BILLETERA', saldoInicial: 22933, desde: '2026-11-02' };
const MILL: Cuenta = { id: 'M', nombre: 'Millonaria', rol: 'BOVEDA', saldoInicial: 1454663, desde: '2026-11-02' };
const CONSULTA = { fecha: '2026-11-09', hora: '11:46' };

let n = 0;
const fila = (descriptor: string, fecha: string, hora: string, soles: number): FilaBanco => ({ descriptor, fecha, hora, centimos: Math.round(soles * 100), pagina: 1 });
const mov = (p: Partial<Movimiento> & Pick<Movimiento, 'fecha' | 'monto' | 'tipo' | 'cuentaId'>): Movimiento => ({ id: `m${++n}`, ...p });
const gasto = (cuentaId: string, fecha: string, monto: number, nota = ''): Movimiento => mov({ cuentaId, fecha, monto, tipo: 'GASTO', nota });

function correr(cuenta: Cuenta, filas: FilaBanco[], movimientos: Movimiento[], extra: Partial<EntradaEmparejar> = {}) {
  return emparejar({ cuenta, filas, movimientos, ignorados: [], consulta: CONSULTA, cubreDesde: true, ...extra });
}

describe('referencia y uuid', () => {
  it('son estables y dependen de la cuenta', () => {
    const f = [fila('OXXO', '2026-11-07', '21:42', -6.9)];
    expect(conReferencias('S', f)[0].referencia).toBe(conReferencias('S', f)[0].referencia);
    expect(conReferencias('S', f)[0].referencia).not.toBe(conReferencias('M', f)[0].referencia);
    expect(conReferencias('S', f)[0].referencia).toHaveLength(32);
  });
  it('filas idénticas reciben ordinal; el orden de llegada no cambia el conjunto', () => {
    const a = fila('YAPE-JUAN C', '2026-11-08', '12:38', -2);
    const refs = conReferencias('S', [a, a, a]).map((r) => r.referencia);
    expect(new Set(refs).size).toBe(3);
    expect(new Set(conReferencias('S', [a, a, a]).reverse().map((r) => r.referencia))).toEqual(new Set(refs));
  });
  it('uuidDeterminista: mismo texto = mismo uuid con formato válido', () => {
    expect(uuidDeterminista('x')).toBe(uuidDeterminista('x'));
    expect(uuidDeterminista('x')).not.toBe(uuidDeterminista('y'));
    expect(uuidDeterminista('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(hash128('hola')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('emparejar 1 a 1', () => {
  it('mismo monto y fecha: ya estaba', () => {
    const r = correr(SIMPLE, [fila('SUPERM METRO SN FELIPE', '2026-11-08', '18:54', -25.6)], [gasto('S', '2026-11-08', 25.6, 'SUPERM METRO SN FELIPE')]);
    expect(r.yaEstaban).toHaveLength(1);
    expect(r.yaEstaban[0].via).toBe('exacto');
    expect(r.nuevos).toEqual([]);
    expect(r.soloEnGreedy).toEqual([]);
  });
  it('tolerancia de ±3 días (compra "en proceso" que se asienta después)', () => {
    const m = gasto('S', '2026-11-05', 13.9);
    expect(correr(SIMPLE, [fila('INKAFARMA', '2026-11-08', '10:00', -13.9)], [m]).yaEstaban).toHaveLength(1);
    const lejos = correr(SIMPLE, [fila('INKAFARMA', '2026-11-09', '10:00', -13.9)], [m]);
    expect(lejos.yaEstaban).toHaveLength(0);
    expect(lejos.nuevos).toHaveLength(1);
    expect(lejos.soloEnGreedy).toEqual([m]);
  });
  it('dos montos iguales: cada uno con el más cercano en tiempo, sin importar el orden', () => {
    const a = gasto('S', '2026-11-04', 2);
    const b = gasto('S', '2026-11-08', 2);
    const f = [fila('YAPE-X', '2026-11-08', '12:00', -2), fila('YAPE-X', '2026-11-04', '12:00', -2)];
    for (const orden of [f, [...f].reverse()]) {
      const r = correr(SIMPLE, orden, [a, b]);
      const porFecha = Object.fromEntries(r.yaEstaban.map((p) => [p.fila.fecha, p.movimientos[0].id]));
      expect(porFecha).toEqual({ '2026-11-08': b.id, '2026-11-04': a.id });
    }
  });
  it('a igual distancia desempata el nombre del banco dentro de la nota', () => {
    const a = gasto('S', '2026-11-08', 9.5, 'Pasaje (Yape a Luis E)');
    const b = gasto('S', '2026-11-08', 9.5, 'Almuerzo (Yape a Heylen)');
    const r = correr(SIMPLE, [fila('YAPE-HEYLEN', '2026-11-08', '11:50', -9.5)], [a, b]);
    expect(r.yaEstaban[0].movimientos[0].id).toBe(b.id);
    expect(r.soloEnGreedy).toEqual([a]);
  });
  it('un movimiento solo coincide con una fila', () => {
    const r = correr(SIMPLE, [fila('A', '2026-11-08', '10:00', -5), fila('B', '2026-11-08', '11:00', -5)], [gasto('S', '2026-11-08', 5)]);
    expect(r.yaEstaban).toHaveLength(1);
    expect(r.nuevos).toHaveLength(1);
  });
  it('el signo importa: un ingreso no empareja con un cargo', () => {
    const r = correr(SIMPLE, [fila('X', '2026-11-08', '10:00', -100)], [mov({ cuentaId: 'S', fecha: '2026-11-08', monto: 100, tipo: 'INGRESO' })]);
    expect(r.yaEstaban).toHaveLength(0);
  });
  it('reembolso (+) y pago de préstamo (-) empareja por su efecto en la cuenta', () => {
    const reemb = mov({ cuentaId: 'S', fecha: '2026-11-07', monto: 33.7, tipo: 'REEMBOLSO' });
    const pagoTc = mov({ cuentaId: 'M', fecha: '2026-11-08', monto: 178.41, tipo: 'PRESTAMO', dir: 'PAGO', prestId: 'p' });
    expect(correr(SIMPLE, [fila('YAPE-LUIS EN', '2026-11-07', '20:07', 33.7)], [reemb]).yaEstaban).toHaveLength(1);
    expect(correr(MILL, [fila('PAGO MI TC', '2026-11-08', '09:00', -178.41)], [pagoTc]).yaEstaban).toHaveLength(1);
  });
  it('movimientos de otra cuenta, borrados o anteriores a la fecha de corte no cuentan', () => {
    const r = correr(SIMPLE, [fila('X', '2026-11-08', '10:00', -5)], [
      gasto('M', '2026-11-08', 5),
      { ...gasto('S', '2026-11-08', 5), borrado: true },
      gasto('S', '2026-11-01', 5),
    ]);
    expect(r.yaEstaban).toHaveLength(0);
    expect(r.nuevos).toHaveLength(1);
  });
});

describe('traspaso: dos filas bancarias, un movimiento', () => {
  const t = mov({ cuentaId: 'M', destinoId: 'S', fecha: '2026-11-06', monto: 300, tipo: 'TRASPASO' });
  it('cada lado se empareja en su cuenta', () => {
    expect(correr(MILL, [fila('Transf Web/App', '2026-11-06', '12:14', -300)], [t]).yaEstaban[0].movimientos).toEqual([t]);
    expect(correr(SIMPLE, [fila('Transf Web/App', '2026-11-06', '12:14', 300)], [t]).yaEstaban[0].movimientos).toEqual([t]);
  });
  it('no empareja el lado equivocado', () => {
    expect(correr(MILL, [fila('Transf Web/App', '2026-11-06', '12:14', 300)], [t]).yaEstaban).toHaveLength(0);
  });
});

describe('coincidencia dividida', () => {
  const vivienda = gasto('M', '2026-11-07', 600, 'Alquiler cuarto');
  const efectivo = gasto('M', '2026-11-07', 250, 'Efectivo en billetera');
  it('retiro de 850 = 600 + 250', () => {
    const r = correr(MILL, [fila('RETIRO CAJERO', '2026-11-07', '22:00', -850)], [vivienda, efectivo]);
    expect(r.yaEstaban).toHaveLength(1);
    expect(r.yaEstaban[0].via).toBe('dividido');
    expect(r.yaEstaban[0].movimientos.map((m) => m.id).sort()).toEqual([vivienda.id, efectivo.id].sort());
    expect(r.nuevos).toEqual([]);
    expect(r.soloEnGreedy).toEqual([]);
  });
  it('también con 3 partes, y no mezcla signos', () => {
    const r = correr(MILL, [fila('RETIRO CAJERO', '2026-11-07', '22:00', -100)], [gasto('M', '2026-11-07', 50), gasto('M', '2026-11-07', 30), gasto('M', '2026-11-07', 20), mov({ cuentaId: 'M', fecha: '2026-11-07', monto: 10, tipo: 'INGRESO' })]);
    expect(r.yaEstaban[0].movimientos).toHaveLength(3);
    const r2 = correr(MILL, [fila('X', '2026-11-07', '22:00', -100)], [gasto('M', '2026-11-07', 150), mov({ cuentaId: 'M', fecha: '2026-11-07', monto: 50, tipo: 'INGRESO' })]);
    expect(r2.yaEstaban).toHaveLength(0);
  });
  it('si la suma no cuadra o hay más de 3, queda como nuevo', () => {
    const r = correr(MILL, [fila('X', '2026-11-07', '22:00', -100)], [gasto('M', '2026-11-07', 60), gasto('M', '2026-11-07', 30)]);
    expect(r.nuevos).toHaveLength(1);
  });
  it('una coincidencia 1 a 1 gana a una dividida (no se parten movimientos innecesariamente)', () => {
    const r = correr(MILL, [fila('X', '2026-11-07', '22:00', -850), fila('Y', '2026-11-07', '22:01', -600)], [vivienda, efectivo, gasto('M', '2026-11-07', 850)]);
    expect(r.yaEstaban.map((p) => p.via).sort()).toEqual(['exacto', 'exacto']);
  });
});

describe('ignoradas', () => {
  it('una fila ignorada nunca se propone ni se empareja', () => {
    const f = fila('Transf Web/App', '2026-11-03', '14:04', -328.66);
    const [{ referencia }] = conReferencias('M', [f]);
    const ign = { id: 'i', cuentaId: 'M', referencia };
    const r = correr(MILL, [f], [gasto('M', '2026-11-03', 328.66)], { ignorados: [ign] });
    expect(r.ignoradas).toHaveLength(1);
    expect(r.nuevos).toEqual([]);
    expect(r.yaEstaban).toEqual([]);
    // borrada = ya no se ignora
    expect(correr(MILL, [f], [], { ignorados: [{ ...ign, borrado: true }] }).nuevos).toHaveLength(1);
    // de otra cuenta no aplica
    expect(correr(MILL, [f], [], { ignorados: [{ ...ign, cuentaId: 'S' }] }).nuevos).toHaveLength(1);
  });
});

describe('referencia e idempotencia', () => {
  it('movimiento con la misma referencia coincide aunque cambie la fecha', () => {
    const f = fila('OXXO', '2026-11-07', '21:42', -6.9);
    const [{ referencia }] = conReferencias('S', [f]);
    const m = mov({ cuentaId: 'S', fecha: '2026-11-07', monto: 6.9, tipo: 'GASTO', referencia });
    const r = correr(SIMPLE, [f], [m]);
    expect(r.yaEstaban[0]).toMatchObject({ via: 'referencia', referenciaDistinta: false });
  });
  it('coincidencia por monto con otra referencia marca referenciaDistinta', () => {
    const r = correr(SIMPLE, [fila('OXXO', '2026-11-07', '21:42', -6.9)], [gasto('S', '2026-11-07', 6.9)]);
    expect(r.yaEstaban[0].referenciaDistinta).toBe(true);
  });
  it('subir el mismo PDF dos veces no cambia nada: lo cargado queda como "ya estaba"', () => {
    const filas = [fila('OXXO', '2026-11-07', '21:42', -6.9), fila('YAPE-JUAN C', '2026-11-08', '12:38', -2), fila('YAPE-JUAN C', '2026-11-08', '12:38', -2)];
    const r1 = correr(SIMPLE, filas, []);
    expect(r1.nuevos).toHaveLength(3);
    // "Cargar": se crean los movimientos con su referencia.
    const cargados = r1.nuevos.map((f) => mov({ cuentaId: 'S', fecha: f.fecha, monto: -f.centimos / 100, tipo: 'GASTO', referencia: f.referencia, descriptor: f.descriptor, origen: 'conciliar', hora: f.hora }));
    const r2 = correr(SIMPLE, filas, cargados);
    expect(r2.nuevos).toEqual([]);
    expect(r2.yaEstaban).toHaveLength(3);
    expect(r2.yaEstaban.every((p) => p.via === 'referencia')).toBe(true);
    expect(r2.soloEnGreedy).toEqual([]);
  });
  it('si el banco asienta una fila "en proceso" con otra fecha, sigue siendo el mismo movimiento', () => {
    const antes = fila('IZI*MARKET NELVA 2', '2026-11-08', '14:35', -44.5);
    const [{ referencia }] = conReferencias('M', [antes]);
    const cargado = mov({ cuentaId: 'M', fecha: '2026-11-08', monto: 44.5, tipo: 'GASTO', referencia, hora: '14:35', descriptor: antes.descriptor });
    const despues = fila('IZI*MARKET NELVA 2', '2026-11-10', '03:10', -44.5);
    const r = correr(MILL, [despues], [cargado], { consulta: { fecha: '2026-11-11', hora: '09:00' } });
    expect(r.nuevos).toEqual([]);
    expect(r.yaEstaban[0]).toMatchObject({ via: 'exacto', referenciaDistinta: true });
  });
});

describe('solo en Greedy', () => {
  it('movimiento dentro del rango que el banco no muestra', () => {
    const huerfano = gasto('S', '2026-11-05', 99, 'Duplicado');
    const r = correr(SIMPLE, [fila('OXXO', '2026-11-07', '21:42', -6.9)], [gasto('S', '2026-11-07', 6.9), huerfano]);
    expect(r.soloEnGreedy).toEqual([huerfano]);
  });
  it('si el PDF no llega a la fecha de corte, el primer día (cortado a medias) y lo anterior no se juzgan', () => {
    const viejo = gasto('S', '2026-11-03', 10);
    const delPrimerDia = gasto('S', '2026-11-05', 10);
    const reciente = gasto('S', '2026-11-06', 10);
    const filas = [fila('OXXO', '2026-11-05', '21:44', -6.9), fila('OXXO', '2026-11-08', '10:00', -6.9)];
    const r = correr(SIMPLE, filas, [viejo, delPrimerDia, reciente], { cubreDesde: false });
    expect(r.soloEnGreedy).toEqual([reciente]);
    expect(correr(SIMPLE, filas, [viejo, delPrimerDia, reciente], { cubreDesde: true }).soloEnGreedy.map((m) => m.fecha)).toEqual(['2026-11-03', '2026-11-05', '2026-11-06']);
  });
  it('lo posterior a la hora de la consulta no se espera en el banco', () => {
    const tarde = mov({ cuentaId: 'S', fecha: '2026-11-09', monto: 5, tipo: 'GASTO', hora: '15:00' });
    const sinHora = gasto('S', '2026-11-10', 5);
    expect(correr(SIMPLE, [], [tarde, sinHora]).soloEnGreedy).toEqual([]);
  });
});

describe('caso real simplificado: Millonaria (criterio de aceptación 3 y 5)', () => {
  const movs = [
    gasto('M', '2026-11-02', 494.82, 'Pasaje ida y vuelta Arequipa-Lima'),
    mov({ cuentaId: 'M', destinoId: 'S', fecha: '2026-11-06', monto: 300, tipo: 'TRASPASO' }),
    gasto('M', '2026-11-06', 81.49, 'Suscripción Claude'),
    mov({ cuentaId: 'M', fecha: '2026-11-06', monto: 4200.57, tipo: 'INGRESO', categoria: 'LIQUIDACION' }),
    gasto('M', '2026-11-07', 600, 'Alquiler'),
    gasto('M', '2026-11-07', 250, 'Efectivo'),
    gasto('M', '2026-11-08', 44.5, 'IZI*MARKET NELVA 2'),
    mov({ cuentaId: 'M', destinoId: 'S', fecha: '2026-11-08', monto: 100, tipo: 'TRASPASO' }),
  ];
  const filas = [
    fila('IZI*MARKET NELVA 2', '2026-11-08', '14:35', -44.5),
    fila('Transf Web/App', '2026-11-08', '18:23', -100),
    fila('RETIRO CAJERO', '2026-11-07', '22:00', -850),
    fila('Transf Web/App', '2026-11-06', '17:26', 4200.57),
    fila('Transf Web/App', '2026-11-06', '17:25', -81.49),
    fila('Transf Web/App', '2026-11-06', '12:14', -300),
    fila('Transf Web/App', '2026-11-03', '14:04', -328.66),
    fila('Transf Web/App', '2026-11-02', '11:38', -494.82),
  ];
  it('queda exactamente 1 nuevo (el -328.66) y los traspasos y el retiro emparejados', () => {
    const r = correr(MILL, filas, movs);
    expect(r.nuevos.map((f) => f.centimos)).toEqual([-32866]);
    expect(r.yaEstaban).toHaveLength(7);
    expect(r.yaEstaban.find((p) => p.fila.centimos === -85000)?.via).toBe('dividido');
    expect(r.yaEstaban.filter((p) => p.movimientos[0].tipo === 'TRASPASO')).toHaveLength(2);
    expect(r.soloEnGreedy).toEqual([]);
  });
  it('tras ignorarlo: 0 nuevos y 1 ignorada', () => {
    const [ref] = conReferencias('M', [filas[6]]);
    const r = correr(MILL, filas, movs, { ignorados: [{ id: 'i', cuentaId: 'M', referencia: ref.referencia }] });
    expect(r.nuevos).toEqual([]);
    expect(r.ignoradas).toHaveLength(1);
  });
});
