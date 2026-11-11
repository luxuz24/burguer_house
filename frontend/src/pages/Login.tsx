import { useState } from 'react';
import { motion } from 'motion/react';
import { Envelope, Lock, WarningCircle, Eye, EyeSlash, ShieldCheck, ArrowRight, CircleNotch } from '../components/ui/icons';
import Smash from '../components/brand/Smash';
import { stagger, rise, tap } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useEnvio } from '../hooks/useEnvio';
import { mensagemDeErro } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // useEnvio: Enter/clique duplo no mesmo instante não envia dois logins (o disabled só vale no próximo render)
  const envio = useEnvio(async () => {
    try {
      await login(email, senha);
    } catch (err: unknown) {
      // Sem resposta HTTP, mensagemDeErro já explica a falta de conexão; o fallback cobre falhas locais
      setErro(mensagemDeErro(err, 'Não foi possível entrar. Tente novamente.'));
    }
  });
  const carregando = envio.enviando;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!email.trim() || !senha.trim()) {
      setErro('Por favor, preencha todos os campos.');
      return;
    }

    await envio.executar();
  };

  const preencherCredenciaisPadrao = () => {
    setEmail('gerente@burguerhouse.com.br');
    setSenha('admin123');
    setErro(null);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center px-5 py-8 transition-colors">
      <motion.div variants={stagger} initial="hidden" animate="show" className="w-full max-w-sm">
        <motion.div variants={rise} className="flex justify-center">
          <Smash mood={erro ? 'alert' : 'wave'} size={130} />
        </motion.div>
        <motion.div variants={rise} className="text-center mt-2 mb-6">
          <h1 className="text-[26px] font-extrabold tracking-tight">
            Burguer <span className="text-primary">House</span>
          </h1>
          <p className="text-sm text-muted">Estoque da cozinha, sem planilha.</p>
        </motion.div>

        <motion.form variants={rise} onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-muted mb-1">
              E-mail
            </label>
            <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[48px] focus-within:ring-2 focus-within:ring-primary/40">
              <Envelope size={18} className="text-muted shrink-0" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="voce@burguerhouse.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-senha" className="block text-xs font-semibold text-muted mb-1">
              Senha
            </label>
            <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[48px] focus-within:ring-2 focus-within:ring-primary/40">
              <Lock size={18} className="text-muted shrink-0" />
              <input
                id="login-senha"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="text-muted hover:text-ink min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center cursor-pointer"
              >
                {mostrarSenha ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {erro && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
              <WarningCircle size={16} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </p>
          )}

          <motion.button
            type="submit"
            whileTap={carregando ? undefined : tap}
            disabled={carregando}
            className="w-full bg-primary text-on-primary rounded-2xl font-bold min-h-[50px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {carregando ? (
              <>
                <CircleNotch size={18} className="animate-spin" /> Entrando...
              </>
            ) : (
              <>
                Entrar <ArrowRight size={18} weight="bold" />
              </>
            )}
          </motion.button>
        </motion.form>

        <motion.p variants={rise} className="text-center text-xs text-muted mt-5">
          Problemas para entrar? Fale com o gerente.
        </motion.p>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={preencherCredenciaisPadrao}
            className="mt-4 w-full text-xs text-muted border border-dashed border-line rounded-2xl min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck size={14} /> Ambiente de teste: preencher credenciais do admin
          </button>
        )}
      </motion.div>
    </div>
  );
}
