import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Usuarios from './Usuarios';
import ConfiguracoesModal from '../components/ConfiguracoesModal';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import {
  mockUsuarioAdmin,
  mockUsuarioGerente,
  mockUsuarioOperador,
} from '../test/fixtures/auth.fixture';

interface UsuarioAdminMock {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: 'ADMIN' | 'GERENTE' | 'OPERADOR';
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

const listaUsuariosInicial: UsuarioAdminMock[] = [
  {
    id: 'u-inativo',
    nome: 'Bruno Inativo',
    email: 'bruno@burguerhouse.com.br',
    telefone: null,
    role: 'OPERADOR',
    ativo: false,
    criadoEm: '2026-11-10T12:00:00.000Z',
    atualizadoEm: '2026-11-12T12:00:00.000Z',
  },
  {
    id: mockUsuarioAdmin.id,
    nome: mockUsuarioAdmin.nome,
    email: mockUsuarioAdmin.email,
    telefone: mockUsuarioAdmin.telefone,
    role: 'ADMIN',
    ativo: true,
    criadoEm: '2026-10-14T12:00:00.000Z',
    atualizadoEm: '2026-10-14T12:00:00.000Z',
  },
  {
    id: 'u-ana',
    nome: 'Ana Caixa',
    email: 'ana.caixa@burguerhouse.com.br',
    telefone: '67 99999-0000',
    role: 'OPERADOR',
    ativo: true,
    criadoEm: '2026-11-15T12:00:00.000Z',
    atualizadoEm: '2026-11-15T12:00:00.000Z',
  },
  {
    id: 'u-gerente',
    nome: 'Daniel Gerente',
    email: 'daniel@burguerhouse.com.br',
    telefone: null,
    role: 'GERENTE',
    ativo: true,
    criadoEm: '2026-11-15T12:00:00.000Z',
    atualizadoEm: '2026-11-15T12:00:00.000Z',
  },
];

function SaudacaoContexto() {
  const { usuario } = useAuth();
  return <span data-testid="nome-auth-context">{usuario?.nome ?? ''}</span>;
}

describe('pages/Usuarios e entrada em ConfiguracoesModal (tarefa 22)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('U1: OPERADOR e GERENTE não veem "Usuários" em Configurações; ADMIN vê (>= 44px), abre a lista com (você) e inativos no fim', async () => {
    // 1. OPERADOR não vê
    const rOp = renderComProviders(
      <ConfiguracoesModal aberto onFechar={vi.fn()} />,
      { usuario: mockUsuarioOperador, verificarSessao: false },
    );
    expect(screen.queryByRole('button', { name: /Usuários/i })).not.toBeInTheDocument();
    rOp.unmount();

    // 2. GERENTE não vê
    const rGer = renderComProviders(
      <ConfiguracoesModal aberto onFechar={vi.fn()} />,
      { usuario: mockUsuarioGerente, verificarSessao: false },
    );
    expect(screen.queryByRole('button', { name: /Usuários/i })).not.toBeInTheDocument();
    rGer.unmount();

    // 3. ADMIN vê e abre a lista
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: {
          '/usuarios': listaUsuariosInicial,
        },
      },
    });

    const btnUsuarios = screen.getByRole('button', { name: /Usuários/i });
    expect(btnUsuarios.className).toContain('min-h-[44px]');
    fireEvent.click(btnUsuarios);

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument();
    expect(await screen.findByText(/Carlos Eduardo/)).toBeInTheDocument();
    expect(screen.getByText(/\(você\)/)).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Gerente')).toBeInTheDocument();
    expect(screen.getAllByText('Operador')).toHaveLength(2);
    expect(screen.getByText('Inativo')).toBeInTheDocument();

    // Inativos ficam depois dos ativos no DOM
    const ativoAna = screen.getByText('Ana Caixa');
    const inativoBruno = screen.getByText('Bruno Inativo');
    expect(
      ativoAna.compareDocumentPosition(inativoBruno) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('U2: Novo usuário valida campos, envia POST /usuarios com papel escolhido, trata 409 mantendo o Sheet e trava duplo clique', async () => {
    let lista = [...listaUsuariosInicial];
    const corposPost: Array<Record<string, unknown>> = [];
    let chamadasPost = 0;
    let resolverPost!: (v: unknown) => void;
    let rejeitarPost!: (err: unknown) => void;

    renderComProviders(<Usuarios onVoltar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: { '/usuarios': () => lista },
        post: {
          '/usuarios': (_url: string, body: unknown) => {
            chamadasPost++;
            corposPost.push(body as Record<string, unknown>);
            return new Promise((resolve, reject) => {
              resolverPost = resolve;
              rejeitarPost = reject;
            });
          },
        },
      },
    });

    await screen.findByText('Ana Caixa');

    const btnNovo = screen.getByRole('button', { name: /Novo usuário/i });
    expect(btnNovo.className).toContain('min-h-[44px]');
    fireEvent.click(btnNovo);

    expect(await screen.findByRole('dialog', { name: 'Novo usuário' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Operador' })).toBeChecked();

    // Submete vazio para validar mensagens junto dos campos
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    expect(await screen.findByText(/pelo menos 2 caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/e-mail válido/i)).toBeInTheDocument();
    expect(screen.getByText(/pelo menos 6 caracteres/i)).toBeInTheDocument();
    expect(chamadasPost).toBe(0);

    // Preenche dados + toggle mostrar/ocultar senha + papel Gerente
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria Nova' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'maria@burguerhouse.com.br' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '67 99999-1111' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Gerente' }));

    const inputSenha = screen.getByLabelText('Senha inicial') as HTMLInputElement;
    expect(inputSenha.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(inputSenha.type).toBe('text');
    fireEvent.change(inputSenha, { target: { value: 'senha123' } });

    // Duplo clique dispara apenas 1 POST
    const btnCriar = screen.getByRole('button', { name: 'Criar usuário' });
    fireEvent.click(btnCriar);
    fireEvent.click(btnCriar);
    expect(chamadasPost).toBe(1);
    expect(corposPost[0]).toEqual({
      nome: 'Maria Nova',
      email: 'maria@burguerhouse.com.br',
      telefone: '67 99999-1111',
      role: 'GERENTE',
      senha: 'senha123',
    });

    // 409 mantém Sheet aberto com os dados preenchidos
    await act(async () => {
      rejeitarPost({
        isAxiosError: true,
        response: { status: 409, data: { message: 'Já existe um usuário com este e-mail' } },
      });
    });

    expect(await screen.findByText('Já existe um usuário com este e-mail.')).toBeInTheDocument();
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Maria Nova');

    // Reenvio com sucesso (201) fecha Sheet e recarrega lista
    const novaUsuario: UsuarioAdminMock = {
      id: 'u-maria',
      nome: 'Maria Nova',
      email: 'maria@burguerhouse.com.br',
      telefone: '67 99999-1111',
      role: 'GERENTE',
      ativo: true,
      criadoEm: '2026-11-17T10:00:00.000Z',
      atualizadoEm: '2026-11-17T10:00:00.000Z',
    };
    lista = [...lista, novaUsuario];

    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    await act(async () => {
      resolverPost(novaUsuario);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Novo usuário' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Maria Nova')).toBeInTheDocument();
  });

  it('U3: editar envia PATCH só com o que mudou; Desativar pede confirmação e envia ativo:false; 409 último admin é exibido', async () => {
    let lista = [...listaUsuariosInicial];
    const patches: Array<{ url: string; body: Record<string, unknown> }> = [];
    let simularUltimoAdmin = false;

    renderComProviders(
      <>
        <SaudacaoContexto />
        <Usuarios onVoltar={vi.fn()} />
      </>,
      {
        usuario: mockUsuarioAdmin,
        verificarSessao: false,
        routes: {
          get: { '/usuarios': () => lista },
          patch: {
            '/usuarios/u-ana': (url: string, body: unknown) => {
              if (simularUltimoAdmin) {
                return {
                  status: 409,
                  data: { message: 'Não é possível remover o último administrador ativo' },
                };
              }
              const payload = body as Record<string, unknown>;
              patches.push({ url, body: payload });
              lista = lista.map((u) => (u.id === 'u-ana' ? { ...u, ...payload } : u));
              return lista.find((u) => u.id === 'u-ana');
            },
            '/usuarios/u-inativo': (url: string, body: unknown) => {
              const payload = body as Record<string, unknown>;
              patches.push({ url, body: payload });
              lista = lista.map((u) => (u.id === 'u-inativo' ? { ...u, ...payload } : u));
              return lista.find((u) => u.id === 'u-inativo');
            },
            '/usuarios/u-gerente': (url: string, body: unknown) => {
              const payload = body as Record<string, unknown>;
              patches.push({ url, body: payload });
              lista = lista.map((u) => (u.id === 'u-gerente' ? { ...u, ...payload } : u));
              return lista.find((u) => u.id === 'u-gerente');
            },
          },
        },
      },
    );

    await screen.findByText('Ana Caixa');

    // Abre Ana Caixa e muda só o papel -> PATCH só com { role: 'GERENTE' } e mantém o AuthContext do admin intacto
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'Gerente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ url: '/usuarios/u-ana', body: { role: 'GERENTE' } });
    expect(screen.getByTestId('nome-auth-context')).toHaveTextContent('Carlos Eduardo');

    // Reabre Ana Caixa e clica Desativar acesso -> pede confirmação neutra -> PATCH { ativo: false }
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Desativar acesso' }));
    expect(
      await screen.findByText(
        'Ana Caixa não vai mais conseguir entrar. As sessões abertas serão encerradas agora.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ url: '/usuarios/u-ana', body: { ativo: false } });
    expect(await screen.findAllByText('Inativo')).toHaveLength(2);

    // Reativar Bruno Inativo -> PATCH { ativo: true }
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Bruno Inativo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reativar acesso' }));
    await waitFor(() => expect(patches).toHaveLength(3));
    expect(patches[2]).toEqual({ url: '/usuarios/u-inativo', body: { ativo: true } });

    // Desativar usuário masculino (Daniel Gerente) usa o mesmo texto neutro
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Daniel Gerente/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Desativar acesso' }));
    expect(
      await screen.findByText(
        'Daniel Gerente não vai mais conseguir entrar. As sessões abertas serão encerradas agora.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(patches).toHaveLength(4));
    expect(patches[3]).toEqual({ url: '/usuarios/u-gerente', body: { ativo: false } });

    // 409 último admin ativo exibido no Sheet
    simularUltimoAdmin = true;
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'Operador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(
      await screen.findByText('Não é possível remover o último administrador ativo'),
    ).toBeInTheDocument();
  });

  it('U4: na própria conta, papel e Desativar acesso ficam desabilitados, editar próprio nome atualiza AuthContext e Redefinir senha leva ao Perfil', async () => {
    const onAbrirPerfil = vi.fn();
    let lista = [...listaUsuariosInicial];
    const patchesProprios: Array<{ url: string; body: Record<string, unknown> }> = [];

    renderComProviders(
      <>
        <SaudacaoContexto />
        <Usuarios onVoltar={vi.fn()} onAbrirPerfil={onAbrirPerfil} />
      </>,
      {
        usuario: mockUsuarioAdmin,
        verificarSessao: false,
        routes: {
          get: { '/usuarios': () => lista },
          patch: {
            [`/usuarios/${mockUsuarioAdmin.id}`]: (url: string, body: unknown) => {
              const payload = body as Record<string, unknown>;
              patchesProprios.push({ url, body: payload });
              lista = lista.map((u) => (u.id === mockUsuarioAdmin.id ? { ...u, ...payload } : u));
              return lista.find((u) => u.id === mockUsuarioAdmin.id);
            },
          },
        },
      },
    );

    expect(screen.getByTestId('nome-auth-context')).toHaveTextContent('Carlos Eduardo');
    const btnProprio = await screen.findByRole('button', { name: /Gerenciar Carlos Eduardo/i });
    fireEvent.click(btnProprio);

    expect(
      await screen.findByText('Você não pode alterar o seu próprio papel nem desativar a sua conta'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Operador' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Gerente' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Administrador' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Desativar acesso' })).toBeDisabled();

    // Edita o próprio nome -> atualiza lista, AuthContext e localStorage
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Carlos Eduardo Silva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patchesProprios).toHaveLength(1));
    expect(patchesProprios[0]).toEqual({
      url: `/usuarios/${mockUsuarioAdmin.id}`,
      body: { nome: 'Carlos Eduardo Silva' },
    });
    await waitFor(() => {
      expect(screen.getByTestId('nome-auth-context')).toHaveTextContent('Carlos Eduardo Silva');
    });
    const salvoStorage = JSON.parse(localStorage.getItem('burger_stock_usuario') ?? 'null') as {
      nome?: string;
    } | null;
    expect(salvoStorage?.nome).toBe('Carlos Eduardo Silva');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(await screen.findByRole('button', { name: /Gerenciar Carlos Eduardo Silva/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha no Perfil' }));
    expect(onAbrirPerfil).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('U5: redefinir senha de outro usuário valida senha curta/divergente e envia POST /usuarios/:id/senha (204)', async () => {
    const senhasEnviadas: Array<Record<string, unknown>> = [];

    renderComProviders(<Usuarios onVoltar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: { '/usuarios': listaUsuariosInicial },
        post: {
          '/usuarios/u-ana/senha': (_url: string, body: unknown) => {
            senhasEnviadas.push(body as Record<string, unknown>);
            return { status: 204, data: undefined };
          },
        },
      },
    });

    await screen.findByText('Ana Caixa');
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));

    // Senha curta (< 6) não envia
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText(/pelo menos 6 caracteres/i)).toBeInTheDocument();
    expect(senhasEnviadas).toHaveLength(0);

    // Senha divergente não envia
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'nova1234' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'outra1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText(/não conferem/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    // Senha válida envia POST e exibe instrução
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'nova1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(senhasEnviadas).toHaveLength(1));
    expect(senhasEnviadas[0]).toEqual({ novaSenha: 'nova1234' });
    expect(
      await screen.findByText('Senha redefinida. Ana Caixa precisa entrar de novo com a senha nova.'),
    ).toBeInTheDocument();
  });

  it('U6: erro 403 volta para Configurações com mensagem explicativa', async () => {
    const onVoltar = vi.fn();

    renderComProviders(<Usuarios onVoltar={onVoltar} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: {
          '/usuarios': { status: 403, data: { message: 'Acesso restrito' } },
        },
      },
    });

    await waitFor(() => expect(onVoltar).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Só o administrador pode gerenciar usuários.'),
    ).toBeInTheDocument();
  });

  it('U7: usa apenas tokens de design em Usuarios.tsx e ConfiguracoesModal.tsx', () => {
    esperarSemCoresLiterais('src/pages/Usuarios.tsx');
    esperarSemCoresLiterais('src/components/ConfiguracoesModal.tsx');
  });

  it('U8: ConfiguracoesModal oculta Usuários deslogado, chama onAbrirUsuarios, e no modo interno volta e redireciona ao Perfil', async () => {
    const onFechar = vi.fn();
    const onAbrirUsuarios = vi.fn();
    const onAbrirPerfil = vi.fn();

    // 1. Sem usuário logado (autenticado: false) não quebra e oculta Usuários
    const rDeslogado = renderComProviders(
      <ConfiguracoesModal aberto onFechar={onFechar} />,
      { autenticado: false, verificarSessao: false },
    );
    expect(screen.queryByRole('button', { name: /Usuários/i })).not.toBeInTheDocument();
    rDeslogado.unmount();

    // 2. Com onAbrirUsuarios informado, clicar em Usuários aciona callback sem montar interno
    const rCallback = renderComProviders(
      <ConfiguracoesModal
        aberto
        onFechar={onFechar}
        onAbrirUsuarios={onAbrirUsuarios}
      />,
      { usuario: mockUsuarioAdmin, verificarSessao: false },
    );
    fireEvent.click(screen.getByRole('button', { name: /Usuários/i }));
    expect(onAbrirUsuarios).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Usuários' })).not.toBeInTheDocument();
    rCallback.unmount();

    // 3. Modo interno (sem onAbrirUsuarios): Voltar retorna às Configurações; Redefinir senha fecha e chama onAbrirPerfil
    renderComProviders(
      <ConfiguracoesModal
        aberto
        onFechar={onFechar}
        onAbrirPerfil={onAbrirPerfil}
      />,
      {
        usuario: mockUsuarioAdmin,
        verificarSessao: false,
        routes: { get: { '/usuarios': listaUsuariosInicial } },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: /Usuários/i }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByRole('heading', { level: 1, name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usuários/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Usuários/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Gerenciar Carlos Eduardo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir senha no Perfil' }));

    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(onAbrirPerfil).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('U9: carregamento inicial, erro de carga com Tentar novamente, ordenação alfabética e classes ativo/inativo', async () => {
    let resolverInicial!: (v: unknown) => void;
    let tentativa = 0;

    const rCarregando = renderComProviders(<Usuarios onVoltar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: {
          '/usuarios': () => {
            tentativa++;
            if (tentativa === 1) {
              return new Promise((resolve) => {
                resolverInicial = resolve;
              });
            }
            return listaUsuariosInicial;
          },
        },
      },
    });

    expect(screen.getByText('Carregando usuários…')).toBeInTheDocument();
    await act(async () => {
      resolverInicial(listaUsuariosInicial);
    });
    await waitFor(() => {
      expect(screen.queryByText('Carregando usuários…')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Ana Caixa')).toBeInTheDocument();
    rCarregando.unmount();

    // Segundo mount com erro 500 direto -> Tentar novamente recarrega
    const rErro = renderComProviders(<Usuarios onVoltar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: {
          '/usuarios': () => {
            if (tentativa <= 1) {
              tentativa++;
              return { status: 500, data: { message: 'Falha no servidor de usuários' } };
            }
            return listaUsuariosInicial;
          },
        },
      },
    });

    expect(await screen.findByText('Falha no servidor de usuários')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    const btnAna = await screen.findByRole('button', { name: /Gerenciar Ana Caixa/i });
    const btnBruno = screen.getByRole('button', { name: /Gerenciar Bruno Inativo/i });
    const btnCarlos = screen.getByRole('button', { name: /Gerenciar Carlos Eduardo/i });

    expect(btnAna.className).not.toContain('opacity-60');
    expect(btnBruno.className).toContain('opacity-60');
    expect(btnAna.compareDocumentPosition(btnCarlos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(btnCarlos.compareDocumentPosition(btnBruno) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('67 99999-0000')).toBeInTheDocument();
    rErro.unmount();
  });

  it('U10: Novo usuário valida limites (nome >100, tel >30, senha >72 bytes), fecha Sheet, trata erro 500 e mostra "Criando…"', async () => {
    let resolverPost!: (v: unknown) => void;
    let modoPost: 'erro' | 'lento' = 'erro';

    renderComProviders(<Usuarios onVoltar={vi.fn()} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: { '/usuarios': listaUsuariosInicial },
        post: {
          '/usuarios': () => {
            if (modoPost === 'erro') {
              return { status: 500, data: { message: 'Falha ao gravar usuário' } };
            }
            return new Promise((resolve) => {
              resolverPost = resolve;
            });
          },
        },
      },
    });

    await screen.findByText('Ana Caixa');
    fireEvent.click(screen.getByRole('button', { name: /Novo usuário/i }));

    // Excesso de nome (> 100), telefone (> 30) e senha (> 72 bytes UTF-8: 'é' = 2 bytes -> 37*2 = 74 bytes)
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'a'.repeat(101) } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'novo@burguerhouse.com.br' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '9'.repeat(31) } });
    fireEvent.change(screen.getByLabelText('Senha inicial'), { target: { value: 'é'.repeat(37) } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('O nome deve ter no máximo 100 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('O telefone deve ter no máximo 30 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('A senha deve ter no máximo 72 bytes.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    // Fecha e reabre Sheet -> limpa campos e erros anteriores
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Novo usuário' })).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Novo usuário/i }));
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/máximo 100 caracteres/i)).not.toBeInTheDocument();

    // Dados válidos nos limites exatos (nome=2, tel='', senha=72 bytes) -> erro 500
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ab' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ab@burguerhouse.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha inicial'), { target: { value: 'a'.repeat(72) } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('Falha ao gravar usuário')).toBeInTheDocument();

    // Em voo mostra "Criando…" desabilitado e depois fecha
    modoPost = 'lento';
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    expect(await screen.findByRole('button', { name: 'Criando…' })).toBeDisabled();

    await act(async () => {
      resolverPost({
        id: 'u-ab',
        nome: 'Ab',
        email: 'ab@burguerhouse.com.br',
        telefone: null,
        role: 'OPERADOR',
        ativo: true,
        criadoEm: '2026-11-17T10:00:00.000Z',
        atualizadoEm: '2026-11-17T10:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Novo usuário' })).not.toBeInTheDocument();
    });
  });

  it('U11: edição valida nenhuma alteração/limites, limpa telefone para null, cancelar desativar não envia, e trata erros no reset/status/PATCH', async () => {
    const patches: Array<Record<string, unknown>> = [];
    let erroPatch: { status: number; data: { message: string } } | null = null;
    let erroReset: { status: number; data: { message: string } } | null = null;
    const onVoltar = vi.fn();

    renderComProviders(<Usuarios onVoltar={onVoltar} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: { '/usuarios': listaUsuariosInicial },
        patch: {
          '/usuarios/u-ana': (_url: string, body: unknown) => {
            if (erroPatch) return erroPatch;
            const payload = body as Record<string, unknown>;
            patches.push(payload);
            return { ...listaUsuariosInicial[2], ...payload };
          },
        },
        post: {
          '/usuarios/u-ana/senha': () => {
            if (erroReset) return erroReset;
            return { status: 204, data: undefined };
          },
        },
      },
    });

    await screen.findByText('Ana Caixa');
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));

    // 1. Nenhuma alteração realizada
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Nenhuma alteração realizada.')).toBeInTheDocument();

    // 2. Validação nome < 2, nome > 100 e telefone > 30 na edição
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('O nome deve ter pelo menos 2 caracteres.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'a'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('O nome deve ter no máximo 100 caracteres.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Caixa' } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '9'.repeat(31) } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('O telefone deve ter no máximo 30 caracteres.')).toBeInTheDocument();

    // 3. Limpar telefone envia { telefone: null }
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ telefone: null });

    // Reabre Ana Caixa
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));

    // 4. Cancelar confirmação de desativar não envia PATCH
    fireEvent.click(screen.getByRole('button', { name: 'Desativar acesso' }));
    expect(await screen.findByRole('button', { name: 'Desativar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(patches).toHaveLength(1);

    // 5. Erro 500 ao desativar mostra mensagem dentro do Sheet
    erroPatch = { status: 500, data: { message: 'Falha ao desativar' } };
    fireEvent.click(screen.getByRole('button', { name: 'Desativar acesso' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(await screen.findByText('Falha ao desativar')).toBeInTheDocument();

    // 6. Reset de senha: toggle mostrar/ocultar senha, > 72 bytes e erro 500
    const inputNova = screen.getByLabelText('Nova senha') as HTMLInputElement;
    const inputConfirmar = screen.getByLabelText('Confirmar nova senha') as HTMLInputElement;
    expect(inputNova.type).toBe('password');
    expect(inputConfirmar.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar nova senha' }));
    expect(inputNova.type).toBe('text');
    expect(inputConfirmar.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar nova senha' }));
    expect(inputNova.type).toBe('password');

    fireEvent.change(inputNova, { target: { value: 'a'.repeat(73) } });
    fireEvent.change(inputConfirmar, { target: { value: 'a'.repeat(73) } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('A senha deve ter no máximo 72 bytes.')).toBeInTheDocument();

    erroReset = { status: 500, data: { message: 'Falha ao trocar senha' } };
    fireEvent.change(inputNova, { target: { value: 'nova1234' } });
    fireEvent.change(inputConfirmar, { target: { value: 'nova1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('Falha ao trocar senha')).toBeInTheDocument();

    // 7. Erro 403 no PATCH fecha e chama onVoltar apenas uma vez
    erroPatch = { status: 403, data: { message: 'Sem acesso' } };
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalledTimes(1));
  });

  it('U12: cadastro testa toggle de senha, e-mail com espaços nos extremos, limites exatos com trim, classes das pills e erros 500/403', async () => {
    let modoPost: 'fallback' | 'ok' | '403' = 'fallback';
    const posts: Array<Record<string, unknown>> = [];
    const onVoltar = vi.fn();

    renderComProviders(<Usuarios onVoltar={onVoltar} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: { '/usuarios': listaUsuariosInicial },
        post: {
          '/usuarios': (_url: string, body: unknown) => {
            if (modoPost === 'fallback') return { status: 500, data: {} };
            if (modoPost === '403') return { status: 403, data: { message: 'Sem acesso' } };
            const payload = body as Record<string, unknown>;
            posts.push(payload);
            return {
              id: 'u-lim',
              ...payload,
              telefone: payload.telefone ?? null,
              ativo: true,
              criadoEm: '2026-11-17T10:00:00.000Z',
              atualizadoEm: '2026-11-17T10:00:00.000Z',
            };
          },
        },
      },
    });

    await screen.findByText('Ana Caixa');
    fireEvent.click(screen.getByRole('button', { name: /Novo usuário/i }));

    // Toggle Mostrar/Ocultar senha inicial e classes dos botões de papel
    const inputSenha = screen.getByLabelText('Senha inicial') as HTMLInputElement;
    expect(inputSenha.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(inputSenha.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(inputSenha.type).toBe('password');

    const radioGerente = screen.getByRole('radio', { name: 'Gerente' });
    const radioOperador = screen.getByRole('radio', { name: 'Operador' });
    expect(radioOperador.closest('label')?.className).toContain('bg-primary-soft');
    expect(radioGerente.closest('label')?.className).toContain('bg-field');
    fireEvent.click(radioGerente);
    expect(radioGerente.closest('label')?.className).toContain('bg-primary-soft');
    expect(radioOperador.closest('label')?.className).toContain('bg-field');

    // E-mail com espaço antes ou depois do padrão (testa âncoras ^ e $) e senha = 5 chars
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'x bad@b.com' } });
    fireEvent.change(inputSenha, { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    expect(await screen.findByText(/e-mail válido/i)).toBeInTheDocument();
    expect(screen.getByText(/pelo menos 6 caracteres/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ok@b.com extra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    expect(await screen.findByText(/e-mail válido/i)).toBeInTheDocument();

    // Limites exatos após trim: nome = 100, telefone = 30, email com espaços, senha = 6 -> falha 500 fallback limpa erros de campo
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: `  ${'n'.repeat(100)}  ` } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: '  novo@burguerhouse.com.br  ' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: `  ${'9'.repeat(30)}  ` } });
    fireEvent.change(inputSenha, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('Não foi possível criar o usuário.')).toBeInTheDocument();
    expect(screen.queryByText(/e-mail válido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pelo menos 6 caracteres/i)).not.toBeInTheDocument();

    // Sucesso exibe toast e envia campos com trim
    modoPost = 'ok';
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      nome: 'n'.repeat(100),
      email: 'novo@burguerhouse.com.br',
      telefone: '9'.repeat(30),
      role: 'GERENTE',
      senha: '123456',
    });
    expect(await screen.findByText('Usuário cadastrado com sucesso.')).toBeInTheDocument();

    // 403 ao criar aciona lidar403 -> onVoltar
    modoPost = '403';
    fireEvent.click(screen.getByRole('button', { name: /Novo usuário/i }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Outro' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'outro@b.com' } });
    fireEvent.change(screen.getByLabelText('Senha inicial'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalledTimes(1));
  });

  it('U13: carga com fallback, troca entre usuários limpa estados do Sheet, classes de conta própria vs outro e fallbacks 500/403', async () => {
    let falharCarga = true;
    let resolverPatch!: (v: unknown) => void;
    let resolverReset!: (v: unknown) => void;
    let modoPatch: 'lento' | 'fallback' | 'ok' | '403-status' = 'lento';
    let modoReset: 'lento' | 'fallback' | '403' = 'lento';
    const onVoltar = vi.fn();

    renderComProviders(<Usuarios onVoltar={onVoltar} />, {
      usuario: mockUsuarioAdmin,
      verificarSessao: false,
      routes: {
        get: {
          '/usuarios': () => {
            if (falharCarga) return { status: 500, data: {} };
            return listaUsuariosInicial;
          },
        },
        patch: {
          '/usuarios/u-gerente': () => {
            if (modoPatch === 'fallback') return { status: 500, data: {} };
            if (modoPatch === '403-status') return { status: 403, data: {} };
            if (modoPatch === 'ok') return { ...listaUsuariosInicial[3], ativo: false };
            return new Promise((resolve) => {
              resolverPatch = resolve;
            });
          },
          '/usuarios/u-inativo': () => ({ ...listaUsuariosInicial[0], ativo: true }),
          '/usuarios/u-ana': () => ({ status: 500, data: {} }),
        },
        post: {
          '/usuarios/u-gerente/senha': () => {
            if (modoReset === 'fallback') return { status: 500, data: {} };
            if (modoReset === '403') return { status: 403, data: {} };
            return new Promise((resolve) => {
              resolverReset = resolve;
            });
          },
        },
      },
    });

    // Carga falhou sem message -> usa mensagemPadrao e não exibe lista
    expect(await screen.findByText('Não foi possível carregar os usuários.')).toBeInTheDocument();
    expect(screen.queryByText('Ana Caixa')).not.toBeInTheDocument();

    falharCarga = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Ana Caixa');

    // Badges Ativo / Inativo com classes corretas
    expect(screen.getAllByText('Ativo')[0].className).toContain('bg-success-soft');
    expect(screen.getByText('Inativo').className).toContain('bg-field');

    // Abre conta própria -> verifica classes de bloqueio nos papéis e no botão Desativar acesso
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Carlos Eduardo/i }));
    const radioOwn = await screen.findByRole('radio', { name: 'Administrador' });
    expect(radioOwn.closest('label')?.className).toContain('opacity-50');
    expect(radioOwn.closest('label')?.className).toContain('cursor-not-allowed');
    expect(radioOwn.closest('label')?.className).toContain('bg-primary-soft');
    expect(screen.getByRole('radio', { name: 'Operador' }).closest('label')?.className).toContain('bg-field');
    expect(screen.getByRole('button', { name: 'Desativar acesso' }).className).toContain('cursor-not-allowed');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    // Abre Ana Caixa -> gera erro de edição + digita senha + gera erro de senha -> fecha
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Ana Caixa/i }));
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('O nome deve ter pelo menos 2 caracteres.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText(/pelo menos 6 caracteres/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desativar acesso' }).className).toContain('bg-danger-soft');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    // Abre Daniel Gerente (telefone null) -> campos e erros anteriores foram limpos
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Daniel Gerente/i }));
    expect((await screen.findByLabelText('Telefone') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Confirmar nova senha') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('O nome deve ter pelo menos 2 caracteres.')).not.toBeInTheDocument();
    expect(screen.queryByText(/pelo menos 6 caracteres/i)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Gerente' }).closest('label')?.className).not.toContain('opacity-50');
    expect(screen.getByRole('radio', { name: 'Gerente' }).closest('label')?.className).toContain('cursor-pointer');

    // Fallback 500 sem message no PATCH e depois sucesso no limite exacto nome=100, tel=30 com "Salvando…"
    modoPatch = 'fallback';
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: `  ${'d'.repeat(100)}  ` } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: `  ${'8'.repeat(30)}  ` } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Não foi possível atualizar o usuário.')).toBeInTheDocument();

    modoPatch = 'lento';
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled();
    await act(async () => {
      resolverPatch({
        ...listaUsuariosInicial[3],
        nome: 'd'.repeat(100),
        telefone: '8'.repeat(30),
      });
    });
    expect(await screen.findByText('Usuário atualizado com sucesso.')).toBeInTheDocument();

    // Reabre Daniel Gerente -> testa reset de senha com 500 fallback, depois 6 chars com "Redefinindo…" e limpa inputs
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Daniel Gerente/i }));

    modoReset = 'fallback';
    fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('Não foi possível redefinir a senha.')).toBeInTheDocument();

    modoReset = 'lento';
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByRole('button', { name: 'Redefinindo…' })).toBeDisabled();
    await act(async () => {
      resolverReset({ status: 204, data: undefined });
    });
    expect(
      await screen.findByText('Senha redefinida. Daniel Gerente precisa entrar de novo com a senha nova.'),
    ).toBeInTheDocument();
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Confirmar nova senha') as HTMLInputElement).value).toBe('');

    // Fallback 500 ao desativar, depois sucesso (toast "Acesso desativado.") e Reativar (classe success + toast "Acesso reativado.")
    modoPatch = 'fallback';
    fireEvent.click(screen.getByRole('button', { name: 'Desativar acesso' }));
    expect(await screen.findByRole('heading', { name: 'Desativar acesso' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(await screen.findByText('Não foi possível alterar a situação do usuário.')).toBeInTheDocument();

    modoPatch = 'ok';
    fireEvent.click(screen.getByRole('button', { name: 'Desativar acesso' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(await screen.findByText('Acesso desativado.')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Bruno Inativo/i }));
    const btnReativar = await screen.findByRole('button', { name: 'Reativar acesso' });
    expect(btnReativar.className).toContain('bg-success-soft');
    fireEvent.click(btnReativar);
    expect(await screen.findByText('Acesso reativado.')).toBeInTheDocument();

    // 403 no reset e 403 ao alterar status fecham e acionam onVoltar
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Daniel Gerente/i }));
    modoReset = '403';
    fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalledTimes(1));

    // Reabre Daniel e provoca 403 ao desativar
    modoPatch = '403-status';
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar Daniel Gerente/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar acesso' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalledTimes(1));
  });
});
