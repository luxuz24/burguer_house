import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { api, EVENTO_SESSAO_EXPIRADA } from './api';

const CHAVE_TOKEN = 'burger_stock_token';

function bloquearStorage() {
  const erro = () => {
    throw new DOMException('O acesso ao armazenamento foi negado', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(erro);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(erro);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(erro);
}

/** Adapter que responde com `status` e devolve a config recebida (já passada pelos interceptors). */
function adapterCom(status: number): { adapter: AxiosAdapter; recebidas: InternalAxiosRequestConfig[] } {
  const recebidas: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    recebidas.push(config);
    const resposta = { data: { message: `status ${status}` }, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status ${status}`, String(status), config, undefined, resposta);
    }
    return resposta;
  };
  return { adapter, recebidas };
}

describe('lib/api - interceptors', () => {
  const adapterOriginal = api.defaults.adapter;
  let eventos: number;
  const ouvir = () => {
    eventos += 1;
  };

  beforeEach(() => {
    eventos = 0;
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvir);
  });

  afterEach(() => {
    api.defaults.adapter = adapterOriginal;
    window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvir);
  });

  it('envia o token salvo no header Authorization', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    const { adapter, recebidas } = adapterCom(200);
    api.defaults.adapter = adapter;

    await api.get('/insumos');

    expect(AxiosHeaders.from(recebidas[0].headers).get('Authorization')).toBe('Bearer tok-1');
  });

  it('sem token salvo, não envia Authorization', async () => {
    const { adapter, recebidas } = adapterCom(200);
    api.defaults.adapter = adapter;

    await api.get('/insumos');

    expect(AxiosHeaders.from(recebidas[0].headers).has('Authorization')).toBe(false);
  });

  it('com o armazenamento bloqueado (aba anônima), a requisição sai em vez de lançar SecurityError', async () => {
    bloquearStorage();
    const { adapter, recebidas } = adapterCom(200);
    api.defaults.adapter = adapter;

    await expect(api.get('/health')).resolves.toMatchObject({ status: 200 });
    expect(recebidas).toHaveLength(1);
  });

  it('401 com o token atual avisa que a sessão expirou', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    api.defaults.adapter = adapterCom(401).adapter;

    await expect(api.get('/insumos')).rejects.toBeInstanceOf(AxiosError);
    expect(eventos).toBe(1);
  });

  it('401 em /auth/login (senha errada) não é sessão expirada', async () => {
    api.defaults.adapter = adapterCom(401).adapter;

    await expect(api.post('/auth/login', { email: 'a@b.c', senha: 'x' })).rejects.toBeInstanceOf(AxiosError);
    expect(eventos).toBe(0);
  });

  it.each([400, 403, 404, 500])('status %i não encerra a sessão', async (status) => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    api.defaults.adapter = adapterCom(status).adapter;

    await expect(api.get('/insumos')).rejects.toBeInstanceOf(AxiosError);
    expect(eventos).toBe(0);
  });

  it('erro sem resposta (rede) não encerra a sessão', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };

    await expect(api.get('/insumos')).rejects.toBeInstanceOf(AxiosError);
    expect(eventos).toBe(0);
  });

  it('401 de uma requisição feita com o token ANTIGO (troca de senha no meio) não derruba a sessão nova', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-antigo');
    let liberar!: () => void;
    const segurar = new Promise<void>((r) => {
      liberar = r;
    });
    let chegou!: () => void;
    const noAdapter = new Promise<void>((r) => {
      chegou = r;
    });
    api.defaults.adapter = async (config) => {
      chegou();
      await segurar;
      const resposta = { data: { message: 'Token revogado. Faça login novamente.' }, status: 401, statusText: '401', headers: {}, config };
      throw new AxiosError('Request failed with status 401', '401', config, undefined, resposta);
    };

    const emVoo = api.get('/insumos');
    await noAdapter; // a requisição já saiu com o token antigo
    // Enquanto a requisição está em voo, a troca de senha grava o token novo
    localStorage.setItem(CHAVE_TOKEN, 'tok-novo');
    liberar();

    await expect(emVoo).rejects.toBeInstanceOf(AxiosError);
    expect(eventos).toBe(0);
  });

  it('401 depois do logout (sem token salvo) não dispara de novo', async () => {
    localStorage.setItem(CHAVE_TOKEN, 'tok-1');
    let liberar!: () => void;
    const segurar = new Promise<void>((r) => {
      liberar = r;
    });
    let chegou!: () => void;
    const noAdapter = new Promise<void>((r) => {
      chegou = r;
    });
    api.defaults.adapter = async (config) => {
      chegou();
      await segurar;
      const resposta = { data: {}, status: 401, statusText: '401', headers: {}, config };
      throw new AxiosError('Request failed with status 401', '401', config, undefined, resposta);
    };

    const emVoo = api.get('/insumos');
    await noAdapter;
    localStorage.removeItem(CHAVE_TOKEN);
    liberar();

    await expect(emVoo).rejects.toBeInstanceOf(AxiosError);
    expect(eventos).toBe(0);
  });
});
