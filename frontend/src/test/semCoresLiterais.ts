/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export const REGEX_CORES_LITERAIS =
  /\b(bg|text|border|ring|stroke|fill)-(blue|red|amber|emerald|green|purple|yellow|orange|slate|zinc|neutral|stone)-/;

/** Famílias de token de cor declaradas em src/index.css (`--color-<familia>[-variante]`). */
const FAMILIAS_DE_TOKEN = [
  'canvas', 'card', 'field', 'line', 'ink', 'muted', 'faint',
  'primary', 'brand', 'on', 'secondary', 'danger', 'success',
];

function resolverCaminho(caminhoRelativoOuAbsoluto: string): string {
  let caminhoAbsoluto = path.isAbsolute(caminhoRelativoOuAbsoluto)
    ? caminhoRelativoOuAbsoluto
    : path.resolve(process.cwd(), caminhoRelativoOuAbsoluto);

  if (!fs.existsSync(caminhoAbsoluto) && !caminhoRelativoOuAbsoluto.startsWith('frontend/')) {
    const caminhoComFrontend = path.resolve(process.cwd(), 'frontend', caminhoRelativoOuAbsoluto);
    if (fs.existsSync(caminhoComFrontend)) {
      caminhoAbsoluto = caminhoComFrontend;
    }
  }
  return caminhoAbsoluto;
}

/** Nomes de token de cor existentes (sem o prefixo `--color-`), lidos do index.css real. */
export function tokensDeCorDeclarados(): Set<string> {
  const css = fs.readFileSync(resolverCaminho('src/index.css'), 'utf-8');
  return new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

/**
 * Classes que usam uma família de token mas com uma variante que não existe
 * (ex.: `bg-success-deep`, `bg-brand-soft/20`). O Tailwind não gera essas classes,
 * então o elemento fica sem a cor e ninguém percebe.
 */
export function classesComTokenInexistente(codigo: string): string[] {
  const declarados = tokensDeCorDeclarados();
  const regex = new RegExp(
    String.raw`\b(?:bg|text|border|ring|stroke|fill|outline|from|to|via|placeholder|divide|decoration|accent|caret)-(` +
      FAMILIAS_DE_TOKEN.join('|') +
      String.raw`)((?:-[a-z0-9]+)*)(?:\/\d+)?(?=[\s"'\`}]|$)`,
    'g',
  );
  const invalidas = new Set<string>();
  for (const m of codigo.matchAll(regex)) {
    const token = m[1] + m[2];
    if (!declarados.has(token)) invalidas.add(m[0]);
  }
  return [...invalidas];
}

/**
 * Validador de conformidade visual para as telas migradas para os tokens F0.5.
 * Garante que o arquivo fonte:
 * 1. Não contenha variantes manuais `dark:` (o tema escuro opera por variáveis CSS redefinidas em `.dark`).
 * 2. Não utilize classes com escala de cinza fixa `-gray-`.
 * 3. Não declare classes com nomes de cores literais do Tailwind (utilizando exclusivamente tokens semânticos).
 * 4. Não use variantes de token que não existem no index.css (classe sem efeito, falha silenciosa).
 */
export function esperarSemCoresLiterais(caminhoRelativoOuAbsoluto: string) {
  const codigo = fs.readFileSync(resolverCaminho(caminhoRelativoOuAbsoluto), 'utf-8');

  // 1. Sem variantes manuais dark:
  expect(codigo).not.toMatch(/\bdark:/);

  // 2. Sem escala fixa -gray-
  expect(codigo).not.toMatch(/-gray-/);

  // 3. Sem cores literais hardcoded
  expect(codigo).not.toMatch(REGEX_CORES_LITERAIS);

  // 4. Sem tokens inexistentes
  expect(classesComTokenInexistente(codigo)).toEqual([]);
}
