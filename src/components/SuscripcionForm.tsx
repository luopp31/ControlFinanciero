import { useId, useState } from 'react';
import { CATS } from '../lib/finanzas';
import { botonPrimario, botonSecundario, etiquetaStyle, inputStyle } from './formStyles';

type ValoresSuscripcion = { nombre: string; monto: number; diaCobro: number; categoria?: string | null };

interface SuscripcionFormProps {
  onCrear: (datos: ValoresSuscripcion) => Promise<unknown>;
  onCancelar?: () => void;
  valoresIniciales?: ValoresSuscripcion;
  etiquetaGuardar?: string;
}

export function SuscripcionForm({ onCrear, onCancelar, valoresIniciales, etiquetaGuardar }: SuscripcionFormProps) {
  const nombreId = useId();
  const categoriaId = useId();
  const editando = !!valoresIniciales;
  const [nombre, setNombre] = useState(valoresIniciales?.nombre ?? '');
  const [monto, setMonto] = useState(valoresIniciales ? String(valoresIniciales.monto) : '');
  const [diaCobro, setDiaCobro] = useState(valoresIniciales ? String(valoresIniciales.diaCobro) : '');
  const [categoria, setCategoria] = useState(valoresIniciales?.categoria ?? '');
  const [guardando, setGuardando] = useState(false);

  const montoValido = monto.trim() !== '' && !Number.isNaN(Number(monto)) && Number(monto) > 0;
  const diaValido =
    diaCobro.trim() !== '' && Number.isInteger(Number(diaCobro)) && Number(diaCobro) >= 1 && Number(diaCobro) <= 31;
  const listo = nombre.trim() !== '' && montoValido && diaValido;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      await onCrear({ nombre: nombre.trim(), monto: Number(monto), diaCobro: Number(diaCobro), categoria: categoria || null });
      if (editando) {
        onCancelar?.();
      } else {
        setNombre('');
        setMonto('');
        setDiaCobro('');
        setCategoria('');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={nombreId} style={etiquetaStyle}>
          Nombre
        </label>
        <input
          id={nombreId}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Spotify, Claude, Netflix..."
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span style={etiquetaStyle}>Monto mensual</span>
          <input
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 110 }}>
          <span style={etiquetaStyle}>Día de cobro</span>
          <input
            inputMode="numeric"
            value={diaCobro}
            onChange={(e) => setDiaCobro(e.target.value)}
            placeholder="1-31"
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={categoriaId} style={etiquetaStyle}>
          Categoría <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
        </label>
        <select id={categoriaId} value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
          <option value="">Sin categoría</option>
          {CATS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onCancelar && (
          <button type="button" onClick={onCancelar} style={botonSecundario}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={!listo || guardando} style={botonPrimario(!listo || guardando)}>
          {guardando ? 'Guardando…' : etiquetaGuardar ?? 'Registrar'}
        </button>
      </div>
    </form>
  );
}
