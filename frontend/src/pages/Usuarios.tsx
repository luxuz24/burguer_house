import { useCallback, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowLeft,
  CircleNotch,
  Eye,
  EyeSlash,
  Plus,
  ShieldCheck,
  User,
  WarningCircle,
} from '../components/ui/icons';
import Sheet from '../components/ui/Sheet';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { api, mensagemDeErro } from '../lib/api';

export type PapelUsuario = 'ADMIN' | 'GERENTE' | 'OPERADOR';

export interface UsuarioAdminItem {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: PapelUsuario;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface UsuariosProps {
  onVoltar: () => void;
  onAbrirPerfil?: () => void;
}

const OPCOES_PAPEL: ReadonlyArray<{
  valor: PapelUsuario;
  rotulo: string;
  descricao: string;
}> = [
  { valor: 'OPERADOR', rotulo: 'Operador', descricao: 'Operação diária e estoque' },
  { valor: 'GERENTE', rotulo: 'Gerente', descricao: 'Contagem e gestão da loja' },
  { valor: 'ADMIN', rotulo: 'Administrador', descricao: 'Acesso total e gestão de usuários' },
];

const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  OPERADOR: 'Operador',
};

const MENSAGEM_403 = 'Só o administrador pode gerenciar usuários.';

function bytesUtf8(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

function validarSenhaTexto(senha: string): string | null {
  if (senha.length < 6) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (bytesUtf8(senha) > 72) {
    return 'A senha deve ter no máximo 72 bytes.';
  }
  return null;
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Usuarios({ onVoltar, onAbrirPerfil }: UsuariosProps) {
  const { usuario: usuarioLogado } = useAuth();
  const { toast, confirmar } = useFeedback();
  const redirecionou403Ref = useRef(false);
  const [acessoNegado, setAcessoNegado] = useState(false);

  // Novo usuário
  const [mostrarNovoSheet, setMostrarNovoSheet] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoPapel, setNovoPapel] = useState<PapelUsuario>('OPERADOR');
  const [novoSenha, setNovoSenha] = useState('');
  const [mostrarSenhaNovo, setMostrarSenhaNovo] = useState(false);
  const [errosNovo, setErrosNovo] = useState<{
    nome?: string;
    email?: string;
    telefone?: string;
    senha?: string;
    geral?: string;
  }>({});

  // Edição e redefinição de senha
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdminItem | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editPapel, setEditPapel] = useState<PapelUsuario>('OPERADOR');
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [novaSenhaReset, setNovaSenhaReset] = useState('');
  const [confirmarSenhaReset, setConfirmarSenhaReset] = useState('');
  const [mostrarSenhaReset, setMostrarSenhaReset] = useState(false);
  const [erroSenhaReset, setErroSenhaReset] = useState<string | null>(null);
  const [avisoSenhaRedefinida, setAvisoSenhaRedefinida] = useState<string | null>(null);

  const lidar403 = useCallback(
    (err: unknown): boolean => {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setAcessoNegado(true);
        if (!redirecionou403Ref.current) {
          redirecionou403Ref.current = true;
          toast.erro(MENSAGEM_403);
          onVoltar();
        }
        return true;
      }
      return false;
    },
    [toast, onVoltar],
  );

  const buscarUsuarios = useCallback(async (): Promise<UsuarioAdminItem[]> => {
    try {
      const resp = await api.get<UsuarioAdminItem[]>('/usuarios');
      return resp.data;
    } catch (err: unknown) {
      if (lidar403(err)) {
        throw new Error('Acesso negado', { cause: err });
      }
      throw err;
    }
  }, [lidar403]);

  const {
    dados: usuariosDados,
    carregandoInicial,
    erro: erroCarga,
    recarregar,
    tentarNovamente,
  } = useCarregamento(buscarUsuarios, [], {
    mensagemPadrao: 'Não foi possível carregar os usuários.',
  });

  const usuariosOrdenados = useMemo(
    () =>
      [...(usuariosDados ?? [])].sort((a, b) => {
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }),
    [usuariosDados],
  );

  const abrirNovoUsuario = useCallback(() => {
    setNovoNome('');
    setNovoEmail('');
    setNovoTelefone('');
    setNovoPapel('OPERADOR');
    setNovoSenha('');
    setMostrarSenhaNovo(false);
    setErrosNovo({});
    setMostrarNovoSheet(true);
  }, []);

  const abrirEdicaoUsuario = useCallback((u: UsuarioAdminItem) => {
    setUsuarioEditando(u);
    setEditNome(u.nome);
    setEditTelefone(u.telefone ?? '');
    setEditPapel(u.role);
    setErroEdicao(null);
    setNovaSenhaReset('');
    setConfirmarSenhaReset('');
    setMostrarSenhaReset(false);
    setErroSenhaReset(null);
    setAvisoSenhaRedefinida(null);
  }, []);

  const fecharEdicaoUsuario = useCallback(() => {
    setUsuarioEditando(null);
    setErroEdicao(null);
    setErroSenhaReset(null);
    setAvisoSenhaRedefinida(null);
  }, []);

  const { enviando: criandoUsuario, executar: executarCriarUsuario } = useEnvio(async () => {
    const erros: typeof errosNovo = {};
    const nomeLimpo = novoNome.trim();
    const emailLimpo = novoEmail.trim();
    const telefoneLimpo = novoTelefone.trim();

    if (nomeLimpo.length < 2) {
      erros.nome = 'O nome deve ter pelo menos 2 caracteres.';
    } else if (nomeLimpo.length > 100) {
      erros.nome = 'O nome deve ter no máximo 100 caracteres.';
    }

    if (!emailValido(emailLimpo)) {
      erros.email = 'Informe um e-mail válido.';
    }

    if (telefoneLimpo.length > 30) {
      erros.telefone = 'O telefone deve ter no máximo 30 caracteres.';
    }

    const erroSenha = validarSenhaTexto(novoSenha);
    if (erroSenha) {
      erros.senha = erroSenha;
    }

    if (Object.keys(erros).length > 0) {
      setErrosNovo(erros);
      return;
    }

    setErrosNovo({});
    try {
      await api.post<UsuarioAdminItem>('/usuarios', {
        nome: nomeLimpo,
        email: emailLimpo,
        senha: novoSenha,
        role: novoPapel,
        ...(telefoneLimpo ? { telefone: telefoneLimpo } : {}),
      });
      setMostrarNovoSheet(false);
      toast.sucesso('Usuário cadastrado com sucesso.');
      void recarregar();
    } catch (err: unknown) {
      if (lidar403(err)) return;
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setErrosNovo({ geral: 'Já existe um usuário com este e-mail.' });
        return;
      }
      setErrosNovo({ geral: mensagemDeErro(err, 'Não foi possível criar o usuário.') });
    }
  });

  const ehPropriaConta =
    !!usuarioEditando && !!usuarioLogado && usuarioEditando.id === usuarioLogado.id;

  const { enviando: salvandoEdicao, executar: executarSalvarEdicao } = useEnvio(async () => {
    if (!usuarioEditando) return;
    const nomeLimpo = editNome.trim();
    if (nomeLimpo.length < 2) {
      setErroEdicao('O nome deve ter pelo menos 2 caracteres.');
      return;
    }
    if (nomeLimpo.length > 100) {
      setErroEdicao('O nome deve ter no máximo 100 caracteres.');
      return;
    }
    const telLimpo = editTelefone.trim() || null;
    if (telLimpo && telLimpo.length > 30) {
      setErroEdicao('O telefone deve ter no máximo 30 caracteres.');
      return;
    }

    const patch: {
      nome?: string;
      telefone?: string | null;
      role?: PapelUsuario;
    } = {};

    if (nomeLimpo !== usuarioEditando.nome) patch.nome = nomeLimpo;
    if (telLimpo !== (usuarioEditando.telefone ?? null)) patch.telefone = telLimpo;
    if (!ehPropriaConta && editPapel !== usuarioEditando.role) patch.role = editPapel;

    if (Object.keys(patch).length === 0) {
      setErroEdicao('Nenhuma alteração realizada.');
      return;
    }

    setErroEdicao(null);
    try {
      await api.patch<UsuarioAdminItem>(`/usuarios/${usuarioEditando.id}`, patch);
      fecharEdicaoUsuario();
      toast.sucesso('Usuário atualizado com sucesso.');
      void recarregar();
    } catch (err: unknown) {
      if (lidar403(err)) return;
      setErroEdicao(mensagemDeErro(err, 'Não foi possível atualizar o usuário.'));
    }
  });

  const { enviando: alterandoStatus, executar: executarAlternarStatus } = useEnvio(async () => {
    if (!usuarioEditando || ehPropriaConta) return;
    const vaiDesativar = usuarioEditando.ativo;

    if (vaiDesativar) {
      const ok = await confirmar({
        titulo: 'Desativar acesso',
        mensagem: `${usuarioEditando.nome} não vai mais conseguir entrar e será desconectada agora.`,
        textoConfirmar: 'Desativar',
        perigoso: true,
      });
      if (!ok) return;
    }

    setErroEdicao(null);
    try {
      await api.patch<UsuarioAdminItem>(`/usuarios/${usuarioEditando.id}`, {
        ativo: !vaiDesativar,
      });
      fecharEdicaoUsuario();
      toast.sucesso(vaiDesativar ? 'Acesso desativado.' : 'Acesso reativado.');
      void recarregar();
    } catch (err: unknown) {
      if (lidar403(err)) return;
      setErroEdicao(mensagemDeErro(err, 'Não foi possível alterar a situação do usuário.'));
    }
  });

  const { enviando: redefinindoSenha, executar: executarRedefinirSenha } = useEnvio(async () => {
    if (!usuarioEditando || ehPropriaConta) return;

    const erroNova = validarSenhaTexto(novaSenhaReset);
    if (erroNova) {
      setErroSenhaReset(erroNova);
      return;
    }
    if (novaSenhaReset !== confirmarSenhaReset) {
      setErroSenhaReset('As senhas não conferem.');
      return;
    }

    setErroSenhaReset(null);
    setAvisoSenhaRedefinida(null);
    try {
      await api.post(`/usuarios/${usuarioEditando.id}/senha`, {
        novaSenha: novaSenhaReset,
      });
      setNovaSenhaReset('');
      setConfirmarSenhaReset('');
      setAvisoSenhaRedefinida(
        `Senha redefinida. ${usuarioEditando.nome} precisa entrar de novo com a senha nova.`,
      );
    } catch (err: unknown) {
      if (lidar403(err)) return;
      setErroSenhaReset(mensagemDeErro(err, 'Não foi possível redefinir a senha.'));
    }
  });

  const campoClasse =
    'w-full bg-field border border-line rounded-2xl px-3 min-h-[46px] text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="flex flex-col min-h-full pb-20 bg-canvas text-ink">
      <div className="bg-canvas px-4 pt-4 pb-2 sticky top-0 z-10 border-b border-line/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={onVoltar}
              aria-label="Voltar"
              className="text-ink -ml-2 rounded-2xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer hover:bg-field shrink-0"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-ink leading-tight">Usuários</h1>
              <p className="text-xs text-muted">Contas e papéis da loja</p>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirNovoUsuario}
            className="min-h-[44px] px-3.5 rounded-2xl bg-primary hover:bg-primary-deep text-on-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
          >
            <Plus size={16} weight="bold" />
            <span>Novo usuário</span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3 flex-1">
        {carregandoInicial && (
          <p className="text-sm text-muted flex items-center gap-2 py-4">
            <CircleNotch size={16} className="animate-spin" /> Carregando usuários…
          </p>
        )}

        {!carregandoInicial && erroCarga && !acessoNegado && (
          <div
            role="alert"
            className="bg-danger-soft border border-danger/40 text-danger rounded-2xl p-3.5 text-xs space-y-2"
          >
            <div className="flex items-start gap-2">
              <WarningCircle size={18} className="shrink-0 mt-0.5" />
              <p className="font-semibold flex-1 break-words">{erroCarga.mensagem}</p>
            </div>
            <button
              type="button"
              onClick={tentarNovamente}
              className="min-h-[44px] px-3 rounded-xl bg-card border border-line text-ink text-xs font-bold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!carregandoInicial && !erroCarga && (
          <ul className="space-y-2">
            {usuariosOrdenados.map((u) => {
              const proprio = !!usuarioLogado && u.id === usuarioLogado.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    aria-label={`Gerenciar ${u.nome}`}
                    onClick={() => abrirEdicaoUsuario(u)}
                    className={`w-full text-left bg-card border border-line rounded-2xl p-3.5 min-h-[44px] space-y-1.5 cursor-pointer hover:bg-card-2 transition-colors shadow-[var(--shadow-card)] ${
                      !u.ativo ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-ink break-words">
                          {u.nome}
                          {proprio && (
                            <span className="ml-1.5 text-xs font-semibold text-brand">(você)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted break-all">{u.email}</p>
                      </div>

                      <span
                        className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          u.ativo
                            ? 'bg-success-soft text-success'
                            : 'bg-field text-muted'
                        }`}
                      >
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-secondary-soft text-secondary">
                        <ShieldCheck size={12} /> {ROTULO_PAPEL[u.role]}
                      </span>
                      {u.telefone && (
                        <span className="text-[11px] text-muted">{u.telefone}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sheet Novo usuário */}
      <Sheet
        open={mostrarNovoSheet}
        onClose={() => setMostrarNovoSheet(false)}
        title="Novo usuário"
        subtitle="Crie o acesso inicial com papel definido"
        icon={<User size={22} weight="duotone" />}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void executarCriarUsuario();
          }}
          className="space-y-3 pb-2"
        >
          <div>
            <label htmlFor="novo-usuario-nome" className="block text-xs font-semibold text-muted mb-1">
              Nome
            </label>
            <input
              id="novo-usuario-nome"
              type="text"
              aria-label="Nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Ana Caixa"
              className={campoClasse}
            />
            {errosNovo.nome && <p className="text-xs text-danger font-semibold mt-1">{errosNovo.nome}</p>}
          </div>

          <div>
            <label htmlFor="novo-usuario-email" className="block text-xs font-semibold text-muted mb-1">
              E-mail
            </label>
            <input
              id="novo-usuario-email"
              type="email"
              inputMode="email"
              aria-label="E-mail"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="nome@burguerhouse.com.br"
              className={campoClasse}
            />
            {errosNovo.email && <p className="text-xs text-danger font-semibold mt-1">{errosNovo.email}</p>}
          </div>

          <div>
            <label htmlFor="novo-usuario-telefone" className="block text-xs font-semibold text-muted mb-1">
              Telefone (opcional)
            </label>
            <input
              id="novo-usuario-telefone"
              type="text"
              inputMode="tel"
              aria-label="Telefone"
              value={novoTelefone}
              onChange={(e) => setNovoTelefone(e.target.value)}
              placeholder="(67) 99999-0000"
              className={campoClasse}
            />
            {errosNovo.telefone && (
              <p className="text-xs text-danger font-semibold mt-1">{errosNovo.telefone}</p>
            )}
          </div>

          <div>
            <span id="novo-usuario-papel-label" className="block text-xs font-semibold text-muted mb-1">
              Papel
            </span>
            <div
              role="radiogroup"
              aria-labelledby="novo-usuario-papel-label"
              className="grid grid-cols-3 gap-1.5"
            >
              {OPCOES_PAPEL.map((op) => {
                const selecionado = novoPapel === op.valor;
                return (
                  <label
                    key={op.valor}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors ${
                      selecionado
                        ? 'bg-primary-soft border-brand text-brand'
                        : 'bg-field border-line text-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="novo-usuario-papel"
                      value={op.valor}
                      checked={selecionado}
                      onChange={() => setNovoPapel(op.valor)}
                      className="sr-only"
                    />
                    <span>{op.rotulo}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="novo-usuario-senha" className="block text-xs font-semibold text-muted mb-1">
              Senha inicial
            </label>
            <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[46px] focus-within:ring-2 focus-within:ring-primary/40">
              <input
                id="novo-usuario-senha"
                type={mostrarSenhaNovo ? 'text' : 'password'}
                aria-label="Senha inicial"
                value={novoSenha}
                onChange={(e) => setNovoSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
              />
              <button
                type="button"
                aria-label={mostrarSenhaNovo ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setMostrarSenhaNovo((v) => !v)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-muted hover:text-ink cursor-pointer"
              >
                {mostrarSenhaNovo ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errosNovo.senha && <p className="text-xs text-danger font-semibold mt-1">{errosNovo.senha}</p>}
          </div>

          {errosNovo.geral && (
            <p role="alert" className="bg-danger-soft border border-danger/40 text-danger rounded-xl p-3 text-xs font-semibold">
              {errosNovo.geral}
            </p>
          )}

          <button
            type="submit"
            disabled={criandoUsuario}
            className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary rounded-2xl min-h-[48px] font-bold text-sm cursor-pointer shadow-sm"
          >
            {criandoUsuario ? 'Criando…' : 'Criar usuário'}
          </button>
        </form>
      </Sheet>

      {/* Sheet Edição de usuário e Redefinição de senha */}
      <Sheet
        open={usuarioEditando !== null}
        onClose={fecharEdicaoUsuario}
        title={usuarioEditando?.nome}
        subtitle={usuarioEditando?.email}
        icon={<User size={22} weight="duotone" />}
      >
        {usuarioEditando && (
          <div className="space-y-4 pb-2">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void executarSalvarEdicao();
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="editar-usuario-nome" className="block text-xs font-semibold text-muted mb-1">
                  Nome
                </label>
                <input
                  id="editar-usuario-nome"
                  type="text"
                  aria-label="Nome"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className={campoClasse}
                />
              </div>

              <div>
                <label htmlFor="editar-usuario-telefone" className="block text-xs font-semibold text-muted mb-1">
                  Telefone
                </label>
                <input
                  id="editar-usuario-telefone"
                  type="text"
                  inputMode="tel"
                  aria-label="Telefone"
                  value={editTelefone}
                  onChange={(e) => setEditTelefone(e.target.value)}
                  placeholder="Não informado"
                  className={campoClasse}
                />
              </div>

              <div>
                <span id="editar-usuario-papel-label" className="block text-xs font-semibold text-muted mb-1">
                  Papel
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="editar-usuario-papel-label"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {OPCOES_PAPEL.map((op) => {
                    const selecionado = editPapel === op.valor;
                    return (
                      <label
                        key={op.valor}
                        className={`min-h-[44px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors ${
                          ehPropriaConta ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          selecionado
                            ? 'bg-primary-soft border-brand text-brand'
                            : 'bg-field border-line text-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name="editar-usuario-papel"
                          value={op.valor}
                          disabled={ehPropriaConta}
                          checked={selecionado}
                          onChange={() => setEditPapel(op.valor)}
                          className="sr-only"
                        />
                        <span>{op.rotulo}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {ehPropriaConta && (
                <p className="bg-card-2 border border-line rounded-xl p-3 text-xs text-muted">
                  Você não pode alterar o seu próprio papel nem desativar a sua conta
                </p>
              )}

              {erroEdicao && (
                <p role="alert" className="bg-danger-soft border border-danger/40 text-danger rounded-xl p-3 text-xs font-semibold">
                  {erroEdicao}
                </p>
              )}

              <button
                type="submit"
                disabled={salvandoEdicao}
                className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary rounded-2xl min-h-[44px] font-bold text-sm cursor-pointer shadow-sm"
              >
                {salvandoEdicao ? 'Salvando…' : 'Salvar alterações'}
              </button>

              <button
                type="button"
                disabled={ehPropriaConta || alterandoStatus}
                onClick={() => void executarAlternarStatus()}
                className={`w-full min-h-[44px] rounded-2xl text-sm font-semibold disabled:opacity-50 ${
                  ehPropriaConta ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${
                  usuarioEditando.ativo
                    ? 'bg-danger-soft text-danger'
                    : 'bg-success-soft text-success'
                }`}
              >
                {usuarioEditando.ativo ? 'Desativar acesso' : 'Reativar acesso'}
              </button>
            </form>

            <div className="pt-3 border-t border-line space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Redefinir senha
              </h3>

              {ehPropriaConta ? (
                <button
                  type="button"
                  onClick={() => {
                    fecharEdicaoUsuario();
                    onAbrirPerfil?.();
                  }}
                  className="w-full min-h-[44px] rounded-2xl bg-field border border-line text-ink text-xs font-bold cursor-pointer hover:bg-card-2"
                >
                  Redefinir senha no Perfil
                </button>
              ) : (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void executarRedefinirSenha();
                  }}
                  className="space-y-2.5"
                >
                  <div>
                    <label htmlFor="reset-nova-senha" className="block text-xs font-semibold text-muted mb-1">
                      Nova senha
                    </label>
                    <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[46px] focus-within:ring-2 focus-within:ring-primary/40">
                      <input
                        id="reset-nova-senha"
                        type={mostrarSenhaReset ? 'text' : 'password'}
                        aria-label="Nova senha"
                        value={novaSenhaReset}
                        onChange={(e) => setNovaSenhaReset(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={mostrarSenhaReset ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                        onClick={() => setMostrarSenhaReset((v) => !v)}
                        className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-muted hover:text-ink cursor-pointer"
                      >
                        {mostrarSenhaReset ? <EyeSlash size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reset-confirmar-senha" className="block text-xs font-semibold text-muted mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      id="reset-confirmar-senha"
                      type={mostrarSenhaReset ? 'text' : 'password'}
                      aria-label="Confirmar nova senha"
                      value={confirmarSenhaReset}
                      onChange={(e) => setConfirmarSenhaReset(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={campoClasse}
                    />
                  </div>

                  {erroSenhaReset && (
                    <p role="alert" className="text-xs text-danger font-semibold">
                      {erroSenhaReset}
                    </p>
                  )}

                  {avisoSenhaRedefinida && (
                    <p
                      role="status"
                      className="bg-success-soft text-success rounded-xl p-3 text-xs font-semibold"
                    >
                      {avisoSenhaRedefinida}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={redefinindoSenha}
                    className="w-full min-h-[44px] rounded-2xl bg-secondary-soft text-secondary text-sm font-bold cursor-pointer disabled:opacity-50"
                  >
                    {redefinindoSenha ? 'Redefinindo…' : 'Redefinir senha'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
