import { useState } from 'react';
import { X, User, Mail, Shield, MapPin, KeyRound, LogOut, Check, Phone, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

export default function PerfilModal({ aberto, onFechar }: Props) {
  const { usuario, atualizarPerfil, atualizarSenha, logout } = useAuth();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  const [mostrarTrocaSenha, setMostrarTrocaSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [senhaConfirmada, setSenhaConfirmada] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  if (!aberto) return null;

  const iniciarEdicao = () => {
    setNome(usuario?.nome || '');
    setTelefone(usuario?.telefone || '');
    setEditando(true);
    setErroPerfil(null);
  };

  const cancelarEdicao = () => {
    setEditando(false);
    setErroPerfil(null);
  };

  const salvarDadosPerfil = async () => {
    setSalvando(true);
    setErroPerfil(null);
    try {
      await atualizarPerfil({ nome, telefone });
      setEditando(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header do Modal */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Perfil do Usuário</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Credenciais autenticadas via JWT</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-gray-700 dark:text-gray-300">
          {/* Card com Foto / Avatar */}
          <div className="flex items-center gap-3.5 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl border border-blue-100/80 dark:border-blue-900/40">
            <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              {iniciais}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                  {usuario?.nome || 'Operador'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0 uppercase">
                  {usuario?.role || 'OPERADOR'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {usuario?.role === 'ADMIN' ? 'Administrador Geral' : 'Operador de Estoque'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> Burguer House &bull; Sessão Ativa
              </p>
            </div>
          </div>

          {salvo && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5 font-medium animate-in fade-in">
              <Check size={14} /> Dados atualizados no banco de dados com sucesso!
            </div>
          )}

          {erroPerfil && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-1.5 font-medium animate-in fade-in">
              <AlertCircle size={14} /> {erroPerfil}
            </div>
          )}

          {/* Dados do Usuário */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                Informações Pessoais
              </span>
              <button
                type="button"
                onClick={editando ? cancelarEdicao : iniciarEdicao}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {editando ? 'Cancelar' : 'Editar Dados'}
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-0.5">
                  Nome Completo
                </label>
                {editando ? (
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <User size={13} className="text-gray-400" /> {usuario?.nome}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-0.5">
                  E-mail de Acesso
                </label>
                <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Mail size={13} className="text-gray-400" /> {usuario?.email}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-0.5">
                  Telefone / WhatsApp
                </label>
                {editando ? (
                  <input
                    type="text"
                    value={telefone}
                    placeholder="(00) 00000-0000"
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Phone size={13} className="text-gray-400" /> {usuario?.telefone || 'Não informado'}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-0.5">
                  Nível de Permissão
                </label>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Shield size={13} /> {usuario?.role === 'ADMIN' ? 'Acesso Total (Administrador)' : 'Acesso Operador'}
                </p>
              </div>

              {editando && (
                <button
                  type="button"
                  disabled={salvando}
                  onClick={salvarDadosPerfil}
                  className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  {salvando ? 'Salvando no banco...' : 'Salvar Alterações'}
                </button>
              )}
            </div>
          </div>

          {/* Troca de Senha */}
          <div className="space-y-2">
            {!mostrarTrocaSenha ? (
              <button
                type="button"
                onClick={() => {
                  setMostrarTrocaSenha(true);
                  setErroSenha(null);
                }}
                className="w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center gap-1.5 font-semibold transition-colors cursor-pointer"
              >
                <KeyRound size={14} /> Alterar Senha de Acesso
              </button>
            ) : (
              <form onSubmit={handleTrocaSenha} className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Alterar Senha</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarTrocaSenha(false);
                      setErroSenha(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                  >
                    Cancelar
                  </button>
                </div>

                {erroSenha && (
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg text-[11px] flex items-center gap-1.5">
                    <AlertCircle size={12} /> {erroSenha}
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Senha Atual</label>
                  <input
                    type="password"
                    required
                    placeholder="Digite sua senha atual..."
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Nova Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres..."
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={salvandoSenha || !senhaAtual.trim() || !senhaNova.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  {salvandoSenha ? (
                    'Atualizando...'
                  ) : senhaConfirmada ? (
                    <>
                      <Check size={14} /> Senha Atualizada!
                    </>
                  ) : (
                    'Confirmar Nova Senha'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Botão de Encerrar Sessão */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} /> Sair da Conta (Logout)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
