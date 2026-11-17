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
});
