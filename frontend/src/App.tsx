import { useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Estoque from './pages/Estoque';
import Perdas from './pages/Perdas';

export default function App() {
  const [activeTab, setActiveTab] = useState('estoque');

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-gray-50 relative pb-16 shadow-xl">
      <Header />
      
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'estoque' && <Estoque />}
        {activeTab === 'inicio' && <div className="p-4 text-center text-gray-500 mt-10">Tela Inicial (Em breve)</div>}
        {activeTab === 'perdas' && <Perdas />}
        {activeTab === 'relatorios' && <div className="p-4 text-center text-gray-500 mt-10">Relatórios (Em breve)</div>}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}