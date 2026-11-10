// Lee un PDF de texto en el navegador y entrega los items (texto + posición) al parser.
// El archivo nunca sale del dispositivo: no se sube a Supabase ni a Netlify.
// pdfjs pesa ~1,7 MB entre librería y worker: se importa recién cuando se usa (no en la carga inicial).
//
// Se usa la build "legacy" de pdfjs-dist a propósito: la normal llama funciones muy nuevas SIN polyfill
// (Math.sumPrecise, Map.prototype.getOrInsertComputed, Uint8Array.fromBase64/toHex…) que Chrome/Edge
// recientes tienen pero Safari/iOS no; la legacy trae esos polyfills. No depende de file.type ni de la
// extensión: lo que entrega iOS puede venir con type vacío, así que siempre se lee con arrayBuffer().
import type { ItemTexto } from './constancia';

/** "Nombre: mensaje" de un error, sin URLs ni rutas, en una línea y corto. Pensado para mostrarlo en pantalla. */
export function describirError(e: unknown): string {
  const nombre = e instanceof Error ? e.name : '';
  const mensaje = (e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/(?:[A-Za-z]:)?[\\/][\w.\-\\/]{3,}/g, '[ruta]')
    .replace(/\s+/g, ' ')
    .trim();
  const texto = nombre && nombre !== 'Error' ? `${nombre}: ${mensaje}` : mensaje;
  return texto.length > 200 ? `${texto.slice(0, 200)}…` : texto;
}

export async function leerItemsPdf(archivo: File | Blob): Promise<ItemTexto[]> {
  // La etapa en curso viaja en el mensaje: así, si falla en un celular, se ve en qué paso.
  let etapa = 'cargando el lector de PDF';
  try {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    etapa = 'leyendo el archivo';
    const datos = new Uint8Array(await archivo.arrayBuffer());

    etapa = 'abriendo el PDF';
    const tarea = pdfjs.getDocument({ data: datos });
    const doc = await tarea.promise;
    const items: ItemTexto[] = [];
    try {
      for (let pagina = 1; pagina <= doc.numPages; pagina++) {
        etapa = `leyendo la página ${pagina}`;
        const contenido = await (await doc.getPage(pagina)).getTextContent();
        for (const it of contenido.items) {
          if ('str' in it) items.push({ s: it.str, x: it.transform[4], y: it.transform[5], pagina });
        }
      }
    } finally {
      await tarea.destroy();
    }
    return items;
  } catch (e) {
    throw new Error(`${etapa} · ${describirError(e)}`);
  }
}
