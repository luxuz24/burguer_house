/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export const REGEX_CORES_LITERAIS =
  /\b(bg|text|border|ring|stroke|fill)-(blue|red|amber|emerald|green|purple|yellow|orange|slate|zinc|neutral|stone)-/;

/**
 * Validador de conformidade visual para as telas migradas para os tokens F0.5.
 * Garante que o arquivo fonte:
 * 1. Não contenha variantes manuais `dark:` (o tema escuro opera por variáveis CSS redefinidas em `.dark`).
 * 2. Não utilize classes com escala de cinza fixa `-gray-`.
 * 3. Não declare classes com nomes de cores literais do Tailwind (utilizando exclusivamente tokens semânticos).
 */
export function esperarSemCoresLiterais(caminhoRelativoOuAbsoluto: string) {
  let caminhoAbsoluto = path.isAbsolute(caminhoRelativoOuAbsoluto)
    ? caminhoRelativoOuAbsoluto
    : path.resolve(process.cwd(), caminhoRelativoOuAbsoluto);

  if (!fs.existsSync(caminhoAbsoluto) && !caminhoRelativoOuAbsoluto.startsWith('frontend/')) {
    const caminhoComFrontend = path.resolve(process.cwd(), 'frontend', caminhoRelativoOuAbsoluto);
    if (fs.existsSync(caminhoComFrontend)) {
      caminhoAbsoluto = caminhoComFrontend;
    }
  }

  const codigo = fs.readFileSync(caminhoAbsoluto, 'utf-8');

  // 1. Sem variantes manuais dark:
  expect(codigo).not.toMatch(/\bdark:/);

  // 2. Sem escala fixa -gray-
  expect(codigo).not.toMatch(/-gray-/);

  // 3. Sem cores literais hardcoded
  expect(codigo).not.toMatch(REGEX_CORES_LITERAIS);
}
