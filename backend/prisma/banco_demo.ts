/**
 * Trava do seed de demonstração: ele APAGA o banco antes de gerar os dados fictícios, então só roda
 * num banco cujo nome tenha "demo" (ex.: burguer_house_demo) e nunca com NODE_ENV=production.
 * Devolve o nome do banco.
 */
export function exigirBancoDeDemonstracao(url: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed de demonstração bloqueado: NODE_ENV=production.');
  }
  if (!url) {
    throw new Error('Seed de demonstração bloqueado: DATABASE_URL não definida.');
  }

  let nome: string;
  try {
    nome = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('Seed de demonstração bloqueado: DATABASE_URL inválida.');
  }

  if (!/demo/i.test(nome)) {
    throw new Error(
      `Seed de demonstração bloqueado: o banco "${nome || '(sem nome)'}" não tem "demo" no nome. ` +
        'Ele apaga tudo antes de gerar os dados fictícios; use um banco separado, ex.: burguer_house_demo.',
    );
  }
  return nome;
}
