import { useState } from 'react';
import { Key, SignOut, Check, WarningCircle, ShieldCheck, GearSix, CaretRight, User } from './ui/icons';
import Sheet from './ui/Sheet';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onAbrirConfiguracoes?: () => void;
}

const ROTULO_PAPEL: Record<string, string> = { ADMIN: 'Administrador', GERENTE: 'Gerente', OPERADOR: 'Operador' };

export default function PerfilModal({ aberto, onFechar, onAbrirConfiguracoes }: Props) {
  const { usuario, atualizarPerfil, atualizarSenha, logout } = useAuth();

  const [nome, setNome] = useState(() => usuario?.nome || '');
  const [telefone, setTelefone] = useState(() => usuario?.telefone || '');
  const [prevAberto, setPrevAberto] = useState(aberto);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  const [mostrarTrocaSenha, setMostrarTrocaSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [senhaConfirmada, setSenhaConfirmada] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  // Ao abrir, os campos voltam a mostrar os dados atuais (ajuste de estado durante a renderização)
  if (aberto !== prevAberto) {
    setPrevAberto(aberto);
    if (aberto) {
      setNome(usuario?.nome || '');
      setTelefone(usuario?.telefone || '');
      setErroPerfil(null);
      setMostrarTrocaSenha(false);
    }
  }

  const salvarDadosPerfil = async () => {
    setSalvando(true);
    setErroPerfil(null);
    try {
      await atualizarPerfil({ nome, telefone });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setErroPerfil(err.response.data.message);
      } else {
        setErroPerfil('Erro ao atualizar perfil no servidor.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleTrocaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenha(null);

    if (!senhaAtual.trim() || !senhaNova.trim()) {
      setErroSenha('Preencha a senha atual e a nova senha.');
      return;
    }

    if (senhaNova.length < 6) {
      setErroSenha('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (new TextEncoder().encode(senhaNova).length > 72) {
      setErroSenha('A nova senha deve ter no máximo 72 bytes.');
      return;
    }

    setSalvandoSenha(true);
    try {
      await atualizarSenha(senhaAtual, senhaNova);
      setSenhaConfirmada(true);
      setTimeout(() => {
        setSenhaConfirmada(false);
        setMostrarTrocaSenha(false);
        setSenhaAtual('');
        setSenhaNova('');
      }, 1500);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setErroSenha(err.response.data.message);
      } else {
        setErroSenha('Erro ao alterar senha. Verifique a senha atual.');
      }
    } finally {
      setSalvandoSenha(false);
    }
  };

  const handleLogout = () => {
    logout();
    onFechar();
  };

  const iniciais = (usuario?.nome || 'Operador')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const alterado = nome.trim() !== (usuario?.nome || '') || telefone.trim() !== (usuario?.telefone || '');
  const campo = 'w-full bg-field border border-line rounded-2xl px-3 min-h-[48px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <Sheet open={aberto} onClose={onFechar} title="Perfil" icon={<User size={22} weight="duotone" />}>
      <div className="space-y-3 pb-2">
        <div className="text-center">
          <span className="inline-flex w-16 h-16 rounded-full bg-primary-soft text-brand text-2xl font-bold items-center justify-center">
            {iniciais}
          </span>
          <p className="text-lg font-bold text-ink mt-1.5">{usuario?.nome}</p>
          <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary-soft text-secondary">
              <ShieldCheck size={12} /> {ROTULO_PAPEL[usuario?.role ?? ''] ?? usuario?.role}
            </span>
            <span className="text-xs text-muted">{usuario?.email}</span>
          </div>
        </div>

        <div>
          <label htmlFor="perfil-nome" className="block text-xs font-semibold text-muted mb-1">Nome</label>
          <input id="perfil-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="perfil-telefone" className="block text-xs font-semibold text-muted mb-1">Telefone</label>
          <input
            id="perfil-telefone"
            type="tel"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className={campo}
          />
        </div>
        {erroPerfil && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
            <WarningCircle size={16} className="shrink-0 mt-0.5" /> {erroPerfil}
          </p>
        )}
        <button
          type="button"
          onClick={() => void salvarDadosPerfil()}
          disabled={!alterado || salvando}
          className="w-full bg-primary text-on-primary rounded-2xl font-bold min-h-[48px] flex items-center justify-center gap-2 cursor-pointer disabled:bg-field disabled:text-faint disabled:cursor-not-allowed"
        >
          {salvo ? (
            <>
              <Check size={18} weight="bold" /> Salvo
            </>
          ) : salvando ? (
            'Salvando...'
          ) : (
            'Salvar'
          )}
        </button>

        <div className="border-t border-line pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setMostrarTrocaSenha(!mostrarTrocaSenha)}
            aria-expanded={mostrarTrocaSenha}
            className="w-full bg-card border border-line rounded-2xl px-4 min-h-[48px] flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer"
          >
            <Key size={16} weight="duotone" /> <span className="flex-1 text-left">Alterar senha</span>
            <CaretRight size={16} className={`text-faint transition-transform ${mostrarTrocaSenha ? 'rotate-90' : ''}`} />
          </button>

          {mostrarTrocaSenha && (
            <form onSubmit={handleTrocaSenha} noValidate className="bg-card border border-line rounded-2xl p-3 space-y-2">
              <div>
                <label htmlFor="perfil-senha-atual" className="block text-xs font-semibold text-muted mb-1">Senha atual</label>
                <input id="perfil-senha-atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} className={campo} />
              </div>
              <div>
                <label htmlFor="perfil-senha-nova" className="block text-xs font-semibold text-muted mb-1">Nova senha</label>
                <input id="perfil-senha-nova" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} className={campo} />
              </div>
              {erroSenha && (
                <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
                  <WarningCircle size={16} className="shrink-0 mt-0.5" /> {erroSenha}
                </p>
              )}
              <button
                type="submit"
                disabled={salvandoSenha}
                className="w-full bg-secondary text-on-secondary rounded-2xl font-bold min-h-[46px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {senhaConfirmada ? (
                  <>
                    <Check size={18} weight="bold" /> Senha alterada
                  </>
                ) : salvandoSenha ? (
                  'Alterando...'
                ) : (
                  'Alterar senha'
                )}
              </button>
            </form>
          )}

          {onAbrirConfiguracoes && (
            <button
              type="button"
              onClick={onAbrirConfiguracoes}
              className="w-full bg-card border border-line rounded-2xl px-4 min-h-[48px] flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer"
            >
              <GearSix size={16} weight="duotone" /> <span className="flex-1 text-left">Configurações</span>
              <CaretRight size={16} className="text-faint" />
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full bg-danger-soft text-danger rounded-2xl font-bold min-h-[48px] flex items-center justify-center gap-2 cursor-pointer"
          >
            <SignOut size={18} /> Sair
          </button>
        </div>
      </div>
    </Sheet>
  );
}
