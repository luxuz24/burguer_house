import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider, useFeedback } from './context/FeedbackContext';
import { page } from './lib/motion';
import Smash from './components/brand/Smash';
import Login from './pages/Login';
import BottomNav from './components/BottomNav';
import Inicio from './pages/Inicio';
import Estoque, { type DestinoEstoque } from './pages/Estoque';
import Perdas from './pages/Perdas';
import Dashboard from './pages/Dashboard';
import ImportarNotaFiscal from './pages/ImportarNotaFiscal';
import FechamentoDia from './pages/FechamentoDia';
import ConfiguracoesModal from './components/ConfiguracoesModal';
import PerfilModal from './components/PerfilModal';

function MainApp() {
  const { autenticado, carregando } = useAuth();
  const { cancelarConfirmacoes } = useFeedback();

  useEffect(() => {
    // Quando a sessão cai ou termina, diálogos de confirmação abertos são cancelados
    // resolvendo com false e saindo da tela, sem cobrir o Login nem vazar para a próxima sessão.
    if (!autenticado) {
      cancelarConfirmacoes();
    }
  }, [autenticado, cancelarConfirmacoes]);

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

  // O shell só existe com sessão: ao cair a sessão ele desmonta e o próximo login começa do zero
  // (antes a aba, a tela de nota e o Perfil aberto sobreviviam ao logout e passavam para o próximo usuário).
  return <ShellAutenticado />;
}

function ShellAutenticado() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [destinoEstoque, setDestinoEstoque] = useState<DestinoEstoque | null>(null);
  const [modalAberto, setModalAberto] = useState<'none' | 'importarNota' | 'fechamentoDia'>('none');
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

  if (modalAberto === 'importarNota') {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-canvas text-ink shadow-xl transition-colors">
        <ImportarNotaFiscal onVoltar={() => setModalAberto('none')} />
      </div>
    );
  }

  if (modalAberto === 'fechamentoDia') {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-canvas text-ink shadow-xl transition-colors">
        <FechamentoDia onVoltar={() => setModalAberto('none')} />
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
                onNavegar={(tab) => {
                  setDestinoEstoque(null);
                  setActiveTab(tab);
                }}
                onAbrirVendasRetidas={(acao) => {
                  setDestinoEstoque({
                    seq: Date.now() + Math.random(),
                    aba: 'produtos',
                    acaoRetida: acao,
                  });
                  setActiveTab('estoque');
                }}
                onAbrirImportarNota={() => setModalAberto('importarNota')}
                onAbrirFechamentoDia={() => setModalAberto('fechamentoDia')}
                onAbrirPerfil={() => setMostrarPerfil(true)}
                onAbrirConfiguracoes={() => setMostrarConfiguracoes(true)}
              />
            )}
            {activeTab === 'estoque' && (
              <Estoque
                key={destinoEstoque ? `estoque-${destinoEstoque.seq}` : 'estoque-padrao'}
                destinoInicial={destinoEstoque}
              />
            )}
            {activeTab === 'perdas' && <Perdas />}
            {activeTab === 'relatorios' && <Dashboard />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'estoque') setDestinoEstoque(null);
          setActiveTab(tab);
        }}
      />

      <ConfiguracoesModal
        aberto={mostrarConfiguracoes}
        onFechar={() => setMostrarConfiguracoes(false)}
      />

      <PerfilModal
        aberto={mostrarPerfil}
        onFechar={() => setMostrarPerfil(false)}
        onAbrirConfiguracoes={() => {
          setMostrarPerfil(false);
          setMostrarConfiguracoes(true);
        }}
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
