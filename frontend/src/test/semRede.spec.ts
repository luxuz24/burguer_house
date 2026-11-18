import { describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { api } from '../lib/api';

/**
 * Nos testes o `api` nunca fala com um servidor de verdade. Sem essa trava, uma requisição que escapa
 * do mock (ex.: efeito disparado pelo cleanup depois que o teste devolveu o adapter original) ia para
 * http://localhost:3000, a origem do jsdom; com o backend de dev no ar ele respondia 401 no meio do
 * teste seguinte e derrubava a sessão dele (App.spec: "Importar Nota Fiscal pelo botão do Início").
 */
describe('setup dos testes - api sem rede', () => {
  it('requisição sem mock falha como "sem conexão" e não abre XHR', async () => {
    const abrir = vi.spyOn(XMLHttpRequest.prototype, 'open');

    const erro = await api.get('/dashboard/resumo').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(AxiosError);
    expect((erro as AxiosError).code).toBe(AxiosError.ERR_NETWORK);
    expect((erro as AxiosError).response).toBeUndefined();
    expect(abrir).not.toHaveBeenCalled();
  });
});
