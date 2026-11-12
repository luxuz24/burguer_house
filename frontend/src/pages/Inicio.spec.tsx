import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import Inicio from './Inicio';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { mockUsuarioAdmin } from '../test/fixtures/auth.fixture';
import { api } from '../lib/api';

// O humor do Smash e o ícone de cada alerta são informação (não só enfeite): ficam observáveis no teste
vi.mock('../components/brand/Smash', () => ({
  default: ({ mood }: { mood?: string }) => <span data-testid="smash" data-humor={mood} />,
}));
vi.mock('../components/ui/icons', async (importOriginal) => {
  const original = await importOriginal<typeof import('../components/ui/icons')>();
  const icone = (nome: string) => () => <span data-icone={nome} />;
  return { ...original, Thermometer: icone('vencido'), Clock: icone('vencendo'), TrendDown: icone('estoque') };
});

const kpis = {
  totalVendasValor: 1284.5, totalVendasQtd: 48, totalComprasValor: 612.3, totalComprasQtd: 2,
  totalPerdasValor: 38.4, totalPerdasQtd: 3, insumosEmAlertaQtd: 2,
};
const alertas = [
  { id: 'a1', nome: 'Molho da casa', unidade: 'Mililitros', estoqueAtual: 900, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: 180, vencido: true },
  { id: 'a2', nome: 'Pão brioche', unidade: 'Unidades', estoqueAtual: 12, estoqueMinimo: 40, status: 'ALERTA', percentualEstoque: 30 },
];
const resumo = (estoqueAlerta = alertas) => ({
  kpis, estoqueAlerta, itensMaisVendidos: [{ produtoNome: 'X-Bacon', quantidadeVendida: 18 }, { produtoNome: 'X-Salada', quantidadeVendida: 9 }],
});

function abrir(
  dados: unknown = resumo(),
  extra: Partial<Parameters<typeof Inicio>[0]> = {},
  opcoes: Parameters<typeof renderComProviders>[1] = {},
) {
  const props = { onNavegar: vi.fn(), onAbrirImportarNota: vi.fn(), onAbrirPerfil: vi.fn(), onAbrirConfiguracoes: vi.fn(), ...extra };
  const resultado = renderComProviders(<Inicio {...props} />, { routes: { get: { '/dashboard/resumo': dados } }, ...opcoes });
  return { ...props, ...resultado };
}

describe('pages/Inicio - tela inicial do esboço (telas.html#inicio)', () => {
  it('cumprimenta pelo primeiro nome e abre Perfil e Configurações (o cabeçalho global saiu)', async () => {
    const props = abrir();
    expect(await screen.findByRole('heading', { name: /, Carlos$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    fireEvent.click(screen.getByRole('button', { name: /^Perfil de / }));
    expect(props.onAbrirConfiguracoes).toHaveBeenCalledTimes(1);
    expect(props.onAbrirPerfil).toHaveBeenCalledTimes(1);
  });

  it('o Smash resume os alertas e cada alerta tem a ação certa', async () => {
    const props = abrir();
    expect(await screen.findByText('2 insumos pedem atenção.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Registrar perda', { selector: 'button' }));
    expect(props.onNavegar).toHaveBeenCalledWith('perdas');
    fireEvent.click(screen.getByText('Comprar', { selector: 'button' }));
    expect(props.onAbrirImportarNota).toHaveBeenCalledTimes(1);
  });

  it('insumo vencendo com estoque folgado mostra o prazo e leva ao estoque, não manda comprar', async () => {
    // Formato do backend (dashboard.service.ts): diasRestantesValidade só vem quando a validade é o motivo do alerta
    const vencendo = { id: 'v1', nome: 'Queijo cheddar', unidade: 'Gramas', estoqueAtual: 4000, estoqueMinimo: 1000, status: 'ALERTA', percentualEstoque: 400, diasRestantesValidade: 2, vencido: false };
    const props = abrir(resumo([vencendo] as typeof alertas));
    expect(await screen.findByText('Vence em 2 dias · 4.000 Gramas')).toBeInTheDocument();
    expect(screen.queryByText('Comprar', { selector: 'button' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver Queijo cheddar no estoque' }));
    expect(props.onNavegar).toHaveBeenCalledWith('estoque');
    expect(props.onAbrirImportarNota).not.toHaveBeenCalled();
  });

  it('sem alertas mostra que está tudo em dia', async () => {
    abrir(resumo([]));
    expect(await screen.findByText('Tudo em dia. Bom serviço!')).toBeInTheDocument();
    expect(screen.getByText('Nenhum insumo abaixo do mínimo ou vencido.')).toBeInTheDocument();
  });

  it('se o resumo falhar, avisa e oferece tentar de novo (antes ficava vazio, só com console.error)', async () => {
    abrir({ status: 503, data: { message: 'Servidor acordando' } });
    expect(await screen.findByText('Não consegui carregar o resumo de hoje.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('mostra os mais vendidos do dia', async () => {
    abrir();
    expect(await screen.findByText('X-Bacon')).toBeInTheDocument();
    expect(screen.getByText('X-Salada')).toBeInTheDocument();
  });

  describe('endurecimento F4', () => {
    const estoqueBaixo = (id: string, nome: string, percentual: number) => ({
      id, nome, unidade: 'Unidades', estoqueAtual: percentual, estoqueMinimo: 100, status: 'CRITICO', percentualEstoque: percentual,
    });

    it('#I1 erro de carga mostra a mensagem do backend (ex.: 403 do RBAC), não só o texto genérico', async () => {
      abrir({ status: 403, data: { message: 'Seu perfil não tem acesso ao resumo.' } });
      expect(await screen.findByText('Seu perfil não tem acesso ao resumo.')).toBeInTheDocument();
    });

    it('#I2/#I3 "Tentar novamente" e os botões de ação dos alertas têm alvo de 44px', async () => {
      abrir({ status: 503, data: { message: 'Servidor acordando' } });
      const tentar = await screen.findByRole('button', { name: 'Tentar novamente' });
      expect(tentar.className).toContain('min-h-[44px]');
    });

    it('#I3 botões de ação por alerta têm alvo de 44px', async () => {
      abrir();
      await screen.findByText('2 insumos pedem atenção.');
      for (const nome of [/^Registrar perda de /, /^Comprar /]) {
        expect(screen.getByRole('button', { name: nome }).className).toContain('min-h-[44px]');
      }
    });

    it('#I22 o nome acessível do botão de ação diz qual insumo', async () => {
      const props = abrir();
      fireEvent.click(await screen.findByRole('button', { name: 'Registrar perda de Molho da casa' }));
      expect(props.onNavegar).toHaveBeenCalledWith('perdas');
      fireEvent.click(screen.getByRole('button', { name: 'Comprar Pão brioche' }));
      expect(props.onAbrirImportarNota).toHaveBeenCalledTimes(1);
    });

    it('#I19 vencido aparece entre os 3 primeiros mesmo vindo depois de 3 itens de estoque crítico', async () => {
      // O backend ordena CRITICO por percentualEstoque: o vencido com 180% vem por último
      const lista = [
        estoqueBaixo('e1', 'Alface', 10), estoqueBaixo('e2', 'Tomate', 20), estoqueBaixo('e3', 'Cebola', 30),
        { id: 'v1', nome: 'Molho da casa', unidade: 'Mililitros', estoqueAtual: 900, estoqueMinimo: 500, status: 'CRITICO', percentualEstoque: 180, diasRestantesValidade: -1, vencido: true },
      ];
      abrir(resumo(lista as typeof alertas));
      expect(await screen.findByText('4 insumos pedem atenção.')).toBeInTheDocument();
      expect(screen.getByText('Molho da casa')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrar perda de Molho da casa' })).toBeInTheDocument();
      // ordem: vencido primeiro, depois os de estoque na ordem do backend
      const nomes = screen.getAllByRole('button', { name: /^(Registrar perda de|Comprar|Ver) .+/ })
        .map((botao) => botao.getAttribute('aria-label'))
        .filter(Boolean);
      expect(nomes).toEqual(['Registrar perda de Molho da casa', 'Comprar Alface', 'Comprar Tomate']);
    });

    it('#I4 validade vencida sem a flag "vencido" (dias <= 0) é tratada como vencida, como no backend', async () => {
      const item = { id: 'x', nome: 'Maionese', unidade: 'Gramas', estoqueAtual: 300, estoqueMinimo: 100, status: 'CRITICO', percentualEstoque: 300, diasRestantesValidade: 0 };
      abrir(resumo([item] as typeof alertas));
      expect(await screen.findByText('Vencido · 300 Gramas')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrar perda de Maionese' })).toBeInTheDocument();
    });

    it('#I4 diasRestantesValidade null conta como ausente (alerta de estoque, não "Vence hoje")', async () => {
      const item = { id: 'x', nome: 'Pão', unidade: 'Unidades', estoqueAtual: 5, estoqueMinimo: 40, status: 'CRITICO', percentualEstoque: 12.5, diasRestantesValidade: null, vencido: null };
      abrir(resumo([item] as unknown as typeof alertas));
      expect(await screen.findByText('5 Unidades · mín. 40 Unidades')).toBeInTheDocument();
      expect(screen.queryByText(/Vence hoje/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Comprar Pão' })).toBeInTheDocument();
    });

    it('#I6 pedidos em pt-BR e no singular quando é 1', async () => {
      abrir({ ...resumo(), kpis: { ...kpis, totalVendasQtd: 1206 } });
      expect(await screen.findByText('1.206 pedidos')).toBeInTheDocument();
    });

    it('#I6 1 pedido no singular; zero pedidos no plural', async () => {
      abrir({ ...resumo([]), kpis: { ...kpis, totalVendasQtd: 1 } });
      expect(await screen.findByText('1 pedido')).toBeInTheDocument();
    });

    it('#I6 dia sem vendas: "0 pedidos" e compras R$ 0,00', async () => {
      abrir({ ...resumo([]), kpis: { ...kpis, totalVendasQtd: 0, totalVendasValor: 0, totalComprasValor: 0, totalPerdasValor: 7 } });
      expect(await screen.findByText('0 pedidos')).toBeInTheDocument();
      expect(screen.getByText('Compras').nextElementSibling).toHaveTextContent(/R\$\s*0,00/);
      expect(screen.getByText('Perdas').nextElementSibling).toHaveTextContent(/R\$\s*7,00/);
    });

    it('#I5 quantidade dos mais vendidos em pt-BR', async () => {
      abrir({ ...resumo(), itensMaisVendidos: [{ produtoNome: 'X-Tudo', quantidadeVendida: 1500 }] });
      expect(await screen.findByText('1.500')).toBeInTheDocument();
    });

    it('#I9 resposta 200 malformada (ex.: index.html do proxy) não derruba a tela', async () => {
      abrir('<!doctype html><html></html>');
      expect(await screen.findByText('Não consegui carregar o resumo de hoje.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    });

    it('#I9 kpis ausente mostra "—" sem quebrar e ainda mostra os alertas', async () => {
      abrir({ estoqueAlerta: alertas, itensMaisVendidos: [] });
      expect(await screen.findByText('2 insumos pedem atenção.')).toBeInTheDocument();
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  describe('cenários da matriz (mutação)', () => {
    const humor = () => screen.getByTestId('smash').getAttribute('data-humor');
    const linhaDoAlerta = (nome: string) => screen.getByText(nome).closest('.border-t') as HTMLElement;
    const larguraDaBarra = (produto: string) =>
      (screen.getByText(produto).parentElement!.querySelector('[style]') as HTMLElement).style.width;

    it('enquanto carrega, o Smash avisa e os valores ficam em "—"', async () => {
      abrir();
      expect(screen.getByText('Carregando o resumo de hoje…')).toBeInTheDocument();
      await screen.findByText('2 insumos pedem atenção.');
    });

    it('saudação sem nome é só a saudação', async () => {
      abrir(resumo(), {}, { usuario: { ...mockUsuarioAdmin, nome: '' } });
      const titulo = await screen.findByRole('heading', { level: 1 });
      expect(titulo.textContent).toMatch(/^(Bom dia|Boa tarde|Boa noite)$/);
    });

    it('sem kpis, cada valor do card de vendas mostra "—"', async () => {
      abrir({ estoqueAlerta: [], itensMaisVendidos: [] });
      await screen.findByText('Tudo em dia. Bom serviço!');
      expect(screen.getByText('Compras').nextElementSibling).toHaveTextContent(/^—$/);
      expect(screen.getByText('Perdas').nextElementSibling).toHaveTextContent(/^—$/);
      expect(screen.getByText('Vendas hoje').nextElementSibling).toHaveTextContent(/^—$/);
      expect(screen.getByText('Vendas hoje').closest('div')!.parentElement!.querySelector('p')).toHaveTextContent(/^—$/);
    });

    it('com alertas, o aviso de "nenhum insumo" não aparece', async () => {
      abrir();
      await screen.findByText('2 insumos pedem atenção.');
      expect(screen.queryByText('Nenhum insumo abaixo do mínimo ou vencido.')).not.toBeInTheDocument();
    });

    it('busca o resumo de hoje', async () => {
      abrir();
      await screen.findByText('2 insumos pedem atenção.');
      expect(api.get).toHaveBeenCalledWith('/dashboard/resumo', { params: { periodo: 'hoje' } });
    });

    it('iniciais do avatar e nome acessível do Perfil', async () => {
      abrir();
      expect(await screen.findByRole('button', { name: 'Perfil de Carlos Eduardo' })).toHaveTextContent('CE');
    });

    it('usuário sem nome: avatar "O", "Perfil de usuário" e saudação sem vírgula', async () => {
      const semNome = { ...mockUsuarioAdmin, nome: undefined as unknown as string };
      abrir(resumo(), {}, { usuario: semNome });
      expect(await screen.findByRole('button', { name: 'Perfil de usuário' })).toHaveTextContent(/^O$/);
      expect(screen.getByRole('heading', { level: 1 }).textContent).not.toContain(',');
    });

    it('nome com espaços sobrando usa as duas primeiras palavras', async () => {
      abrir(resumo(), {}, { usuario: { ...mockUsuarioAdmin, nome: '  ana  maria souza ' } });
      expect(await screen.findByRole('button', { name: /^Perfil de / })).toHaveTextContent(/^AM$/);
    });

    it('humor do Smash: carregando, com alerta, tudo em dia, erro', async () => {
      abrir();
      expect(humor()).toBe('idle');
      await screen.findByText('2 insumos pedem atenção.');
      expect(humor()).toBe('alert');
    });

    it('humor feliz sem alertas e alerta no erro', async () => {
      abrir(resumo([]));
      await screen.findByText('Tudo em dia. Bom serviço!');
      expect(humor()).toBe('happy');
    });

    it('humor de alerta quando a carga falha, mesmo sem alertas', async () => {
      abrir({ status: 500, data: { message: 'Falhou' } });
      await screen.findByText('Falhou');
      expect(humor()).toBe('alert');
      // Nenhuma seção que depende dos dados aparece no erro
      expect(screen.queryByText('Pedem atenção')).not.toBeInTheDocument();
      expect(screen.queryByText('Nenhum insumo abaixo do mínimo ou vencido.')).not.toBeInTheDocument();
      expect(screen.queryByText('Mais vendidos hoje')).not.toBeInTheDocument();
    });

    it('1 alerta no singular', async () => {
      abrir(resumo([alertas[1]]));
      expect(await screen.findByText('1 insumo pede atenção.')).toBeInTheDocument();
    });

    it('sem alertas, a seção "Pedem atenção" não aparece', async () => {
      abrir(resumo([]));
      await screen.findByText('Tudo em dia. Bom serviço!');
      expect(screen.queryByText('Pedem atenção')).not.toBeInTheDocument();
    });

    it('sem vendas, a seção "Mais vendidos hoje" não aparece', async () => {
      abrir({ ...resumo(), itensMaisVendidos: [] });
      await screen.findByText('2 insumos pedem atenção.');
      expect(screen.queryByText('Mais vendidos hoje')).not.toBeInTheDocument();
    });

    it('ícone e cor de cada tipo de alerta', async () => {
      const vencendo = { id: 'v1', nome: 'Queijo cheddar', unidade: 'Gramas', estoqueAtual: 4000, estoqueMinimo: 1000, status: 'ALERTA', percentualEstoque: 400, diasRestantesValidade: 2, vencido: false };
      abrir(resumo([...alertas, vencendo] as typeof alertas));
      await screen.findByText('3 insumos pedem atenção.');
      const casos: Array<[string, string, string, string]> = [
        ['Molho da casa', 'vencido', 'text-danger', 'bg-danger-soft'],
        ['Queijo cheddar', 'vencendo', 'text-brand', 'bg-primary-soft'],
        ['Pão brioche', 'estoque', 'text-muted', 'bg-primary-soft'],
      ];
      for (const [nome, icone, corTexto, fundoIcone] of casos) {
        const linha = linhaDoAlerta(nome);
        const marcador = linha.querySelector('[data-icone]') as HTMLElement;
        expect(marcador.getAttribute('data-icone')).toBe(icone);
        expect(marcador.parentElement!.className).toContain(fundoIcone);
        expect(screen.getByText(nome).nextElementSibling!.className).toContain(corTexto);
      }
    });

    it('mostra só os 3 primeiros alertas e os 3 mais vendidos, numerados', async () => {
      const quatro = ['A', 'B', 'C', 'D'].map((n, i) => ({ ...alertas[1], id: n, nome: `Insumo ${n}`, percentualEstoque: i }));
      abrir({
        ...resumo(quatro as typeof alertas),
        itensMaisVendidos: [
          { produtoNome: 'P1', quantidadeVendida: 40 }, { produtoNome: 'P2', quantidadeVendida: 20 },
          { produtoNome: 'P3', quantidadeVendida: 10 }, { produtoNome: 'P4', quantidadeVendida: 5 },
        ],
      });
      expect(await screen.findByText('Insumo C')).toBeInTheDocument();
      expect(screen.queryByText('Insumo D')).not.toBeInTheDocument();
      expect(screen.queryByText('P4')).not.toBeInTheDocument();
      expect(screen.getByText('P1').previousElementSibling).toHaveTextContent(/^1$/);
      expect(screen.getByText('P3').previousElementSibling).toHaveTextContent(/^3$/);
      expect(larguraDaBarra('P1')).toBe('100%');
      expect(larguraDaBarra('P2')).toBe('50%');
      expect(larguraDaBarra('P3')).toBe('25%');
    });

    it('barra dos mais vendidos com quantidade fracionária usa 1 como piso do máximo', async () => {
      abrir({ ...resumo(), itensMaisVendidos: [{ produtoNome: 'Meia porção', quantidadeVendida: 0.5 }] });
      await screen.findByText('Meia porção');
      expect(larguraDaBarra('Meia porção')).toBe('50%');
    });

    it('kpis que não é objeto mostra "—" (não "— pedidos")', async () => {
      abrir({ ...resumo(), kpis: 'quebrado' });
      await screen.findByText('2 insumos pedem atenção.');
      expect(screen.queryByText(/pedidos?$/)).not.toBeInTheDocument();
    });

    it('resposta malformada mostra também a mensagem padrão da carga', async () => {
      abrir('<!doctype html>');
      expect(await screen.findByText('Não foi possível carregar o resumo de hoje.')).toBeInTheDocument();
    });

    it('resposta null também é erro de carga', async () => {
      abrir(null);
      expect(await screen.findByText('Não foi possível carregar o resumo de hoje.')).toBeInTheDocument();
    });

    it('atalhos: Registrar perda grande vai para Perdas e "Ver estoque" vai para o Estoque', async () => {
      const props = abrir();
      await screen.findByText('2 insumos pedem atenção.');
      fireEvent.click(screen.getByRole('button', { name: /Baixa com 1 toque/ }));
      expect(props.onNavegar).toHaveBeenLastCalledWith('perdas');
      fireEvent.click(screen.getByRole('button', { name: /Importar NF/ }));
      expect(props.onAbrirImportarNota).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Ver estoque' }));
      expect(props.onNavegar).toHaveBeenLastCalledWith('estoque');
    });

    it('"Tentar novamente" refaz a busca e mostra os dados', async () => {
      let tentativas = 0;
      abrir(() => (++tentativas === 1 ? { status: 503, data: { message: 'Servidor acordando' } } : resumo()));
      fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
      expect(await screen.findByText('2 insumos pedem atenção.')).toBeInTheDocument();
      expect(screen.queryByText('Servidor acordando')).not.toBeInTheDocument();
    });
  });

  describe('virada da meia-noite e faixas de saudação (tarefa 04)', () => {
    it('às 23:59:30 monta com data atual; ao avançar 60s vira para dia seguinte e refaz busca do resumo', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      // 23:59:30 em Campo Grande (-04:00) = 2026-11-13T03:59:30.000Z
      vi.setSystemTime(new Date('2026-11-13T03:59:30.000Z'));
      const buscarResumo = vi.fn().mockImplementation(() => ({ status: 200, data: resumo() }));

      abrir(buscarResumo);
      expect(screen.getByText('Quinta, 12 de novembro')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Boa noite/ })).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      // Avança 60 segundos atravessando a meia-noite da loja
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(screen.getByText('Sexta, 13 de novembro')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Bom dia/ })).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('desmonte antes da virada cancela o timer e não dispara novas buscas', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date('2026-11-13T03:59:30.000Z'));
      const buscarResumo = vi.fn().mockImplementation(() => ({ status: 200, data: resumo() }));

      const { unmount } = abrir(buscarResumo);
      expect(screen.getByText('Quinta, 12 de novembro')).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('quando o fuso do ambiente é diferente de Campo Grande (ex: UTC), a virada segue o horário da loja', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      // 02:00 UTC do dia 13 = 22:00 em Campo Grande no dia 12
      vi.setSystemTime(new Date('2026-11-13T02:00:00.000Z'));
      const buscarResumo = vi.fn().mockImplementation(() => ({ status: 200, data: resumo() }));

      abrir(buscarResumo);
      // Ainda é dia 12 na loja
      expect(screen.getByText('Quinta, 12 de novembro')).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      // Avança 1h59m (ainda falta 1 minuto para a meia-noite em Campo Grande)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(119 * 60_000);
      });
      expect(screen.getByText('Quinta, 12 de novembro')).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      // Avança mais 2 minutos (virando a meia-noite da loja)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60_000);
      });
      expect(screen.getByText('Sexta, 13 de novembro')).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('transição de faixa de saudação durante o dia (ex: 11:59 -> 12:00) muda a saudação sem refazer busca', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      // 11:59:30 em Campo Grande (-04:00) = 15:59:30 UTC
      vi.setSystemTime(new Date('2026-11-12T15:59:30.000Z'));
      const buscarResumo = vi.fn().mockImplementation(() => ({ status: 200, data: resumo() }));

      abrir(buscarResumo);
      expect(screen.getByRole('heading', { name: /^Bom dia/ })).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      // Avança 60 segundos até 12:00:30
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(screen.getByRole('heading', { name: /^Boa tarde/ })).toBeInTheDocument();
      // A busca NÃO foi refeita (não virou o dia)
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('se a busca na virada falhar, exibe o tratamento de erro do F4 e permite tentar novamente', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date('2026-11-13T03:59:30.000Z'));
      let chamadas = 0;
      const buscarResumo = vi.fn().mockImplementation(() => {
        chamadas++;
        if (chamadas === 1) return { status: 200, data: resumo() };
        if (chamadas === 2) return { status: 503, data: { message: 'Serviço temporariamente indisponível' } };
        return { status: 200, data: resumo([]) };
      });

      abrir(buscarResumo);
      expect(screen.getByText('Quinta, 12 de novembro')).toBeInTheDocument();
      await act(async () => {});
      expect(screen.getByText('2 insumos pedem atenção.')).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(1);

      // Vira a meia-noite da loja com falha de rede/backend
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(screen.getByText('Sexta, 13 de novembro')).toBeInTheDocument();
      expect(screen.getByText('Serviço temporariamente indisponível')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
      expect(buscarResumo).toHaveBeenCalledTimes(2);

      // Usuário clica em "Tentar novamente" com serviço restaurado
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      });

      expect(buscarResumo).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Tudo em dia. Bom serviço!')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('ao voltar para a aba em primeiro plano via visibilitychange, sincroniza imediatamente o dia e refaz busca', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      // 23:50 em Campo Grande no dia 12 = 03:50 UTC dia 13
      vi.setSystemTime(new Date('2026-11-13T03:50:00.000Z'));
      const buscarResumo = vi.fn().mockImplementation(() => ({ status: 200, data: resumo() }));

      try {
        abrir(buscarResumo);
        expect(screen.getByText('Quinta, 12 de novembro')).toBeInTheDocument();
        expect(buscarResumo).toHaveBeenCalledTimes(1);

        // Simula tablet que hibernou durante a virada e acorda às 08:00 do dia 13 (12:00 UTC)
        vi.setSystemTime(new Date('2026-11-13T12:00:00.000Z'));
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });

        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(screen.getByText('Sexta, 13 de novembro')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /^Bom dia/ })).toBeInTheDocument();
        expect(buscarResumo).toHaveBeenCalledTimes(2);
      } finally {
        delete (document as { visibilityState?: string }).visibilityState;
        vi.useRealTimers();
      }
    });
  });

  it('usa só tokens de design (Inicio e App)', () => {
    esperarSemCoresLiterais('src/pages/Inicio.tsx');
    esperarSemCoresLiterais('src/App.tsx');
  });
});
