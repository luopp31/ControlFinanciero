import type { CategoriaTotal } from '../../lib/finanzas';

export type Periodo = 'mes' | '3meses' | 'anio' | 'todo';

export interface EstadisticasViewProps {
  periodo: Periodo;
  onCambiarPeriodo: (p: Periodo) => void;
  categorias: CategoriaTotal[];
  total: number;
  catColor: Record<string, string>;
}
