import { useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { page } from './lib/motion';
import Smash from './components/brand/Smash';
import Login from './pages/Login';
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-ink p-4">
        <Smash mood="idle" size={120} className="mb-4" />
        <p className="text-sm font-semibold text-muted">Carregando BurgerStock...</p>
      </div>
    );
  }

  if (!autenticado) {
    return <Login />;
  }

  if (modalAberto === 'importarNota') {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-canvas text-ink shadow-xl transition-colors">
        <ImportarNotaFiscal onVoltar={() => setModalAberto('none')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-canvas text-ink relative pb-16 shadow-xl transition-colors">
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={page}
            initial="initial"
            animate="enter"
            exit="exit"
          >
            {activeTab === 'inicio' && (
              <Inicio
                onNavegar={setActiveTab}
                onAbrirImportarNota={() => setModalAberto('importarNota')}
                onAbrirPerfil={() => setMostrarPerfil(true)}
                onAbrirConfiguracoes={() => setMostrarConfiguracoes(true)}
              />
            )}
            {activeTab === 'estoque' && <Estoque />}
            {activeTab === 'perdas' && <Perdas />}
            {activeTab === 'relatorios' && <Dashboard />}
          </motion.div>
        </AnimatePresence>
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
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider>
            <MainApp />
          </AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
