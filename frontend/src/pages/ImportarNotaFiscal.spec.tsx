import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import ImportarNotaFiscal from './ImportarNotaFiscal';
import { renderComProviders, criarErroAxios, type MockRoutes } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';

// Html5Qrcode controlado pelo teste: o callback de leitura fica exposto para simular quadros da câmera.
const camera = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  getCameras: vi.fn(),
  onSucesso: null as null | ((texto: string) => void),
}));

vi.mock('html5-qrcode', () => {
  class Html5Qrcode {
    isScanning = false;
    async start(_c: unknown, _cfg: unknown, sucesso: (t: string) => void) {
      await camera.start();
      this.isScanning = true;
      camera.onSucesso = sucesso;
    }
    async stop() {
      this.isScanning = false;
      camera.stop();
    }
    clear() {}
    async scanFile() {
      throw new Error('sem QR');
    }
    static getCameras() {
      return camera.getCameras();
    }
  }
  return { Html5Qrcode };
});

const insumos = [
  { id: 'i1', nome: 'Pão brioche', unidade: 'Unidades', estoqueAtual: 10, estoqueMinimo: 40, custoUnitario: 1.8, fatorPerda: 0 },
  { id: 'i2', nome: 'Cheddar fatiado', unidade: 'Gramas', estoqueAtual: 1500.5, estoqueMinimo: 500, custoUnitario: 0.05, fatorPerda: 0 },
];

const itemBase = {
  itemNumero: 1, codigo: 'A1', descricao: 'PAO BRIOCHE C/ GERGELIM 12UN', unidadeOriginal: 'CX', quantidadeOriginal: 10,
  valorUnitario: 21.6, valorTotal: 216, sugestaoInsumoId: 'i1', sugestaoInsumoNome: 'Pão brioche', sugestaoUnidadeInsumo: 'Unidades',
  fatorConversaoSugerido: 12, quantidadeConvertidaSugerida: 120, confiancaMatch: 95, motivoMatch: 'EXATO',
};

const nota = {
  chaveAcesso: '5'.repeat(44), numero: '48211', serie: '1', dataEmissao: '2026-11-08T12:00:00Z',
  fornecedor: { nome: 'Atacadão Campo Grande', cnpjCpf: '00000000000100' }, valorTotal: 216,
  itens: [itemBase],
};

const notaDoisItens = {
  ...nota,
  itens: [
    itemBase,
    {
      ...itemBase, itemNumero: 2, codigo: 'B2', descricao: 'QUEIJO CHEDDAR FAT 2KG', unidadeOriginal: 'KG', quantidadeOriginal: 2,
      valorUnitario: 40, valorTotal: 80, sugestaoInsumoId: 'i2', sugestaoInsumoNome: 'Cheddar fatiado', sugestaoUnidadeInsumo: 'Gramas',
      fatorConversaoSugerido: 1000, quantidadeConvertidaSugerida: 2000,
    },
  ],
};

const respostaConfirmar = { totalItensProcessados: 1, insumosAtualizados: [{ id: 'i1', nome: 'Pão brioche', adicionado: 120 }] };

function abrir(routes: MockRoutes = {}) {
  const onVoltar = vi.fn();
  const r = renderComProviders(<ImportarNotaFiscal onVoltar={onVoltar} />, {
    routes: {
      get: { '/insumos': insumos, ...(routes.get ?? {}) },
      post: {
        '/notas-fiscais/parser-qrcode': nota,
        '/notas-fiscais/confirmar': respostaConfirmar,
        ...(routes.post ?? {}),
      },
    },
  });
  return { onVoltar, ...r };
}

async function consultarChave(chave = nota.chaveAcesso) {
  fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
  fireEvent.change(screen.getByPlaceholderText(/44 dígitos/), { target: { value: chave } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); });
}

async function irParaRevisao(notaLida: unknown = nota, routes: MockRoutes = {}) {
  const r = abrir({ ...routes, post: { '/notas-fiscais/parser-qrcode': notaLida, ...(routes.post ?? {}) } });
  await act(async () => {}); // carga de /insumos
  await consultarChave();
  await screen.findByRole('heading', { name: 'Revisar itens' });
  return r;
}

function chamadasPost(url: string) {
  return vi.mocked(api.post).mock.calls.filter(([u]) => u === url);
}

function botaoConfirmar() {
  return screen.getByRole('button', { name: /Confirmar Entrada no Estoque/ });
}

describe('pages/ImportarNotaFiscal - fluxo em 3 passos (telas.html#nf1..nf3)', () => {
  it('começa no passo 1 (Ler)', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Entrada por nota fiscal' })).toBeInTheDocument();
    expect(screen.getByText('1. Ler').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('chave consultada leva ao passo 2 (Revisar) e confirmar leva ao 3 (Pronto) com o Smash', async () => {
    const { onVoltar } = abrir();
    await consultarChave();
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
    expect(screen.getByText('2. Revisar').closest('li')).toHaveAttribute('aria-current', 'step');

    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByRole('heading', { name: 'Estoque atualizado' })).toBeInTheDocument();
    expect(screen.getByText('3. Pronto').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('img', { name: /Smash/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it('usa só tokens de design', () => {
    esperarSemCoresLiterais('src/pages/ImportarNotaFiscal.tsx');
  });
});

describe('ImportarNotaFiscal - upload de XML', () => {
  function inputXml(container: HTMLElement) {
    return container.querySelector('input[accept=".xml"]') as HTMLInputElement;
  }

  it('XML corrompido: mostra a mensagem do backend (400) e continua no passo 1', async () => {
    const { container } = abrir({
      post: { '/notas-fiscais/parser-xml': { status: 400, data: { message: 'XML inválido: estrutura de NF-e não encontrada' } } },
    });
    const arquivo = new File(['<nfeProc><quebrado'], 'nota.xml', { type: 'text/xml' });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [arquivo] } }); });
    expect(await screen.findByText('XML inválido: estrutura de NF-e não encontrada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entrada por nota fiscal' })).toBeInTheDocument();
  });

  it('arquivo sem extensão .xml é recusado sem chamar o backend', async () => {
    const { container } = abrir();
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [arquivo] } }); });
    expect(await screen.findByText(/selecione um arquivo no formato \.xml/i)).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-xml')).toHaveLength(0);
  });

  it('XML acima de 500 KB (512.000 caracteres, docs/api.md §8) é recusado antes do envio', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': nota } });
    const arquivo = new File(['a'.repeat(512_001)], 'grande.xml', { type: 'text/xml' });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [arquivo] } }); });
    expect(await screen.findByText(/limite de 500 KB/)).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-xml')).toHaveLength(0);
  });

  it('XML de exatamente 512.000 caracteres é enviado (limite inclusivo do backend)', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': nota } });
    const arquivo = new File(['a'.repeat(512_000)], 'limite.xml', { type: 'text/xml' });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [arquivo] } }); });
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-xml')).toHaveLength(1);
  });

  it('zera o input depois da leitura, para o mesmo arquivo poder ser escolhido de novo após um erro', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': { status: 400, data: { message: 'XML inválido' } } } });
    const input = inputXml(container);
    const valores: string[] = [];
    Object.defineProperty(input, 'value', { configurable: true, get: () => 'C:\\fakepath\\nota.xml', set: (v: string) => valores.push(v) });
    const arquivo = new File(['<x/>'], 'nota.xml', { type: 'text/xml' });
    await act(async () => { fireEvent.change(input, { target: { files: [arquivo] } }); });
    expect(valores).toContain('');
  });
});

describe('ImportarNotaFiscal - QR code e SEFAZ', () => {
  it('SEFAZ indisponível/scraping vazio: mostra o aviso e permite a entrada manual pela chave', async () => {
    const fallback = {
      chaveAcesso: nota.chaveAcesso, sucessoScraping: false,
      mensagem: 'Chave de acesso extraída com sucesso! No entanto, a consulta automática na SEFAZ não retornou os itens.',
      fornecedor: { nome: 'Fornecedor da NFC-e', cnpjCpf: '' }, valorTotal: 0,
      dataEmissao: '2026-11-01T00:00:00.000Z', dataEmissaoAproximada: true, itens: [],
    };
    await irParaRevisao(fallback);
    expect(screen.getByText('Aviso da Consulta da SEFAZ')).toBeInTheDocument();
    expect(screen.getByText(/não retornou os itens/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Item/ }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'i1' } });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByRole('heading', { name: 'Estoque atualizado' })).toBeInTheDocument();
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect(corpo).toMatchObject({ chaveAcesso: nota.chaveAcesso, itens: [{ insumoId: 'i1', quantidade: 1 }] });
  });

  it('chave inválida (400 do backend): mostra a mensagem e fica no passo 1', async () => {
    abrir({ post: { '/notas-fiscais/parser-qrcode': { status: 400, data: { message: 'Não foi possível extrair uma chave válida de 44 dígitos' } } } });
    await consultarChave('123');
    expect(await screen.findByText(/chave válida de 44 dígitos/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entrada por nota fiscal' })).toBeInTheDocument();
  });

  it('timeout/queda de rede (sem resposta): avisa a falta de conexão e libera o botão', async () => {
    abrir({ post: { '/notas-fiscais/parser-qrcode': () => Promise.reject(Object.assign(new Error('timeout of 0ms exceeded'), { isAxiosError: true })) } });
    await consultarChave();
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeEnabled();
  });
});

describe('ImportarNotaFiscal - data de emissão', () => {
  it('mostra a data de emissão no resumo da nota (fuso da loja)', async () => {
    await irParaRevisao();
    expect(screen.getByText(/Emissão: 08\/11\/2026/)).toBeInTheDocument();
  });

  it('data aproximada pela chave (dataEmissaoAproximada) é sinalizada', async () => {
    await irParaRevisao({ ...nota, dataEmissao: '2026-11-01T12:00:00.000Z', dataEmissaoAproximada: true });
    expect(screen.getByText(/Emissão: 11\/2026 \(aproximada/)).toBeInTheDocument();
  });

  it('sem data de emissão: não inventa a data de hoje no envio', async () => {
    const { dataEmissao: _omitida, ...semData } = nota;
    void _omitida;
    await irParaRevisao(semData);
    expect(screen.getByText('Emissão não informada')).toBeInTheDocument();
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect((corpo as { dataEmissao?: string }).dataEmissao).toBeUndefined();
  });

  it('data de emissão inválida não é exibida nem enviada', async () => {
    await irParaRevisao({ ...nota, dataEmissao: '31/02/2026' });
    expect(screen.getByText('Emissão não informada')).toBeInTheDocument();
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect((corpo as { dataEmissao?: string }).dataEmissao).toBeUndefined();
  });
});

describe('ImportarNotaFiscal - fator de conversão (kg↔g, L↔ml, 1:1 com ajuste manual)', () => {
  function campoFator(valorAtual: string) {
    return screen.getByDisplayValue(valorAtual);
  }

  it('aceita vírgula decimal: "0,5" em 10 CX vira 5 unidades', async () => {
    await irParaRevisao();
    fireEvent.change(campoFator('12'), { target: { value: '0,5' } });
    expect(screen.getByText('+5 Unidades')).toBeInTheDocument();
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect((corpo as { itens: Array<{ quantidade: number }> }).itens[0]!.quantidade).toBe(5);
  });

  it('aceita ponto decimal: "0.25" em 10 CX vira 2,5 unidades', async () => {
    await irParaRevisao();
    fireEvent.change(campoFator('12'), { target: { value: '0.25' } });
    expect(screen.getByText('+2,5 Unidades')).toBeInTheDocument();
  });

  it.each([
    ['vazio', ''],
    ['zero', '0'],
    ['negativo', '-5'],
    ['texto', 'abc'],
    ['infinito (extremo)', '1e999'],
  ])('fator %s: mostra erro e bloqueia a confirmação (não vira 1 em silêncio)', async (_caso, valor) => {
    await irParaRevisao();
    fireEvent.change(campoFator('12'), { target: { value: valor } });
    expect(screen.getByText('Informe um fator maior que zero')).toBeInTheDocument();
    expect(botaoConfirmar()).toBeDisabled();
    fireEvent.click(botaoConfirmar());
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(0);
  });

  it('o campo guarda o que foi digitado (permite digitar "0," a caminho de "0,001")', async () => {
    await irParaRevisao();
    fireEvent.change(campoFator('12'), { target: { value: '0,' } });
    expect(campoFator('0,')).toBeInTheDocument();
    fireEvent.change(campoFator('0,'), { target: { value: '0,001' } });
    expect(campoFator('0,001')).toBeInTheDocument();
  });

  it('troca de vínculo recalcula a conversão canônica (KG → Gramas = 1000)', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, unidadeOriginal: 'KG', quantidadeOriginal: 2, sugestaoInsumoId: 'i1', fatorConversaoSugerido: 1 }] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'i2' } });
    expect(campoFator('1000')).toBeInTheDocument();
    expect(screen.getByText('+2.000 Gramas')).toBeInTheDocument();
  });

  it('conversão incerta pede confirmação antes de dar entrada 1:1', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, fatorConversaoSugerido: 1, conversaoIncerta: true }] });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText(/conversão 1:1 incerta/)).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(0);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar mesmo assim' })); });
    expect(await screen.findByRole('heading', { name: 'Estoque atualizado' })).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(1);
  });

  it('conversão incerta: cancelar o diálogo não envia nada', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, fatorConversaoSugerido: 1, conversaoIncerta: true }] });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Revisar' })); });
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
  });

  it('editar o fator resolve a incerteza (sem diálogo)', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, fatorConversaoSugerido: 1, conversaoIncerta: true }] });
    fireEvent.change(campoFator('1'), { target: { value: '12' } });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByRole('heading', { name: 'Estoque atualizado' })).toBeInTheDocument();
  });
});

describe('ImportarNotaFiscal - vínculo de itens com insumos', () => {
  it('item marcado sem vínculo bloqueia a confirmação com o motivo (telas.html#nf2)', async () => {
    await irParaRevisao({ ...nota, itens: [itemBase, { ...itemBase, itemNumero: 2, descricao: 'MOLHO BARBECUE GALAO 3,6L', sugestaoInsumoId: null, confiancaMatch: 0 }] });
    // O item sem sugestão começa desmarcado; o operador marca para incluir e esquece de vincular.
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    expect(screen.getByText('Vincule 1 item para continuar (ou ignore-o).')).toBeInTheDocument();
    expect(botaoConfirmar()).toBeDisabled();
    fireEvent.click(botaoConfirmar());
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(0);

    // Ignorar o item libera a confirmação só com o vinculado
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect((corpo as { itens: unknown[] }).itens).toHaveLength(1);
  });

  it('sugestão aponta para insumo excluído: trata como sem vínculo e não envia o id', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, sugestaoInsumoId: 'i-excluido', sugestaoInsumoNome: 'Insumo apagado' }] });
    expect(screen.getByText('Vincule 1 item para continuar (ou ignore-o).')).toBeInTheDocument();
    fireEvent.click(botaoConfirmar());
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(0);
  });

  it('conta só os itens vinculados no resumo', async () => {
    await irParaRevisao({ ...nota, itens: [itemBase, { ...itemBase, itemNumero: 2, sugestaoInsumoId: null, confiancaMatch: 0 }] });
    expect(screen.getByText('1 de 2 itens vinculados')).toBeInTheDocument();
  });

  it('item manual adicionado depois de remover outro não colide com um item existente', async () => {
    await irParaRevisao(notaDoisItens);
    const removerPrimeiro = screen.getAllByTitle('Remover item')[0]!;
    fireEvent.click(removerPrimeiro);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Item/ }));
    expect(screen.getAllByTitle('Remover item')).toHaveLength(2);
    // Remover o item manual não pode levar junto o item 2 da nota
    const botoes = screen.getAllByTitle('Remover item');
    fireEvent.click(botoes[botoes.length - 1]!);
    expect(screen.getAllByTitle('Remover item')).toHaveLength(1);
    expect(screen.getByDisplayValue('QUEIJO CHEDDAR FAT 2KG')).toBeInTheDocument();
  });

  it('falha ao carregar insumos: avisa e permite tentar de novo (antes ficava em silêncio)', async () => {
    let tentativas = 0;
    abrir({
      get: {
        '/insumos': () => {
          tentativas++;
          return tentativas === 1 ? Promise.reject(criarErroAxios(500, { message: 'Falha no banco' })) : insumos;
        },
      },
    });
    expect(await screen.findByText(/Não foi possível carregar os insumos/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); });
    await waitFor(() => expect(screen.queryByText(/Não foi possível carregar os insumos/)).not.toBeInTheDocument());
    expect(tentativas).toBe(2);
  });
});

describe('ImportarNotaFiscal - confirmação', () => {
  it('duplo clique em Confirmar envia uma vez só', async () => {
    let resolver: ((v: unknown) => void) | null = null;
    await irParaRevisao(nota, { post: { '/notas-fiscais/confirmar': () => new Promise((r) => { resolver = r; }) } });
    fireEvent.click(botaoConfirmar());
    fireEvent.click(screen.getByRole('button', { name: /Confirmando Entrada/ }));
    await waitFor(() => expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(1));
    await act(async () => { resolver?.(respostaConfirmar); });
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(1);
  });

  it('chave já importada (409): mostra a mensagem, fica na revisão e libera o botão', async () => {
    await irParaRevisao(nota, { post: { '/notas-fiscais/confirmar': { status: 409, data: { message: 'Nota fiscal já importada anteriormente' } } } });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText('Nota fiscal já importada anteriormente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
    expect(botaoConfirmar()).toBeEnabled();
  });

  it('"Nova Leitura" fica travada enquanto a confirmação está em andamento', async () => {
    let resolver: ((v: unknown) => void) | null = null;
    await irParaRevisao(nota, { post: { '/notas-fiscais/confirmar': () => new Promise((r) => { resolver = r; }) } });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(screen.getByRole('button', { name: /Nova Leitura/ })).toBeDisabled();
    await act(async () => { resolver?.(respostaConfirmar); });
  });

  it('tela final mostra a quantidade adicionada em pt-BR com a unidade do insumo', async () => {
    await irParaRevisao(notaDoisItens, {
      post: {
        '/notas-fiscais/confirmar': {
          totalItensProcessados: 2,
          insumosAtualizados: [
            { id: 'i1', nome: 'Pão brioche', adicionado: 120 },
            { id: 'i2', nome: 'Cheddar fatiado', adicionado: 0.1 + 0.2 + 1999.7 },
          ],
        },
      },
    });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    await screen.findByRole('heading', { name: 'Estoque atualizado' });
    expect(screen.getByText('+120 Unidades')).toBeInTheDocument();
    expect(screen.getByText('+2.000 Gramas')).toBeInTheDocument();
  });
});

describe('ImportarNotaFiscal - câmera', () => {
  const descritorSeguro = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const descritorMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  function contextoSeguro(seguro: boolean) {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: seguro });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  }

  beforeEach(() => {
    camera.start.mockReset().mockResolvedValue(undefined);
    camera.stop.mockReset();
    camera.getCameras.mockReset().mockResolvedValue([]);
    camera.onSucesso = null;
  });

  afterEach(() => {
    if (descritorSeguro) Object.defineProperty(window, 'isSecureContext', descritorSeguro);
    else delete (window as { isSecureContext?: boolean }).isSecureContext;
    if (descritorMedia) Object.defineProperty(navigator, 'mediaDevices', descritorMedia);
    else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it('sem HTTPS (contexto inseguro): abre a câmera nativa do aparelho pelo input de foto', async () => {
    contextoSeguro(false);
    const clique = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    expect(clique).toHaveBeenCalledTimes(1);
    expect(camera.start).not.toHaveBeenCalled();
  });

  it('câmera negada: avisa, fecha a área da câmera e oferece a foto', async () => {
    contextoSeguro(true);
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    camera.start.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    camera.getCameras.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    expect(await screen.findByText(/câmera nativa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir Câmera/ })).toBeInTheDocument();
  });

  it('vários quadros com o mesmo QR antes de a câmera parar consultam a SEFAZ uma vez só', async () => {
    contextoSeguro(true);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    await waitFor(() => expect(camera.onSucesso).not.toBeNull());
    await act(async () => {
      camera.onSucesso!(nota.chaveAcesso);
      camera.onSucesso!(nota.chaveAcesso);
      camera.onSucesso!(nota.chaveAcesso);
    });
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-qrcode')).toHaveLength(1);
  });

  it('sair da tela logo depois de abrir a câmera não deixa a câmera ligada', async () => {
    contextoSeguro(true);
    const { unmount } = abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    unmount();
    await new Promise((r) => setTimeout(r, 200));
    // Ou nem chegou a ligar, ou foi desligada logo em seguida
    const ligadas = camera.start.mock.calls.length;
    expect(camera.stop.mock.calls.length).toBeGreaterThanOrEqual(ligadas);
  });
});
