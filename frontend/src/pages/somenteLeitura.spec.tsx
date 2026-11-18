import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderComProviders } from '../test/render';
import type { UsuarioAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  mockUsuarioAdmin,
  mockUsuarioGerente,
  mockUsuarioOperador,
  mockListaInsumos,
  mockInsumoBeneficiado,
  mockListaProdutos,
  mockProdutoComFicha,
  mockListaPerdas,
  mockResumoMensalPerdas,
} from '../test/fixtures';
import Inicio from './Inicio';
import Estoque from './Estoque';
import FichaTecnica from './FichaTecnica';
import PreparoInterno from './PreparoInterno';
import Perdas from './Perdas';
import FechamentosDoDia from '../components/FechamentosDoDia';
import PerfilModal from '../components/PerfilModal';
import ConfiguracoesModal from '../components/ConfiguracoesModal';
import AvisoSomenteLeitura from '../components/AvisoSomenteLeitura';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';

/**
 * Decisão do dono (18/11/2026): "por enquanto só o ADMIN gere o sistema; GERENTE e OPERADOR só leem".
 * Toda ação que dispara POST/PUT/PATCH/DELETE (fora de /auth/*) some para quem não é ADMIN;
 * as telas de consulta continuam funcionando.
 */

const AVISO = /Somente leitura: alterações são feitas pelo administrador/;
const NAO_ADMINS: Array<[string, UsuarioAuth]> = [
  ['OPERADOR', mockUsuarioOperador],
  ['GERENTE', mockUsuarioGerente],
];

const retidasComPendencia = {
  retidas: [
    {
      id: 'venda-1',
      externalId: '1001',
      criadoEm: '2026-11-18T12:00:00.000Z',
      check: null,
      motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'X-Tudo' }],
    },
  ],
  resumoPorProduto: [{ produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 2 }],
  aguardandoEstado: 0,
  totalRetidas: 2,
  totalPendentesAnalisadas: 2,
  totalPendentes: 2,
  limite: 200,
  offset: 0,
  temMais: false,
};

// ───────────────────────────── Início ─────────────────────────────

const resumoHoje = {
  kpis: {
    totalVendasValor: 100, totalVendasQtd: 4, totalComprasValor: 50, totalComprasQtd: 1,
    totalPerdasValor: 10, totalPerdasQtd: 1, insumosEmAlertaQtd: 3,
  },
  estoqueAlerta: [
    { id: 'a1', nome: 'Molho da casa', unidade: 'Mililitros', estoqueAtual: 900, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: 180, vencido: true },
    { id: 'a2', nome: 'Pão brioche', unidade: 'Unidades', estoqueAtual: 12, estoqueMinimo: 40, status: 'ALERTA', percentualEstoque: 30 },
    { id: 'a3', nome: 'Cebola caramelizada', unidade: 'Gramas', estoqueAtual: 800, estoqueMinimo: 200, status: 'OK', percentualEstoque: 400, diasRestantesValidade: 1 },
  ],
  itensMaisVendidos: [{ produtoNome: 'X-Bacon', quantidadeVendida: 3 }],
};

function abrirInicio(usuario: UsuarioAuth) {
  const props = {
    onNavegar: vi.fn(),
    onAbrirImportarNota: vi.fn(),
    onAbrirFechamentoDia: vi.fn(),
    onAbrirPerfil: vi.fn(),
    onAbrirConfiguracoes: vi.fn(),
    onAbrirVendasRetidas: vi.fn(),
  };
  renderComProviders(<Inicio {...props} />, {
    usuario,
    verificarSessao: false,
    routes: { get: { '/dashboard/resumo': resumoHoje, '/vendas/retidas': retidasComPendencia } },
  });
  return props;
}

describe('somente leitura — Início', () => {
  it.each(NAO_ADMINS)('%s não vê Registrar perda, Ler QR code, Fechar o dia, Comprar nem as correções de vendas retidas', async (_papel, usuario) => {
    const props = abrirInicio(usuario);
    await screen.findByText('Molho da casa');
    await screen.findByText(/2 vendas retidas/);

    expect(screen.queryAllByRole('button', { name: /Registrar perda/ })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Ler QR code/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fechar o dia/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comprar Pão brioche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar produto X-Tudo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Corrigir cardápio/ })).not.toBeInTheDocument();

    // Consulta continua: resumo, alertas, ver no estoque, vendas retidas (só leitura), perfil e configurações
    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(screen.getAllByText(AVISO)).toHaveLength(1);
    expect(screen.getByText('Pedem atenção')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver Cebola caramelizada no estoque' }));
    expect(props.onNavegar).toHaveBeenCalledWith('estoque');
    expect(screen.getByRole('button', { name: /Ver detalhes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Perfil de / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeInTheDocument();
  });

  it('ADMIN vê Registrar perda, Ler QR code, Fechar o dia, Comprar e as correções de vendas retidas (sem aviso)', async () => {
    abrirInicio(mockUsuarioAdmin);
    await screen.findByText('Molho da casa');
    await screen.findByText(/2 vendas retidas/);

    // O atalho grande do topo e a ação do alerta vencido
    expect(screen.getAllByRole('button', { name: /Registrar perda/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Registrar perda de Molho da casa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ler QR code/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fechar o dia/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comprar Pão brioche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar produto X-Tudo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Corrigir cardápio/ })).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});

// ───────────────────────────── Estoque ─────────────────────────────

const movimentacoesVazias = { total: 0, limite: 20, offset: 0, movimentacoes: [] };

function abrirEstoque(usuario: UsuarioAuth, insumos: unknown = mockListaInsumos) {
  return renderComProviders(<Estoque />, {
    usuario,
    verificarSessao: false,
    routes: {
      get: {
        '/insumos': insumos,
        '/produtos': mockListaProdutos,
        '/vendas/retidas': retidasComPendencia,
        '/estoque/movimentacoes': movimentacoesVazias,
      },
    },
  });
}

describe('somente leitura — Estoque (insumos)', () => {
  it.each(NAO_ADMINS)('%s não vê Contagem, Entrada sem nota, Importar NF-e, Novo insumo, Produzir, Editar nem Excluir', async (_papel, usuario) => {
    abrirEstoque(usuario);
    await screen.findByText('Carne de Hambúrguer');

    expect(screen.queryByRole('button', { name: /Contagem/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrada sem nota/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importar NF-e' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo insumo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Produzir ${mockInsumoBeneficiado.nome}` })).not.toBeInTheDocument();
    expect(screen.getAllByText(AVISO)).toHaveLength(1);

    // Detalhes e histórico continuam abrindo; só as ações de escrita somem
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar Carne de Hambúrguer' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Estoque atual:/)).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Editar Carne de Hambúrguer' })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Excluir Carne de Hambúrguer' })).not.toBeInTheDocument();
  });

  it('OPERADOR abre a receita do item da casa em modo consulta (botão "Ver receita")', async () => {
    abrirEstoque(mockUsuarioOperador);
    await screen.findByText(mockInsumoBeneficiado.nome);
    expect(screen.getByRole('button', { name: `Ver receita de ${mockInsumoBeneficiado.nome}` })).toBeInTheDocument();
  });

  it('OPERADOR com estoque vazio não vê "Cadastrar primeiro insumo"', async () => {
    abrirEstoque(mockUsuarioOperador, []);
    await screen.findByText('Nenhum insumo cadastrado');
    expect(screen.queryByRole('button', { name: 'Cadastrar primeiro insumo' })).not.toBeInTheDocument();
  });

  it('ADMIN vê Contagem, Entrada sem nota, Importar NF-e, Novo insumo, Produzir, Editar e Excluir (sem aviso)', async () => {
    abrirEstoque(mockUsuarioAdmin);
    await screen.findByText('Carne de Hambúrguer');

    expect(screen.getByRole('button', { name: 'Contagem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrada sem nota/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar NF-e' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo insumo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Produzir ${mockInsumoBeneficiado.nome}` })).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar Carne de Hambúrguer' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Editar Carne de Hambúrguer' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Excluir Carne de Hambúrguer' })).toBeInTheDocument();
  });

  it('ADMIN com estoque vazio vê "Cadastrar primeiro insumo"', async () => {
    abrirEstoque(mockUsuarioAdmin, []);
    await screen.findByText('Nenhum insumo cadastrado');
    expect(screen.getByRole('button', { name: 'Cadastrar primeiro insumo' })).toBeInTheDocument();
  });
});

describe('somente leitura — Estoque (prontos)', () => {
  it.each(NAO_ADMINS)('%s não vê Novo produto, Excluir produto nem "Criar produto" das vendas retidas; ainda abre a ficha', async (_papel, usuario) => {
    abrirEstoque(usuario);
    fireEvent.click(await screen.findByRole('tab', { name: /Prontos/ }));
    await screen.findByText(mockProdutoComFicha.nome);
    await screen.findByText(/2 vendas retidas/);

    expect(screen.queryByRole('button', { name: /Novo produto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Excluir ${mockProdutoComFicha.nome}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar produto X-Tudo' })).not.toBeInTheDocument();
  });

  it('ADMIN vê Novo produto, Excluir produto e "Criar produto" das vendas retidas', async () => {
    abrirEstoque(mockUsuarioAdmin);
    fireEvent.click(await screen.findByRole('tab', { name: /Prontos/ }));
    await screen.findByText(mockProdutoComFicha.nome);
    await screen.findByText(/2 vendas retidas/);

    expect(screen.getByRole('button', { name: /Novo produto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Excluir ${mockProdutoComFicha.nome}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar produto X-Tudo' })).toBeInTheDocument();
  });
});

// ───────────────────────────── Ficha técnica ─────────────────────────────

function abrirFicha(usuario: UsuarioAuth) {
  renderComProviders(<FichaTecnica produtoId={mockProdutoComFicha.id} onVoltar={vi.fn()} />, {
    usuario,
    verificarSessao: false,
    routes: { get: { [`/produtos/${mockProdutoComFicha.id}`]: mockProdutoComFicha, '/insumos': mockListaInsumos } },
  });
}

describe('somente leitura — Ficha técnica', () => {
  it.each(NAO_ADMINS)('%s vê os ingredientes mas não vê Renomear, Excluir produto, Editar quantidade, Remover nem Adicionar', async (_papel, usuario) => {
    abrirFicha(usuario);
    await screen.findByText('Carne de Hambúrguer');
    expect(screen.getByText('Pão Brioche')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Renomear produto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Excluir produto ${mockProdutoComFicha.nome}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar quantidade de Carne de Hambúrguer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Carne de Hambúrguer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar Insumo/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(AVISO)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('ADMIN vê Renomear, Excluir produto, Editar quantidade, Remover e Adicionar (sem aviso)', async () => {
    abrirFicha(mockUsuarioAdmin);
    await screen.findByText('Carne de Hambúrguer');

    expect(screen.getByRole('button', { name: 'Renomear produto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Excluir produto ${mockProdutoComFicha.nome}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar quantidade de Carne de Hambúrguer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Carne de Hambúrguer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar Insumo/i })).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});

// ───────────────────────────── Preparo interno ─────────────────────────────

const oleo = { id: 'insumo-oleo', nome: 'Óleo de Soja', unidade: 'Mililitros', estoqueAtual: 1000, fatorPerda: 0, produzidoInternamente: false };
const subFicha = [
  { id: 'sub-1', insumoBeneficiadoId: mockInsumoBeneficiado.id, insumoBrutoId: oleo.id, quantidadeNecessaria: 0.6, insumoBruto: oleo },
];

function abrirPreparo(usuario: UsuarioAuth) {
  renderComProviders(<PreparoInterno insumoId={mockInsumoBeneficiado.id} onVoltar={vi.fn()} />, {
    usuario,
    verificarSessao: false,
    routes: {
      get: {
        '/insumos': [mockInsumoBeneficiado, oleo],
        [`/preparo-interno/sub-fichas/${mockInsumoBeneficiado.id}`]: subFicha,
      },
    },
  });
}

describe('somente leitura — Preparo interno', () => {
  it.each(NAO_ADMINS)('%s vê estoque e receita mas não vê Produzir, Editar, Remover nem Adicionar ingrediente', async (_papel, usuario) => {
    abrirPreparo(usuario);
    await screen.findByText('Óleo de Soja');
    expect(screen.getByText('Em estoque')).toBeInTheDocument();

    expect(screen.queryByLabelText('Quantidade a produzir')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Produzir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Óleo de Soja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Óleo de Soja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar ingrediente/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(AVISO)).toHaveLength(1);
  });

  it('ADMIN vê Produzir, Editar, Remover e Adicionar ingrediente (sem aviso)', async () => {
    abrirPreparo(mockUsuarioAdmin);
    await screen.findByText('Óleo de Soja');

    expect(screen.getByLabelText('Quantidade a produzir')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Produzir/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Óleo de Soja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Óleo de Soja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar ingrediente/ })).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});

// ───────────────────────────── Perdas ─────────────────────────────

function abrirPerdas(usuario: UsuarioAuth, post: Record<string, unknown> = {}) {
  renderComProviders(<Perdas />, {
    usuario,
    verificarSessao: false,
    routes: {
      get: {
        '/insumos': mockListaInsumos,
        '/perdas': mockListaPerdas,
        '/perdas/resumo-mensal': mockResumoMensalPerdas,
      },
      post,
    },
  });
}

describe('somente leitura — Perdas', () => {
  it.each(NAO_ADMINS)('%s vê o resumo do mês e os últimos registros, sem busca, quantidade nem botões de motivo', async (_papel, usuario) => {
    abrirPerdas(usuario);
    await screen.findByText('Neste mês');
    await screen.findByText('Últimos registros');
    expect(await screen.findByText(/Estragado •/)).toBeInTheDocument();

    expect(screen.queryByLabelText('Buscar insumo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Quantidade')).not.toBeInTheDocument();
    for (const motivo of ['Vencimento', 'Erro de preparo', 'Estragado', 'Outro']) {
      expect(screen.queryByRole('button', { name: motivo })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Registrar perda' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Perdas' })).toBeInTheDocument();
    expect(screen.getAllByText(AVISO)).toHaveLength(1);
    // A lista de insumos só serve para registrar: não é buscada
    expect(api.get).not.toHaveBeenCalledWith('/insumos');
  });

  it('ADMIN vê busca, quantidade e os botões de motivo (sem aviso)', async () => {
    abrirPerdas(mockUsuarioAdmin);
    await screen.findByText('Neste mês');

    expect(screen.getByLabelText('Buscar insumo')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade')).toBeInTheDocument();
    for (const motivo of ['Vencimento', 'Erro de preparo', 'Estragado', 'Outro']) {
      expect(screen.getByRole('button', { name: motivo })).toBeInTheDocument();
    }
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it('403 do backend (papel mudou durante a sessão) aparece no toast com a mensagem do backend', async () => {
    abrirPerdas(mockUsuarioAdmin, {
      '/perdas': { status: 403, data: { message: 'Acesso negado: privilégios insuficientes' } },
    });
    await screen.findByText('Neste mês');
    fireEvent.click(screen.getByRole('button', { name: 'Carne de Hambúrguer' }));
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '10' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Estragado' }));
    });
    expect(await screen.findByText('Acesso negado: privilégios insuficientes')).toBeInTheDocument();
  });
});

// ───────────────────────────── Fechamentos do dia ─────────────────────────────

const listaFechamentos = {
  data: '2026-11-13',
  total: 1,
  fechamentos: [
    {
      id: 'v1', externalId: 'manual:a', criadoEm: '2026-11-13T22:41:00.000Z', ocorridoEm: '2026-11-13T16:00:00.000Z',
      observacao: 'Turno noite', itens: [{ nome: 'BACON HOUSE', quantidade: 2 }],
      usuario: { id: 'u1', nome: 'Carlos Eduardo' }, estornada: false, estorno: null,
    },
  ],
};

function abrirFechamentos(usuario: UsuarioAuth) {
  renderComProviders(
    <FechamentosDoDia dados={listaFechamentos} carregando={false} erro={null} onTentarNovamente={vi.fn()} onAlterado={vi.fn()} />,
    { usuario, verificarSessao: false },
  );
}

describe('somente leitura — Lançamentos do dia (estorno)', () => {
  it.each(NAO_ADMINS)('%s vê o lançamento mas não vê "Desfazer"', (_papel, usuario) => {
    abrirFechamentos(usuario);
    expect(screen.getByText('2× BACON HOUSE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument();
  });

  it('ADMIN vê "Desfazer"', () => {
    abrirFechamentos(mockUsuarioAdmin);
    expect(screen.getByRole('button', { name: /Desfazer/ })).toBeInTheDocument();
  });
});

// ───────────────────────────── Perfil, senha e configurações ─────────────────────────────

describe('somente leitura — Perfil e troca de senha continuam liberados', () => {
  it('OPERADOR edita o próprio perfil e troca a própria senha (/auth/*)', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, {
      usuario: mockUsuarioOperador,
      verificarSessao: false,
      routes: {
        put: {
          '/auth/perfil': (_u: string, body?: unknown) => ({
            usuario: { ...mockUsuarioOperador, nome: (body as { nome: string }).nome },
          }),
          '/auth/senha': () => ({ message: 'Senha alterada com sucesso', token: 'novo-token' }),
        },
      },
    });

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Marcos Silva' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    });
    expect(api.put).toHaveBeenCalledWith('/auth/perfil', expect.objectContaining({ nome: 'Marcos Silva' }));

    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'atual123' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'nova12345' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Alterar senha' })[1]!);
    });
    expect(api.put).toHaveBeenCalledWith('/auth/senha', { senhaAtual: 'atual123', novaSenha: 'nova12345' });
    expect(await screen.findByText('Senha alterada')).toBeInTheDocument();
  });

  it('OPERADOR abre Configurações (tema e som) e não vê "Usuários"; ADMIN vê', () => {
    const { unmount } = renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />, {
      usuario: mockUsuarioOperador,
      verificarSessao: false,
    });
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuários/ })).not.toBeInTheDocument();
    unmount();

    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
    });
    expect(screen.getByRole('button', { name: /Usuários/ })).toBeInTheDocument();
  });
});

describe('somente leitura — aviso', () => {
  it('é uma nota neutra (role="note", não alerta), com tokens de design e sem cores literais', () => {
    renderComProviders(<AvisoSomenteLeitura />, { usuario: mockUsuarioOperador, verificarSessao: false });
    const nota = screen.getByRole('note');
    expect(nota).toHaveTextContent('Somente leitura: alterações são feitas pelo administrador.');
    expect(nota.className).toContain('text-muted');
    expect(nota.className).not.toMatch(/danger/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    esperarSemCoresLiterais('src/components/AvisoSomenteLeitura.tsx');
  });
});

// ───────────────────────────── Papel muda com a tela de ação aberta ─────────────────────────────

/**
 * Sessão em cache de ADMIN com o /auth/me segurado: ao liberar, ele devolve OPERADOR e o AuthContext
 * troca o usuário (como acontece no app quando o papel muda no meio da sessão).
 */
function authMeQueViraOperador() {
  let liberar!: () => void;
  const segurar = new Promise<void>((r) => {
    liberar = r;
  });
  const rota = () => segurar.then(() => ({ usuario: mockUsuarioOperador }));
  const virarOperador = () =>
    act(async () => {
      liberar();
      await new Promise((r) => setTimeout(r, 0));
    });
  return { rota, virarOperador };
}

describe('somente leitura — papel muda para OPERADOR com uma tela de ação aberta', () => {
  it.each([
    { tela: 'Importar NF-e', botao: { name: 'Importar NF-e' }, titulo: 'Entrada por nota fiscal' },
    { tela: 'Entrada sem nota', botao: { name: /Entrada sem nota/ }, titulo: 'Entrada manual' },
    { tela: 'Contagem', botao: { name: 'Contagem' }, titulo: 'Contagem de estoque' },
  ])('Estoque: ADMIN abre "$tela"; o papel vira OPERADOR e a tela some, voltando ao Estoque em leitura', async ({ botao, titulo }) => {
    const { rota, virarOperador } = authMeQueViraOperador();
    renderComProviders(<Estoque />, {
      usuario: mockUsuarioAdmin,
      routes: { get: { '/auth/me': rota, '/insumos': mockListaInsumos } },
    });
    await screen.findByText('Carne de Hambúrguer');

    fireEvent.click(screen.getByRole('button', botao));
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();

    await virarOperador();

    expect(screen.queryByRole('heading', { level: 1, name: titulo })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Estoque' })).toBeInTheDocument();
    expect(screen.getAllByText(AVISO)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: botao.name })).not.toBeInTheDocument();
  });

  it('Configurações (sem onAbrirUsuarios): ADMIN abre Usuários; o papel vira OPERADOR e a lista some', async () => {
    const { rota, virarOperador } = authMeQueViraOperador();
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      routes: { get: { '/auth/me': rota, '/usuarios': [] } },
    });

    fireEvent.click(screen.getByRole('button', { name: /Usuários/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument();

    await virarOperador();

    expect(screen.queryByRole('heading', { level: 1, name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuários/ })).not.toBeInTheDocument();
  });
});
