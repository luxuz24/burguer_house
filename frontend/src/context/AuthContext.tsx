import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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

const CHAVE_TOKEN = 'burger_stock_token';
const CHAVE_USUARIO = 'burger_stock_usuario';

// Cópia local do último usuário válido: mantém o app usável quando a API está fora do ar ao abrir.
function lerUsuarioSalvo(): UsuarioAuth | null {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    return bruto ? (JSON.parse(bruto) as UsuarioAuth) : null;
  } catch {
    return null;
  }
}

function salvarUsuario(usuario: UsuarioAuth) {
  try {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  } catch {
    // armazenamento indisponível: segue sem cache
  }
}

export function AuthProvider({
  children,
  verificarSessao = true,
}: {
  children: React.ReactNode;
  verificarSessao?: boolean;
}) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(CHAVE_TOKEN);
  });

  const [usuario, setUsuario] = useState<UsuarioAuth | null>(() => {
    return localStorage.getItem(CHAVE_TOKEN) ? lerUsuarioSalvo() : null;
  });
  const [carregando, setCarregando] = useState(() => {
    return verificarSessao && !!localStorage.getItem(CHAVE_TOKEN) && !lerUsuarioSalvo();
  });

  const encerrarSessaoLocal = useCallback(() => {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    setToken(null);
    setUsuario(null);
  }, []);

  const logout = useCallback(() => {
    const tokenAtual = localStorage.getItem(CHAVE_TOKEN);
    if (tokenAtual) {
      api
        .post('/auth/logout', null, {
          headers: { Authorization: `Bearer ${tokenAtual}` },
        })
        .catch(() => {});
    }
    encerrarSessaoLocal();
  }, [encerrarSessaoLocal]);

  useEffect(() => {
    if (!verificarSessao) {
      return;
    }

    const tokenSalvo = localStorage.getItem(CHAVE_TOKEN);
    if (!tokenSalvo) {
      return;
    }

    let ativo = true;

    api
      .get<{ usuario: UsuarioAuth }>('/auth/me')
      .then((res) => {
        // Se a sessão foi encerrada enquanto /auth/me estava em trânsito, ignora a resposta
        if (!ativo || !localStorage.getItem(CHAVE_TOKEN)) {
          return;
        }
        const novoUsuario = res.data.usuario;
        salvarUsuario(novoUsuario);
        setUsuario((atual) => {
          if (
            atual &&
            atual.id === novoUsuario.id &&
            atual.nome === novoUsuario.nome &&
            atual.email === novoUsuario.email &&
            atual.role === novoUsuario.role &&
            atual.ativo === novoUsuario.ativo &&
            atual.telefone === novoUsuario.telefone
          ) {
            return atual;
          }
          return novoUsuario;
        });
      })
      .catch((erro: unknown) => {
        if (!ativo || !localStorage.getItem(CHAVE_TOKEN)) {
          return;
        }
        const status = axios.isAxiosError(erro) ? erro.response?.status : undefined;
        if (status === 401 || status === 403) {
          // Token inválido/expirado ou usuário desativado: encerra a sessão localmente sem chamar backend de novo.
          encerrarSessaoLocal();
          return;
        }
        // Rede fora do ar, timeout ou erro 5xx (ex.: servidor acordando): mantém o token e usa o último usuário salvo.
        setUsuario(lerUsuarioSalvo());
      })
      .finally(() => {
        if (ativo) {
          setCarregando((atual) => (atual ? false : atual));
        }
      });

    return () => {
      ativo = false;
    };
  }, [encerrarSessaoLocal, verificarSessao]);

  // Qualquer resposta 401 da API (token expirado/inválido) encerra a sessão local e volta ao login.
  useEffect(() => {
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, encerrarSessaoLocal);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, encerrarSessaoLocal);
  }, [encerrarSessaoLocal]);

  const login = async (email: string, senha: string) => {
    const res = await api.post<{ token: string; usuario: UsuarioAuth }>('/auth/login', {
      email,
      senha,
    });

    localStorage.setItem(CHAVE_TOKEN, res.data.token);
    salvarUsuario(res.data.usuario);
    setToken(res.data.token);
    setUsuario(res.data.usuario);
  };

  const atualizarPerfil = async (dados: { nome?: string; telefone?: string | null }) => {
    const res = await api.put<{ usuario: UsuarioAuth }>('/auth/perfil', dados);
    salvarUsuario(res.data.usuario);
    setUsuario(res.data.usuario);
  };

  const atualizarSenha = async (senhaAtual: string, novaSenha: string) => {
    const res = await api.put<{ message: string; token: string }>('/auth/senha', { senhaAtual, novaSenha });
    if (res.data?.token) {
      localStorage.setItem(CHAVE_TOKEN, res.data.token);
      setToken(res.data.token);
    }
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
