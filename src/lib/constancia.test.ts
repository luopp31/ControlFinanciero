import { describe, it, expect } from 'vitest';
import { parsearConstancia, filtrarDesde, type ItemTexto } from './constancia';

// Fixtures sintéticas: nada de datos reales.
const it_ = (s: string, x: number, y: number, pagina = 1): ItemTexto => ({ s, x, y, pagina });

function cabecera(opts: { cuenta?: string; fecha?: string; hora?: string; contable?: string; disp?: string } = {}): ItemTexto[] {
  const { cuenta = 'Simple', fecha = '09 nov 2026', hora = '11:46', contable = 'S/ 231.33', disp = 'S/ 69.63' } = opts;
  return [
    it_('CONSULTA DE MOVIMIENTOS CUENTA DE AHORROS', 127, 723),
    it_('Tipo de Cambio Preferencial Compra: S/ 3.4300 Venta: S/ 3.4400', 36, 681),
    it_('NOMBRE APELLIDO DE PRUEBA', 36, 648),
    it_(`Cuenta ${cuenta} Soles 000-0000000000`, 36, 633),
    it_('FECHA:', 40, 605), it_(fecha, 105, 605), it_('HORA:', 196, 605), it_(hora, 254, 605),
    it_('SALDOS:', 36, 567),
    it_('Saldo Contable', 125, 523), it_('Saldo Disponible', 387, 523),
    it_(contable, 131, 492), it_(disp, 397, 492),
    it_('MOVIMIENTOS:', 36, 447),
    it_('Cargo realizado por', 102, 404), it_('Fecha y hora', 318, 404), it_('Monto', 488, 404),
  ];
}
const mov = (y: number, desc: string, fecha: string, monto: string, pagina = 1): ItemTexto[] => [
  it_(desc, 100, y, pagina), it_(fecha, 300, y, pagina), it_(monto, 520, y, pagina),
];

describe('parsearConstancia', () => {
  const items = [
    ...cabecera(),
    ...mov(373, 'SUPERM METRO SN FELIPE', 'dom. 08 nov 18:54', 'S/ -25.60'),
    ...mov(343, 'YAPE-ALONSO', 'dom. 08 nov 18:23', 'S/ -16.00'),
    ...mov(313, 'Transf Web/App', 'dom. 08 nov 18:23', 'S/ +100.00'),
    ...mov(283, 'Transf Web/App', 'vie. 06 nov 17:26', 'S/ +4,200.57'),
  ];
  const r = parsearConstancia(items);

  it('lee cuenta por nombre y descarta el número', () => {
    expect(r.cuenta).toBe('Simple');
    expect(JSON.stringify(r)).not.toContain('0000000000');
  });
  it('lee fecha/hora de la consulta y los dos saldos en céntimos', () => {
    expect(r.consulta).toEqual({ fecha: '2026-11-09', hora: '11:46' });
    expect(r.saldoContableCent).toBe(23133);
    expect(r.saldoDisponibleCent).toBe(6963);
  });
  it('lee las filas con signo y coma de miles, sin avisos', () => {
    expect(r.avisos).toEqual([]);
    expect(r.filas.map((f) => [f.descriptor, f.fecha, f.hora, f.centimos])).toEqual([
      ['SUPERM METRO SN FELIPE', '2026-11-08', '18:54', -2560],
      ['YAPE-ALONSO', '2026-11-08', '18:23', -1600],
      ['Transf Web/App', '2026-11-08', '18:23', 10000],
      ['Transf Web/App', '2026-11-06', '17:26', 420057],
    ]);
  });
  it('no se apoya en el orden de las filas', () => {
    const r2 = parsearConstancia([...cabecera(), ...mov(300, 'A', 'vie. 06 nov 10:00', 'S/ -1.00'), ...mov(340, 'B', 'dom. 08 nov 10:00', 'S/ -2.00')]);
    expect(r2.filas.map((f) => f.descriptor).sort()).toEqual(['A', 'B']);
    expect(r2.avisos).toEqual([]);
  });
  it('el tipo de cambio (4 decimales) no se confunde con un saldo ni un monto', () => {
    expect(r.saldoDisponibleCent).toBe(6963);
  });
  it('filas de páginas siguientes (sin cabecera) se leen igual', () => {
    const r2 = parsearConstancia([...items, ...mov(777, 'OXXO', 'sáb. 07 nov 21:42', 'S/ -6.90', 2)]);
    expect(r2.filas).toHaveLength(5);
    expect(r2.filas[4]).toMatchObject({ descriptor: 'OXXO', fecha: '2026-11-07', centimos: -690, pagina: 2 });
  });
});

describe('tolerancia a PDFs desordenados', () => {
  it('filas desalineadas unos puntos en vertical y columnas corridas', () => {
    const r = parsearConstancia([
      ...cabecera(),
      it_('YAPE-LUIS E', 139, 192), it_('dom. 08 nov 12:01', 338, 190), it_('S/ -9.50', 528, 194),
    ]);
    expect(r.avisos).toEqual([]);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({ descriptor: 'YAPE-LUIS E', centimos: -950 });
  });
  it('fecha y monto en líneas distintas se unen', () => {
    const r = parsearConstancia([
      ...cabecera(),
      it_('PLIN-JOSUE', 140, 300), it_('vie. 06 nov 14:31', 342, 300),
      it_('S/ -73.00', 522, 288),
    ]);
    expect(r.avisos).toEqual([]);
    expect(r.filas).toEqual([{ descriptor: 'PLIN-JOSUE', fecha: '2026-11-06', hora: '14:31', centimos: -7300, pagina: 1 }]);
  });
  it('descriptor partido en dos líneas se concatena', () => {
    const r = parsearConstancia([
      ...cabecera(),
      it_('BCP*LUCHA PLAZA', 95, 300), it_('sáb. 07 nov 20:05', 340, 300), it_('S/ -63.50', 522, 300),
      it_('LIMA NO', 95, 290),
    ]);
    expect(r.filas[0].descriptor).toBe('BCP*LUCHA PLAZA LIMA NO');
    expect(r.filas).toHaveLength(1);
  });
  it('una línea ilegible se avisa, nunca se ignora en silencio', () => {
    const r = parsearConstancia([...cabecera(), ...mov(300, 'OXXO', 'sáb. 07 nov 21:42', 'S/ -6.90'), it_('texto raro sin forma', 100, 200)]);
    expect(r.filas).toHaveLength(1);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain('texto raro sin forma');
  });
  it('fila sin monto con signo (solo fecha) se avisa', () => {
    const r = parsearConstancia([...cabecera(), it_('COSA', 100, 300), it_('sáb. 07 nov 21:42', 300, 300)]);
    expect(r.filas).toHaveLength(0);
    expect(r.avisos).toHaveLength(1);
  });
});

describe('año de las filas', () => {
  it('mes posterior al de la consulta = año anterior (cambio de año)', () => {
    const r = parsearConstancia([
      ...cabecera({ fecha: '05 ene 2027' }),
      ...mov(300, 'X', 'mié. 30 dic 10:00', 'S/ -5.00'),
      ...mov(270, 'Y', 'mar. 05 ene 09:00', 'S/ -1.00'),
    ]);
    expect(r.avisos).toEqual([]);
    expect(r.filas.map((f) => f.fecha)).toEqual(['2026-12-30', '2027-01-05']);
  });
  it('el día de la semana que no cuadra con ningún año se avisa', () => {
    const r = parsearConstancia([...cabecera(), ...mov(300, 'X', 'lun. 08 nov 10:00', 'S/ -5.00')]); // 8 nov 2026 es domingo
    expect(r.filas).toHaveLength(0);
    expect(r.avisos).toHaveLength(1);
  });
  it('sin fecha de consulta no fecha nada y avisa', () => {
    const r = parsearConstancia(mov(300, 'X', 'dom. 08 nov 10:00', 'S/ -5.00'));
    expect(r.filas).toHaveLength(0);
    expect(r.avisos.join(' ')).toContain('fecha y hora de la consulta');
  });
});

describe('cuenta', () => {
  it('reconoce Millonaria y avisa de cuentas en dólares', () => {
    expect(parsearConstancia(cabecera({ cuenta: 'Millonaria' })).cuenta).toBe('Millonaria');
    const d = parsearConstancia([...cabecera().filter((i) => !i.s.startsWith('Cuenta ')), it_('Cuenta Simple Dólares 000', 36, 633)]);
    expect(d.cuenta).toBeNull();
    expect(d.avisos.join(' ')).toContain('soles');
  });
});

describe('filtrarDesde', () => {
  it('separa y cuenta las filas anteriores a la fecha de corte', () => {
    const r = parsearConstancia([
      ...cabecera(),
      ...mov(300, 'A', 'dom. 01 nov 08:00', 'S/ -1.00'),
      ...mov(270, 'B', 'lun. 02 nov 08:00', 'S/ -2.00'),
      ...mov(240, 'C', 'sáb. 31 oct 08:00', 'S/ -3.00'),
    ]);
    const { vigentes, descartadas } = filtrarDesde(r.filas, '2026-11-02');
    expect(vigentes.map((f) => f.descriptor)).toEqual(['B']);
    expect(descartadas.map((f) => f.descriptor).sort()).toEqual(['A', 'C']);
  });
});
