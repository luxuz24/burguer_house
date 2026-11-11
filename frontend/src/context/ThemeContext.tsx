import React, { createContext, useContext, useState, useEffect } from 'react';
import { gravarArmazenado, lerArmazenado } from '../lib/armazenamento';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const CHAVE_TEMA = 'burger_stock_theme';
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

// Webviews antigos não têm matchMedia: sem a API, "system" vale como claro
function consultaSistema(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_ESCURO) : null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const salvo = lerArmazenado(CHAVE_TEMA);
    if (salvo === 'light' || salvo === 'dark' || salvo === 'system') {
      return salvo;
    }
    return 'system';
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const aplicarTema = () => {
      const dark =
        theme === 'dark'
          ? true
          : theme === 'light'
            ? false
            : (consultaSistema()?.matches ?? false);

      setIsDark(dark);
      if (dark) {
        document.documentElement.classList.add('dark');
        document.body.style.backgroundColor = '#030712'; // gray-950
      } else {
        document.documentElement.classList.remove('dark');
        document.body.style.backgroundColor = '#f3f4f6'; // gray-100
      }
    };

    aplicarTema();
    gravarArmazenado(CHAVE_TEMA, theme);

    const mediaQuery = theme === 'system' ? consultaSistema() : null;
    if (mediaQuery) {
      const listener = () => aplicarTema();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const setTheme = (novoTema: Theme) => {
    setThemeState(novoTema);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
}
