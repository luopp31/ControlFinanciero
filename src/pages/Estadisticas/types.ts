import type { CategoriaTotal, TotalMensual } from '../../lib/finanzas';
import type { Comparacion } from '../../components/ComparacionPeriodo';

export type Periodo = 'mes' | '3meses' | 'anio' | 'todo';

export interface EstadisticasViewProps {
  periodo: Periodo;
  onCambiarPeriodo: (p: Periodo) => void;
  categorias: CategoriaTotal[];
  total: number;
  ingresos: number;
  comparacionGasto: Comparacion | null;
  comparacionIngreso: Comparacion | null;
  tendencia: TotalMensual[];
  catColor: Record<string, string>;
}
