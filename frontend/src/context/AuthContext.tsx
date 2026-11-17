import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { api, EVENTO_SESSAO_EXPIRADA } from '../lib/api';
import { gravarArmazenado, lerArmazenado, removerArmazenado } from '../lib/armazenamento';

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
  atualizarUsuario: (usuario: UsuarioAuth) => void;
  atualizarPerfil: (dados: { nome?: string; telefone?: string | null }) => Promise<void>;
  atualizarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CHAVE_TOKEN = 'burger_stock_token';
const CHAVE_USUARIO = 'burger_stock_usuario';

function pareceUsuario(valor: unknown): valor is UsuarioAuth {
  if (typeof valor !== 'object' || valor === null) return false;
  const { id, nome, email } = valor as Record<string, unknown>;
  return typeof id === 'string' && id !== '' && typeof nome === 'string' && typeof email === 'string';
}

// Cópia local do último usuário válido: mantém o app usável quando a API está fora do ar ao abrir.
// Conteúdo com outro formato (versão antiga, edição manual) é descartado em vez de virar "usuário".
function lerUsuarioSalvo(): UsuarioAuth | null {
  const bruto = lerArmazenado(CHAVE_USUARIO);
  if (!bruto) return null;
  try {
    const valor: unknown = JSON.parse(bruto);
    return pareceUsuario(valor) ? valor : null;
  } catch {
    return null;
  }
}

function salvarUsuario(usuario: UsuarioAuth) {
  gravarArmazenado(CHAVE_USUARIO, JSON.stringify(usuario));
}

export function AuthProvider({
  children,
  verificarSessao = true,
}: {
  children: React.ReactNode;
  verificarSessao?: boolean;
}) {
  const [token, setToken] = useState<string | null>(() => {
    return lerArmazenado(CHAVE_TOKEN);
  });

  const [usuario, setUsuario] = useState<UsuarioAuth | null>(() => {
    return lerArmazenado(CHAVE_TOKEN) ? lerUsuarioSalvo() : null;
  });
  const [carregando, setCarregando] = useState(() => {
    return verificarSessao && !!lerArmazenado(CHAVE_TOKEN) && !lerUsuarioSalvo();
  });

  const encerrarSessaoLocal = useCallback(() => {
    removerArmazenado(CHAVE_TOKEN);
    removerArmazenado(CHAVE_USUARIO);
    setToken(null);
    setUsuario(null);
  }, []);

  const logout = useCallback(() => {
    const tokenAtual = lerArmazenado(CHAVE_TOKEN);
    if (tokenAtual) {
      api
        // Corpo `{}` e não `null`: sem corpo o axios manda application/x-www-form-urlencoded e o Fastify responde 415
        .post('/auth/logout', {}, {
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

    const tokenSalvo = lerArmazenado(CHAVE_TOKEN);
    if (!tokenSalvo) {
      return;
    }

    let ativo = true;
    // A resposta só vale para a sessão que fez a pergunta: logout, novo login ou troca de senha
    // (que grava um token novo) no meio do caminho tornam a resposta obsoleta.
    const mesmaSessao = () => ativo && lerArmazenado(CHAVE_TOKEN) === tokenSalvo;

    api
      .get<{ usuario: UsuarioAuth }>('/auth/me')
      .then((res) => {
        if (!mesmaSessao()) {
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
        if (!mesmaSessao()) {
          return;
        }
        const status = axios.isAxiosError(erro) ? erro.response?.status : undefined;
        if (status === 401 || status === 403 || status === 404) {
          // Token inválido/expirado, usuário desativado ou removido (404 no contrato de /auth/me):
          // encerra a sessão localmente sem chamar backend de novo.
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

  const atualizarUsuario = useCallback((novoUsuario: UsuarioAuth) => {
    salvarUsuario(novoUsuario);
    setUsuario(novoUsuario);
  }, []);

  const login = useCallback(
    async (email: string, senha: string) => {
      const res = await api.post<{ token: string; usuario: UsuarioAuth }>('/auth/login', {
        email,
        senha,
      });

      gravarArmazenado(CHAVE_TOKEN, res.data.token);
      setToken(res.data.token);
      atualizarUsuario(res.data.usuario);
    },
    [atualizarUsuario],
  );

  const atualizarPerfil = useCallback(
    async (dados: { nome?: string; telefone?: string | null }) => {
      const res = await api.put<{ usuario: UsuarioAuth }>('/auth/perfil', dados);
      atualizarUsuario(res.data.usuario);
    },
    [atualizarUsuario],
  );

  const atualizarSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const tokenDaTroca = lerArmazenado(CHAVE_TOKEN);
    const res = await api.put<{ message: string; token: string }>('/auth/senha', { senhaAtual, novaSenha });
    // Logout (ou outro login) enquanto a troca estava em voo: não ressuscita a sessão encerrada
    if (!tokenDaTroca || lerArmazenado(CHAVE_TOKEN) !== tokenDaTroca) {
      return;
    }
    if (res.data?.token) {
      gravarArmazenado(CHAVE_TOKEN, res.data.token);
      setToken(res.data.token);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      usuario,
      carregando,
      autenticado: !!token && !!usuario,
      login,
      logout,
      atualizarUsuario,
      atualizarPerfil,
      atualizarSenha,
    }),
    [token, usuario, carregando, login, logout, atualizarUsuario, atualizarPerfil, atualizarSenha],
  );

  return (
    <AuthContext.Provider value={value}>
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthOpcional(): AuthContextType | null {
  return useContext(AuthContext) ?? null;
}
