import { useState } from 'react';
import { X, User, Mail, Shield, MapPin, KeyRound, LogOut, Check, Phone } from 'lucide-react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

export default function PerfilModal({ aberto, onFechar }: Props) {
  const [nome, setNome] = useState(() => localStorage.getItem('usuario_nome') || 'Carlos Eduardo');
  const [telefone, setTelefone] = useState(() => localStorage.getItem('usuario_telefone') || '(67) 99876-5432');
  const [editando, setEditando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [mostrarTrocaSenha, setMostrarTrocaSenha] = useState(false);
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmada, setSenhaConfirmada] = useState(false);

  if (!aberto) return null;

  const salvarPerfil = () => {
    localStorage.setItem('usuario_nome', nome);
    localStorage.setItem('usuario_telefone', telefone);
    setEditando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  const handleTrocaSenha = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaNova.trim()) return;
    setSenhaConfirmada(true);
    setTimeout(() => {
      setSenhaConfirmada(false);
      setMostrarTrocaSenha(false);
      setSenhaNova('');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header do Modal */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Perfil do Usuário</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Identificação e credenciais de acesso</p>
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
              {nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{nome}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Gerente Operacional & Estoque</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> Burguer House — Unidade Central
              </p>
            </div>
          </div>

          {salvo && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5 font-medium">
              <Check size={14} /> Dados atualizados com sucesso!
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
                onClick={() => setEditando(!editando)}
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
                    <User size={13} className="text-gray-400" /> {nome}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-0.5">
                  E-mail de Acesso
                </label>
                <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Mail size={13} className="text-gray-400" /> gerente@burguerhouse.com.br
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
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Phone size={13} className="text-gray-400" /> {telefone}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-0.5">
                  Nível de Permissão
                </label>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Shield size={13} /> Administrador Total (Todas as Fases)
                </p>
              </div>

              {editando && (
                <button
                  type="button"
                  onClick={salvarPerfil}
                  className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                >
                  Salvar Alterações
                </button>
              )}
            </div>
          </div>

          {/* Troca de Senha */}
          <div className="space-y-2">
            {!mostrarTrocaSenha ? (
              <button
                type="button"
                onClick={() => setMostrarTrocaSenha(true)}
                className="w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center gap-1.5 font-semibold transition-colors"
              >
                <KeyRound size={14} /> Alterar Senha de Acesso
              </button>
            ) : (
              <form onSubmit={handleTrocaSenha} className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Nova Senha</span>
                  <button
                    type="button"
                    onClick={() => setMostrarTrocaSenha(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                  >
                    Cancelar
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Digite a nova senha..."
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!senhaNova.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {senhaConfirmada ? (
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
              onClick={() => {
                alert('Sessão encerrada com segurança.');
                onFechar();
              }}
              className="w-full py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} /> Sair da Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
