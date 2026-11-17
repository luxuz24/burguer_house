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
      await screen.findByText('Dar entrada de 2 itens? O estoque será aumentado.'),
    ).toBeInTheDocument();
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

  it('não utiliza cores literais hardcoded ou tokens inválidos em EntradaManual.tsx', () => {
    esperarSemCoresLiterais('src/pages/EntradaManual.tsx');
  });
});
