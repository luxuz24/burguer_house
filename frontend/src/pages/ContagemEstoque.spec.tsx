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
      rejeitarPost(new axios.AxiosError('Network Error', 'ERR_NETWORK'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/mesma chave/i);

    // 3ª tentativa editando um contado (mesmo após erro de rede) -> chave nova; simula 409
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '3500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(chavesEnviadas).toHaveLength(3));
    expect(chavesEnviadas[2]).not.toBe(chavesEnviadas[1]);

    await act(async () => {
      resolverPost({
        status: 409,
        data: { message: 'Conflito de chave' },
      });
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // 4ª tentativa após 409 (mesmo SEM mudar nenhum valor) -> chave nova
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(chavesEnviadas).toHaveLength(4));
    expect(chavesEnviadas[3]).not.toBe(chavesEnviadas[2]);
    expect(chavesEnviadas[3]).not.toBe(chavesEnviadas[1]);
    expect(chavesEnviadas[3]).not.toBe(chavesEnviadas[0]);

    await act(async () => {
      resolverPost({
        reaproveitado: false,
        chaveIdempotencia: chavesEnviadas[3],
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

  it('C8: filtra insumos por aba de categoria e busca sem acento, preservando contagens já digitadas', async () => {
    renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: { get: { '/insumos': insumosMock } },
    });

    await screen.findByText('Pão Brioche');

    const tabTodos = screen.getByRole('tab', { name: 'Todos' });
    const tabBebida = screen.getByRole('tab', { name: 'Bebida' });
    const tabIngrediente = screen.getByRole('tab', { name: 'Ingrediente' });

    expect(tabTodos).toHaveAttribute('aria-selected', 'true');
    expect(tabBebida).toHaveAttribute('aria-selected', 'false');

    // Preenche Pão antes de trocar de aba
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '18' } });

    // Aba Bebida mostra só Coca Cola
    fireEvent.click(tabBebida);
    expect(tabBebida).toHaveAttribute('aria-selected', 'true');
    expect(tabTodos).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Coca Cola Zero 350ml')).toBeInTheDocument();
    expect(screen.queryByText('Pão Brioche')).not.toBeInTheDocument();

    // Volta para Ingrediente e busca sem acento ("pao") -> Pão Brioche aparece com valor preservado
    fireEvent.click(tabIngrediente);
    fireEvent.change(screen.getByLabelText('Buscar insumo na contagem'), {
      target: { value: 'pao' },
    });
    expect(screen.getByText('Pão Brioche')).toBeInTheDocument();
    expect(screen.queryByText('Carne de Hambúrguer')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Contado de Pão Brioche') as HTMLInputElement).value).toBe('18');
    expect(screen.getByText('1 item contado · 1 com diferença')).toBeInTheDocument();
  });

  it('C9: carregamento inicial, erro de carga com Tentar novamente, envio sem preencher e alternância kg <-> g', async () => {
    let resolverCarga!: (v: unknown) => void;
    let tentativaCarga = 0;

    const r1 = renderComProviders(<ContagemEstoque onVoltar={vi.fn()} />, {
      routes: {
        get: {
          '/insumos': () => {
            tentativaCarga++;
            if (tentativaCarga === 1) {
              return new Promise((resolve) => {
                resolverCarga = resolve;
              });
            }
            return insumosMock;
          },
        },
        post: { '/estoque/ajustes': vi.fn() },
      },
    });

    expect(screen.getByText('Carregando insumos…')).toBeInTheDocument();

    await act(async () => {
      resolverCarga(insumosMock);
    });

    await waitFor(() => {
      expect(screen.queryByText('Carregando insumos…')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Pão Brioche')).toBeInTheDocument();
    r1.unmount();

    const onSucesso = vi.fn();
    let falhar = true;
    const { unmount } = renderComProviders(<ContagemEstoque onVoltar={vi.fn()} onSucesso={onSucesso} />, {
      routes: {
        get: {
          '/insumos': () => {
            if (falhar) {
              return { status: 500, data: { message: 'Erro ao carregar insumos da loja' } };
            }
            return insumosMock;
          },
        },
        post: { '/estoque/ajustes': vi.fn() },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro ao carregar insumos da loja');
    expect(screen.queryByText('Carregando insumos…')).not.toBeInTheDocument();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Carne de Hambúrguer');

    // Registrar sem nenhum item preenchido nem motivo mostra ambos os erros sem abrir confirmação
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    expect(
      await screen.findByText('Preencha o saldo contado de pelo menos um insumo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Informe o motivo com pelo menos 3 caracteres.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    // Alternar kg -> g e voltar para g preserva texto e ajusta label/diferença/aria-pressed e classes visuais
    const btnG = screen.getByRole('button', { name: 'Usar g em Carne de Hambúrguer' });
    const btnKg = screen.getByRole('button', { name: 'Usar kg em Carne de Hambúrguer' });
    expect(btnG).toHaveAttribute('aria-pressed', 'true');
    expect(btnKg).toHaveAttribute('aria-pressed', 'false');

    // Valor inválido mostra erro imediato antes de enviar e limpa quando apagado
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: 'abc' },
    });
    expect(screen.getByText('Valor inválido')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '' },
    });
    expect(screen.queryByText('Valor inválido')).not.toBeInTheDocument();

    fireEvent.click(btnKg);
    expect(btnKg).toHaveAttribute('aria-pressed', 'true');
    expect(btnG).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Contado (kg) — vazio = não contado')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Contado de Carne de Hambúrguer'), {
      target: { value: '6' },
    });
    const prevPos = screen.getByText('+1.000 g');
    expect(prevPos.className).toContain('bg-success-soft');
    expect(prevPos.className).toContain('text-success');

    // Volta para g: "6" vira 6 g (-4994 g)
    fireEvent.click(btnG);
    expect(btnG).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Contado (g) — vazio = não contado')).toBeInTheDocument();
    const prevNeg = screen.getByText('−4.994 g');
    expect(prevNeg.className).toContain('bg-danger-soft');
    expect(prevNeg.className).toContain('text-danger');

    unmount();
  });

  it('C10: chips de motivo atualizam destaque, alterar campo limpa erro, Voltar com motivo/espaços e resultado negativo/zero', async () => {
    const onVoltar = vi.fn();
    const onSucesso = vi.fn();
    let responderComErro = true;
    let resolverPost!: (v: unknown) => void;

    renderComProviders(<ContagemEstoque onVoltar={onVoltar} onSucesso={onSucesso} />, {
      routes: {
        get: { '/insumos': insumosMock },
        post: {
          '/estoque/ajustes': () => {
            if (responderComErro) {
              return { status: 400, data: { message: 'Erro temporário no envio' } };
            }
            return new Promise((resolve) => {
              resolverPost = resolve;
            });
          },
        },
      },
    });

    await screen.findByText('Pão Brioche');

    // Apenas espaços no motivo e na contagem não contam como preenchido -> Voltar direto
    fireEvent.change(screen.getByLabelText('Motivo da contagem'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);

    // Preencher apenas o motivo (sem itens) -> Voltar pede confirmação; Cancelar mantém na tela
    fireEvent.change(screen.getByLabelText('Motivo da contagem'), {
      target: { value: 'Inventário de caixa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' })); // 2º clique enquanto aberto é ignorado
    expect(await screen.findByText(/Descartar contagem/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(onVoltar).toHaveBeenCalledTimes(1);

    // Chips de motivo destacam apenas o selecionado
    const chipInicial = screen.getByRole('button', { name: 'Contagem inicial' });
    const chipSemanal = screen.getByRole('button', { name: 'Contagem semanal' });
    fireEvent.click(chipInicial);
    expect(chipInicial.className).toContain('bg-primary-soft');
    expect(chipSemanal.className).toContain('bg-card');

    // Preenche 1 item com saldo igual (sem diferença) -> classe neutra text-muted
    fireEvent.change(screen.getByLabelText('Contado de Pão Brioche'), { target: { value: '10' } });
    const prevZero = screen.getByText('sem diferença');
    expect(prevZero.className).toContain('bg-field');
    expect(prevZero.className).toContain('text-muted');
    expect(screen.getByText('1 item contado · 0 com diferença')).toBeInTheDocument();

    // Cancelar diálogo de confirmação da contagem não chama POST
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(api.post).not.toHaveBeenCalled();

    // Erro 400 aparece no alert e é limpo ao editar campo/motivo
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro temporário no envio');

    fireEvent.change(screen.getByLabelText('Motivo da contagem'), {
      target: { value: '  Contagem semanal  ' },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Envio em voo mostra "Registrando…" desabilitado e depois renderiza diferenças -, + e 0
    responderComErro = false;
    fireEvent.click(screen.getByRole('button', { name: 'Registrar contagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('button', { name: 'Registrando…' })).toBeDisabled();

    await act(async () => {
      resolverPost({
        reaproveitado: false,
        chaveIdempotencia: 'chave-ok-1234',
        itens: [
          {
            insumoId: 'ins-pao',
            nome: 'Pão Brioche',
            unidade: 'Unidade',
            saldoAnterior: 10,
            saldoContado: 10,
            diferenca: 0,
          },
          {
            insumoId: 'ins-carne',
            nome: 'Carne de Hambúrguer',
            unidade: 'Gramas',
            saldoAnterior: 5000,
            saldoContado: 3000,
            diferenca: -2000,
          },
          {
            insumoId: 'ins-coca',
            nome: 'Coca Cola Zero 350ml',
            unidade: 'Unidade',
            saldoAnterior: 12,
            saldoContado: 15,
            diferenca: 3,
          },
        ],
      });
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Contagem registrada' })).toBeInTheDocument();
    expect(onSucesso).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Esta contagem já tinha sido registrada.')).not.toBeInTheDocument();

    const badgeZero = screen.getByText('0 un');
    expect(badgeZero.className).toContain('text-muted');
    const badgeNeg = screen.getByText('−2.000 g');
    expect(badgeNeg.className).toContain('text-danger');
    const badgePos = screen.getByText('+3 un');
    expect(badgePos.className).toContain('text-success');

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));
    expect(onVoltar).toHaveBeenCalledTimes(2);
  });
});
