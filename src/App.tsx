import { useState } from 'react';
import { AppShell, type Vista } from './components/AppShell';
import { Cuentas } from './pages/Cuentas';
import { Movimientos } from './pages/Movimientos';
import { Panel } from './pages/Panel';
import { Compromisos } from './pages/Compromisos';

function App() {
  const [vista, setVista] = useState<Vista>('panel');

  return (
    <AppShell vista={vista} onCambiarVista={setVista}>
      {vista === 'panel' && <Panel />}
      {vista === 'cuentas' && <Cuentas />}
      {vista === 'movimientos' && <Movimientos />}
      {vista === 'compromisos' && <Compromisos />}
    </AppShell>
  );
}

export default App;
