import { useId, useState } from 'react';
import type { RolCuenta } from '../lib/finanzas';
import { hoyISO } from '../lib/fecha';
import { botonPrimario, botonSecundario, chipStyle, etiquetaStyle, inputStyle } from './formStyles';

interface CuentaFormProps {
  onCrear: (datos: { nombre: string; rol: RolCuenta; saldoInicial: number; desde: string }) => Promise<unknown>;
  onCancelar?: () => void;
}

const ROLES: { id: RolCuenta; etiqueta: string; ayuda: string }[] = [
  { id: 'BILLETERA', etiqueta: 'Billetera', ayuda: 'De aquí sale tu gasto diario' },
  { id: 'BOVEDA', etiqueta: 'Bóveda', ayuda: 'Guarda. No gastas desde aquí' },
];

export function CuentaForm({ onCrear, onCancelar }: CuentaFormProps) {
  const nombreId = useId();
  const saldoId = useId();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolCuenta>('BILLETERA');
  const [saldo, setSaldo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const saldoValido = saldo.trim() !== '' && !Number.isNaN(Number(saldo));
  const listo = nombre.trim() !== '' && saldoValido;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      await onCrear({ nombre: nombre.trim(), rol, saldoInicial: Number(saldo), desde: hoyISO() });
      setNombre('');
      setSaldo('');
      setRol('BILLETERA');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={nombreId} style={etiquetaStyle}>
          Nombre de la cuenta
        </label>
        <input
          id={nombreId}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Simple, BCP, Interbank..."
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={etiquetaStyle}>Tipo de cuenta</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRol(r.id)}
              aria-pressed={rol === r.id}
              style={chipStyle(rol === r.id)}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
          {ROLES.find((r) => r.id === rol)?.ayuda}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={saldoId} style={etiquetaStyle}>
          Saldo actual, según tu banco
        </label>
        <input
          id={saldoId}
          inputMode="decimal"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          placeholder="0.00"
          style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
        />
        <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
          El de hoy — no intentes reconstruir historial pasado, eso solo genera saldos que no cuadran.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onCancelar && (
          <button type="button" onClick={onCancelar} style={botonSecundario}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={!listo || guardando} style={botonPrimario(!listo || guardando)}>
          {guardando ? 'Guardando…' : 'Crear cuenta'}
        </button>
      </div>
    </form>
  );
}
