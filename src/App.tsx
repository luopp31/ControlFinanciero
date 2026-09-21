import { useEffect, useRef, useState } from 'react';
import { AppShell, type Vista } from './components/AppShell';
import { Cuentas } from './pages/Cuentas';
import { Movimientos } from './pages/Movimientos';
import { Panel } from './pages/Panel';
import { Compromisos } from './pages/Compromisos';
import { Estadisticas } from './pages/Estadisticas';
import { Ajustes } from './pages/Ajustes';
import { Bienvenida } from './pages/Bienvenida/Bienvenida';
import { useAuth } from './hooks/useAuth';
import { useConfig } from './hooks/useConfig';
import { useCuentas } from './hooks/useCuentas';

function App() {
  const [vista, setVista] = useState<Vista>('panel');
  const { session, cargando: cargandoAuth } = useAuth();
  const { cuentas, cargando: cargandoCuentas } = useCuentas();
  const { config } = useConfig();
  const [terminado, setTerminado] = useState(false);

  // El tema se aplica acá, no dentro de Ajustes, porque debe regir en toda la
  // app (incluida la Bienvenida) y no solo mientras esa pantalla está montada.
  useEffect(() => {
    const raiz = document.documentElement;
    if (config.tema === 'claro') raiz.setAttribute('data-theme', 'light');
    else if (config.tema === 'oscuro') raiz.setAttribute('data-theme', 'dark');
    else raiz.removeAttribute('data-theme');
  }, [config.tema]);
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
      {vista === 'ajustes' && <Ajustes onVolver={() => setVista('panel')} />}
    </AppShell>
  );
}

export default App;
