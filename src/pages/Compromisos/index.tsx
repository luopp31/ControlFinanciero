import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useCuentas } from '../../hooks/useCuentas';
import { useMovimientos } from '../../hooks/useMovimientos';
import { usePrestamos } from '../../hooks/usePrestamos';
import { useCompromisos } from '../../hooks/useCompromisos';
import type { Compromiso } from '../../lib/db';
import { direccionPago, type Prestamo } from '../../lib/finanzas';
import { hoyISO } from '../../lib/fecha';
import { CompromisosDesktop } from './Compromisos.desktop';
import { CompromisosMobile } from './Compromisos.mobile';

export function Compromisos() {
  const isDesktop = useIsDesktop();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { movimientos, cargando: cargandoMovs, crearMovimiento } = useMovimientos();
  const { prestamos, cargando: cargandoPrest, crearPrestamo, actualizarPrestamo, borrarPrestamo } = usePrestamos();
  const { compromisos, cargando: cargandoComps, crearCompromiso, actualizarCompromiso, borrarCompromiso } = useCompromisos();

  if (cargandoCuentas || cargandoMovs || cargandoPrest || cargandoComps) return null;

  const suscripciones = compromisos.filter((c) => c.tipo === 'SUSCRIPCION');

  async function crearPrestamoConMovimiento(
    datos: { persona: string; tipo: Prestamo['tipo']; capital: number; acordado?: number | null; fecha: string },
    cuentaId: string,
  ) {
    const nuevo = await crearPrestamo(datos);
    await crearMovimiento({
      fecha: datos.fecha,
      monto: datos.capital,
      tipo: 'PRESTAMO',
      cuentaId,
      dir: datos.tipo,
      prestId: nuevo.id,
    });
    return nuevo;
  }

  async function registrarPago(prestamo: Prestamo, monto: number, cuentaId: string) {
    await crearMovimiento({
      fecha: hoyISO(),
      monto,
      tipo: 'PRESTAMO',
      cuentaId,
      dir: direccionPago(prestamo.tipo),
      prestId: prestamo.id,
    });
  }

  async function crearSuscripcion(datos: { nombre: string; monto: number; diaCobro: number }) {
    await crearCompromiso({ tipo: 'SUSCRIPCION', ...datos });
  }

  async function registrarPagoSuscripcion(suscripcion: Compromiso, monto: number, cuentaId: string) {
    await crearMovimiento({
      fecha: hoyISO(),
      monto,
      tipo: 'GASTO',
      cuentaId,
      categoria: suscripcion.categoria ?? null,
      compromisoId: suscripcion.id,
      nota: suscripcion.nombre,
    });
  }

  const props = {
    cuentas,
    movimientos,
    prestamos,
    suscripciones,
    crearPrestamo: crearPrestamoConMovimiento,
    actualizarPrestamo,
    borrarPrestamo,
    registrarPago,
    crearSuscripcion,
    actualizarSuscripcion: actualizarCompromiso,
    registrarPagoSuscripcion,
    borrarSuscripcion: borrarCompromiso,
  };

  return isDesktop ? <CompromisosDesktop {...props} /> : <CompromisosMobile {...props} />;
}
