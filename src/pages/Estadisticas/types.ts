import type { CategoriaTotal, TotalMensual } from '../../lib/finanzas';
import type { Comparacion } from '../../components/ComparacionPeriodo';

export type Periodo = 'mes' | '3meses' | 'anio' | 'todo';
export type Modo = 'historial' | 'simular';

export interface EstadisticasViewProps {
  periodo: Periodo;
  onCambiarPeriodo: (p: Periodo) => void;
  modo: Modo;
  onCambiarModo: (m: Modo) => void;
  categorias: CategoriaTotal[];
  total: number;
  ingresos: number;
  comparacionGasto: Comparacion | null;
  comparacionIngreso: Comparacion | null;
  tendencia: TotalMensual[];
  valorNetoActual: number;
  promedioGastoSugerido: number;
  catColor: Record<string, string>;
}
