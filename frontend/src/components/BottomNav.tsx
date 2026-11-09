import { NavIcon, type NavTabId } from './brand/NavIcons';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavItem {
  id: NavTabId;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'perdas', label: 'Perdas' },
  { id: 'relatorios', label: 'Relatórios' },
];

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 w-full max-w-md bg-card border-t border-line flex justify-around pb-safe pt-1.5 px-2 z-50 transition-colors shadow-[var(--shadow-card)]"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 gap-0.5 cursor-pointer transition-colors ${
              isActive
                ? 'text-brand font-semibold'
                : 'text-muted font-normal hover:text-ink'
            }`}
          >
            <span
              className={`rounded-full px-3.5 py-0.5 transition-colors ${
                isActive ? 'bg-primary-soft' : 'bg-transparent'
              }`}
            >
              <NavIcon id={item.id} ativo={isActive} size={28} />
            </span>
            <span className="text-[11px] leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
