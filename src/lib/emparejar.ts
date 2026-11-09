// Empareja las filas de la constancia del banco con los movimientos que ya hay en Greedy.
// Lógica pura. Dinero en céntimos enteros. Funciona por cuenta: un TRASPASO de Greedy
// representa dos filas bancarias (una por cuenta) y cada lado se empareja en su propia
// cuenta, porque `efecto()` ya da el efecto del movimiento sobre esa cuenta (±monto).
import { efecto, type Cuenta, type Movimiento } from './finanzas';
import { normalizarClave } from './clasificador';
import type { Ignorado } from './db';
import type { FilaBanco } from './constancia';

export const TOLERANCIA_DIAS = 3;
const MAX_DIVIDIDO = 3;

// --- Hash estable (sin crypto.subtle: tiene que ser síncrono y sin dependencias) ---

/** cyrb128: 128 bits en 32 caracteres hexadecimales. No es criptográfico; basta para ids. */
export function hash128(texto: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < texto.length; i++) {
    const k = texto.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
}

/** Mismo texto -> mismo uuid, en cualquier dispositivo: dos importaciones del mismo PDF no duplican. */
export function uuidDeterminista(texto: string): string {
  const x = hash128(texto);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-5${x.slice(13, 16)}-${((parseInt(x[16], 16) & 3) | 8).toString(16)}${x.slice(17, 20)}-${x.slice(20, 32)}`;
}

export interface FilaConRef extends FilaBanco {
  /** Hash de cuenta + fecha + hora + monto + descriptor (+ ordinal si hay filas idénticas). */
  referencia: string;
}

/** Asigna la referencia estable. Filas idénticas (misma fecha, hora, monto y descriptor) llevan un ordinal. */
export function conReferencias(cuentaId: string, filas: FilaBanco[]): FilaConRef[] {
  const vistas = new Map<string, number>();
  return filas.map((f) => {
    const base = [cuentaId, f.fecha, f.hora, f.centimos, f.descriptor.trim()].join('|');
    const n = vistas.get(base) ?? 0;
    vistas.set(base, n + 1);
    return { ...f, referencia: hash128(`${base}|${n}`) };
  });
}

// --- Emparejado ---

export interface Par {
  fila: FilaConRef;
  /** 1 movimiento normalmente; 2 o 3 en una coincidencia dividida (retiro 850 = 600 + 250). */
  movimientos: Movimiento[];
  via: 'referencia' | 'exacto' | 'dividido';
  /** El movimiento coincide pero no lleva esta referencia (es manual, o el banco asentó con otra fecha). */
  referenciaDistinta: boolean;
}

export interface EntradaEmparejar {
  cuenta: Cuenta;
  /** Filas del banco ya filtradas por la fecha de corte de la cuenta. */
  filas: FilaBanco[];
  /** Todos los movimientos de Greedy (se filtran aquí por cuenta, borrado y fecha de corte). */
  movimientos: Movimiento[];
  ignorados: Ignorado[];
  consulta: { fecha: string; hora: string };
  /** El PDF trae filas anteriores a la fecha de corte: su historial cubre todo el rango vigente. */
  cubreDesde: boolean;
}

export interface ResultadoEmparejo {
  yaEstaban: Par[];
  nuevos: FilaConRef[];
  ignoradas: FilaConRef[];
  /** Movimientos de Greedy dentro del rango del PDF que el banco no muestra: posible duplicado o error. */
  soloEnGreedy: Movimiento[];
}

const aDias = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const aMin = (hora: string) => +hora.slice(0, 2) * 60 + +hora.slice(3, 5);
const cent = (n: number) => Math.round(n * 100);

/** ¿El nombre del banco aparece en la nota o el descriptor del movimiento? Solo desempata. */
function parecido(f: FilaBanco, m: Movimiento): boolean {
  if (m.descriptor && m.descriptor.trim().toUpperCase() === f.descriptor.trim().toUpperCase()) return true;
  const nombre = normalizarClave(f.descriptor.replace(/^(YAPE|PLIN)-/i, ''));
  if (nombre.length < 3) return false;
  return normalizarClave(`${m.nota ?? ''} ${m.descriptor ?? ''}`).includes(nombre);
}

interface Mov {
  m: Movimiento;
  ef: number; // efecto sobre la cuenta, en céntimos con signo
}

export function emparejar(e: EntradaEmparejar): ResultadoEmparejo {
  const { cuenta, consulta } = e;
  const filas = conReferencias(cuenta.id, e.filas);

  // 1. Ignoradas: nunca se proponen ni se emparejan.
  const refsIgnoradas = new Set(e.ignorados.filter((i) => !i.borrado && i.cuentaId === cuenta.id).map((i) => i.referencia));
  const ignoradas = filas.filter((f) => refsIgnoradas.has(f.referencia));
  const pendientes = filas.filter((f) => !refsIgnoradas.has(f.referencia));

  // 2. Movimientos que afectan a esta cuenta y cuentan para su saldo.
  const movs: Mov[] = e.movimientos
    .filter((m) => !m.borrado && m.fecha >= cuenta.desde)
    .map((m) => ({ m, ef: cent(efecto(m, cuenta.id)) }))
    .filter((x) => x.ef !== 0);

  const usadoMov = new Set<Mov>();
  const filaEmparejada = new Set<FilaConRef>();
  const yaEstaban: Par[] = [];
  const unir = (fila: FilaConRef, ms: Mov[], via: Par['via']) => {
    filaEmparejada.add(fila);
    ms.forEach((x) => usadoMov.add(x));
    yaEstaban.push({ fila, movimientos: ms.map((x) => x.m), via, referenciaDistinta: ms.some((x) => x.m.referencia !== fila.referencia) });
  };

  // 3. Misma referencia del banco: coincide sin más.
  for (const f of pendientes) {
    const x = movs.find((y) => !usadoMov.has(y) && y.m.referencia && y.m.referencia === f.referencia);
    if (x) unir(f, [x], 'referencia');
  }

  // 4. Mismo monto exacto, ±3 días, 1 a 1: primero los más cercanos en tiempo (desempata el nombre).
  const pares: { f: FilaConRef; x: Mov; clave: [number, number, number, number, number] }[] = [];
  pendientes.forEach((f, i) => {
    if (filaEmparejada.has(f)) return;
    movs.forEach((x, j) => {
      if (usadoMov.has(x) || x.ef !== f.centimos) return;
      const dias = Math.abs(aDias(f.fecha) - aDias(x.m.fecha));
      if (dias > TOLERANCIA_DIAS) return;
      const minutos = x.m.hora ? Math.abs(aMin(f.hora) - aMin(x.m.hora)) : 0;
      pares.push({ f, x, clave: [dias, parecido(f, x.m) ? 0 : 1, minutos, i, j] });
    });
  });
  pares.sort((a, b) => {
    for (let k = 0; k < 5; k++) if (a.clave[k] !== b.clave[k]) return a.clave[k] - b.clave[k];
    return 0;
  });
  for (const { f, x } of pares) if (!filaEmparejada.has(f) && !usadoMov.has(x)) unir(f, [x], 'exacto');

  // 5. Dividida: la fila no coincide 1 a 1; busca 2 o 3 movimientos sin emparejar, del mismo signo,
  //    de la misma cuenta y a ±3 días, cuya suma sea igual a la fila.
  const sinPar = pendientes.filter((f) => !filaEmparejada.has(f)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.centimos - b.centimos);
  for (const f of sinPar) {
    const pool = movs.filter(
      (x) => !usadoMov.has(x) && Math.sign(x.ef) === Math.sign(f.centimos) && Math.abs(x.ef) < Math.abs(f.centimos) && Math.abs(aDias(f.fecha) - aDias(x.m.fecha)) <= TOLERANCIA_DIAS
    );
    let mejor: { combo: Mov[]; costo: number } | null = null;
    const buscar = (desde: number, combo: Mov[], suma: number, tam: number) => {
      if (combo.length === tam) {
        if (suma === f.centimos) {
          const costo = combo.reduce((s, x) => s + Math.abs(aDias(f.fecha) - aDias(x.m.fecha)), 0);
          if (!mejor || costo < mejor.costo) mejor = { combo: [...combo], costo };
        }
        return;
      }
      for (let i = desde; i < pool.length; i++) buscar(i + 1, [...combo, pool[i]], suma + pool[i].ef, tam);
    };
    for (let tam = 2; tam <= MAX_DIVIDIDO && !mejor; tam++) buscar(0, [], 0, tam);
    if (mejor) unir(f, (mejor as { combo: Mov[] }).combo, 'dividido');
  }

  // 6. Lo que quedó: nuevos (banco sin Greedy) y solo en Greedy (Greedy sin banco, dentro del rango del PDF).
  const nuevos = pendientes.filter((f) => !filaEmparejada.has(f));
  const minFecha = filas.reduce((m, f) => (f.fecha < m ? f.fecha : m), '9999-12-31');
  // Si el PDF no llega hasta la fecha de corte, el primer día está cortado a medias: no se juzga.
  const inicio = e.cubreDesde || filas.length === 0 ? cuenta.desde : minFecha > cuenta.desde ? new Date((aDias(minFecha) + 1) * 86_400_000).toISOString().slice(0, 10) : cuenta.desde;
  const soloEnGreedy = movs
    .filter((x) => !usadoMov.has(x))
    .filter(({ m }) => m.fecha >= inicio && m.fecha <= consulta.fecha && !(m.fecha === consulta.fecha && m.hora && m.hora > consulta.hora))
    .map((x) => x.m);

  return { yaEstaban, nuevos, ignoradas, soloEnGreedy };
}
