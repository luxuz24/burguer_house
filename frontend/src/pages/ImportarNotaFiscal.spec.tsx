import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, waitFor, within } from '@testing-library/react';
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
    async start(c: unknown, cfg: unknown, sucesso: (t: string) => void) {
      await camera.start(c, cfg);
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

const leituraFoto = vi.hoisted(() => ({ decodificar: vi.fn() }));
vi.mock('../lib/qrImagem', () => ({ decodificarQrDeArquivo: (f: File) => leituraFoto.decodificar(f) }));

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

describe('ImportarNotaFiscal - layout do passo 2 (telas.html#nf2)', () => {
  it('itens em lista: texto da nota, insumo vinculado e a conversão em chip', async () => {
    await irParaRevisao();
    const lista = screen.getByRole('list', { name: 'Itens da nota' });
    const [linha] = within(lista).getAllByRole('listitem');
    expect(within(linha!).getByDisplayValue('PAO BRIOCHE C/ GERGELIM 12UN')).toBeInTheDocument();
    expect(within(linha!).getByText('Pão brioche')).toBeInTheDocument();
    expect(within(linha!).getByText('1 CX = 12 Unidades')).toBeInTheDocument();
    expect(within(linha!).getByRole('combobox', { name: 'Trocar insumo vinculado' })).toBeInTheDocument();
  });

  it('item sem vínculo mostra "Escolher insumo" em destaque e vincular troca para o insumo escolhido', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, sugestaoInsumoId: null, confiancaMatch: 0 }] });
    fireEvent.click(screen.getByRole('checkbox', { name: /Incluir PAO BRIOCHE/ }));
    const escolher = screen.getByRole('combobox', { name: 'Escolher insumo' });
    expect(escolher.closest('label')).toHaveClass('border-primary');
    fireEvent.change(escolher, { target: { value: 'i1' } });
    expect(screen.queryByRole('combobox', { name: 'Escolher insumo' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Trocar insumo vinculado' })).toHaveValue('i1');
    expect(screen.getByText('1 de 1 itens vinculados')).toBeInTheDocument();
  });

  it('remover item tem nome acessível e alvo de toque de 44px', async () => {
    await irParaRevisao();
    expect(screen.getByRole('button', { name: 'Remover item' })).toHaveClass('min-h-[44px]', 'min-w-[44px]');
  });
});

describe('ImportarNotaFiscal - QR code por foto', () => {
  function inputFoto(container: HTMLElement) {
    return container.querySelector('input[accept="image/*"]') as HTMLInputElement;
  }

  beforeEach(() => {
    leituraFoto.decodificar.mockReset();
  });

  it('foto lida: bipa, consulta a chave e vai para a revisão', async () => {
    leituraFoto.decodificar.mockResolvedValue(`  ${nota.chaveAcesso}  `);
    const { container } = abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    const foto = new File(['jpg'], 'cupom.jpg', { type: 'image/jpeg' });
    await act(async () => { fireEvent.change(inputFoto(container), { target: { files: [foto] } }); });
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
    expect(leituraFoto.decodificar).toHaveBeenCalledWith(foto);
    expect(chamadasPost('/notas-fiscais/parser-qrcode')[0]![1]).toEqual({ urlOuChave: nota.chaveAcesso });
  });

  it('foto sem QR legível: avisa com a mensagem da leitura e libera os botões', async () => {
    leituraFoto.decodificar.mockRejectedValue(new Error('Não foi possível identificar um QR Code nítido na foto.'));
    const { container } = abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    await act(async () => {
      fireEvent.change(inputFoto(container), { target: { files: [new File(['x'], 'a.jpg')] } });
    });
    expect(await screen.findByText('Não foi possível identificar um QR Code nítido na foto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir Câmera/ })).toBeEnabled();
    expect(chamadasPost('/notas-fiscais/parser-qrcode')).toHaveLength(0);
  });

  it('falha que não é Error usa a mensagem padrão; cancelar a escolha não faz nada', async () => {
    leituraFoto.decodificar.mockRejectedValue('quebrou');
    const { container } = abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    await act(async () => { fireEvent.change(inputFoto(container), { target: { files: [] } }); });
    expect(leituraFoto.decodificar).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.change(inputFoto(container), { target: { files: [new File(['x'], 'a.jpg')] } });
    });
    expect(await screen.findByText('Não foi possível ler o QR Code da imagem.')).toBeInTheDocument();
  });

  it('o botão de foto abre o seletor de imagem', () => {
    const clique = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tirar Foto/ }));
    expect(clique).toHaveBeenCalledTimes(1);
  });
});

describe('ImportarNotaFiscal - resposta da SEFAZ incompleta', () => {
  it('campos ausentes viram padrões neutros (fornecedor genérico, R$ 0,00, sem itens) e o envio usa textos vazios', async () => {
    await irParaRevisao({ chaveAcesso: nota.chaveAcesso, sucessoScraping: false });
    expect(screen.getByText('Fornecedor da NFC-e')).toBeInTheDocument();
    expect(screen.getByText('Nota fiscal · 0 itens')).toBeInTheDocument();
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument();
    expect(screen.queryByText('Aviso da Consulta da SEFAZ')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Item/ }));
    expect(screen.getByDisplayValue('Item Manual')).toBeInTheDocument();
    expect(screen.getByText('Nota fiscal · 1 item')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Escolher insumo' }), { target: { value: 'i2' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    // UN → Gramas é incompatível: confirma a entrada 1:1 no diálogo
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Confirmar mesmo assim' })); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect(corpo).toMatchObject({
      numero: '', serie: '', fornecedorNome: 'Fornecedor da NFC-e', fornecedorCnpj: '', valorTotal: 0,
      itens: [{ insumoId: 'i2', descricaoOriginal: 'Item Manual', unidadeOriginal: 'UN', quantidadeOriginal: 1, quantidade: 1, valorTotal: 0 }],
    });
  });

  it('scraping com sucesso não mostra aviso mesmo com mensagem; o número e a série vão no envio', async () => {
    await irParaRevisao({ ...nota, sucessoScraping: true, mensagem: 'ok' });
    expect(screen.queryByText('Aviso da Consulta da SEFAZ')).not.toBeInTheDocument();
    expect(screen.getByText('NF-e 48211 · 1 item')).toBeInTheDocument();
    expect(screen.getByText('R$ 216,00')).toBeInTheDocument();
    expect(screen.getByText('CNPJ: 00000000000100')).toBeInTheDocument();
    expect(screen.getByText(`Chave: ${nota.chaveAcesso}`)).toBeInTheDocument();
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect(corpo).toMatchObject({
      chaveAcesso: nota.chaveAcesso, numero: '48211', serie: '1', fornecedorNome: 'Atacadão Campo Grande',
      fornecedorCnpj: '00000000000100', valorTotal: 216, dataEmissao: '2026-11-08T12:00:00Z',
      itens: [{ insumoId: 'i1', quantidade: 120, valorUnitario: 1.8, quantidadeOriginal: 10, valorTotal: 216, unidadeOriginal: 'CX' }],
    });
  });

  it('erro sem resposta HTTP de outro tipo usa a mensagem padrão da consulta', async () => {
    abrir({ post: { '/notas-fiscais/parser-qrcode': () => Promise.reject(new Error('falha interna')) } });
    await consultarChave(`  ${nota.chaveAcesso}  `);
    expect(await screen.findByText('Erro ao processar QR Code da NFC-e')).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-qrcode')[0]![1]).toEqual({ urlOuChave: nota.chaveAcesso });
  });

  async function lerXml(notaLida: unknown) {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': notaLida } });
    const input = container.querySelector('input[accept=".xml"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['<x/>'], 'n.xml')] } }); });
    await screen.findByRole('heading', { name: 'Revisar itens' });
  }

  it('XML: valor total ilegível e itens com erro de leitura são sinalizados; item com erro começa fora', async () => {
    await lerXml({
      ...nota, erroValorTotal: 'vNF ausente', totalItensComErro: 1,
      itens: [{ ...itemBase, erro: 'vProd inválido' }],
    });
    expect(screen.getByTitle('vNF ausente')).toBeInTheDocument();
    expect(screen.getByText('Ilegível')).toBeInTheDocument();
    expect(screen.getByText(/1 item com leitura inválida/)).toBeInTheDocument();
    expect(screen.getByText('Atenção: vProd inválido')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Incluir PAO BRIOCHE/ })).not.toBeChecked();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('plural de itens com erro de leitura', async () => {
    await lerXml({ ...nota, totalItensComErro: 2 });
    expect(screen.getByText(/2 itens com leitura inválida/)).toBeInTheDocument();
  });
});

describe('ImportarNotaFiscal - selos de reconhecimento', () => {
  it.each([
    ['HISTORICO', 100, 'Reconhecido pelo histórico anterior (100%)'],
    ['EXATO', 99, 'Nome idêntico (99%)'],
    ['SINONIMO', 80, 'Identificado por sinônimo (80%)'],
    ['SIMILARIDADE', 70, 'Identificado automaticamente (70%)'],
  ])('motivo %s com confiança %s', async (motivoMatch, confiancaMatch, texto) => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, motivoMatch, confiancaMatch }] });
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it('entre 35% e 69% pede conferência; abaixo de 35% não mostra selo', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, motivoMatch: 'SIMILARIDADE', confiancaMatch: 69 }, { ...itemBase, itemNumero: 2, confiancaMatch: 35 }, { ...itemBase, itemNumero: 3, confiancaMatch: 34 }] });
    expect(screen.getByText(/Sugestão aproximada \(69%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sugestão aproximada \(35%\)/)).toBeInTheDocument();
    expect(screen.queryByText(/\(34%\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Identificado automaticamente/)).not.toBeInTheDocument();
  });

  it('outras sugestões viram botões que trocam o vínculo e recalculam a conversão', async () => {
    await irParaRevisao({
      ...nota,
      itens: [{
        ...itemBase, unidadeOriginal: 'KG', quantidadeOriginal: 1, fatorConversaoSugerido: 1,
        outrasSugestoes: [{ insumoId: 'i2', insumoNome: 'Cheddar fatiado', unidade: 'Gramas', confianca: 60 }],
      }],
    });
    expect(screen.getByText('Encontramos semelhança também com:')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'Cheddar fatiado (60%)' });
    expect(chip).not.toHaveClass('bg-secondary');
    fireEvent.click(chip);
    expect(screen.getByRole('button', { name: 'Cheddar fatiado (60%)' })).toHaveClass('bg-secondary');
    expect(screen.getByRole('combobox', { name: 'Trocar insumo vinculado' })).toHaveValue('i2');
    expect(screen.getByText('1 KG = 1.000 Gramas')).toBeInTheDocument();
  });

  it('conversão incerta só aparece com insumo vinculado', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, conversaoIncerta: true }] });
    expect(screen.getByText(/Conversão 1:1 incerta para "CX"/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Trocar insumo vinculado' }), { target: { value: '' } });
    expect(screen.queryByText(/Conversão 1:1 incerta/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Escolher insumo' })).toBeInTheDocument();
  });
});

describe('ImportarNotaFiscal - edição dos itens', () => {
  it('editar a descrição muda só aquele item e vai no envio', async () => {
    await irParaRevisao(notaDoisItens);
    fireEvent.change(screen.getByDisplayValue('PAO BRIOCHE C/ GERGELIM 12UN'), { target: { value: 'Pão brioche cx 12' } });
    expect(screen.getByDisplayValue('QUEIJO CHEDDAR FAT 2KG')).toBeInTheDocument();
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    const [, corpo] = chamadasPost('/notas-fiscais/confirmar')[0]!;
    expect((corpo as { itens: Array<{ descricaoOriginal: string }> }).itens.map((i) => i.descricaoOriginal)).toEqual([
      'Pão brioche cx 12', 'QUEIJO CHEDDAR FAT 2KG',
    ]);
  });

  it('a quantidade da nota e o estoque atual aparecem em pt-BR', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, quantidadeOriginal: 1.5, unidadeOriginal: 'KG' }] });
    expect(screen.getByText('1,5 KG')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cheddar fatiado \(Gramas\) - Estoque atual: 1\.500,5/ })).toBeInTheDocument();
  });

  it('nenhum item marcado: confirmar avisa e não envia', async () => {
    await irParaRevisao();
    fireEvent.click(screen.getByRole('checkbox', { name: /Incluir PAO BRIOCHE/ }));
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText(/Selecione e vincule ao menos um item/)).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/confirmar')).toHaveLength(0);
  });

  it('dois itens com fator inválido usam o plural; dois sem vínculo também', async () => {
    await irParaRevisao(notaDoisItens);
    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '0' } });
    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '' } });
    expect(screen.getByText('Corrija o fator de conversão de 2 itens.')).toBeInTheDocument();
    for (const select of screen.getAllByRole('combobox', { name: 'Trocar insumo vinculado' })) {
      fireEvent.change(select, { target: { value: '' } });
    }
    expect(screen.getByText('Vincule 2 itens para continuar (ou ignore-os).')).toBeInTheDocument();
  });

  it('"Nova Leitura" volta ao passo 1 e limpa o aviso da SEFAZ', async () => {
    await irParaRevisao({ ...nota, sucessoScraping: false, mensagem: 'SEFAZ fora do ar' });
    expect(screen.getByText('SEFAZ fora do ar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Nova Leitura/ }));
    expect(screen.getByRole('heading', { name: 'Entrada por nota fiscal' })).toBeInTheDocument();
    expect(screen.queryByText('SEFAZ fora do ar')).not.toBeInTheDocument();
  });
});

describe('ImportarNotaFiscal - confirmação (mensagens)', () => {
  it('diálogo de conversão incerta lista os itens (plural) e o sucesso informa o total processado', async () => {
    await irParaRevisao(
      { ...nota, itens: [{ ...itemBase, conversaoIncerta: true }, { ...itemBase, itemNumero: 2, descricao: 'MOLHO', unidadeOriginal: 'GL', conversaoIncerta: true }] },
      { post: { '/notas-fiscais/confirmar': { totalItensProcessados: 2, insumosAtualizados: [] } } },
    );
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText('Conversão a conferir')).toBeInTheDocument();
    expect(screen.getByText(
      '2 itens estão com conversão 1:1 incerta (PAO BRIOCHE C/ GERGELIM 12UN em CX; MOLHO em GL). Confira o fator antes de dar entrada no estoque.',
    )).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar mesmo assim' })); });
    expect(await screen.findByText('2 itens da nota entraram no estoque.')).toBeInTheDocument();
    expect(screen.getByText('Entrada de nota fiscal confirmada com sucesso!')).toBeInTheDocument();
  });

  it('diálogo no singular', async () => {
    await irParaRevisao({ ...nota, itens: [{ ...itemBase, conversaoIncerta: true }] });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText(/^1 item está com conversão 1:1 incerta \(PAO BRIOCHE C\/ GERGELIM 12UN em CX\)/)).toBeInTheDocument();
  });

  it('resposta sem total processado mostra 0; erro de outro tipo usa a mensagem padrão', async () => {
    await irParaRevisao(nota, { post: { '/notas-fiscais/confirmar': () => Promise.reject(new Error('x')) } });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText('Erro ao confirmar entrada de estoque')).toBeInTheDocument();
  });

  it('resposta sem total processado mostra 0 itens e insumo desconhecido sem unidade', async () => {
    await irParaRevisao(nota, { post: { '/notas-fiscais/confirmar': { insumosAtualizados: [{ id: 'novo', nome: 'Outro', adicionado: 3 }] } } });
    await act(async () => { fireEvent.click(botaoConfirmar()); });
    expect(await screen.findByText('0 itens da nota entraram no estoque.')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
});

describe('ImportarNotaFiscal - XML (envio e mensagens)', () => {
  function inputXml(container: HTMLElement) {
    return container.querySelector('input[accept=".xml"]') as HTMLInputElement;
  }

  it('envia o conteúdo do arquivo e mapeia os itens lidos', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': notaDoisItens } });
    await act(async () => {
      fireEvent.change(inputXml(container), { target: { files: [new File(['<nfeProc/>'], 'NOTA.XML')] } });
    });
    expect(await screen.findByText('2 de 2 itens vinculados')).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-xml')[0]![1]).toEqual({ xml: '<nfeProc/>' });
  });

  it('arquivo de bytes acima de 4x o limite é recusado sem ser lido', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': nota } });
    const arquivo = new File(['x'], 'enorme.xml');
    Object.defineProperty(arquivo, 'size', { value: 512_000 * 4 + 1 });
    const ler = vi.spyOn(arquivo, 'text');
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [arquivo] } }); });
    expect(await screen.findByText(/limite de 500 KB/)).toBeInTheDocument();
    expect(ler).not.toHaveBeenCalled();
  });

  it('arquivo de exatamente 4x o limite em bytes ainda é lido (pode ter até 512.000 caracteres)', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': nota } });
    const arquivo = new File(['<x/>'], 'acentos.xml');
    Object.defineProperty(arquivo, 'size', { value: 512_000 * 4 });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [arquivo] } }); });
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
  });

  it('erro de outro tipo usa a mensagem padrão; o botão volta a "Procurar Arquivo"; cancelar a escolha não faz nada', async () => {
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': () => Promise.reject(new Error('x')) } });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [] } }); });
    expect(chamadasPost('/notas-fiscais/parser-xml')).toHaveLength(0);
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [new File(['<x/>'], 'n.xml')] } }); });
    expect(await screen.findByText('Erro ao processar o arquivo XML da nota fiscal')).toBeInTheDocument();
    expect(screen.getByText('Procurar Arquivo')).toBeInTheDocument();
    expect(inputXml(container)).toBeEnabled();
  });

  it('enquanto lê o XML mostra "Lendo XML..." e trava o input', async () => {
    let resolver: ((v: unknown) => void) | null = null;
    const { container } = abrir({ post: { '/notas-fiscais/parser-xml': () => new Promise((r) => { resolver = r; }) } });
    await act(async () => { fireEvent.change(inputXml(container), { target: { files: [new File(['<x/>'], 'n.xml')] } }); });
    expect(screen.getByText('Lendo XML...')).toBeInTheDocument();
    expect(inputXml(container)).toBeDisabled();
    await act(async () => { resolver?.(nota); });
  });
});

describe('ImportarNotaFiscal - câmera (fluxos alternativos)', () => {
  const descritorSeguro = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const descritorMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
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

  async function abrirCamera() {
    const r = abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    return r;
  }

  it('abre a câmera traseira com o quadro de leitura de 250 px e fecha pelo botão', async () => {
    await abrirCamera();
    await waitFor(() => expect(camera.start).toHaveBeenCalledTimes(1));
    expect(camera.start).toHaveBeenCalledWith({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fechar Câmera' })); });
    expect(camera.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Abrir Câmera/ })).toBeInTheDocument();
  });

  it('sem facingMode, escolhe a câmera traseira pelo rótulo', async () => {
    camera.start.mockRejectedValueOnce(new Error('OverconstrainedError'));
    camera.getCameras.mockResolvedValue([{ id: 'frente', label: 'Front camera' }, { id: 'tras', label: 'Back camera' }, { id: 'ultima', label: 'Wide' }]);
    await abrirCamera();
    await waitFor(() => expect(camera.start).toHaveBeenCalledTimes(2));
    expect(camera.start.mock.calls[1]![0]).toBe('tras');
  });

  it('sem rótulo reconhecível, usa a última câmera da lista', async () => {
    camera.start.mockRejectedValueOnce(new Error('OverconstrainedError'));
    camera.getCameras.mockResolvedValue([{ id: 'a', label: 'Lente A' }, { id: 'b', label: 'Lente B' }]);
    await abrirCamera();
    await waitFor(() => expect(camera.start).toHaveBeenCalledTimes(2));
    expect(camera.start.mock.calls[1]![0]).toBe('b');
  });

  it('nenhuma câmera encontrada: volta para o botão e abre a câmera nativa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const clique = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    camera.start.mockRejectedValueOnce(new Error('NotFoundError'));
    camera.getCameras.mockResolvedValue([]);
    await abrirCamera();
    expect(await screen.findByText(/Abrindo câmera nativa/)).toBeInTheDocument();
    expect(clique).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Abrir Câmera/ })).toBeInTheDocument();
  });

  it('texto vazio lido pela câmera avisa em vez de consultar', async () => {
    await abrirCamera();
    await waitFor(() => expect(camera.onSucesso).not.toBeNull());
    await act(async () => { camera.onSucesso!('   '); });
    expect(await screen.findByText(/Informe a URL do QR Code ou a Chave de Acesso/)).toBeInTheDocument();
    expect(chamadasPost('/notas-fiscais/parser-qrcode')).toHaveLength(0);
  });

  it('nova abertura da câmera aceita uma nova leitura', async () => {
    await abrirCamera();
    await waitFor(() => expect(camera.onSucesso).not.toBeNull());
    await act(async () => { camera.onSucesso!('   '); });
    await screen.findByText(/Informe a URL do QR Code/);
    camera.onSucesso = null;
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    await waitFor(() => expect(camera.onSucesso).not.toBeNull());
    await act(async () => { camera.onSucesso!(nota.chaveAcesso); });
    expect(await screen.findByRole('heading', { name: 'Revisar itens' })).toBeInTheDocument();
  });

  it('trocar para XML com a câmera aberta desliga a câmera', async () => {
    await abrirCamera();
    await waitFor(() => expect(camera.start).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Upload de XML/ })); });
    expect(camera.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Selecione o arquivo XML da NF-e')).toBeInTheDocument();
  });

  it('sair da tela com a câmera ligada desliga a câmera', async () => {
    const { unmount } = await abrirCamera();
    await waitFor(() => expect(camera.start).toHaveBeenCalledTimes(1));
    unmount();
    expect(camera.stop).toHaveBeenCalledTimes(1);
  });

  it('start que termina depois de sair da tela desliga a câmera em seguida', async () => {
    let liberar: (() => void) | null = null;
    camera.start.mockImplementation(() => new Promise<void>((r) => { liberar = r; }));
    const { unmount } = await abrirCamera();
    await waitFor(() => expect(liberar).not.toBeNull());
    unmount();
    await act(async () => { liberar!(); });
    await waitFor(() => expect(camera.stop).toHaveBeenCalledTimes(1));
  });

  it('sem getUserMedia (navegador antigo) também usa a câmera nativa', () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    const clique = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Scanner QR Code/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir Câmera/ }));
    expect(clique).toHaveBeenCalledTimes(1);
    expect(camera.start).not.toHaveBeenCalled();
  });
});
