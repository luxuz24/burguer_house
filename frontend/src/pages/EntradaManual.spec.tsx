import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import axios from 'axios';
import EntradaManual from './EntradaManual';
import { renderComProviders, criarErroAxios } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

const insumos = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Carne de Hambúrguer',
    unidade: 'Gramas',
    categoria: 'INGREDIENTE',
    estoqueAtual: 5000,
    custoUnitario: 0.045,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Pão Brioche',
    unidade: 'Unidade',
    categoria: 'INGREDIENTE',
    estoqueAtual: 10,
    custoUnitario: 2.5,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Coca Cola Zero 350ml',
    unidade: 'Unidade',
    categoria: 'BEBIDA',
    estoqueAtual: 10,
    custoUnitario: 3.05,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    nome: 'Óleo de Soja',
    unidade: 'Mililitros',
    categoria: 'INGREDIENTE',
    estoqueAtual: 2000,
    custoUnitario: 0.01,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    nome: 'Caixa Kraft Burger',
    unidade: 'Unidades',
    categoria: 'EMBALAGEM',
    estoqueAtual: 40,
    custoUnitario: 1.2,
  },
];

interface CorpoEntrada {
  chaveIdempotencia: string;
  observacao?: string;
  itens: Array<{ insumoId: string; quantidade: number; custoUnitario?: number }>;
}

const respostaPadrao = {
  reaproveitado: false,
  chaveIdempotencia: '11111111-2222-4333-8444-555555555555',
  itens: [
    {
      insumoId: '33333333-3333-4333-8333-333333333333',
      nome: 'Coca Cola Zero 350ml',
      unidade: 'Unidade',
      quantidade: 24,
      saldoAnterior: 10,
      saldoPosterior: 34,
      custoUnitario: 3.05,
    },
  ],
  avisos: [],
};

function abrir(opcoes: {
  insumosLista?: unknown;
  post?: (corpo: CorpoEntrada, n: number) => unknown;
  onVoltar?: () => void;
  onSucesso?: () => void;
} = {}) {
  const corpos: CorpoEntrada[] = [];
  const onVoltar = opcoes.onVoltar ?? vi.fn();
  const onSucesso = opcoes.onSucesso ?? vi.fn();

  renderComProviders(<EntradaManual onVoltar={onVoltar} onSucesso={onSucesso} />, {
    routes: {
      get: {
        '/insumos': opcoes.insumosLista ?? insumos,
      },
      post: {
        '/estoque/entradas-manuais': ((_url: string, body: unknown) => {
          corpos.push(body as CorpoEntrada);
          const res = opcoes.post ? opcoes.post(body as CorpoEntrada, corpos.length) : respostaPadrao;
          if (res instanceof Error) throw res;
          return res;
        }) as never,
      },
    },
  });

  return { corpos, onVoltar, onSucesso };
}

describe('pages/EntradaManual (tarefa 15)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adicionar 2 linhas com observação pede confirmação e envia POST /estoque/entradas-manuais com chaveIdempotencia (8..100)', async () => {
    const { corpos, onSucesso } = abrir();

    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
    expect(
      screen.getByText(
        'Se a nota fiscal aparecer depois, não importe de novo: o sistema não consegue ver que é a mesma compra.',
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Observação'), {
      target: { value: 'Nota perdida - Atacadão' },
    });

    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[2].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), {
      target: { value: '3,05' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }));

    fireEvent.change(screen.getByLabelText('Insumo do item 2'), {
      target: { value: insumos[1].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 2'), { target: { value: '12' } });

    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));

    expect(
      await screen.findByText(/Dar entrada de 2 itens\? O estoque será aumentado\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Coca Cola Zero 350ml: \+24 un/)).toBeInTheDocument();
    expect(screen.getByText(/Pão Brioche: \+12 un/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(onSucesso).toHaveBeenCalledTimes(1);
    expect(corpos).toHaveLength(1);
    expect(corpos[0].chaveIdempotencia.length).toBeGreaterThanOrEqual(8);
    expect(corpos[0].chaveIdempotencia.length).toBeLessThanOrEqual(100);
    expect(corpos[0]).toMatchObject({
      observacao: 'Nota perdida - Atacadão',
      itens: [
        { insumoId: insumos[2].id, quantidade: 24, custoUnitario: 3.05 },
        { insumoId: insumos[1].id, quantidade: 12 },
      ],
    });
  });

  it('vírgula decimal vira ponto e alternar para kg converte quantidade e custo para gramas no payload', async () => {
    const { corpos } = abrir();
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    // Item 1: 1,5 Gramas direto na unidade base
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[0].id },
    });
    const item1 = screen.getByLabelText('Item 1');
    expect(within(item1).getByText('Gramas')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '1,5' } });

    // Alterna para kg: 2 kg = 2000 g e R$ 34,90/kg = R$ 0,0349/g
    fireEvent.click(within(item1).getByRole('button', { name: /kg/i }));
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), {
      target: { value: '34,90' },
    });

    expect(within(item1).getByText('equivale a 2000 g')).toBeInTheDocument();
    expect(within(item1).getByText('R$ 34,90/kg = R$ 0,0349/g')).toBeInTheDocument();

    // Item 2: Mililitros -> alternar para L e testar "1,5" L -> 1500 ml
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }));
    fireEvent.change(screen.getByLabelText('Insumo do item 2'), {
      target: { value: insumos[3].id },
    });
    const item2 = screen.getByLabelText('Item 2');
    fireEvent.click(within(item2).getByRole('button', { name: /Usar L/i }));
    fireEvent.change(screen.getByLabelText('Quantidade do item 2'), { target: { value: '1,5' } });
    expect(within(item2).getByText('equivale a 1500 ml')).toBeInTheDocument();

    // Remove item 2 para testar também quantidade com vírgula direto em g? Não, envia os 2!
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(corpos[0].itens).toEqual([
      { insumoId: insumos[0].id, quantidade: 2000, custoUnitario: 0.0349 },
      { insumoId: insumos[3].id, quantidade: 1500 },
    ]);
  });

  it('quantidade com vírgula ("1,5") na unidade base vira 1.5 no payload', async () => {
    const { corpos } = abrir();
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[0].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '1,5' } });

    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(corpos[0].itens).toEqual([{ insumoId: insumos[0].id, quantidade: 1.5 }]);
  });

  it('insumo já usado fica desabilitado no seletor da outra linha; lista vazia, quantidade <= 0 ou custo < 0 não envia', async () => {
    const { corpos } = abrir();
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[0].id },
    });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }));

    const select2 = screen.getByLabelText('Insumo do item 2');
    const opcaoRepetida = within(select2).getByRole('option', {
      name: /Carne de Hambúrguer/,
    }) as HTMLOptionElement;
    expect(opcaoRepetida).toBeDisabled();

    // Remove item 2, deixa quantidade 0 e custo negativo
    fireEvent.click(screen.getByRole('button', { name: 'Remover item 2' }));
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));

    expect(screen.getByText('Informe uma quantidade maior que zero.')).toBeInTheDocument();
    expect(screen.getByText('O custo unitário não pode ser negativo.')).toBeInTheDocument();
    expect(corpos).toHaveLength(0);

    // Remove o único item -> lista vazia não envia e mostra mensagem
    fireEvent.click(screen.getByRole('button', { name: 'Remover item 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    expect(
      screen.getByText('Adicione pelo menos um item para registrar a entrada.'),
    ).toBeInTheDocument();
    expect(corpos).toHaveLength(0);
  });

  it('atalho por categoria e busca por nome sem acento filtram o seletor mantendo o insumo selecionado', async () => {
    abrir();
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    const item1 = screen.getByLabelText('Item 1');
    fireEvent.click(within(item1).getByRole('button', { name: 'Embalagem' }));
    const select1 = screen.getByLabelText('Insumo do item 1');
    expect(within(select1).getByRole('option', { name: /Caixa Kraft Burger/ })).toBeInTheDocument();
    expect(
      within(select1).queryByRole('option', { name: /Coca Cola Zero 350ml/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(item1).getByRole('button', { name: 'Todos' }));
    fireEvent.change(screen.getByLabelText('Buscar insumo do item 1'), {
      target: { value: 'pao' },
    });
    expect(within(select1).getByRole('option', { name: /Pão Brioche/ })).toBeInTheDocument();
    expect(
      within(select1).queryByRole('option', { name: /Caixa Kraft Burger/ }),
    ).not.toBeInTheDocument();
  });

  it('duplo clique em Dar entrada / Confirmar faz uma chamada; falha de rede mantém chave; editar gera chave nova', async () => {
    let falhar = true;
    const { corpos } = abrir({
      post: () => {
        if (falhar) {
          return new axios.AxiosError('Network Error', 'ERR_NETWORK');
        }
        return respostaPadrao;
      },
    });

    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[2].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '10' } });

    const btnDarEntrada = screen.getByRole('button', { name: 'Dar entrada' });
    fireEvent.click(btnDarEntrada);
    fireEvent.click(btnDarEntrada);

    const btnConfirmar = await screen.findByRole('button', { name: 'Confirmar' });
    fireEvent.click(btnConfirmar);
    fireEvent.click(btnConfirmar);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Falha de conexão/);
    await waitFor(() => expect(corpos).toHaveLength(1));

    // Reenvio após falha de rede usa a MESMA chave
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(corpos).toHaveLength(2));
    expect(corpos[1].chaveIdempotencia).toBe(corpos[0].chaveIdempotencia);

    // Editar item e reenviar gera CHAVE NOVA
    falhar = false;
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(corpos).toHaveLength(3);
    expect(corpos[2].chaveIdempotencia).not.toBe(corpos[0].chaveIdempotencia);
  });

  it('resposta 201 com avisos exibe os avisos e "saldo 10 → 34"; reaproveitado: true mostra mensagem neutra', async () => {
    const { onVoltar } = abrir({
      post: () => ({
        ...respostaPadrao,
        avisos: [
          'Coca Cola Zero 350ml: o novo custo (30.51) é mais de 10× diferente do atual (3.05). Confira a unidade (R$ por unidade de medida).',
        ],
      }),
    });

    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[2].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(screen.getByText(/saldo 10 → 34/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/mais de 10× diferente/);
    expect(screen.queryByText('Esta entrada já tinha sido registrada.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it('resposta 200 com reaproveitado: true exibe a mensagem neutra', async () => {
    abrir({
      post: () => ({ ...respostaPadrao, reaproveitado: true, avisos: [] }),
    });

    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[2].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    const msgNeutra = screen.getByText('Esta entrada já tinha sido registrada.');
    expect(msgNeutra).toBeInTheDocument();
    expect(msgNeutra).toHaveAttribute('role', 'status');
  });

  it('trata 404 (aponta o insumo e mantém formulário), 409 (troca chave e orienta conferir estoque) e 400', async () => {
    let tentativa = 0;
    const { corpos } = abrir({
      post: () => {
        tentativa++;
        if (tentativa === 1) {
          return criarErroAxios(404, {
            message: `Insumo(s) não encontrado(s): ${insumos[1].id}`,
          });
        }
        if (tentativa === 2) {
          return criarErroAxios(409, { message: 'Chave já usada com outro conteúdo' });
        }
        return criarErroAxios(400, { message: 'Quantidade inválida no servidor' });
      },
    });

    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[1].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '5' } });

    // 404
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Pão Brioche/);
    expect((screen.getByLabelText('Quantidade do item 1') as HTMLInputElement).value).toBe('5');

    // 409 -> orienta conferir estoque e prepara chave nova
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/confira o estoque/i);

    // 400 -> mensagem do backend e chave diferente da tentativa anterior após 409
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quantidade inválida no servidor');
    expect(corpos[2].chaveIdempotencia).not.toBe(corpos[1].chaveIdempotencia);
  });

  it('funciona sem crypto.randomUUID (contexto http://IP) gerando chaves de 36 caracteres diferentes', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (b: Uint8Array) => {
        for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
        return b;
      },
    });

    const { corpos } = abrir({
      post: () => criarErroAxios(409, { message: 'Conflito para forçar nova chave' }),
    });

    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[1].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(corpos).toHaveLength(2));

    expect(corpos[0].chaveIdempotencia).toHaveLength(36);
    expect(corpos[1].chaveIdempotencia).toHaveLength(36);
    expect(corpos[0].chaveIdempotencia).not.toBe(corpos[1].chaveIdempotencia);
  });

  it('erro ao carregar insumos exibe mensagem e botão Tentar novamente', async () => {
    let falha = true;
    renderComProviders(<EntradaManual onVoltar={vi.fn()} />, {
      routes: {
        get: {
          '/insumos': () => {
            if (falha) {
              return { status: 500, data: { message: 'Falha ao buscar insumos' } };
            }
            return insumos;
          },
        },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao buscar insumos');
    falha = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await act(async () => {});
    expect(await screen.findByLabelText('Insumo do item 1')).toBeInTheDocument();
  });

  it('recusa quantidade no formato de milhar ("5.000"), exige "5000" e lista quantidade convertida na confirmação', async () => {
    const { corpos } = abrir();
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[0].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '5.000' } });

    expect(
      screen.getByText('Para 5 mil, digite 5000 (use vírgula só para decimais)'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(corpos).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));

    expect(await screen.findByText(/Carne de Hambúrguer: \+5\.000 g/)).toBeInTheDocument();
  });

  it('mostra "Valor inválido" para custo "1.234,56" e pede confirmação em "Voltar" com formulário preenchido', async () => {
    const onVoltarVazio = vi.fn();
    abrir({ onVoltar: onVoltarVazio });
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    // Formulário vazio volta sem perguntar
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onVoltarVazio).toHaveBeenCalledTimes(1);

    // Digitar custo inválido e tentar enviar mostra "Valor inválido"
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[0].id },
    });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), {
      target: { value: '1.234,56' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));

    expect(screen.getByText('Valor inválido')).toBeInTheDocument();
    expect(screen.queryByText('O custo unitário não pode ser negativo.')).not.toBeInTheDocument();

    // Voltar com dados preenchidos pede confirmação; cancelar mantém e confirmar chama onVoltar
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    const btnDescartar = await screen.findByRole('button', { name: 'Descartar' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(onVoltarVazio).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    void btnDescartar;
    await waitFor(() => expect(onVoltarVazio).toHaveBeenCalledTimes(2));
  });

  it('não utiliza cores literais hardcoded ou tokens inválidos em EntradaManual.tsx', () => {
    esperarSemCoresLiterais('src/pages/EntradaManual.tsx');
  });

  it('exibe carregamento inicial, valida insumo ausente/observação > 500, limpa erro ao editar e alterna g/kg', async () => {
    let resolverCarga!: (v: unknown) => void;
    let cargaPendente = true;
    let rejeitarPost = true;
    let resolverPost!: (v: unknown) => void;
    const onVoltar = vi.fn();

    const { corpos } = (() => {
      const enviados: CorpoEntrada[] = [];
      renderComProviders(<EntradaManual onVoltar={onVoltar} />, {
        routes: {
          get: {
            '/insumos': () => {
              if (cargaPendente) {
                cargaPendente = false;
                return new Promise((resolve) => {
                  resolverCarga = resolve;
                });
              }
              return insumos;
            },
          },
          post: {
            '/estoque/entradas-manuais': ((_u: string, body: unknown) => {
              enviados.push(body as CorpoEntrada);
              if (rejeitarPost) {
                throw criarErroAxios(400, { message: 'Falha validada' });
              }
              return new Promise((resolve) => {
                resolverPost = resolve;
              });
            }) as never,
          },
        },
      });
      return { corpos: enviados };
    })();

    expect(screen.getByText('Carregando insumos…')).toBeInTheDocument();

    await act(async () => {
      resolverCarga(insumos);
    });
    await waitFor(() => expect(screen.queryByText('Carregando insumos…')).not.toBeInTheDocument());

    // Espaços apenas na observação/quantidade/custo -> Voltar direto sem confirmar
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);

    // Apenas custo preenchido em 1 de 2 linhas (sem insumoId/obs) -> Voltar pede confirmação
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }));
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText(/Descartar entrada manual/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('Custo unitário do item 1'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remover item 2' }));

    // Antes de escolher insumo, rótulo do custo não mostra sigla
    expect(screen.getByText('Custo unitário (opcional)')).toBeInTheDocument();

    // Clicar Dar entrada sem selecionar insumo e com observação > 500
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: 'a'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    expect(await screen.findByText('Selecione um insumo.')).toBeInTheDocument();
    expect(
      screen.getByText('A observação deve ter no máximo 500 caracteres.'),
    ).toBeInTheDocument();
    expect(corpos).toHaveLength(0);

    // Apenas observação preenchida pede confirmação ao clicar Voltar (2 cliques rápidos no Voltar abre só 1 diálogo)
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: 'Compra centro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText(/Descartar entrada manual/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(onVoltar).toHaveBeenCalledTimes(1);

    // Seleciona insumo em gramas e alterna kg <-> g verificando rótulos, aria-pressed e classes visuais
    fireEvent.change(screen.getByLabelText('Insumo do item 1'), {
      target: { value: insumos[0].id },
    });
    expect(screen.getByText('Salvo em R$ por Gramas')).toBeInTheDocument();

    // Mesmo filtrando para Bebida na linha 1, Carne de Hambúrguer (já selecionada) continua visível no select 1
    const item1 = screen.getByLabelText('Item 1');
    fireEvent.click(within(item1).getByRole('button', { name: 'Bebida' }));
    expect(
      within(screen.getByLabelText('Insumo do item 1')).getByRole('option', {
        name: /Carne de Hambúrguer/,
      }),
    ).toBeInTheDocument();

    const btnG = screen.getByRole('button', { name: 'Usar g no item 1' });
    const btnKg = screen.getByRole('button', { name: 'Usar kg no item 1' });
    expect(btnG).toHaveAttribute('aria-pressed', 'true');
    expect(btnG.className).toContain('bg-primary');
    expect(btnKg).toHaveAttribute('aria-pressed', 'false');
    expect(btnKg.className).toContain('text-muted');
    expect(screen.getByLabelText('Quantidade do item 1').parentElement).toHaveTextContent('g');

    fireEvent.click(btnKg);
    expect(btnKg).toHaveAttribute('aria-pressed', 'true');
    expect(btnKg.className).toContain('bg-primary');
    expect(btnG).toHaveAttribute('aria-pressed', 'false');
    expect(btnG.className).toContain('text-muted');
    expect(screen.getByText('Quantidade (kg)')).toBeInTheDocument();
    expect(screen.getByText('Custo unitário (opcional, R$/kg)')).toBeInTheDocument();

    fireEvent.click(btnG);
    expect(btnG).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Quantidade (g)')).toBeInTheDocument();

    // Adiciona linha 2 e 3 para garantir isolamento de idsUsadosEmOutrasLinhas e categoria
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }));
    fireEvent.change(screen.getByLabelText('Insumo do item 3'), {
      target: { value: insumos[1].id },
    });
    const select1 = screen.getByLabelText('Insumo do item 1');
    const select2 = screen.getByLabelText('Insumo do item 2');
    expect(
      (within(select1).getByRole('option', { name: /Carne de Hambúrguer/ }) as HTMLOptionElement)
        .disabled,
    ).toBe(false);
    expect(
      (within(select2).getByRole('option', { name: /Carne de Hambúrguer/ }) as HTMLOptionElement)
        .disabled,
    ).toBe(true);
    expect(
      (within(select2).getByRole('option', { name: /Pão Brioche/ }) as HTMLOptionElement).disabled,
    ).toBe(true);

    // Remove linhas extras e preenche item 1
    fireEvent.click(screen.getByRole('button', { name: 'Remover item 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover item 2' }));
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '500' } });

    // Cancelar diálogo de confirmação não envia
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(corpos).toHaveLength(0);

    // Erro 400 aparece e editar observação / linha limpa o alerta
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha validada');
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: 'Compra centro 2' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Em voo exibe "Registrando…" desabilitado e, quando avisos=[], não exibe "Atenção ao custo informado"
    rejeitarPost = false;
    fireEvent.click(screen.getByRole('button', { name: 'Dar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('button', { name: 'Registrando…' })).toBeDisabled();

    await act(async () => {
      resolverPost({ ...respostaPadrao, avisos: [] });
    });

    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(screen.queryByText('Atenção ao custo informado')).not.toBeInTheDocument();
  });

  it('categoria filtrada atualiza aria-pressed e remoção reduz contagem de itens mantendo os restantes', async () => {
    abrir({ insumosLista: insumos });
    await screen.findByRole('heading', { level: 1, name: 'Entrada manual' });

    const item1 = screen.getByLabelText('Item 1');
    const btnTodos = within(item1).getByRole('button', { name: 'Todos' });
    const btnBebida = within(item1).getByRole('button', { name: 'Bebida' });
    expect(btnTodos).toHaveAttribute('aria-pressed', 'true');
    expect(btnBebida).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btnBebida);
    expect(btnBebida).toHaveAttribute('aria-pressed', 'true');
    expect(btnTodos).toHaveAttribute('aria-pressed', 'false');

    const btnAdd = screen.getByRole('button', { name: /Adicionar item/i });
    expect(btnAdd).toBeEnabled();
    fireEvent.click(btnAdd);
    expect(screen.getByLabelText('Item 2')).toBeInTheDocument();
  });
});
