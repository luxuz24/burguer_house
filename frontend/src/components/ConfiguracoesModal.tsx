import { useState } from 'react';
import { Moon, Sun, Monitor, GearSix, User, CaretRight } from './ui/icons';
import { useTheme } from '../context/ThemeContext';
import { usePodeGerir } from '../hooks/usePodeGerir';
import Sheet from './ui/Sheet';
import Usuarios from '../pages/Usuarios';
import { CHAVE_SOM_SCANNER, lerSomScanner } from '../lib/bipScanner';
import { gravarArmazenado } from '../lib/armazenamento';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onAbrirUsuarios?: () => void;
  onAbrirPerfil?: () => void;
}

const TEMAS = [
  { id: 'light' as const, label: 'Claro', icone: Sun },
  { id: 'dark' as const, label: 'Escuro', icone: Moon },
  { id: 'system' as const, label: 'Auto', icone: Monitor },
];

/**
 * Configurações do aparelho. Só entram preferências que alguma tela realmente usa:
 * os antigos interruptores de "alerta de estoque" e "validade" não eram lidos por nada,
 * e a empresa/CNPJ e os horários das rotinas eram texto fixo (o horário estava errado).
 */
export default function ConfiguracoesModal({ aberto, onFechar, onAbrirUsuarios, onAbrirPerfil }: Props) {
  const { theme, setTheme } = useTheme();
  const [somScanner, setSomScanner] = useState(lerSomScanner);
  const [mostrarUsuariosInterno, setMostrarUsuariosInterno] = useState(false);

  const ehAdmin = usePodeGerir();

  const alternarSom = () => {
    const novo = !somScanner;
    setSomScanner(novo);
    gravarArmazenado(CHAVE_SOM_SCANNER, String(novo));
  };

  if (mostrarUsuariosInterno) {
    return (
      <div className="fixed inset-0 z-[65] overflow-y-auto bg-canvas text-ink">
        <div className="max-w-md mx-auto min-h-full">
          <Usuarios
            onVoltar={() => setMostrarUsuariosInterno(false)}
            onAbrirPerfil={() => {
              setMostrarUsuariosInterno(false);
              onFechar();
              onAbrirPerfil?.();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Configurações" subtitle="Preferências deste aparelho" icon={<GearSix size={22} weight="duotone" />}>
      <div className="space-y-5 pb-2">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Aparência</h3>
          <div role="radiogroup" aria-label="Tema" className="flex bg-field rounded-2xl p-1 gap-1">
            {TEMAS.map((t) => {
              const Icone = t.icone;
              const ativo = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 rounded-xl min-h-[44px] text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    ativo ? 'bg-card text-ink shadow-sm' : 'text-muted'
                  }`}
                >
                  <Icone size={16} /> {t.label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Leitura de notas</h3>
          <div className="bg-card border border-line rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Som e vibração no QR code</p>
              <p className="text-xs text-muted">Ao ler uma NFC-e com a câmera</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={somScanner}
              aria-label="Som e vibração no QR code"
              onClick={alternarSom}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span
                aria-hidden="true"
                className={`relative inline-block w-12 h-7 rounded-full transition-colors ${somScanner ? 'bg-primary' : 'bg-line'}`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${somScanner ? 'right-1' : 'left-1'}`}
                />
              </span>
            </button>
          </div>
        </section>

        {ehAdmin && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Administração</h3>
            <button
              type="button"
              onClick={() => {
                if (onAbrirUsuarios) {
                  onAbrirUsuarios();
                } else {
                  setMostrarUsuariosInterno(true);
                }
              }}
              className="w-full min-h-[44px] bg-card border border-line rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-card-2 transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-xl bg-secondary-soft text-secondary flex items-center justify-center shrink-0">
                <User size={18} weight="duotone" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink">Usuários</span>
                <span className="block text-xs text-muted">Cadastrar, alterar papéis e desativar acessos</span>
              </span>
              <CaretRight size={18} className="text-muted shrink-0" />
            </button>
          </section>
        )}
      </div>
    </Sheet>
  );
}
