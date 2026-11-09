// Lee un PDF de texto en el navegador y entrega los items (texto + posición) al parser.
// El archivo nunca sale del dispositivo: no se sube a Supabase ni a Netlify.
// pdfjs pesa ~1,7 MB entre librería y worker: se importa recién cuando se usa (no en la carga inicial).
import type { ItemTexto } from './constancia';

export async function leerItemsPdf(archivo: File | Blob): Promise<ItemTexto[]> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  const doc = await tarea.promise;
  const items: ItemTexto[] = [];
  try {
    for (let pagina = 1; pagina <= doc.numPages; pagina++) {
      const contenido = await (await doc.getPage(pagina)).getTextContent();
      for (const it of contenido.items) {
        if ('str' in it) items.push({ s: it.str, x: it.transform[4], y: it.transform[5], pagina });
      }
    }
  } finally {
    await tarea.destroy();
  }
  return items;
}
