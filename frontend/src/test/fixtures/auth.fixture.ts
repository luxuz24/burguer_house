import type { UsuarioAuth } from '../../context/AuthContext';

export const mockUsuarioAdmin: UsuarioAuth = {
  id: 'u-admin-1',
  nome: 'Carlos Eduardo',
  email: 'gerente@burguerhouse.com.br',
  telefone: '(67) 99876-5432',
  role: 'ADMIN',
  ativo: true,
};

export const mockUsuarioGerente: UsuarioAuth = {
  id: 'u-gerente-1',
  nome: 'Ana Paula Gerente',
  email: 'ana@burguerhouse.com.br',
  telefone: '(67) 99876-1234',
  role: 'GERENTE',
  ativo: true,
};

export const mockUsuarioOperador: UsuarioAuth = {
  id: 'u-operador-1',
  nome: 'Marcos Operador',
  email: 'operador@burguerhouse.com.br',
  telefone: null,
  role: 'OPERADOR',
  ativo: true,
};

export const mockTokenAuth = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-jwt-token';

export const mockRespostaLogin = {
  token: mockTokenAuth,
  usuario: mockUsuarioAdmin,
};

export const mockRespostaAuthMe = {
  usuario: mockUsuarioAdmin,
};

export const mockErroLoginInvalido = {
  message: 'E-mail ou senha incorretos',
};

export const mockErroSessaoRevogada = {
  message: 'Token revogado. Faça login novamente.',
};
