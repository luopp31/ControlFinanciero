import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS, type Cuenta, type Movimiento } from '../lib/finanzas';
import { categoriasFrecuentes } from '../lib/frecuentes';
import { hoyISO } from '../lib/fecha';
import { leerMonto } from '../lib/presupuesto';
import { acentoGasto, barraAcentoStyle, botonPrimario, chipStyle, chipStyleColor, etiquetaStyle, inputStyle, montoGrandeInputStyle } from './formStyles';

type Datos = Omit<Movimiento, 'id' | 'borrado' | 'actualizado' | 'sincronizado'>;

/**
 * Un gasto en pocos segundos: monto (teclado numérico ya enfocado), categoría frecuente y Guardar.
 * Por defecto: gasto, cuenta Simple (la billetera), fecha de hoy. Sin categoría se guarda como "Sin identificar".
 * Escribir solo cambia el estado local de este bloque: no repinta la vista de atrás (en iOS cerraría el teclado).
 */
export function RegistroRapidoForm({
  cuentas,
  movimientos,
  retrasoEnfoqueMs,
  onGuardar,
  onMasOpciones,
}: {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  retrasoEnfoqueMs: number;
  onGuardar: (datos: Datos) => Promise<unknown>;
  onMasOpciones: (monto: string) => void;
}) {
  const montoRef = useRef<HTMLInputElement>(null);
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState(() => (cuentas.find((c) => c.rol === 'BILLETERA') ?? cuentas[0]).id);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [enfocado, setEnfocado] = useState(false);

  // Las categorías se calculan una vez al abrir: no se reordenan mientras escribes.
  const frecuentes = useMemo(() => categoriasFrecuentes(movimientos, hoyISO(), 6), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setTimeout(() => montoRef.current?.focus(), retrasoEnfoqueMs);
    return () => clearTimeout(id);
  }, [retrasoEnfoqueMs]);

  const valor = leerMonto(monto);
  const acento = acentoGasto();

  async function guardar() {
    if (valor === null || guardando) return;
    setGuardando(true);
    try {
      await onGuardar({ fecha: hoyISO(), monto: valor, tipo: 'GASTO', categoria: categoria ?? 'SINID', cuentaId, nota: nota.trim() || null });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nuevo gasto</p>

      {/* Toda la fila es un <label>: un toque en cualquier parte enfoca el monto. Si el teclado no se abrió solo
          (iOS a veces lo impide), la fila resaltada invita a tocarla. */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 18,
          background: 'var(--muted)',
          border: `2px solid ${enfocado ? acento.texto : 'var(--primary)'}`,
          cursor: 'text',
          transition: 'border-color .15s ease',
        }}
      >
        <span style={barraAcentoStyle(acento)} />
        <input
          ref={montoRef}
          onFocus={(e) => {
            setEnfocado(true);
            e.target.select();
          }}
          onBlur={() => setEnfocado(false)}
          inputMode="decimal"
          enterKeyHint="done"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
          aria-label="Monto"
          autoComplete="off"
          style={montoGrandeInputStyle(acento, monto.trim() !== '')}
        />
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--muted-fg)' }}>S/</span>
      </label>
      {!enfocado && monto.trim() === '' && (
        <p style={{ margin: '-8px 0 0', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>Toca aquí y escribe el monto</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {frecuentes.map((id) => {
          const c = CATS.find((x) => x.id === id);
          if (!c) return null;
          const sel = categoria === id;
          return (
            <button key={id} type="button" aria-pressed={sel} style={chipStyleColor(sel, c.color)} onClick={() => setCategoria(sel ? null : id)}>
              {c.nombre}
            </button>
          );
        })}
      </div>

      {cuentas.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={etiquetaStyle}>Desde</span>
          {cuentas.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === cuentaId} style={chipStyle(c.id === cuentaId)} onClick={() => setCuentaId(c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota" autoComplete="off" style={inputStyle} />

      <button type="submit" disabled={valor === null || guardando} style={botonPrimario(valor === null || guardando)}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" onClick={() => onMasOpciones(monto)} style={{ all: 'unset', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline' }}>
        Más opciones
      </button>
    </form>
  );
}
