import { describe, it, expect } from 'vitest';
import { XmlParserService, type InsumoBasico } from './xml_parser.service.js';

// Vínculo automático de item da nota ao insumo (encontrarMelhorMatch). Com histórico pré-carregado não há
// consulta ao banco, então estes testes rodam sem banco.
// Caso real (18/11/2026, catálogo da loja): "PAO BRIOCHE HAMBURGUER" (60 UN) ia para a Carne de Hambúrguer.

const service = new XmlParserService();
const semHistorico = () => new Map<string, InsumoBasico>();

const carne: InsumoBasico = { id: 'carne', nome: 'Carne de Hambúrguer', unidade: 'Gramas' };
const pao: InsumoBasico = { id: 'pao', nome: 'Pão Brioche', unidade: 'Unidade' };
const carneSeca: InsumoBasico = { id: 'carne-seca', nome: 'Carne seca com requeijão - Beneficiado', unidade: 'Gramas' };
// Ordem alfabética, como vem do banco: "Carne" antes de "Pão".
const catalogo = [carne, carneSeca, pao];

describe('vínculo automático do item da nota ao insumo', () => {
  it('"PAO BRIOCHE HAMBURGUER" vai para o Pão Brioche, não para a Carne de Hambúrguer', async () => {
    const r = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', catalogo, semHistorico(), 'UN');
    expect(r.insumoNome).toBe('Pão Brioche');
    expect(r.motivo).toBe('SIMILARIDADE');
    expect(r.confianca).toBe(95); // a confiança exibida continua limitada a 95
    expect(r.outrasSugestoes.map((s) => s.insumoNome)).toContain('Carne de Hambúrguer');
  });

  it('sem a unidade da nota (chamada antiga) o nome inteiro casando ainda vence', async () => {
    const r = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', catalogo, semHistorico());
    expect(r.insumoNome).toBe('Pão Brioche');
  });

  it('empate de pontuação: vence o insumo com unidade compatível com a da nota', async () => {
    const fatias: InsumoBasico = { id: 'fatias', nome: 'Bacon Fatias', unidade: 'Unidade' };
    const cubos: InsumoBasico = { id: 'cubos', nome: 'Bacon Cubos', unidade: 'Gramas' };
    // Os dois casam só "bacon" (1 de 2 palavras). Nota em KG → o de Gramas, mesmo vindo depois na lista.
    const emKg = await service.encontrarMelhorMatch('BACON KG', [fatias, cubos], semHistorico(), 'KG');
    expect(emKg.insumoNome).toBe('Bacon Cubos');
    const emUn = await service.encontrarMelhorMatch('BACON', [cubos, fatias], semHistorico(), 'UN');
    expect(emUn.insumoNome).toBe('Bacon Fatias');
  });

  it('histórico errado com unidade incompatível não se repete: sugere o candidato compatível e mantém o antigo como opção', async () => {
    const historico = new Map([['pao brioche hamburguer', carne]]);
    const r = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', catalogo, historico, 'UN');
    expect(r.insumoNome).toBe('Pão Brioche');
    expect(r.motivo).not.toBe('HISTORICO');
    expect(r.confianca).toBeLessThan(100);
    expect(r.outrasSugestoes[0]?.insumoNome).toBe('Carne de Hambúrguer');
  });

  it('histórico com unidade compatível continua valendo 100%', async () => {
    const historico = new Map([['bld carne bov moida esp', carne]]);
    // Espaços em volta da descrição não atrapalham a busca no histórico.
    const r = await service.encontrarMelhorMatch('  BLD CARNE BOV MOIDA ESP  ', catalogo, historico, 'KG');
    expect(r).toEqual({ insumoId: 'carne', insumoNome: 'Carne de Hambúrguer', unidade: 'Gramas', confianca: 100, motivo: 'HISTORICO', outrasSugestoes: [] });
  });

  it('histórico com unidade incompatível sem alternativa compatível é mantido (ligação feita de propósito)', async () => {
    const frango: InsumoBasico = { id: 'frango', nome: 'Frango Empanado', unidade: 'Unidade' };
    // A loja compra frango por KG e controla em unidades: ligou de propósito, com fator manual.
    const historico = new Map([['frango empanado cong', frango]]);
    const r = await service.encontrarMelhorMatch('FRANGO EMPANADO CONG', [carne, frango, pao], historico, 'KG');
    expect(r).toMatchObject({ insumoNome: 'Frango Empanado', confianca: 100, motivo: 'HISTORICO' });
  });

  it('unidade desconhecida na nota (CX, PCT, FD) não muda a escolha nem descarta o histórico', async () => {
    const coca: InsumoBasico = { id: 'coca', nome: 'Coca Cola Original 350ml', unidade: 'Unidade' };
    const historico = new Map([['refrig coca lata cx12', coca]]);
    const r = await service.encontrarMelhorMatch('REFRIG COCA LATA CX12', [coca, pao], historico, 'CX');
    expect(r).toMatchObject({ insumoNome: 'Coca Cola Original 350ml', motivo: 'HISTORICO', confianca: 100 });
  });

  describe('regras do ranking', () => {
    it('nome exato da descrição: motivo EXATO com 99, sem outras sugestões', async () => {
      const r = await service.encontrarMelhorMatch('pão brioche', catalogo, semHistorico(), 'UN');
      expect(r).toEqual({ insumoId: 'pao', insumoNome: 'Pão Brioche', unidade: 'Unidade', confianca: 99, motivo: 'EXATO', outrasSugestoes: [] });
    });

    it('nenhum candidato: devolve vazio com motivo NENHUM', async () => {
      const r = await service.encontrarMelhorMatch('DETERGENTE NEUTRO', catalogo, semHistorico(), 'UN');
      expect(r).toEqual({ insumoId: null, insumoNome: null, unidade: null, confianca: 0, motivo: 'NENHUM', outrasSugestoes: [] });
    });

    it('abaixo de 35 pontos não vincula (1 de 3 palavras = 33)', async () => {
      const empanar: InsumoBasico = { id: 'emp', nome: 'Queijo Mussarela para empanamento', unidade: 'Gramas' };
      const r = await service.encontrarMelhorMatch('QUEIJO PRATO', [empanar], semHistorico(), 'KG');
      expect(r.motivo).toBe('NENHUM');
      expect(r.insumoId).toBeNull();
    });

    it('só por sinônimo: motivo SINONIMO, sem o bônus de nome inteiro (2 sinônimos × 0,9 = 90)', async () => {
      const r = await service.encontrarMelhorMatch('HAMB 160', [pao, carne], semHistorico(), 'KG');
      expect(r).toMatchObject({ insumoNome: 'Carne de Hambúrguer', motivo: 'SINONIMO', confianca: 90 });
    });

    it('parte da palavra conta 0,8 e o nome inteiro ganha +15 com teto de 95 na confiança exibida', async () => {
      const manjericao: InsumoBasico = { id: 'manj', nome: 'Manjericão', unidade: 'Gramas' };
      const parcial = await service.encontrarMelhorMatch('MANJERICAOFRESCO', [manjericao], semHistorico(), 'KG');
      expect(parcial).toMatchObject({ insumoNome: 'Manjericão', confianca: 80, motivo: 'SIMILARIDADE' });
      const inteiro = await service.encontrarMelhorMatch('MANJERICAO FRESCO', [manjericao], semHistorico(), 'KG');
      expect(inteiro.confianca).toBe(95); // 100 + 15, exibido com teto de 95
    });

    it('outras sugestões: até 3, sem repetir a escolhida, em ordem de pontuação', async () => {
      const cebolas: InsumoBasico[] = ['Cebola Roxa', 'Cebola branca', 'Cebola Caramelizada', 'Cebola Crispy', 'Cebola em Conserva'].map(
        (nome, i) => ({ id: `c${i}`, nome, unidade: 'Gramas' }),
      );
      const r = await service.encontrarMelhorMatch('CEBOLA ROXA KG', cebolas, semHistorico(), 'KG');
      expect(r.insumoNome).toBe('Cebola Roxa');
      expect(r.outrasSugestoes).toHaveLength(3);
      expect(r.outrasSugestoes.map((o) => o.insumoNome)).not.toContain('Cebola Roxa');
      expect(r.outrasSugestoes.map((o) => o.confianca)).toEqual([50, 50, 50]); // "cebola" casa 1 de 2 palavras
    });

    it('histórico incompatível trocado pelo compatível: o do histórico vem primeiro, com a pontuação dele, e no máximo 3 opções', async () => {
      const extras: InsumoBasico[] = ['Pão de Hambúrguer Australiano', 'Pão Francês', 'Pão de Forma'].map((nome, i) => ({
        id: `p${i}`, nome, unidade: 'Unidade',
      }));
      const historico = new Map([['pao brioche hamburguer', carne]]);
      const r = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', [...catalogo, ...extras], historico, 'UN');
      expect(r.insumoNome).toBe('Pão Brioche');
      expect(r.outrasSugestoes).toHaveLength(3);
      expect(r.outrasSugestoes[0]).toEqual({ insumoId: 'carne', insumoNome: 'Carne de Hambúrguer', unidade: 'Gramas', confianca: 95 });
      const nomes = r.outrasSugestoes.map((o) => o.insumoNome);
      expect(nomes).not.toContain('Pão Brioche');
      expect(new Set(nomes).size).toBe(3);
    });

    it('histórico incompatível sem nenhum candidato pelos tokens aparece com confiança 0 na lista', async () => {
      const queijo: InsumoBasico = { id: 'queijo', nome: 'Queijo Cheddar Fatia', unidade: 'Gramas' };
      const historico = new Map([['pao brioche hamburguer', queijo]]);
      const r = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', [queijo, pao], historico, 'UN');
      expect(r.insumoNome).toBe('Pão Brioche');
      expect(r.outrasSugestoes[0]).toMatchObject({ insumoNome: 'Queijo Cheddar Fatia', confianca: 0 });
    });

    it('candidato compatível fraco (abaixo de 35) não derruba o histórico; as outras opções não repetem o histórico', async () => {
      const paoDeQueijo: InsumoBasico = { id: 'pq', nome: 'Pão de queijo mineiro', unidade: 'Gramas' };
      const frango: InsumoBasico = { id: 'frango', nome: 'Frango Empanado', unidade: 'Unidade' };
      const frangoDesfiado: InsumoBasico = { id: 'fd', nome: 'Frango Desfiado', unidade: 'Unidade' };
      const historico = new Map([['pao frango empanado', frango]]);
      // Nota em KG: o histórico (Unidade) é incompatível. "Pão de queijo mineiro" é compatível (Gramas), mas casa
      // só "pao" (33 < 35); "Frango Desfiado" casa mais, porém é Unidade. Fica o histórico, com as opções listadas.
      const r = await service.encontrarMelhorMatch('PAO FRANGO EMPANADO', [paoDeQueijo, frango, frangoDesfiado], historico, 'KG');
      expect(r).toMatchObject({ insumoNome: 'Frango Empanado', motivo: 'HISTORICO', confianca: 100 });
      const nomes = r.outrasSugestoes.map((o) => o.insumoNome);
      expect(nomes).toEqual(['Frango Desfiado', 'Pão de queijo mineiro']);
    });

    it('outras sugestões só trazem insumos que casaram alguma palavra', async () => {
      const detergente: InsumoBasico = { id: 'det', nome: 'Detergente Neutro', unidade: 'Unidade' };
      const r = await service.encontrarMelhorMatch('PAO BRIOCHE HAMBURGUER', [...catalogo, detergente], semHistorico(), 'UN');
      // "Carne seca" casa "carne" por sinônimo (23) e aparece; o detergente não casa nada e fica de fora.
      expect(r.outrasSugestoes.map((o) => [o.insumoNome, o.confianca])).toEqual([
        ['Carne de Hambúrguer', 95],
        ['Carne seca com requeijão - Beneficiado', 23],
      ]);
    });

    it('palavra literal + sinônimo é SIMILARIDADE, não SINONIMO', async () => {
      const r = await service.encontrarMelhorMatch('HAMBURGUER BOVINO', [carne], semHistorico(), 'KG');
      expect(r).toMatchObject({ insumoNome: 'Carne de Hambúrguer', motivo: 'SIMILARIDADE', confianca: 95 });
    });

    it('parte da palavra vale contra qualquer palavra da descrição, não precisa de todas', async () => {
      const manjericao: InsumoBasico = { id: 'manj', nome: 'Manjericão', unidade: 'Gramas' };
      const r = await service.encontrarMelhorMatch('MANJERICAOFRESCO MACO', [manjericao], semHistorico(), 'KG');
      expect(r).toMatchObject({ insumoNome: 'Manjericão', confianca: 80 });
    });

    it('histórico mantido (sem compatível): no máximo 3 outras opções', async () => {
      const frango: InsumoBasico = { id: 'frango', nome: 'Frango Empanado', unidade: 'Unidade' };
      const outros: InsumoBasico[] = ['Frango Desfiado', 'Frango Inteiro', 'Frango Coxa', 'Frango Asa'].map((nome, i) => ({
        id: `f${i}`, nome, unidade: 'Unidade',
      }));
      const historico = new Map([['frango empanado cong', frango]]);
      const r = await service.encontrarMelhorMatch('FRANGO EMPANADO CONG', [frango, ...outros], historico, 'KG');
      expect(r.insumoNome).toBe('Frango Empanado');
      expect(r.outrasSugestoes).toHaveLength(3);
    });
  });
});
