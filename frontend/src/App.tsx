import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Inicio from './pages/Inicio';
import Estoque from './pages/Estoque';
import Perdas from './pages/Perdas';
import Dashboard from './pages/Dashboard';
import ImportarNotaFiscal from './pages/ImportarNotaFiscal';
import ConfiguracoesModal from './components/ConfiguracoesModal';
import PerfilModal from './components/PerfilModal';

function MainApp() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [modalAberto, setModalAberto] = useState<'none' | 'importarNota'>('none');
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

  if (modalAberto === 'importarNota') {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-gray-50 dark:bg-gray-950 shadow-xl transition-colors">
        <ImportarNotaFiscal onVoltar={() => setModalAberto('none')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 relative pb-16 shadow-xl transition-colors">
      <Header
        onAbrirPerfil={() => setMostrarPerfil(true)}
        onAbrirConfiguracoes={() => setMostrarConfiguracoes(true)}
      />
      
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'inicio' && (
          <Inicio
            onNavegar={setActiveTab}
            onAbrirImportarNota={() => setModalAberto('importarNota')}
          />
        )}
        {activeTab === 'estoque' && <Estoque />}
        {activeTab === 'perdas' && <Perdas />}
        {activeTab === 'relatorios' && <Dashboard />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <ConfiguracoesModal
        aberto={mostrarConfiguracoes}
        onFechar={() => setMostrarConfiguracoes(false)}
      />

      <PerfilModal
        aberto={mostrarPerfil}
        onFechar={() => setMostrarPerfil(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}