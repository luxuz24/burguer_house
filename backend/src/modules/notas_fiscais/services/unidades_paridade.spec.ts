import { describe, it, expect } from 'vitest';
import {
  APELIDOS_UNIDADE as BACKEND_APELIDOS,
  FATORES_CONVERSAO as BACKEND_FATORES,
} from './xml_parser.service.js';
import {
  APELIDOS_UNIDADE as FRONTEND_APELIDOS,
  FATORES_CONVERSAO as FRONTEND_FATORES,
} from '../../../../../frontend/src/lib/unidades.js';

describe('Paridade de Unidades e Conversões (Backend x Frontend)', () => {
  it('APELIDOS_UNIDADE do backend e do frontend devem ser rigorosamente idênticos', () => {
    expect(FRONTEND_APELIDOS).toEqual(BACKEND_APELIDOS);
  });

  it('FATORES_CONVERSAO do backend e do frontend devem ser rigorosamente idênticos', () => {
    expect(FRONTEND_FATORES).toEqual(BACKEND_FATORES);
  });
});
