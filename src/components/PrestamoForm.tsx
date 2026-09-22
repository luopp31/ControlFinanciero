import { useId, useState } from 'react';
import type { Cuenta, TipoPrestamo } from '../lib/finanzas';
import { hoyISO } from '../lib/fecha';
import { botonPrimario, botonSecundario, chipStyle, etiquetaStyle, inputStyle } from './formStyles';

type ValoresPrestamo = {
  persona: string;
  tipo: TipoPrestamo;
  capital: number;
  acordado?: number | null;
  fecha: string;
};

interface PrestamoFormProps {
  cuentas: Cuenta[];
  onCrear: (datos: ValoresPrestamo, cuentaId: string) => Promise<unknown>;
  onCancelar?: () => void;
  valoresIniciales?: ValoresPrestamo;
  etiquetaGuardar?: string;
}

const TIPOS: { id: TipoPrestamo; etiqueta: string }[] = [
  { id: 'PRESTE', etiqueta: 'Me deben' },
  { id: 'DEBO', etiqueta: 'Le debo' },
];

export function PrestamoForm({ cuentas, onCrear, onCancelar, valoresIniciales, etiquetaGuardar }: PrestamoFormProps) {
  const personaId = useId();
  const acordadoId = useId();
  const editando = !!valoresIniciales;
  const [persona, setPersona] = useState(valoresIniciales?.persona ?? '');
  const [tipo, setTipo] = useState<TipoPrestamo>(valoresIniciales?.tipo ?? 'PRESTE');
  const [capital, setCapital] = useState(valoresIniciales ? String(valoresIniciales.capital) : '');
  const [acordado, setAcordado] = useState(valoresIniciales?.acordado ? String(valoresIniciales.acordado) : '');
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [guardando, setGuardando] = useState(false);

  const capitalValido = capital.trim() !== '' && !Number.isNaN(Number(capital)) && Number(capital) > 0;
  const listo = persona.trim() !== '' && capitalValido && (editando || cuentaId !== '');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      const acordadoNum = Number(acordado);
      await onCrear(
        {
          persona: persona.trim(),
          tipo,
          capital: Number(capital),
          acordado: acordadoNum > 0 ? acordadoNum : null,
          fecha: valoresIniciales?.fecha ?? hoyISO(),
        },
        cuentaId,
      );
      if (editando) {
        onCancelar?.();
      } else {
        setPersona('');
        setCapital('');
        setAcordado('');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={etiquetaStyle}>Tipo</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              aria-pressed={tipo === t.id}
              style={chipStyle(tipo === t.id)}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={personaId} style={etiquetaStyle}>
          Persona
        </label>
        <input
          id={personaId}
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="Nombre"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={etiquetaStyle}>Monto</span>
        <input
          inputMode="decimal"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
          placeholder="0.00"
          style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={acordadoId} style={etiquetaStyle}>
          Monto acordado a devolver <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
        </label>
        <input
          id={acordadoId}
          inputMode="decimal"
          value={acordado}
          onChange={(e) => setAcordado(e.target.value)}
          placeholder="Igual al monto si lo dejas vacío"
          style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
        />
      </div>

      {!editando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={etiquetaStyle}>{tipo === 'PRESTE' ? 'Sale de' : 'Entra a'}</span>
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={inputStyle}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

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
