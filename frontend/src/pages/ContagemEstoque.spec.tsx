import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ContagemEstoque from './ContagemEstoque';
import { api } from '../lib/api';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

const insumosMock = [
  {
    id: 'ins-pao',
    nome: 'Pão Brioche',
    unidade: 'Unidade',
    categoria: 'INGREDIENTE',
    estoqueAtual: 10,
    estoqueMinimo: 20,
    custoUnitario: 2.11,
  },
  {
    id: 'ins-carne',
    nome: 'Carne de Hambúrguer',
    unidade: 'Gramas',
    categoria: 'INGREDIENTE',
    estoqueAtual: 5000,
    estoqueMinimo: 1000,
    custoUnitario: 0.0319,
  },
  {
    id: 'ins-coca',
    nome: 'Coca Cola Zero 350ml',
    unidade: 'Unidade',
    categoria: 'BEBIDA',
    estoqueAtual: 12,
    estoqueMinimo: 6,
    custoUnitario: 3.05,
  },
];

describe('pages/ContagemEstoque (tarefa 21)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('C1: preencher 2 de 3 insumos (incluindo kg → g) e confirmar envia POST /estoque/ajustes só com os 2, motivo e chaveIdempotencia', async () => {
    const payloadsEnviados: Array<Record<string, unknown>> = [];

    renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: {
        get: { '/insumos': insumosMock },
        post: {
          '/estoque/ajustes': (_url: string, body: unknown) => {
            const payload = body as Record<string, unknown>;
            payloadsEnviados.push(payload);
            return {
              reaproveitado: false,
              chaveIdempotencia: payload.chaveIdempotencia,
              itens: [
                {
                  insumoId: 'ins-pao',
                  nome: 'Pão Brioche',
                  unidade: 'Unidade',
                  saldoAnterior: 10,
                  saldoContado: 25,
                  diferenca: 15,
                },
                {
                  insumoId: 'ins-carne',
                  nome: 'Carne de Hambúrguer',
                  unidade: 'Gramas',
                  saldoAnterior: 5000,
                  saldoContado: 3200,
                  diferenca: -1800,
                },
              ],
            };
          },
        },
      },
    });

    await screen.findByText('Pão Brioche');

    // Preenche Pão (Unidade -> 25) e Carne (alterna para kg -> 3,2 = 3200 g), deixa Coca vazio
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar kg em Carne de Hambúrguer' }));
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '3,2' },
    });
    expect(screen.getByText('equivale a 3200 g')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Contagem inicial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Contagem registrada' });
    expect(payloadsEnviados).toHaveLength(1);
    const payloadEnviado = payloadsEnviados[0];
    expect(payloadEnviado.motivo).toBe('Contagem inicial');
    expect(typeof payloadEnviado.chaveIdempotencia).toBe('string');
    const chave = String(payloadEnviado.chaveIdempotencia);
    expect(chave.length).toBeGreaterThanOrEqual(8);
    expect(chave.length).toBeLessThanOrEqual(100);
    expect(payloadEnviado.itens).toEqual([
      { insumoId: 'ins-pao', saldoContado: 25 },
      { insumoId: 'ins-carne', saldoContado: 3200 },
    ]);
  });

  it('C2: "0" é aceito; "5.000" é recusado com mensagem de milhar; vazio não entra no lote; motivo vazio não envia', async () => {
    renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: {
        get: { '/insumos': insumosMock },
        post: { '/estoque/ajustes': vi.fn() },
      },
    });

    await screen.findByText('Pão Brioche');

    // "0" válido e mostra diferença negativa
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '0' } });
    expect(screen.getByText('−10 un')).toBeInTheDocument();

    // "5.000" recusado com mensagem de milhar
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '5.000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));

    expect(
      await screen.findByText('Para 5 mil, digite 5000 (use vírgula só para decimais)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Informe o motivo/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    // Corrige Carne para vazio (não entra no lote) e informa motivo
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Contagem semanal' }));
    expect((screen.getByLabelText('Motivo da contagem') as HTMLInputElement).value).toBe('Contagem semanal');
  });

  it('C3: exibe diferença prevista (+15 un, −800 g, sem diferença) e resumo fixo "N itens contados · M com diferença"', async () => {
    renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: { get: { '/insumos': insumosMock } },
    });

    await screen.findByText('Pão Brioche');

    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '4200' },
    });
    fireEvent.change(screen.getByLabelText('Contado de Coca Cola Zero 350ml'), {
      target: { value: '12' },
    });

    expect(screen.getByText('+15 un')).toBeInTheDocument();
    expect(screen.getByText('−800 g')).toBeInTheDocument();
    expect(screen.getByText('sem diferença')).toBeInTheDocument();
    expect(screen.getByText('3 itens contados · 2 com diferença')).toBeInTheDocument();
  });

  it('C4: confirmação lista itens com diferença, trava duplo clique, falha de rede reaproveita chave e editar contado gera chave nova', async () => {
    const chavesEnviadas: string[] = [];
    let chamadasPost = 0;
    let resolverPost!: (v: unknown) => void;
    let rejeitarPost!: (err: unknown) => void;

    renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: {
        get: { '/insumos': insumosMock },
        post: {
          '/estoque/ajustes': (_url: string, body: unknown) => {
            chamadasPost++;
            chavesEnviadas.push(String((body as { chaveIdempotencia: string }).chaveIdempotencia));
            return new Promise((resolve, reject) => {
              resolverPost = resolve;
              rejeitarPost = reject;
            });
          },
        },
      },
    });

    await screen.findByText('Carne de Hambúrguer');

    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '3200' },
    });
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Contagem mensal' }));

    // 1ª tentativa: duplo clique rápido em Registrar contagem não duplica diálogo/envio; falha de rede depois de confirmar
    const btnPrimeiroEnvio = screen.getByRole('button', { name: 'Registrar contagem' });
    fireEvent.click(btnPrimeiroEnvio);
    fireEvent.click(btnPrimeiroEnvio);
    expect(
      await screen.findAllByText(/Carne de Hambúrguer: 5\.000 g → 3\.200 g \(−1\.800 g\)/),
    ).toHaveLength(1);
    expect(screen.getByText(/1 item sem diferença/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(chamadasPost).toBe(1));

    await act(async () => {
      rejeitarPost(new axios.AxiosError('Network Error', 'ERR_NETWORK'));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/mesma chave/i);

    // 2ª tentativa sem mudar nada -> mesma chaveIdempotencia
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(chavesEnviadas).toHaveLength(2));
    expect(chavesEnviadas[1]).toBe(chavesEnviadas[0]);

    await act(async () => {
      rejeitarPost({
        isAxiosError: true,
        response: { status: 409, data: { message: 'Conflito de chave' } },
      });
    });

    // Após 409 ou editar contado -> chave nova
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '3500' },
    });
    const btnRegistrar = screen.getByRole('button', { name: 'Registrar contagem' });
    fireEvent.click(btnRegistrar);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(chavesEnviadas).toHaveLength(3));
    expect(chavesEnviadas[2]).not.toBe(chavesEnviadas[1]);

    await act(async () => {
      resolverPost({
        reaproveitado: false,
        chaveIdempotencia: chavesEnviadas[2],
        itens: [
          {
            insumoId: 'ins-carne',
            nome: 'Carne de Hambúrguer',
            unidade: 'Gramas',
            saldoAnterior: 5000,
            saldoContado: 3500,
            diferenca: -1500,
          },
        ],
      });
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Contagem registrada' })).toBeInTheDocument();
  });

  it('C5: trata erro 403, erro 404 com nome do insumo e resultado com reaproveitado: true', async () => {
    let modoResposta: '403' | '404' | 'replay' = '403';

    renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: {
        get: { '/insumos': insumosMock },
        post: {
          '/estoque/ajustes': () => {
            if (modoResposta === '403') {
              return { status: 403, data: { message: 'Acesso negado' } };
            }
            if (modoResposta === '404') {
              return { status: 404, data: { message: 'Insumo(s) não encontrado(s): ins-pao' } };
            }
            return {
              reaproveitado: true,
              chaveIdempotencia: 'chave-replay-123',
              itens: [
                {
                  insumoId: 'ins-pao',
                  nome: 'Pão Brioche',
                  unidade: 'Unidade',
                  saldoAnterior: 10,
                  saldoContado: 25,
                  diferenca: 15,
                },
              ],
            };
          },
        },
      },
    });

    await screen.findByText('Pão Brioche');

    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Contagem inicial' }));

    // 403
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(
      await screen.findByText('Só gerente ou administrador pode registrar contagem.'),
    ).toBeInTheDocument();

    // 404 aponta o insumo e mantém o formulário
    modoResposta = '404';
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Pão Brioche/);
    expect((screen.getByLabelText('Contado de Pão Brioche') as HTMLInputElement).value).toBe('25');

    // Replay
    modoResposta = 'replay';
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Esta contagem já tinha sido registrada.')).toBeInTheDocument();
    expect(screen.getByText(/saldo 10 → 25 un \(\+15 un\)/i)).toBeInTheDocument();
  });

  it('C6: Voltar com preenchimento pede confirmação e sem preenchimento volta direto', async () => {
    const onVoltar = vi.fn();
    renderComProviders(<ContagemEstoque onVoltar={onVoltar} />, {
      routes: { get: { '/insumos': insumosMock } },
    });

    await screen.findByText('Pão Brioche');

    // Sem preenchimento -> volta direto
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);

    // Preenche campo -> pede confirmação
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText(/Descartar contagem/i)).toBeInTheDocument();
    expect(onVoltar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalledTimes(2));
  });

  it('C7: usa apenas tokens de design em ContagemEstoque.tsx (sem cores literais)', () => {
    esperarSemCoresLiterais('src/pages/ContagemEstoque.tsx');
  });
});
