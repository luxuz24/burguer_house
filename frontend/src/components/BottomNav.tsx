import { LayoutGrid, Package, Trash2, BarChart2 } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems = [
    { id: 'inicio', label: 'Início', icon: LayoutGrid },
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'perdas', label: 'Perdas', icon: Trash2 },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
  ];

  return (
    <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around pb-safe pt-2 px-2 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center w-16 py-1 gap-1 transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
