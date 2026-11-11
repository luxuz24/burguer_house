import { describe, it, expect } from 'vitest';
import {
  LIMITE_XML_CARACTERES,
  dataEmissaoValida,
  estaVinculado,
  formatarFator,
  mapearItensIniciais,
  montarItensParaSalvar,
  parsearFator,
  pendenciasDaConfirmacao,
  proximoItemNumero,
  textoDataEmissao,
  textoPendencias,
  type ItemMapeado,
  type ItemNFeExtraido,
} from './notaFiscal';

const ids = new Set(['i1', 'i2']);

function item(parcial: Partial<ItemMapeado> = {}): ItemMapeado {
  return {
    itemNumero: 1,
    descricao: 'PAO BRIOCHE',
    unidadeOriginal: 'CX',
    quantidadeOriginal: 10,
    valorUnitario: 21.6,
    incluir: true,
    insumoId: 'i1',
    fatorConversao: 12,
    fatorTexto: '12',
    ...parcial,
  };
}

describe('lib/notaFiscal - limite do XML', () => {
  it('espelha o backend: 512.000 caracteres (docs/api.md §8)', () => {
    expect(LIMITE_XML_CARACTERES).toBe(512_000);
  });
});

describe('parsearFator / formatarFator', () => {
  it.each([
    ['12', 12],
    ['0,5', 0.5],
    ['0.25', 0.25],
    [' 1000 ', 1000],
    ['0,001', 0.001],
    ['1e3', 1000],
  ])('"%s" → %s', (texto, esperado) => {
    expect(parsearFator(texto)).toBe(esperado);
  });

  it.each(['', '   ', '0', '0,0', '-1', '-0,5', 'abc', '1,5,0', '1e999', 'Infinity'])('"%s" é inválido', (texto) => {
    expect(parsearFator(texto)).toBeNull();
  });

  it('formata com vírgula decimal e volta ao mesmo número', () => {
    expect(formatarFator(0.001)).toBe('0,001');
    expect(formatarFator(1000)).toBe('1000');
    expect(parsearFator(formatarFator(0.001))).toBe(0.001);
  });
});

describe('mapearItensIniciais', () => {
  const extraido: ItemNFeExtraido = {
    itemNumero: 3, codigo: 'X', descricao: 'QUEIJO', unidadeOriginal: 'G', quantidadeOriginal: 500, valorUnitario: 0.05,
    valorTotal: 25, sugestaoInsumoId: 'i2', sugestaoInsumoNome: 'Queijo', sugestaoUnidadeInsumo: 'KG',
    fatorConversaoSugerido: 0.001, quantidadeConvertidaSugerida: 0.5, conversaoIncerta: false,
  };

  it('inclui itens com sugestão e sem erro, com o fator sugerido em texto pt-BR', () => {
    expect(mapearItensIniciais([extraido])[0]).toMatchObject({
      itemNumero: 3, incluir: true, insumoId: 'i2', fatorConversao: 0.001, fatorTexto: '0,001', conversaoIncerta: false,
    });
  });

  it('item com erro de leitura ou sem sugestão começa desmarcado; fator 0 vira 1', () => {
    const [comErro, semSugestao] = mapearItensIniciais([
      { ...extraido, erro: 'vProd inválido' },
      { ...extraido, sugestaoInsumoId: null, fatorConversaoSugerido: 0 },
    ]);
    expect(comErro).toMatchObject({ incluir: false, erro: 'vProd inválido' });
    expect(semSugestao).toMatchObject({ incluir: false, insumoId: '', fatorConversao: 1, fatorTexto: '1' });
  });
});

describe('vínculo e pendências da confirmação', () => {
  it('estaVinculado exige id existente na lista de insumos', () => {
    expect(estaVinculado(item(), ids)).toBe(true);
    expect(estaVinculado(item({ insumoId: '' }), ids)).toBe(false);
    expect(estaVinculado(item({ insumoId: 'excluido' }), ids)).toBe(false);
  });

  it('separa sem vínculo, fator inválido e conversão incerta, só entre os itens incluídos', () => {
    const p = pendenciasDaConfirmacao(
      [
        item({ itemNumero: 1 }),
        item({ itemNumero: 2, insumoId: '' }),
        item({ itemNumero: 3, insumoId: 'excluido' }),
        item({ itemNumero: 4, fatorConversao: Number.NaN }),
        item({ itemNumero: 5, fatorConversao: -2 }),
        item({ itemNumero: 6, conversaoIncerta: true }),
        item({ itemNumero: 7, insumoId: '', incluir: false }),
        item({ itemNumero: 8, fatorConversao: 0, incluir: false }),
        item({ itemNumero: 9, insumoId: '', fatorConversao: Number.NaN, conversaoIncerta: true }),
      ],
      ids,
    );
    expect(p.semVinculo.map((i) => i.itemNumero)).toEqual([2, 3, 9]);
    expect(p.fatorInvalido.map((i) => i.itemNumero)).toEqual([4, 5]);
    expect(p.conversaoIncerta.map((i) => i.itemNumero)).toEqual([6]);
  });

  it('textos no singular e no plural; nada pendente → lista vazia', () => {
    const vazio = { semVinculo: [], fatorInvalido: [], conversaoIncerta: [] };
    expect(textoPendencias(vazio)).toEqual([]);
    expect(textoPendencias({ ...vazio, semVinculo: [item()] })).toEqual(['Vincule 1 item para continuar (ou ignore-o).']);
    expect(textoPendencias({ ...vazio, semVinculo: [item(), item()] })).toEqual(['Vincule 2 itens para continuar (ou ignore-os).']);
    expect(textoPendencias({ ...vazio, fatorInvalido: [item()] })).toEqual(['Corrija o fator de conversão de 1 item.']);
    expect(textoPendencias({ ...vazio, fatorInvalido: [item(), item(), item()] })).toEqual([
      'Corrija o fator de conversão de 3 itens.',
    ]);
    // Incerteza não bloqueia (vira diálogo de confirmação)
    expect(textoPendencias({ ...vazio, conversaoIncerta: [item()] })).toEqual([]);
  });
});

describe('montarItensParaSalvar', () => {
  it('converte quantidade e custo pelo fator e mantém os dados originais da nota', () => {
    expect(montarItensParaSalvar([item()], ids)).toEqual([
      {
        insumoId: 'i1', quantidade: 120, valorUnitario: 1.8, descricaoOriginal: 'PAO BRIOCHE',
        unidadeOriginal: 'CX', quantidadeOriginal: 10, valorTotal: 216,
      },
    ]);
  });

  it('ignora itens desmarcados, sem vínculo, com insumo excluído ou quantidade não positiva', () => {
    const r = montarItensParaSalvar(
      [
        item({ incluir: false }),
        item({ insumoId: '' }),
        item({ insumoId: 'excluido' }),
        item({ fatorConversao: Number.NaN }),
        item({ fatorConversao: 0 }),
        item({ quantidadeOriginal: 0 }),
        item({ itemNumero: 2, insumoId: 'i2', fatorConversao: 1000, quantidadeOriginal: 2, valorUnitario: 40 }),
      ],
      ids,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ insumoId: 'i2', quantidade: 2000, valorUnitario: 0.04, valorTotal: 80 });
  });
});

describe('data de emissão', () => {
  it('aceita ISO com hora ou só data; recusa o resto', () => {
    expect(dataEmissaoValida('2026-11-08T12:00:00Z')).toBe('2026-11-08T12:00:00Z');
    expect(dataEmissaoValida('2026-10-10T14:30:00-04:00')).toBe('2026-10-10T14:30:00-04:00');
    expect(dataEmissaoValida(' 2026-10-10 ')).toBe('2026-10-10');
    expect(dataEmissaoValida('31/02/2026')).toBeUndefined();
    expect(dataEmissaoValida('02/03/2026')).toBeUndefined(); // seria lido como 3 de fevereiro (formato EUA)
    expect(dataEmissaoValida('2026-13-01')).toBeUndefined();
    expect(dataEmissaoValida('2026-11-08T99:00')).toBeUndefined();
    expect(dataEmissaoValida('')).toBeUndefined();
    expect(dataEmissaoValida(null)).toBeUndefined();
    expect(dataEmissaoValida(undefined)).toBeUndefined();
  });

  it('mostra no fuso da loja (America/Campo_Grande)', () => {
    expect(textoDataEmissao('2026-11-08T12:00:00Z')).toBe('Emissão: 08/11/2026');
    // 02h UTC ainda é dia 31/10 em Campo Grande (UTC-4)
    expect(textoDataEmissao('2026-11-01T02:00:00Z')).toBe('Emissão: 31/10/2026');
  });

  it('só data (NF-e dEmi) é o dia civil, sem deslocar pelo fuso', () => {
    expect(textoDataEmissao('2026-10-10')).toBe('Emissão: 10/10/2026');
  });

  it('aproximada pela chave mostra só mês/ano; inválida ou ausente diz que não foi informada', () => {
    expect(textoDataEmissao('2026-11-01T12:00:00.000Z', true)).toBe('Emissão: 11/2026 (aproximada pela chave de acesso)');
    expect(textoDataEmissao('abc')).toBe('Emissão não informada');
    expect(textoDataEmissao(undefined, true)).toBe('Emissão não informada');
  });
});

describe('proximoItemNumero', () => {
  it('lista vazia começa em 1; depois de remoções usa o maior + 1', () => {
    expect(proximoItemNumero([])).toBe(1);
    expect(proximoItemNumero([item({ itemNumero: 2 }), item({ itemNumero: 3 })])).toBe(4);
    expect(proximoItemNumero([item({ itemNumero: 7 }), item({ itemNumero: 2 })])).toBe(8);
  });
});
