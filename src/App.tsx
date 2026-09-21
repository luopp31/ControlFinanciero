import { useRef, useState } from 'react';
import { AppShell, type Vista } from './components/AppShell';
import { Cuentas } from './pages/Cuentas';
import { Movimientos } from './pages/Movimientos';
import { Panel } from './pages/Panel';
import { Compromisos } from './pages/Compromisos';
import { Estadisticas } from './pages/Estadisticas';
import { Bienvenida } from './pages/Bienvenida/Bienvenida';
import { useAuth } from './hooks/useAuth';
import { useCuentas } from './hooks/useCuentas';

function App() {
  const [vista, setVista] = useState<Vista>('panel');
  const { session, cargando: cargandoAuth } = useAuth();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const [terminado, setTerminado] = useState(false);
  // Se decide una sola vez, al cargar, si hace falta bienvenida — no en cada
  // render. Si se recalculara con el `cuentas` en vivo, crear la primera
  // cuenta durante el onboarding (cuentas.length pasa a ser > 0) cerraría la
  // bienvenida de golpe, sin dejar agregar una segunda cuenta.
  const yaTeniaAlgoAlCargar = useRef<boolean | null>(null);

  if (cargandoAuth || cargandoCuentas) return null;

  if (yaTeniaAlgoAlCargar.current === null) {
    yaTeniaAlgoAlCargar.current = !!session || cuentas.length > 0;
  }

  if (!terminado && !yaTeniaAlgoAlCargar.current) {
    return <Bienvenida onContinuar={() => setTerminado(true)} />;
  }

  return (
    <AppShell vista={vista} onCambiarVista={setVista}>
      {vista === 'panel' && <Panel />}
      {vista === 'movimientos' && <Movimientos />}
      {vista === 'cuentas' && <Cuentas />}
      {vista === 'estadisticas' && <Estadisticas />}
      {vista === 'compromisos' && <Compromisos />}
    </AppShell>
  );
}

export default App;
