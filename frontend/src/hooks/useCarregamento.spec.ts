import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCarregamento } from './useCarregamento';
import { criarErroAxios } from '../test/render';

describe('hooks/useCarregamento - Carga Inicial e Sincronização em Segundo Plano', () => {
  // 1. carga inicial ok → dados preenchido, carregandoInicial vai a false
  it('carga inicial ok → dados preenchido, carregandoInicial vai a false', async () => {
    const buscar = vi.fn().mockResolvedValue({ id: 'prod-1', nome: 'Smash Duplo' });

    const { result } = renderHook(() => useCarregamento(buscar, []));

    expect(result.current.carregandoInicial).toBe(true);
    expect(result.current.dados).toBeNull();
    expect(result.current.erro).toBeNull();

    await waitFor(() => {
      expect(result.current.carregandoInicial).toBe(false);
    });

    expect(result.current.dados).toEqual({ id: 'prod-1', nome: 'Smash Duplo' });
    expect(result.current.erro).toBeNull();
    expect(result.current.erroRecarga).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  // 2. 404 → erro.tipo === 'nao_encontrado'; 503 → 'erro' com a mensagem do backend
  it('404 → erro.tipo === "nao_encontrado"; 503 → "erro" com a mensagem do backend', async () => {
    // Caso 404 (recurso inexistente ou deletado)
    const buscar404 = vi.fn().mockRejectedValue(
      criarErroAxios(404, { message: 'Produto não encontrado' }),
    );

    const { result: r404 } = renderHook(() =>
      useCarregamento(buscar404, [], { mensagemPadrao: 'Falha produto' }),
    );

    await waitFor(() => {
      expect(r404.current.carregandoInicial).toBe(false);
    });

    expect(r404.current.dados).toBeNull();
    expect(r404.current.erro).toEqual({
      tipo: 'nao_encontrado',
      mensagem: 'Produto não encontrado',
    });

    // Caso 503 (erro de servidor)
    const buscar503 = vi.fn().mockRejectedValue(
      criarErroAxios(503, { message: 'Banco indisponível' }),
    );

    const { result: r503 } = renderHook(() =>
      useCarregamento(buscar503, [], { mensagemPadrao: 'Falha padrão' }),
    );

    await waitFor(() => {
      expect(r503.current.carregandoInicial).toBe(false);
    });

    expect(r503.current.dados).toBeNull();
    expect(r503.current.erro).toEqual({
      tipo: 'erro',
      mensagem: 'Banco indisponível',
    });
  });

  // 3. recarregar com falha mantém os dados antigos, preenche erroRecarga e devolve false
  it('recarregar com falha mantém os dados antigos, preenche erroRecarga e devolve false', async () => {
    const dadosIniciais = { id: 'prod-1', nome: 'Burger Original' };
    const buscar = vi.fn().mockResolvedValueOnce(dadosIniciais);

    const { result } = renderHook(() => useCarregamento(buscar, []));

    await waitFor(() => {
      expect(result.current.dados).toEqual(dadosIniciais);
      expect(result.current.carregandoInicial).toBe(false);
    });

    // Simula erro 500 durante recarga em segundo plano
    buscar.mockRejectedValueOnce(
      criarErroAxios(500, { message: 'Erro interno ao sincronizar' }),
    );

    let sucessoRecarga = true;
    await act(async () => {
      sucessoRecarga = await result.current.recarregar();
    });

    expect(sucessoRecarga).toBe(false);
    // Dados antigos continuam preservados (não vira null)
    expect(result.current.dados).toEqual(dadosIniciais);
    expect(result.current.carregandoInicial).toBe(false);
    expect(result.current.erroRecarga).toBe('Erro interno ao sincronizar');
    expect(result.current.erro).toBeNull();

    // Se o recurso sumiu (404) durante uma recarga, preenche erro com nao_encontrado
    buscar.mockRejectedValueOnce(
      criarErroAxios(404, { message: 'Produto excluído por outro operador' }),
    );

    await act(async () => {
      sucessoRecarga = await result.current.recarregar();
    });

    expect(sucessoRecarga).toBe(false);
    expect(result.current.erro).toEqual({
      tipo: 'nao_encontrado',
      mensagem: 'Produto excluído por outro operador',
    });
    expect(result.current.erroRecarga).toBeNull();
  });

  // 4. troca de deps durante a requisição: a resposta antiga não sobrescreve a nova
  it('troca de deps durante a requisição: a resposta antiga não sobrescreve a nova', async () => {
    let resolverReq1!: (val: { id: string; nome: string }) => void;
    let resolverReq2!: (val: { id: string; nome: string }) => void;

    const promessaReq1 = new Promise<{ id: string; nome: string }>((res) => {
      resolverReq1 = res;
    });
    const promessaReq2 = new Promise<{ id: string; nome: string }>((res) => {
      resolverReq2 = res;
    });

    const buscar = vi.fn((id: string) => {
      if (id === 'prod-1') return promessaReq1;
      return promessaReq2;
    });

    let depId = 'prod-1';
    const { result, rerender } = renderHook(() => useCarregamento(() => buscar(depId), [depId]));

    expect(buscar).toHaveBeenCalledTimes(1);

    // Troca de deps antes da req1 responder: dispara req2
    depId = 'prod-2';
    rerender();
    expect(buscar).toHaveBeenCalledTimes(2);

    // Responde a req2 (mais recente) primeiro
    await act(async () => {
      resolverReq2({ id: 'prod-2', nome: 'Produto Mais Novo' });
    });

    await waitFor(() => {
      expect(result.current.dados).toEqual({ id: 'prod-2', nome: 'Produto Mais Novo' });
    });

    // Agora responde a req1 (mais antiga / obsoleta)
    await act(async () => {
      resolverReq1({ id: 'prod-1', nome: 'Produto Obsoleto' });
    });

    // A resposta antiga NÃO deve ter sobrescrito a nova
    expect(result.current.dados).toEqual({ id: 'prod-2', nome: 'Produto Mais Novo' });
  });

  // 4b. ao trocar de deps, reinicia imediatamente com dados === null e carregandoInicial === true enquanto a nova busca está pendente
  it('ao trocar de deps, reinicia imediatamente com dados === null e carregandoInicial === true enquanto a nova busca está pendente', async () => {
    let resolverReq2!: (val: { id: string; nome: string }) => void;
    const promessaReq2 = new Promise<{ id: string; nome: string }>((res) => {
      resolverReq2 = res;
    });

    const buscar = vi.fn((id: string) => {
      if (id === 'prod-1') return Promise.resolve({ id: 'prod-1', nome: 'Produto 1' });
      return promessaReq2;
    });

    let depId = 'prod-1';
    const { result, rerender } = renderHook(() => useCarregamento(() => buscar(depId), [depId]));

    // Aguarda primeira carga concluir com sucesso
    await waitFor(() => {
      expect(result.current.carregandoInicial).toBe(false);
      expect(result.current.dados).toEqual({ id: 'prod-1', nome: 'Produto 1' });
    });

    // Troca a dependência
    depId = 'prod-2';
    rerender();

    // Enquanto a busca de prod-2 está pendente:
    // os dados anteriores NÃO continuam na tela e carregandoInicial é resetado para true
    expect(result.current.dados).toBeNull();
    expect(result.current.carregandoInicial).toBe(true);

    // Quando a nova requisição resolve
    await act(async () => {
      resolverReq2({ id: 'prod-2', nome: 'Produto 2' });
    });

    await waitFor(() => {
      expect(result.current.carregandoInicial).toBe(false);
      expect(result.current.dados).toEqual({ id: 'prod-2', nome: 'Produto 2' });
    });
  });

  // 5. tentarNovamente refaz a chamada e limpa o erro
  it('tentarNovamente refaz a chamada e limpa o erro', async () => {
    const buscar = vi
      .fn()
      .mockRejectedValueOnce(criarErroAxios(503, { message: 'Timeout temporário' }))
      .mockResolvedValueOnce({ id: 'prod-1', nome: 'Produto Recuperado' });

    const { result } = renderHook(() => useCarregamento(buscar, []));

    await waitFor(() => {
      expect(result.current.carregandoInicial).toBe(false);
      expect(result.current.erro?.tipo).toBe('erro');
    });

    // Aciona tentarNovamente
    act(() => {
      result.current.tentarNovamente();
    });

    expect(result.current.carregandoInicial).toBe(true);
    expect(result.current.erro).toBeNull();

    await waitFor(() => {
      expect(result.current.carregandoInicial).toBe(false);
    });

    expect(result.current.dados).toEqual({ id: 'prod-1', nome: 'Produto Recuperado' });
    expect(result.current.erro).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  // 6. desmontar com requisição pendente não lança erro
  it('desmontar com requisição pendente não lança erro', async () => {
    let resolver!: () => void;
    const promessaPendente = new Promise<{ id: string }>((res) => {
      resolver = () => res({ id: '1' });
    });

    const buscar = vi.fn(() => promessaPendente);
    const { unmount } = renderHook(() => useCarregamento(buscar, []));

    // Desmonta enquanto a requisição está em trânsito
    expect(() => unmount()).not.toThrow();

    // Quando resolver, não lança exceção não tratada
    await act(async () => {
      resolver();
    });
  });

  // 7. com habilitado=false não há chamada
  it('com habilitado=false não há chamada', async () => {
    const buscar = vi.fn().mockResolvedValue({ id: 'prod-1' });

    const { result } = renderHook(() =>
      useCarregamento(buscar, [], { habilitado: false }),
    );

    expect(result.current.carregandoInicial).toBe(false);
    expect(result.current.dados).toBeNull();
    expect(result.current.erro).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });

  // 8. uma resposta que chega depois de desabilitar é descartada
  it('uma resposta que chega depois de desabilitar é descartada', async () => {
    let resolverReq!: (val: { id: string; nome: string }) => void;
    const promessaPendente = new Promise<{ id: string; nome: string }>((res) => {
      resolverReq = res;
    });

    const buscar = vi.fn(() => promessaPendente);

    let habilitado = true;
    const { result, rerender } = renderHook(() =>
      useCarregamento(buscar, [], { habilitado }),
    );

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(result.current.carregandoInicial).toBe(true);

    // Desabilita enquanto a requisição ainda está pendente
    habilitado = false;
    rerender();

    expect(result.current.carregandoInicial).toBe(false);

    // A resposta tardia chega
    await act(async () => {
      resolverReq({ id: 'prod-1', nome: 'Smash Duplo' });
    });

    // Como foi desabilitado antes de responder, os dados permanecem nulos
    expect(result.current.dados).toBeNull();
  });

  // 9. reabilitar com dados faz recarga sem ligar carregandoInicial
  it('reabilitar com dados faz recarga sem ligar carregandoInicial', async () => {
    const dadosIniciais = { id: 'prod-1', nome: 'Smash Duplo' };
    const dadosAtualizados = { id: 'prod-1', nome: 'Smash Duplo Especial' };

    let resolverRecarga!: (val: typeof dadosAtualizados) => void;
    const promessaRecarga = new Promise<typeof dadosAtualizados>((res) => {
      resolverRecarga = res;
    });

    const buscar = vi
      .fn()
      .mockResolvedValueOnce(dadosIniciais)
      .mockReturnValueOnce(promessaRecarga);

    let habilitado = true;
    const { result, rerender } = renderHook(() =>
      useCarregamento(buscar, [], { habilitado }),
    );

    // Aguarda a carga inicial concluir com sucesso
    await waitFor(() => {
      expect(result.current.carregandoInicial).toBe(false);
      expect(result.current.dados).toEqual(dadosIniciais);
    });
    expect(buscar).toHaveBeenCalledTimes(1);

    // Desabilita o hook (ex.: usuário trocou para outra aba)
    habilitado = false;
    rerender();

    expect(result.current.carregandoInicial).toBe(false);
    expect(result.current.dados).toEqual(dadosIniciais);

    // Reabilita o hook (ex.: usuário voltou para a aba)
    habilitado = true;
    rerender();

    // Como já havia dados, carregandoInicial PERMANECE false (não pisca tela)
    expect(result.current.carregandoInicial).toBe(false);
    expect(result.current.dados).toEqual(dadosIniciais);
    expect(buscar).toHaveBeenCalledTimes(2);

    // Conclui a recarga em segundo plano
    await act(async () => {
      resolverRecarga(dadosAtualizados);
    });

    await waitFor(() => {
      expect(result.current.dados).toEqual(dadosAtualizados);
    });
    expect(result.current.carregandoInicial).toBe(false);
  });
});
