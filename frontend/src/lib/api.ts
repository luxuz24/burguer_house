import axios from 'axios';
import { lerArmazenado } from './armazenamento';

// VITE_API_URL = origem da API (ex.: https://burguer-house.koyeb.app). Sem ela, usa '/api' no mesmo host,
// que em desenvolvimento o proxy do Vite (vite.config.ts) encaminha para o backend.
const origemApi = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: `${origemApi}/api`,
});

export const EVENTO_SESSAO_EXPIRADA = 'burger_stock:sessao-expirada';

const CHAVE_TOKEN = 'burger_stock_token';

api.interceptors.request.use((config) => {
  const token = lerArmazenado(CHAVE_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function tokenDaRequisicao(config: unknown): string | null {
  const headers = (config as { headers?: Record<string, unknown> } | undefined)?.headers;
  const valor = headers?.Authorization ?? headers?.authorization;
  return typeof valor === 'string' && valor.startsWith('Bearer ') ? valor.slice('Bearer '.length) : null;
}

// Token expirado/inválido: avisa o AuthContext para encerrar a sessão.
// O próprio /auth/login é ignorado (401 ali significa senha errada, não sessão expirada).
// Só encerra se a requisição usou o token da sessão ATUAL: uma resposta atrasada feita com o token
// anterior (revogado pela troca de senha) ou depois do logout não pode derrubar a sessão nova.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    if (status === 401 && !url.includes('/auth/login')) {
      const tokenAtual = lerArmazenado(CHAVE_TOKEN);
      if (tokenAtual && tokenDaRequisicao(error?.config) === tokenAtual) {
        window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
      }
    }
    return Promise.reject(error);
  }
);

const ROTULOS_CAMPOS: Record<string, string> = {
  nome: 'Nome',
  unidade: 'Unidade',
  fatorPerda: 'Fator de perda',
  estoqueAtual: 'Estoque atual',
  estoqueMinimo: 'Estoque mínimo',
  custoUnitario: 'Custo unitário',
  produzidoInternamente: 'Produzido internamente',
  validadeDias: 'Validade em dias',
  quantidade: 'Quantidade',
  motivo: 'Motivo',
  produtoId: 'Produto',
  insumoId: 'Insumo',
  email: 'E-mail',
  senha: 'Senha',
  senhaAtual: 'Senha atual',
  novaSenha: 'Nova senha',
  telefone: 'Telefone',
  dataInicio: 'Data de início',
  dataFim: 'Data de fim',
  periodo: 'Período',
  chaveAcesso: 'Chave de acesso',
  numero: 'Número',
  serie: 'Série',
  xml: 'XML',
  urlOuChave: 'URL ou chave',
};

function formatarNomeCampo(campo: string): string {
  if (!campo) return '';
  if (ROTULOS_CAMPOS[campo]) {
    return ROTULOS_CAMPOS[campo];
  }
  const formatado = campo
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .toLowerCase();
  return formatado.charAt(0).toUpperCase() + formatado.slice(1);
}

/** Extrai a mensagem de erro enviada pelo backend ({ message, issues }) ou usa o fallback. */
export function mensagemDeErro(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Sem conexão com o servidor. Verifique se o backend está rodando.';
    }
    const data = error.response.data as
      | { message?: unknown; issues?: Array<{ message?: unknown; path?: unknown[] }> }
      | undefined;

    // Achado A3: Se o Zod retornou issues de validação (status 400), a primeira issue contém o detalhe específico
    const primeiraIssue = data?.issues?.[0];
    const mensagemIssue =
      typeof primeiraIssue?.message === 'string' ? primeiraIssue.message.trim() : '';

    if (mensagemIssue) {
      const path = primeiraIssue?.path;
      const campoBruto =
        Array.isArray(path) && path.length > 0 ? String(path[path.length - 1]) : '';
      const nomeCampo = formatarNomeCampo(campoBruto);

      // Prefixar com o nome do campo quando a mensagem não o contiver explicitamente
      if (nomeCampo && !mensagemIssue.toLowerCase().includes(nomeCampo.toLowerCase())) {
        return `${nomeCampo}: ${mensagemIssue}`;
      }
      return mensagemIssue;
    }

    const msg = data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}
