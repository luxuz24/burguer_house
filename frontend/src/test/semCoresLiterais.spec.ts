import { describe, it, expect } from 'vitest';
import { classesComTokenInexistente, tokensDeCorDeclarados } from './semCoresLiterais';

describe('test/semCoresLiterais - tokens de cor inexistentes', () => {
  it('lê os tokens declarados no index.css real', () => {
    const tokens = tokensDeCorDeclarados();
    expect(tokens.has('primary-soft')).toBe(true);
    expect(tokens.has('on-primary')).toBe(true);
    expect(tokens.has('success-deep')).toBe(false);
  });

  it('aponta variantes que não existem e aceita as que existem, com ou sem opacidade', () => {
    const codigo = `className="bg-success-deep hover:bg-success-deep bg-brand-soft/20 border-brand/40
      bg-primary-soft/30 text-on-primary bg-card-2 text-ink-soft ring-primary/40 text-danger"`;
    expect(classesComTokenInexistente(codigo).sort()).toEqual(['bg-brand-soft/20', 'bg-success-deep']);
  });
});
