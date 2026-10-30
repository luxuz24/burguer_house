import { describe, it, expect } from 'vitest';
import {
  APELIDOS_UNIDADE as BACKEND_APELIDOS,
  FATORES_CONVERSAO as BACKEND_FATORES,
  sugerirConversao as backendSugerirConversao,
} from './xml_parser.service.js';
import {
  APELIDOS_UNIDADE as FRONTEND_APELIDOS,
  FATORES_CONVERSAO as FRONTEND_FATORES,
  sugerirConversao as frontendSugerirConversao,
} from '../../../../../frontend/src/lib/unidades.js';

describe('Paridade de Unidades e Conversões (Backend x Frontend)', () => {
  it('APELIDOS_UNIDADE do backend e do frontend devem ser rigorosamente idênticos', () => {
    expect(FRONTEND_APELIDOS).toEqual(BACKEND_APELIDOS);
  });

  it('FATORES_CONVERSAO do backend e do frontend devem ser rigorosamente idênticos', () => {
    expect(FRONTEND_FATORES).toEqual(BACKEND_FATORES);
  });

  it('sugerirConversao deve produzir resultados idênticos no backend e no frontend em todos os cenários', () => {
    const cenariosDeTeste = [
      { de: 'KG', para: 'Gramas', qtd: 2 },
      { de: 'QUILOS', para: 'G', qtd: 0.5 },
      { de: 'KILOGRAMA', para: 'GRAMAS', qtd: 3.25 },
      { de: 'G', para: 'KG', qtd: 500 },
      { de: 'L', para: 'Mililitros', qtd: 1 },
      { de: 'LTS', para: 'ML', qtd: 2.5 },
      { de: 'LITROS', para: 'MILILITROS', qtd: 0.75 },
      { de: 'ML', para: 'L', qtd: 250 },
      { de: 'UN', para: 'Unidade', qtd: 10 },
      { de: 'QUILOS', para: 'KG', qtd: 5 },
      { de: 'PECA', para: 'UN', qtd: 12 },
      // Casos com conversaoIncerta: true (embalagens ou grandezas incompatíveis)
      { de: 'CX', para: 'Unidades', qtd: 2 },
      { de: 'PCT', para: 'Gramas', qtd: 4 },
      { de: 'FARDO', para: 'KG', qtd: 1 },
      { de: 'UN', para: 'Gramas', qtd: 1 },
      { de: 'KG', para: 'Litros', qtd: 2 },
      { de: 'DESCONHECIDO', para: 'UN', qtd: 1 },
    ];

    for (const cenario of cenariosDeTeste) {
      const resBackend = backendSugerirConversao(cenario.de, cenario.para, cenario.qtd);
      const resFrontend = frontendSugerirConversao(cenario.de, cenario.para, cenario.qtd);
      expect(resBackend).toEqual(resFrontend);
    }
  });
});
