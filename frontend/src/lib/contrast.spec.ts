/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Converte cor hex (#RGB ou #RRGGBB) para valores sRGB normalizados [0, 1].
 */
function hexParaRgb(hex: string): [number, number, number] {
  let limpo = hex.replace('#', '').trim();
  if (limpo.length === 3) {
    limpo = limpo.split('').map((c) => c + c).join('');
  }
  const num = parseInt(limpo, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r / 255, g / 255, b / 255];
}

/**
 * Calcula a luminância relativa conforme fórmula WCAG 2.1.
 */
function luminanciaRelativa([r, g, b]: [number, number, number]): number {
  const ajustar = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * ajustar(r) + 0.7152 * ajustar(g) + 0.0722 * ajustar(b);
}

/**
 * Calcula a razão de contraste (x:1) entre duas cores hex.
 */
export function calcularContraste(hex1: string, hex2: string): number {
  const l1 = luminanciaRelativa(hexParaRgb(hex1));
  const l2 = luminanciaRelativa(hexParaRgb(hex2));
  const maisClaro = Math.max(l1, l2);
  const maisEscuro = Math.min(l1, l2);
  return (maisClaro + 0.05) / (maisEscuro + 0.05);
}

/**
 * Extrai variáveis CSS do index.css para temas claro e escuro.
 */
function carregarCoresIndexCss() {
  const caminhosPossiveis = [
    path.resolve(process.cwd(), 'src/index.css'),
    path.resolve(process.cwd(), 'frontend/src/index.css'),
  ];
  const cssPath = caminhosPossiveis.find((p) => fs.existsSync(p));
  if (!cssPath) {
    throw new Error('Arquivo src/index.css não encontrado nos caminhos: ' + caminhosPossiveis.join(', '));
  }
  const css = fs.readFileSync(cssPath, 'utf-8');

  const extrairVariaveis = (bloco: string): Record<string, string> => {
    const mapa: Record<string, string> = {};
    const regex = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g;
    let match;
    while ((match = regex.exec(bloco)) !== null) {
      mapa[match[1]] = match[2];
    }
    return mapa;
  };

  const blocoThemeMatch = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  const blocoDarkMatch = css.match(/\.dark\s*\{([\s\S]*?)\n\}/);

  if (!blocoThemeMatch || !blocoDarkMatch) {
    throw new Error('Blocos @theme ou .dark não encontrados em index.css');
  }

  const claro = extrairVariaveis(blocoThemeMatch[1]);
  const escuro = extrairVariaveis(blocoDarkMatch[1]);

  return { claro, escuro };
}

describe('Tokens de design — Contraste WCAG AA (>= 4.5:1)', () => {
  const { claro, escuro } = carregarCoresIndexCss();

  const paresObrigatorios: Array<{
    nome: string;
    texto: string;
    fundo: string;
    minimo: number;
  }> = [
    { nome: 'ink / canvas', texto: 'ink', fundo: 'canvas', minimo: 4.5 },
    { nome: 'muted / card', texto: 'muted', fundo: 'card', minimo: 4.5 },
    { nome: 'on-primary / primary (preto no botão)', texto: 'on-primary', fundo: 'primary', minimo: 4.5 },
    { nome: 'brand / card (laranja como texto)', texto: 'brand', fundo: 'card', minimo: 4.5 },
    { nome: 'on-secondary / secondary (branco no azul)', texto: 'on-secondary', fundo: 'secondary', minimo: 4.5 },
    { nome: 'danger / card', texto: 'danger', fundo: 'card', minimo: 4.5 },
    { nome: 'success / card', texto: 'success', fundo: 'card', minimo: 4.5 },
    { nome: 'secondary / secondary-soft (chip azul)', texto: 'secondary', fundo: 'secondary-soft', minimo: 4.5 },
    { nome: 'danger / danger-soft (alerta)', texto: 'danger', fundo: 'danger-soft', minimo: 4.5 },
    { nome: 'success / success-soft (sucesso)', texto: 'success', fundo: 'success-soft', minimo: 4.5 },
    { nome: 'brand / primary-soft (chip laranja)', texto: 'brand', fundo: 'primary-soft', minimo: 4.5 },
  ];

  describe('Tema Claro', () => {
    for (const { nome, texto, fundo, minimo } of paresObrigatorios) {
      it(`garante contraste >= ${minimo}:1 para ${nome}`, () => {
        const corTexto = claro[texto];
        const corFundo = claro[fundo];
        expect(corTexto, `Token texto ${texto} deve existir`).toBeDefined();
        expect(corFundo, `Token fundo ${fundo} deve existir`).toBeDefined();

        const razao = calcularContraste(corTexto, corFundo);
        expect(razao).toBeGreaterThanOrEqual(minimo);
      });
    }

    it('reprova texto branco sobre primary (contraste insuficiente < 4.5)', () => {
      const razaoBrancoSobrePrimary = calcularContraste('#FFFFFF', claro['primary']);
      // Prova por que branco sobre primary é estritamente proibido no design system
      expect(razaoBrancoSobrePrimary).toBeLessThan(4.5);
      expect(razaoBrancoSobrePrimary).toBeCloseTo(2.6, 0.5);
    });
  });

  describe('Tema Escuro', () => {
    for (const { nome, texto, fundo, minimo } of paresObrigatorios) {
      it(`garante contraste >= ${minimo}:1 para ${nome}`, () => {
        const corTexto = escuro[texto];
        const corFundo = escuro[fundo];
        expect(corTexto, `Token texto ${texto} deve existir no tema escuro`).toBeDefined();
        expect(corFundo, `Token fundo ${fundo} deve existir no tema escuro`).toBeDefined();

        const razao = calcularContraste(corTexto, corFundo);
        expect(razao).toBeGreaterThanOrEqual(minimo);
      });
    }
  });
});
