import { useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Estoque from './pages/Estoque';
import Perdas from './pages/Perdas';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-gray-50 relative pb-16 shadow-xl">
      <Header />
      
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'inicio' && <Dashboard />}
        {activeTab === 'estoque' && <Estoque />}
        {activeTab === 'perdas' && <Perdas />}
        {activeTab === 'relatorios' && <Dashboard />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}