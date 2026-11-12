import { useState } from 'react';
import { Moon, Sun, Monitor, GearSix } from './ui/icons';
import { useTheme } from '../context/ThemeContext';
import Sheet from './ui/Sheet';
import { CHAVE_SOM_SCANNER, lerSomScanner } from '../lib/bipScanner';
import { gravarArmazenado } from '../lib/armazenamento';

interface Props {
  aberto: boolean;
  onFechar: () => void;
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
export default function ConfiguracoesModal({ aberto, onFechar }: Props) {
  const { theme, setTheme } = useTheme();
  const [somScanner, setSomScanner] = useState(lerSomScanner);

  const alternarSom = () => {
    const novo = !somScanner;
    setSomScanner(novo);
    gravarArmazenado(CHAVE_SOM_SCANNER, String(novo));
  };

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
              className={`relative w-12 h-7 rounded-full shrink-0 cursor-pointer transition-colors ${somScanner ? 'bg-primary' : 'bg-line'}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${somScanner ? 'right-1' : 'left-1'}`}
              />
            </button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
