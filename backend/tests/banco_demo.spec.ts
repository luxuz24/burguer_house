import { describe, it, expect } from 'vitest';
import { exigirBancoDeDemonstracao } from '../prisma/banco_demo.js';

// O seed de demonstração APAGA o banco: a trava impede que ele rode no banco de produção ou de dev.
describe('exigirBancoDeDemonstracao', () => {
  const url = (banco: string) => `postgresql://u:s@localhost:5432/${banco}?schema=public`;

  it('aceita banco com "demo" no nome e devolve o nome', () => {
    expect(exigirBancoDeDemonstracao(url('burguer_house_demo'), {})).toBe('burguer_house_demo');
    expect(exigirBancoDeDemonstracao(url('DEMO_banca'), { NODE_ENV: 'development' })).toBe('DEMO_banca');
  });

  it('recusa banco sem "demo" no nome (produção, dev, teste)', () => {
    for (const banco of ['burguer_house', 'neondb', 'burguer_house_test', '']) {
      expect(() => exigirBancoDeDemonstracao(url(banco), {})).toThrow(/não tem "demo" no nome/);
    }
  });

  it('recusa com NODE_ENV=production mesmo que o nome tenha "demo"', () => {
    expect(() => exigirBancoDeDemonstracao(url('burguer_house_demo'), { NODE_ENV: 'production' })).toThrow(/production/);
  });

  it('recusa URL ausente ou inválida, e "demo" só no usuário ou no host não basta', () => {
    expect(() => exigirBancoDeDemonstracao(undefined, {})).toThrow(/não definida/);
    expect(() => exigirBancoDeDemonstracao('isto não é url', {})).toThrow(/inválida/);
    expect(() => exigirBancoDeDemonstracao('postgresql://demo:s@demo-host:5432/producao', {})).toThrow(/"producao"/);
  });
});
