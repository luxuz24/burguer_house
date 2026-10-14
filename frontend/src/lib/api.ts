import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

export const EVENTO_SESSAO_EXPIRADA = 'burger_stock:sessao-expirada';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('burger_stock_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token expirado/inválido: avisa o AuthContext para encerrar a sessão.
// O próprio /auth/login é ignorado (401 ali significa senha errada, não sessão expirada).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    if (status === 401 && !url.includes('/auth/login')) {
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
    return Promise.reject(error);
  }
);

/** Extrai a mensagem de erro enviada pelo backend ({ message }) ou usa o fallback. */
export function mensagemDeErro(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Sem conexão com o servidor. Verifique se o backend está rodando.';
    }
    const msg = (error.response.data as { message?: unknown } | undefined)?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}
