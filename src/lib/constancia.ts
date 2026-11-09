// Parser puro de la "Constancia de movimientos" de Interbank (PDF de texto).
// Recibe los items de texto que entrega pdfjs (texto + posición) y devuelve filas
// con el dinero en céntimos enteros. Sin IO ni Date.now(): se prueba con fixtures.
//
// Reglas de robustez (CLAUDE.md / prompt del Paso A):
//  - Las filas se reconocen por la FORMA del texto, no por la columna (x): el monto
//    va alineado a la derecha y la fecha se mueve según el largo del descriptor.
//  - No se confía en el orden de las filas.
//  - Toda línea de la zona de movimientos que no se pueda leer va a `avisos`.
//  - El número de cuenta nunca se guarda: solo el nombre ("Simple", "Millonaria").

export interface ItemTexto {
  s: string;
  x: number;
  /** Coordenada vertical de pdfjs: mayor = más arriba en la página. */
  y: number;
  pagina: number;
}

export interface FilaBanco {
  descriptor: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM */
  hora: string;
  /** Con signo: negativo = cargo, positivo = abono. */
  centimos: number;
  pagina: number;
}

export interface ConstanciaLeida {
  /** Nombre de la cuenta tal como lo escribe el banco ("Simple", "Millonaria"). */
  cuenta: string | null;
  /** Momento al que corresponde el saldo. */
  consulta: { fecha: string; hora: string } | null;
  saldoContableCent: number | null;
  /** El que sirve para verificar: incluye las compras "en proceso". */
  saldoDisponibleCent: number | null;
  filas: FilaBanco[];
  avisos: string[];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']; // índice = getUTCDay()

const TOL_MISMA_FILA = 4; // puntos: tolera filas desalineadas verticalmente
const TOL_CONTINUACION = 14; // puntos: una fila partida cae a menos que esto de su vecina

const MES_RE = '(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)';
const FECHA_HORA_RE = new RegExp(
  `\\b(lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\\.?\\s+(\\d{1,2})\\s+${MES_RE}\\.?\\s+(\\d{1,2}):(\\d{2})\\b`,
  'i'
);
// (?!\d): el tipo de cambio trae 4 decimales ("3.4300") y no es un monto.
const MONTO_RE = /S\/\s*([+-])?\s*((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d)/g;

const pad = (n: number) => String(n).padStart(2, '0');
const sinAcento = (s: string) => s.toLowerCase().replace('é', 'e').replace('á', 'a');

/** "4,200.57" -> 420057. Aritmética entera: nunca pasa por coma flotante. */
function aCentimos(texto: string): number {
  const [ent, dec] = texto.replace(/,/g, '').split('.');
  return Number(ent) * 100 + Number(dec);
}

function diaSemana(y: number, mes0: number, d: number): { dia: string; valido: boolean } {
  const f = new Date(Date.UTC(y, mes0, d));
  return { dia: DIAS[f.getUTCDay()], valido: f.getUTCMonth() === mes0 && f.getUTCDate() === d };
}

interface Fila {
  pagina: number;
  y: number;
  texto: string;
}

/** Agrupa los items por línea visual (misma página, y casi igual) y los une de izquierda a derecha. */
function agruparFilas(items: ItemTexto[]): Fila[] {
  const orden = [...items].filter((i) => i.s.trim()).sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x);
  const grupos: { pagina: number; y: number; items: ItemTexto[] }[] = [];
  for (const it of orden) {
    const g = grupos[grupos.length - 1];
    if (g && g.pagina === it.pagina && g.y - it.y <= TOL_MISMA_FILA) g.items.push(it);
    else grupos.push({ pagina: it.pagina, y: it.y, items: [it] });
  }
  return grupos.map((g) => ({
    pagina: g.pagina,
    y: g.y,
    texto: g.items
      .sort((a, b) => a.x - b.x)
      .map((i) => i.s.trim())
      .join(' ')
      .replace(/\s+/g, ' '),
  }));
}

interface Analisis {
  desc: string;
  fecha?: { dia: string; d: number; mes0: number; hora: string };
  /** Con signo, en céntimos. undefined si no hay monto con signo. */
  monto?: number;
}

/** Separa de una línea: fecha/hora, monto con signo y el resto (descriptor). */
function analizar(texto: string): Analisis {
  let resto = texto;
  const r: Analisis = { desc: '' };
  const f = FECHA_HORA_RE.exec(resto);
  if (f) {
    r.fecha = { dia: sinAcento(f[1]), d: Number(f[2]), mes0: MESES.indexOf(f[3].toLowerCase()), hora: `${pad(Number(f[4]))}:${f[5]}` };
    resto = resto.replace(f[0], ' ');
  }
  const montos = [...resto.matchAll(MONTO_RE)].filter((m) => m[1]);
  const m = montos[montos.length - 1];
  if (m) {
    r.monto = (m[1] === '-' ? -1 : 1) * aCentimos(m[2]);
    resto = resto.replace(m[0], ' ');
  }
  r.desc = resto.replace(/\s+/g, ' ').trim();
  return r;
}

interface Cruda {
  desc: string;
  fecha: NonNullable<Analisis['fecha']>;
  monto: number;
  pagina: number;
}

/** Año de una fila: el de la consulta, o el anterior si el mes es posterior; el día de la semana desempata. */
function resolverFecha(c: Cruda, anio: number, mesC0: number, diaC: number): string | null {
  const { d, mes0, dia } = c.fecha;
  const futuro = mes0 > mesC0 || (mes0 === mesC0 && d > diaC);
  for (const y of futuro ? [anio - 1, anio] : [anio, anio - 1]) {
    const w = diaSemana(y, mes0, d);
    if (w.valido && w.dia === dia) return `${y}-${pad(mes0 + 1)}-${pad(d)}`;
  }
  return null;
}

export function parsearConstancia(items: ItemTexto[]): ConstanciaLeida {
  const out: ConstanciaLeida = { cuenta: null, consulta: null, saldoContableCent: null, saldoDisponibleCent: null, filas: [], avisos: [] };
  const crudas: Cruda[] = [];
  let enMovimientos = false;
  let hayEtiquetasSaldo = false;
  let pendiente: (Analisis & { pagina: number; y: number; texto: string }) | null = null;
  let ultima: { y: number; pagina: number; idx: number } | null = null;

  const avisar = (pagina: number, texto: string, motivo: string) =>
    out.avisos.push(`Página ${pagina}: ${motivo}: «${texto}»`);
  const soltarPendiente = () => {
    if (pendiente) avisar(pendiente.pagina, pendiente.texto, 'fila incompleta (falta fecha o monto)');
    pendiente = null;
  };

  for (const fila of agruparFilas(items)) {
    const t = fila.texto;

    // --- Cabecera ---
    if (/CONSULTA DE MOVIMIENTOS|Tipo de Cambio|^SALDOS:?$/i.test(t)) continue;
    if (/^MOVIMIENTOS:?$/i.test(t) || /Cargo realizado por/i.test(t)) {
      enMovimientos = true;
      continue;
    }
    if (/Saldo Contable/i.test(t) && /Saldo Disponible/i.test(t)) {
      hayEtiquetasSaldo = true;
      continue;
    }
    const cta = /Cuenta\s+(.+?)\s+(Soles|D[oó]lares)\b/i.exec(t);
    if (cta && !enMovimientos) {
      if (/^D/i.test(cta[2])) out.avisos.push(`Cuenta en ${cta[2]}: Greedy solo maneja soles.`);
      else out.cuenta = cta[1].trim(); // el número de cuenta queda descartado aquí
      continue;
    }
    if (/FECHA:/i.test(t)) {
      const f = new RegExp(`(\\d{1,2})\\s+${MES_RE}\\.?\\s+(\\d{4})`, 'i').exec(t);
      const h = /HORA:\s*(\d{1,2}):(\d{2})/i.exec(t);
      if (f && h) out.consulta = { fecha: `${f[3]}-${pad(MESES.indexOf(f[2].toLowerCase()) + 1)}-${pad(Number(f[1]))}`, hora: `${pad(Number(h[1]))}:${h[2]}` };
      else avisar(fila.pagina, t, 'no pude leer la fecha/hora de la consulta');
      continue;
    }
    if (hayEtiquetasSaldo && out.saldoDisponibleCent === null) {
      const montos = [...t.matchAll(MONTO_RE)];
      if (montos.length >= 2) {
        const v = (m: RegExpMatchArray) => (m[1] === '-' ? -1 : 1) * aCentimos(m[2]);
        out.saldoContableCent = v(montos[0]);
        out.saldoDisponibleCent = v(montos[1]);
        continue;
      }
    }

    // --- Movimientos ---
    const a = analizar(t);
    if (a.fecha && a.monto !== undefined) {
      soltarPendiente();
      crudas.push({ desc: a.desc, fecha: a.fecha, monto: a.monto, pagina: fila.pagina });
      ultima = { y: fila.y, pagina: fila.pagina, idx: crudas.length - 1 };
      continue;
    }
    if (a.fecha || a.monto !== undefined) {
      // Fila partida: la fecha y el monto cayeron en líneas distintas. Se unen con la vecina.
      const p = pendiente as (Analisis & { pagina: number; y: number; texto: string }) | null;
      if (p && p.pagina === fila.pagina && p.y - fila.y <= TOL_CONTINUACION && ((p.fecha && a.monto !== undefined && !a.fecha) || (p.monto !== undefined && a.fecha && a.monto === undefined))) {
        const fecha = p.fecha ?? a.fecha!;
        const monto = p.monto ?? a.monto!;
        crudas.push({ desc: `${p.desc} ${a.desc}`.trim(), fecha, monto, pagina: fila.pagina });
        ultima = { y: fila.y, pagina: fila.pagina, idx: crudas.length - 1 };
        pendiente = null;
      } else {
        soltarPendiente();
        pendiente = { ...a, pagina: fila.pagina, y: fila.y, texto: t };
      }
      continue;
    }
    // Sin fecha ni monto con signo.
    if (!enMovimientos) continue; // resto de la cabecera (nombre del titular, etc.)
    if (pendiente && pendiente.pagina === fila.pagina && pendiente.y - fila.y <= TOL_CONTINUACION) {
      pendiente.desc = `${pendiente.desc} ${a.desc}`.trim(); // descriptor partido en dos líneas
      continue;
    }
    if (ultima && ultima.pagina === fila.pagina && ultima.y - fila.y <= TOL_CONTINUACION) {
      const c = crudas[ultima.idx];
      c.desc = `${c.desc} ${a.desc}`.trim(); // continuación del descriptor de la fila anterior
      ultima.y = fila.y;
      continue;
    }
    avisar(fila.pagina, t, 'línea no legible');
  }
  soltarPendiente();

  if (!out.consulta) {
    out.avisos.push('No encontré la fecha y hora de la consulta: no se puede fechar ninguna fila.');
    return out;
  }
  const [anio, mesC, diaC] = out.consulta.fecha.split('-').map(Number);
  for (const c of crudas) {
    const fecha = resolverFecha(c, anio, mesC - 1, diaC);
    if (!fecha) {
      avisar(c.pagina, `${c.desc} ${c.fecha.dia}. ${c.fecha.d}/${c.fecha.mes0 + 1}`, 'fecha imposible o día de la semana que no cuadra');
      continue;
    }
    out.filas.push({ descriptor: c.desc, fecha, hora: c.fecha.hora, centimos: c.monto, pagina: c.pagina });
  }
  return out;
}

/** Separa las filas anteriores a la fecha de corte de la cuenta (se descartan y se cuentan). */
export function filtrarDesde(filas: FilaBanco[], desde: string): { vigentes: FilaBanco[]; descartadas: FilaBanco[] } {
  const vigentes: FilaBanco[] = [];
  const descartadas: FilaBanco[] = [];
  for (const f of filas) (f.fecha < desde ? descartadas : vigentes).push(f);
  return { vigentes, descartadas };
}
