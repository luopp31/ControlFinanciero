import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TextoBorrado } from '../lib/textoBorrado';
import { botonSecundario } from './formStyles';

/** "¿Borrar S/ 2.00 pasaje?" con detalle y aviso. Cancelar es lo que tiene el foco: un Enter sin querer no borra. */
export function ConfirmarBorrado({
  texto,
  borrando,
  onConfirmar,
  onCancelar,
}: {
  texto: TextoBorrado;
  borrando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCancelar]);

  return createPortal(
    <div
      onClick={onCancelar}
      style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-borrado-titulo"
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--card)' }}
      >
        <p id="confirmar-borrado-titulo" style={{ margin: 0, fontSize: 18, fontWeight: 800, overflowWrap: 'anywhere' }}>
          {texto.titulo}
        </p>
        {texto.detalle && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-fg)', overflowWrap: 'anywhere' }}>{texto.detalle}</p>}
        {texto.aviso && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-fg)' }}>{texto.aviso}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button ref={cancelarRef} type="button" onClick={onCancelar} disabled={borrando} style={{ ...botonSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={borrando}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 12, border: 'none', background: 'var(--destructive)', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: borrando ? 'not-allowed' : 'pointer', opacity: borrando ? 0.6 : 1 }}
          >
            {borrando ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
