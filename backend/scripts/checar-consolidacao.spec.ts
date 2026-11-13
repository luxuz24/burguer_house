import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, 'checar-consolidacao.mjs');

function executarScript(conteudoArquivo: string, comSummary = false) {
  const dir = mkdtempSync(path.join(tmpdir(), 'checar-consolidacao-'));
  const respostaPath = path.join(dir, 'resposta.json');
  const summaryPath = path.join(dir, 'summary.md');
  writeFileSync(respostaPath, conteudoArquivo, 'utf-8');

  try {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH, respostaPath], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        ...(comSummary ? { GITHUB_STEP_SUMMARY: summaryPath } : { GITHUB_STEP_SUMMARY: '' }),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const summary = comSummary ? readFileSync(summaryPath, 'utf-8') : '';
    return { exitCode: 0, stdout, stderr: '', summary };
  } catch (err: unknown) {
    const error = err as { status?: number; stdout?: string; stderr?: string };
    let summary = '';
    if (comSummary) {
      try {
        summary = readFileSync(summaryPath, 'utf-8');
      } catch {
        summary = '';
      }
    }
    return {
      exitCode: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      summary,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('scripts/checar-consolidacao.mjs', () => {
  it('retorna exit 0 quando não há vendas retidas (resposta completa)', () => {
    const res = executarScript(
      JSON.stringify({
        consolidadas: 15,
        insumosAfetados: 8,
        vendasSemItens: 0,
        vendasComItensInvalidos: 0,
        canceladasIgnoradas: 2,
        vendasAguardando: 3,
        vendasPendentesNaoMapeadas: 0,
        produtosNaoEncontrados: [],
        produtosSemFicha: [],
        produtosComColisaoNome: [],
        insumosComEstoqueNegativo: [],
      }),
      true,
    );

    expect(res.exitCode).toBe(0);
    expect(res.summary).toContain('Consolidadas');
    expect(res.summary).toContain('15');
    expect(res.summary).toContain('Retidas');
    expect(res.summary).toContain('0');
  });

  it('retorna exit 0 quando não há vendas pendentes ({ consolidadas: 0, mensagem })', () => {
    const res = executarScript(
      JSON.stringify({
        consolidadas: 0,
        mensagem: 'Nenhuma venda pendente de processamento.',
      }),
      true,
    );

    expect(res.exitCode).toBe(0);
    expect(res.summary).toContain('Nenhuma venda pendente de processamento.');
  });

  it('retorna exit 1 e escreve resumo com GET /api/vendas/retidas quando há vendasPendentesNaoMapeadas > 0', () => {
    const res = executarScript(
      JSON.stringify({
        consolidadas: 10,
        insumosAfetados: 6,
        vendasSemItens: 0,
        vendasComItensInvalidos: 0,
        canceladasIgnoradas: 1,
        vendasAguardando: 0,
        vendasPendentesNaoMapeadas: 3,
        produtosNaoEncontrados: ['Lanche Fantasma'],
        produtosSemFicha: ['Coca Lata'],
        produtosComColisaoNome: [],
        insumosComEstoqueNegativo: [],
      }),
      true,
    );

    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('GET /api/vendas/retidas');
    expect(res.summary).toContain('Lanche Fantasma');
    expect(res.summary).toContain('Coca Lata');
    expect(res.summary).toContain('GET /api/vendas/retidas');
    expect(res.summary).toContain('cadastro');
  });

  it('retorna exit 1 quando vendasComItensInvalidos > 0 ou vendasSemItens > 0', () => {
    const resInvalidos = executarScript(
      JSON.stringify({
        consolidadas: 2,
        vendasSemItens: 0,
        vendasComItensInvalidos: 1,
        vendasPendentesNaoMapeadas: 0,
      }),
    );
    expect(resInvalidos.exitCode).toBe(1);

    const resSemItens = executarScript(
      JSON.stringify({
        consolidadas: 2,
        vendasSemItens: 1,
        vendasComItensInvalidos: 0,
        vendasPendentesNaoMapeadas: 0,
      }),
    );
    expect(resSemItens.exitCode).toBe(1);
  });

  it('retorna exit 1 quando a resposta é JSON inválido ou fora do contrato', () => {
    const resTexto = executarScript('<html>502 Bad Gateway</html>', true);
    expect(resTexto.exitCode).toBe(1);
    expect(resTexto.summary).toMatch(/inválida/i);

    const resSemConsolidadas = executarScript(JSON.stringify({ ok: true }), true);
    expect(resSemConsolidadas.exitCode).toBe(1);
    expect(resSemConsolidadas.summary).toMatch(/inválida/i);
  });
});
