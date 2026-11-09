import { useState } from 'react';
import { Envelope, Lock, SignIn, WarningCircle, Eye, EyeSlash, ShieldCheck, Fire } from '../components/ui/icons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!email.trim() || !senha.trim()) {
      setErro('Por favor, preencha todos os campos.');
      return;
    }

    setCarregando(true);
    try {
      await login(email, senha);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setErro(err.response.data.message);
      } else {
        setErro('Não foi possível conectar ao servidor. Verifique se o backend está ativo.');
      }
    } finally {
      setCarregando(false);
    }
  };

  const preencherCredenciaisPadrao = () => {
    setEmail('gerente@burguerhouse.com.br');
    setSenha('admin123');
    setErro(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-gray-50 to-orange-500/10 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col justify-center items-center p-4 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30 mb-4 animate-in zoom-in-75 duration-300">
            <Fire size={34} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Burguer House
          </h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
            Gestão de Estoque, Fichas Técnicas & Operação
          </p>
        </div>

        {/* Card de Login */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-xl shadow-gray-200/50 dark:shadow-black/50 transition-all">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Identificação</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Entre com suas credenciais para acessar o painel
            </p>
          </div>

          {erro && (
            <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <WarningCircle size={16} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 uppercase tracking-wider text-[11px]">
                E-mail de Acesso
              </label>
              <div className="relative">
                <Envelope size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@burguerhouse.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 uppercase tracking-wider text-[11px]">
                Senha
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  {mostrarSenha ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full mt-2 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              {carregando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <SignIn size={16} />
                  <span>Acessar Painel</span>
                </>
              )}
            </button>
          </form>

          {/* Atalho de Credencial Rápida: Renderiza EXCLUSIVAMENTE em ambiente de desenvolvimento / testes locais */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={preencherCredenciaisPadrao}
                className="w-full py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Ambiente de Teste: Preencher Credenciais do Admin</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-6">
          Burguer House &bull; Autenticação JWT com Criptografia Bcrypt
        </p>
      </div>
    </div>
  );
}
