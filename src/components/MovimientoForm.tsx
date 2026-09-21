import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CATS,
  CATS_ING,
  estadoPrestamo,
  saldo,
  TIPOS,
  type Cuenta,
  type DireccionPrestamo,
  type Movimiento,
  type TipoMovimiento,
} from '../lib/finanzas';
import { hoyISO } from '../lib/fecha';
import { formatearMontoOcultable } from '../lib/formato';
import { useConfig } from '../hooks/useConfig';
import { useMovimientos } from '../hooks/useMovimientos';
import { usePrestamos } from '../hooks/usePrestamos';
import {
  CATEGORIA_ICONOS,
  IconCaretRight,
  IconDownload,
  IconTag,
  IconUpload,
  IconWallet,
  IconX,
  TIPO_COLOR,
  TIPO_ICONOS,
} from './icons';
import {
  acentoColor,
  acentoGasto,
  acentoIngreso,
  barraAcentoStyle,
  botonPrimario,
  botonSecundario,
  campoSelIconoStyle,
  campoSelStyle,
  chipStyleColor,
  etiquetaStyle,
  inputStyle,
  montoGrandeInputStyle,
  pickerGridStyle,
  pickerItemIconoStyle,
  pickerItemStyle,
  pickerOverlayStyle,
  segmentoStyle,
  segmentoTrackStyle,
} from './formStyles';

type ValoresMovimiento = Omit<Movimiento, 'id' | 'borrado' | 'actualizado' | 'sincronizado'>;

interface MovimientoFormProps {
  cuentas: Cuenta[];
  onCrear: (datos: ValoresMovimiento) => Promise<unknown>;
  onCancelar?: () => void;
  valoresIniciales?: ValoresMovimiento;
  etiquetaGuardar?: string;
}

const TIPOS_OTRO: TipoMovimiento[] = ['REEMBOLSO', 'TRASPASO', 'AHORRO', 'PRESTAMO'];

const TITULO_NUEVO: Record<TipoMovimiento, string> = {
  GASTO: 'Nuevo gasto',
  INGRESO: 'Nuevo ingreso',
  REEMBOLSO: 'Nuevo reembolso',
  TRASPASO: 'Nueva transferencia',
  AHORRO: 'Nuevo ahorro',
  PRESTAMO: 'Préstamo',
};

// Portado de DIRS en legacy/index.html:598-603.
const DIRS: { id: DireccionPrestamo; nombre: string; titulo: string; ayuda: string }[] = [
  { id: 'PRESTE', nombre: 'Presté', titulo: 'Presté dinero', ayuda: 'Sale de tu cuenta. No es gasto.' },
  { id: 'DEBO', nombre: 'Me prestaron', titulo: 'Me prestaron dinero', ayuda: 'Entra a tu cuenta. No es ingreso.' },
  { id: 'COBRO', nombre: 'Me pagaron', titulo: 'Me pagaron', ayuda: 'Alguien te devuelve.' },
  { id: 'PAGO', nombre: 'Pagué', titulo: 'Pagué una deuda', ayuda: 'Le devuelves a alguien.' },
];

type Picker = null | 'tipoOtro' | 'categoria' | 'cuenta' | 'destino';

export function MovimientoForm({ cuentas, onCrear, onCancelar, valoresIniciales, etiquetaGuardar }: MovimientoFormProps) {
  const fechaId = useId();
  const notaId = useId();
  const personaId = useId();
  const acordadoId = useId();
  const editando = !!valoresIniciales;
  const { movimientos } = useMovimientos();
  const { prestamos, crearPrestamo } = usePrestamos();
  const { config } = useConfig();
  const ocultoSaldos = !!config.ocultarSaldos;

  const [tipo, setTipo] = useState<TipoMovimiento>(valoresIniciales?.tipo ?? 'GASTO');
  const [cuentaId, setCuentaId] = useState(valoresIniciales?.cuentaId ?? cuentas[0]?.id ?? '');
  const [destinoId, setDestinoId] = useState(valoresIniciales?.destinoId ?? '');
  const [categoria, setCategoria] = useState(valoresIniciales?.categoria ?? '');
  const [monto, setMonto] = useState(valoresIniciales ? String(valoresIniciales.monto) : '');
  const [fecha, setFecha] = useState(valoresIniciales?.fecha ?? hoyISO());
  const [nota, setNota] = useState(valoresIniciales?.nota ?? '');
  const [guardando, setGuardando] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [dirPrestamo, setDirPrestamo] = useState<DireccionPrestamo>(valoresIniciales?.dir ?? 'PRESTE');
  const [prestIdSel, setPrestIdSel] = useState(valoresIniciales?.prestId ?? '');
  const [personaPrestamo, setPersonaPrestamo] = useState('');
  const [acordado, setAcordado] = useState('');

  const esOtro = TIPOS_OTRO.includes(tipo);
  const esPrestamo = tipo === 'PRESTAMO';
  const esNuevoPrestamo = dirPrestamo === 'PRESTE' || dirPrestamo === 'DEBO';
  const necesitaCategoria = tipo === 'GASTO' || tipo === 'INGRESO';
  const necesitaDestino = tipo === 'TRASPASO';
  const catalogo = tipo === 'INGRESO' ? CATS_ING : CATS;
  const destinosPosibles = cuentas.filter((c) => c.id !== cuentaId);

  const prestamosAbiertos = prestamos.filter((p) => {
    const e = estadoPrestamo(p, movimientos);
    return !e.saldado && ((dirPrestamo === 'COBRO' && p.tipo === 'PRESTE') || (dirPrestamo === 'PAGO' && p.tipo === 'DEBO'));
  });
  const prestIdEfectivo = prestIdSel || prestamosAbiertos[0]?.id || '';

  const categoriaSel = catalogo.find((c) => c.id === categoria) ?? null;
  const cuentaSel = cuentas.find((c) => c.id === cuentaId) ?? null;
  const destinoSel = cuentas.find((c) => c.id === destinoId) ?? null;

  const acento =
    tipo === 'GASTO' ? acentoGasto() : tipo === 'INGRESO' ? acentoIngreso() : acentoColor(TIPO_COLOR[tipo] ?? '#9A93AC');

  const montoValido = monto.trim() !== '' && !Number.isNaN(Number(monto)) && Number(monto) > 0;
  const prestamoValido = !esPrestamo || (esNuevoPrestamo ? personaPrestamo.trim() !== '' : prestIdEfectivo !== '');
  const listo =
    montoValido &&
    cuentaId !== '' &&
    (!necesitaCategoria || categoria !== '') &&
    (!necesitaDestino || destinoId !== '') &&
    prestamoValido;

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    setCategoria('');
    setDestinoId('');
    setPicker(null);
    if (t === 'PRESTAMO') {
      setDirPrestamo('PRESTE');
      setPersonaPrestamo('');
      setAcordado('');
      setPrestIdSel('');
    }
  }

  function cambiarDirPrestamo(d: DireccionPrestamo) {
    setDirPrestamo(d);
    setPrestIdSel('');
  }

  function saldoDe(c: Cuenta): string {
    return formatearMontoOcultable(saldo(c, movimientos), ocultoSaldos);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      let prestId: string | null = null;
      if (esPrestamo) {
        if (esNuevoPrestamo) {
          const montoNum = Number(monto);
          const acordadoNum = Number(acordado);
          const nuevo = await crearPrestamo({
            tipo: dirPrestamo === 'PRESTE' ? 'PRESTE' : 'DEBO',
            persona: personaPrestamo.trim(),
            capital: montoNum,
            acordado: acordadoNum > 0 ? acordadoNum : montoNum,
            fecha,
          });
          prestId = nuevo.id;
        } else {
          prestId = prestIdEfectivo;
        }
      }
      await onCrear({
        fecha,
        monto: Number(monto),
        tipo,
        categoria: necesitaCategoria ? categoria : null,
        cuentaId,
        destinoId: necesitaDestino ? destinoId : null,
        dir: esPrestamo ? dirPrestamo : null,
        prestId,
        nota: nota.trim() || null,
      });
      if (editando) {
        onCancelar?.();
      } else {
        setMonto('');
        setNota('');
        setCategoria('');
        setPersonaPrestamo('');
        setAcordado('');
        setPrestIdSel('');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
      <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 800, textAlign: 'center' }}>
        {editando ? 'Editar movimiento' : esPrestamo ? DIRS.find((d) => d.id === dirPrestamo)?.titulo : TITULO_NUEVO[tipo]}
      </p>

      <div style={segmentoTrackStyle}>
        <button type="button" onClick={() => cambiarTipo('GASTO')} style={segmentoStyle(tipo === 'GASTO', 'var(--destructive)')}>
          <IconUpload width={15} height={15} />
          Gasto
        </button>
        <button type="button" onClick={() => cambiarTipo('INGRESO')} style={segmentoStyle(tipo === 'INGRESO', 'var(--accent)')}>
          <IconDownload width={15} height={15} />
          Ingreso
        </button>
        <button
          type="button"
          onClick={() => setPicker('tipoOtro')}
          style={segmentoStyle(esOtro, esOtro ? TIPO_COLOR[tipo] : 'var(--muted-fg)')}
        >
          {esOtro && TIPO_ICONOS[tipo] ? (
            (() => {
              const IconoOtro = TIPO_ICONOS[tipo];
              return <IconoOtro width={15} height={15} />;
            })()
          ) : (
            <IconCaretRight width={13} height={13} style={{ transform: 'rotate(90deg)' }} />
          )}
          {esOtro ? TIPOS.find((t) => t.id === tipo)?.nombre : 'Otro'}
        </button>
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '22px 0' }}
        onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
      >
        <span style={barraAcentoStyle(acento)} />
        <input
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
          autoComplete="off"
          autoFocus={!editando}
          onFocus={(e) => e.target.select()}
          style={montoGrandeInputStyle(acento, monto.trim() !== '')}
        />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--muted-fg)', flex: '0 0 auto' }}>S/</span>
      </div>

      {esPrestamo && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {DIRS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => cambiarDirPrestamo(d.id)}
                style={chipStyleColor(dirPrestamo === d.id, d.id === 'PRESTE' || d.id === 'PAGO' ? '#FF5C86' : '#3DE39A')}
              >
                {d.nombre}
              </button>
            ))}
          </div>

          {esNuevoPrestamo ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={personaId} style={etiquetaStyle}>
                  Persona
                </label>
                <input
                  id={personaId}
                  value={personaPrestamo}
                  onChange={(e) => setPersonaPrestamo(e.target.value)}
                  placeholder="Nombre"
                  style={inputStyle}
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
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-fg)' }}>
                {DIRS.find((d) => d.id === dirPrestamo)?.ayuda} No afecta tu valor neto.
              </p>
            </>
          ) : prestamosAbiertos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={etiquetaStyle}>¿A cuál corresponde?</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {prestamosAbiertos.map((p) => {
                  const e = estadoPrestamo(p, movimientos);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPrestIdSel(p.id)}
                      style={chipStyleColor(prestIdEfectivo === p.id, '#8B5CF6')}
                    >
                      {p.persona} · falta S/ {formatearMontoOcultable(e.falta, ocultoSaldos)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--destructive)' }}>
              No hay {dirPrestamo === 'COBRO' ? 'préstamos' : 'deudas'} abiertos. Registra primero el original.
            </p>
          )}
        </>
      )}

      <button type="button" onClick={() => setPicker('cuenta')} style={campoSelStyle}>
        <span style={campoSelIconoStyle('var(--primary)')}>
          <IconWallet width={17} height={17} />
        </span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <small style={{ display: 'block', fontSize: 10.5, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {necesitaDestino ? 'Desde' : 'Cuenta'}
          </small>
          <b style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{cuentaSel?.nombre ?? 'Elegir cuenta'}</b>
          {cuentaSel && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-fg)' }}>Saldo: S/ {saldoDe(cuentaSel)}</span>
          )}
        </span>
        <IconCaretRight width={15} height={15} style={{ color: 'var(--muted-fg)', opacity: 0.6, flex: '0 0 auto' }} />
      </button>

      {necesitaDestino && (
        <button type="button" onClick={() => setPicker('destino')} style={campoSelStyle}>
          <span style={campoSelIconoStyle('var(--primary)')}>
            <IconWallet width={17} height={17} />
          </span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <small style={{ display: 'block', fontSize: 10.5, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Hacia
            </small>
            <b style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{destinoSel?.nombre ?? 'Elegir cuenta destino'}</b>
            {destinoSel && (
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-fg)' }}>Saldo: S/ {saldoDe(destinoSel)}</span>
            )}
          </span>
          <IconCaretRight width={15} height={15} style={{ color: 'var(--muted-fg)', opacity: 0.6, flex: '0 0 auto' }} />
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={notaId} style={etiquetaStyle}>
          Descripción
        </label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <IconTag
            width={16}
            height={16}
            style={{ position: 'absolute', left: 13, color: 'var(--muted-fg)', pointerEvents: 'none' }}
          />
          <input
            id={notaId}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="¿En qué ha sido?"
            style={{ ...inputStyle, paddingLeft: 38 }}
          />
        </div>
      </div>

      {necesitaCategoria && (
        <button type="button" onClick={() => setPicker('categoria')} style={campoSelStyle}>
          <span style={campoSelIconoStyle(categoriaSel?.color ?? '#9A93AC')}>
            {categoriaSel ? (
              (() => {
                const Icono = CATEGORIA_ICONOS[categoriaSel.icono];
                return <Icono width={17} height={17} />;
              })()
            ) : (
              <IconCaretRight width={17} height={17} />
            )}
          </span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <small style={{ display: 'block', fontSize: 10.5, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Categoría
            </small>
            <b style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{categoriaSel ? categoriaSel.nombre : 'Elegir categoría'}</b>
          </span>
          <IconCaretRight width={15} height={15} style={{ color: 'var(--muted-fg)', opacity: 0.6, flex: '0 0 auto' }} />
        </button>
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

      {picker === 'tipoOtro' &&
        createPortal(
          <div style={pickerOverlayStyle}>
            <PickerHeader titulo="Tipo de movimiento" onCerrar={() => setPicker(null)} />
            <div style={pickerGridStyle}>
              {TIPOS_OTRO.map((id) => {
                const t = TIPOS.find((x) => x.id === id)!;
                const Icono = TIPO_ICONOS[id];
                const color = TIPO_COLOR[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => cambiarTipo(id)}
                    style={pickerItemStyle(tipo === id, color)}
                  >
                    <span style={pickerItemIconoStyle(color)}>
                      <Icono width={19} height={19} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{t.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}

      {picker === 'categoria' &&
        createPortal(
          <div style={pickerOverlayStyle}>
            <PickerHeader titulo="Categoría" onCerrar={() => setPicker(null)} />
            <div style={{ ...pickerGridStyle, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {catalogo.map((c) => {
                const Icono = CATEGORIA_ICONOS[c.icono];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoria(c.id);
                      setPicker(null);
                    }}
                    style={pickerItemStyle(categoria === c.id, c.color)}
                  >
                    <span style={pickerItemIconoStyle(c.color)}>
                      <Icono width={19} height={19} />
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                      {c.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}

      {picker === 'cuenta' &&
        createPortal(
          <div style={pickerOverlayStyle}>
            <PickerHeader titulo="Cuenta" onCerrar={() => setPicker(null)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cuentas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCuentaId(c.id);
                    if (c.id === destinoId) setDestinoId('');
                    setPicker(null);
                  }}
                  style={campoSelStyle}
                >
                  <span style={campoSelIconoStyle('var(--primary)')}>
                    <IconWallet width={17} height={17} />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <b style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{c.nombre}</b>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-fg)' }}>Saldo: S/ {saldoDe(c)}</span>
                  </span>
                  {cuentaId === c.id && <IconCaretRight width={15} height={15} style={{ color: 'var(--primary)' }} />}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {picker === 'destino' &&
        createPortal(
          <div style={pickerOverlayStyle}>
            <PickerHeader titulo="Cuenta destino" onCerrar={() => setPicker(null)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {destinosPosibles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setDestinoId(c.id);
                    setPicker(null);
                  }}
                  style={campoSelStyle}
                >
                  <span style={campoSelIconoStyle('var(--primary)')}>
                    <IconWallet width={17} height={17} />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <b style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{c.nombre}</b>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-fg)' }}>Saldo: S/ {saldoDe(c)}</span>
                  </span>
                  {destinoId === c.id && <IconCaretRight width={15} height={15} style={{ color: 'var(--primary)' }} />}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </form>
  );
}

function PickerHeader({ titulo, onCerrar }: { titulo: string; onCerrar: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{titulo}</p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        style={{
          all: 'unset',
          cursor: 'pointer',
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'var(--muted)',
          color: 'var(--muted-fg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconX width={15} height={15} />
      </button>
    </div>
  );
}
