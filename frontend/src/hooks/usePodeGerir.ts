import { useAuthOpcional } from '../context/AuthContext';

/**
 * Ponto único da regra de permissão de escrita no frontend.
 *
 * Decisão do dono (18/11/2026): por enquanto só o ADMIN gere o sistema; GERENTE e OPERADOR só leem.
 * O backend devolve 403 em todo POST/PUT/PATCH/DELETE (fora de /auth/*) para quem não é ADMIN;
 * aqui as ações correspondentes ficam escondidas. Sem sessão ou fora do AuthProvider: false.
 * Para mudar quem pode gerir, mude só esta função.
 */
export function usePodeGerir(): boolean {
  return useAuthOpcional()?.usuario?.role === 'ADMIN';
}
