import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
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
  const { autenticado, carregando } = useAuth();
  const [activeTab, setActiveTab] = useState('inicio');
  const [modalAberto, setModalAberto] = useState<'none' | 'importarNota'>('none');
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

  if (carregando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white p-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Carregando BurgerStock...</p>
      </div>
    );
  }

  if (!autenticado) {
    return <Login />;
  }

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
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}