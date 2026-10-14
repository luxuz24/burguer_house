import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, EVENTO_SESSAO_EXPIRADA } from '../lib/api';

export interface UsuarioAuth {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: 'ADMIN' | 'GERENTE' | 'OPERADOR';
  ativo: boolean;
}

interface AuthContextType {
  token: string | null;
  usuario: UsuarioAuth | null;
  carregando: boolean;
  autenticado: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  atualizarPerfil: (dados: { nome?: string; telefone?: string | null }) => Promise<void>;
  atualizarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('burger_stock_token');
  });

  const [usuario, setUsuario] = useState<UsuarioAuth | null>(null);
  const [carregando, setCarregando] = useState(() => {
    return !!localStorage.getItem('burger_stock_token');
  });

  const logout = useCallback(() => {
    localStorage.removeItem('burger_stock_token');
    setToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    const tokenSalvo = localStorage.getItem('burger_stock_token');
    if (!tokenSalvo) {
      return;
    }

    api
      .get<{ usuario: UsuarioAuth }>('/auth/me')
      .then((res) => {
        setUsuario(res.data.usuario);
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [logout]);

  // Qualquer resposta 401 da API (token expirado/inválido) encerra a sessão e volta ao login.
  useEffect(() => {
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, logout);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, logout);
  }, [logout]);

  const login = async (email: string, senha: string) => {
    const res = await api.post<{ token: string; usuario: UsuarioAuth }>('/auth/login', {
      email,
      senha,
    });

    localStorage.setItem('burger_stock_token', res.data.token);
    setToken(res.data.token);
    setUsuario(res.data.usuario);
  };

  const atualizarPerfil = async (dados: { nome?: string; telefone?: string | null }) => {
    const res = await api.put<{ usuario: UsuarioAuth }>('/auth/perfil', dados);
    setUsuario(res.data.usuario);
  };

  const atualizarSenha = async (senhaAtual: string, novaSenha: string) => {
    await api.put('/auth/senha', { senhaAtual, novaSenha });
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        usuario,
        carregando,
        autenticado: !!token && !!usuario,
        login,
        logout,
        atualizarPerfil,
        atualizarSenha,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
