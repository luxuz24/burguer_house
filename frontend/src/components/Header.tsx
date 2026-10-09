import { User, Settings } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <div className="font-bold text-xl text-gray-900 tracking-tight">
          BurgerStock
        </div>
        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          Loja Aberta
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        <button className="text-gray-500 hover:text-gray-700">
          <User size={20} />
        </button>
        <button className="text-gray-500 hover:text-gray-700">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
