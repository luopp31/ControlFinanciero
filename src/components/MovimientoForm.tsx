import { useId, useState } from 'react';
import { CATS, CATS_ING, TIPOS, type Cuenta, type Movimiento, type TipoMovimiento } from '../lib/finanzas';
import { hoyISO } from '../lib/fecha';
import { CATEGORIA_ICONOS } from './icons';
import { botonPrimario, botonSecundario, chipStyle, chipStyleColor, etiquetaStyle, inputStyle } from './formStyles';

type ValoresMovimiento = Omit<Movimiento, 'id' | 'borrado' | 'actualizado' | 'sincronizado'>;

interface MovimientoFormProps {
  cuentas: Cuenta[];
  onCrear: (datos: ValoresMovimiento) => Promise<unknown>;
  onCancelar?: () => void;
  valoresIniciales?: ValoresMovimiento;
  etiquetaGuardar?: string;
}

export function MovimientoForm({ cuentas, onCrear, onCancelar, valoresIniciales, etiquetaGuardar }: MovimientoFormProps) {
  const montoId = useId();
  const fechaId = useId();
  const notaId = useId();
  const editando = !!valoresIniciales;

  const [tipo, setTipo] = useState<TipoMovimiento>(valoresIniciales?.tipo ?? 'GASTO');
  const [cuentaId, setCuentaId] = useState(valoresIniciales?.cuentaId ?? cuentas[0]?.id ?? '');
  const [destinoId, setDestinoId] = useState(valoresIniciales?.destinoId ?? '');
  const [categoria, setCategoria] = useState(valoresIniciales?.categoria ?? '');
  const [monto, setMonto] = useState(valoresIniciales ? String(valoresIniciales.monto) : '');
  const [fecha, setFecha] = useState(valoresIniciales?.fecha ?? hoyISO());
  const [nota, setNota] = useState(valoresIniciales?.nota ?? '');
  const [guardando, setGuardando] = useState(false);

  const necesitaCategoria = tipo === 'GASTO' || tipo === 'INGRESO';
  const necesitaDestino = tipo === 'TRASPASO';
  const catalogo = tipo === 'INGRESO' ? CATS_ING : CATS;
  const destinosPosibles = cuentas.filter((c) => c.id !== cuentaId);

  const montoValido = monto.trim() !== '' && !Number.isNaN(Number(monto)) && Number(monto) > 0;
  const listo =
    montoValido &&
    cuentaId !== '' &&
    (!necesitaCategoria || categoria !== '') &&
    (!necesitaDestino || destinoId !== '');

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    setCategoria('');
    setDestinoId('');
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      await onCrear({
        fecha,
        monto: Number(monto),
        tipo,
        categoria: necesitaCategoria ? categoria : null,
        cuentaId,
        destinoId: necesitaDestino ? destinoId : null,
        nota: nota.trim() || null,
      });
      if (editando) {
        onCancelar?.();
      } else {
        setMonto('');
        setNota('');
        setCategoria('');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={etiquetaStyle}>Tipo</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiarTipo(t.id)}
              aria-pressed={tipo === t.id}
              style={chipStyle(tipo === t.id)}
            >
              {t.nombre}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={montoId} style={etiquetaStyle}>
          Monto
        </label>
        <input
          id={montoId}
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={etiquetaStyle}>{necesitaDestino ? 'Desde' : 'Cuenta'}</span>
        <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={inputStyle}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {necesitaDestino && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={etiquetaStyle}>Hacia</span>
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} style={inputStyle}>
            <option value="">Elige una cuenta destino</option>
            {destinosPosibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {necesitaCategoria && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={etiquetaStyle}>Categoría</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {catalogo.map((c) => {
              const Icono = CATEGORIA_ICONOS[c.icono];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoria(c.id)}
                  aria-pressed={categoria === c.id}
                  style={chipStyleColor(categoria === c.id, c.color)}
                >
                  <Icono width={14} height={14} />
                  {c.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={fechaId} style={etiquetaStyle}>
          Fecha
        </label>
        <input
          id={fechaId}
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={notaId} style={etiquetaStyle}>
          Nota <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
        </label>
        <input id={notaId} value={nota} onChange={(e) => setNota(e.target.value)} style={inputStyle} />
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

