/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
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

  it('nenhum componente usa texto branco sobre fundo cheio de danger, success, secondary ou primary (reprova no escuro)', () => {
    const raiz = path.resolve(process.cwd(), fs.existsSync('src') ? 'src' : 'frontend/src');
    const arquivos: string[] = [];
    const varrer = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) varrer(p);
      else if (/\.tsx$/.test(e.name) && !/\.spec\./.test(e.name)) arquivos.push(p);
    });
    varrer(raiz);
    const ofensas: string[] = [];
    for (const a of arquivos) {
      const codigo = fs.readFileSync(a, 'utf-8');
      for (const m of codigo.matchAll(/["'`][^"'`\n]*\bbg-(?:danger|success|secondary|primary)\b[^"'`\n]*["'`]/g)) {
        if (/\btext-white\b/.test(m[0])) ofensas.push(`${path.relative(raiz, a)}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(ofensas).toEqual([]);
  });
});
