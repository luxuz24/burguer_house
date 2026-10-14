import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onAbrirPerfil: () => void;
  onAbrirConfiguracoes: () => void;
}

export default function Header({ onAbrirPerfil, onAbrirConfiguracoes }: HeaderProps) {
  const { usuario } = useAuth();

  const iniciais = (usuario?.nome || 'Operador')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <header className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 transition-colors">
      <div className="flex items-center gap-2">
        <div className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">
          BurgerStock
        </div>
        <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          Loja Aberta
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAbrirPerfil}
          className="flex items-center gap-1.5 py-1 px-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
          title={`Perfil de ${usuario?.nome || 'Usuário'}`}
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {iniciais}
          </div>
          <span className="hidden sm:inline text-xs font-medium max-w-[110px] truncate">
            {usuario?.nome?.split(' ')[0] || 'Usuário'}
          </span>
        </button>
        <button
          type="button"
          onClick={onAbrirConfiguracoes}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
          title="Configurações e Tema"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
