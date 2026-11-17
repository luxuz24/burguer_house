import { useState } from 'react';
import Sheet from './ui/Sheet';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import type { ResultadoEstorno } from '../lib/fechamentoDia';

const LIMITE_MOTIVO = 500;

interface Props {
  aberto: boolean;
  vendaId: string;
  onFechar: () => void;
  onEstornado: (resultado: ResultadoEstorno) => void;
  /** O backend respondeu 409: outra pessoa (ou outro toque) já estornou este fechamento. */
  onJaEstornado: () => void;
}

/** Estorno de um fechamento manual com motivo obrigatório. Reutilizado pela tela do dia (13) e pela lista do dia (14). */
export default function EstornoFechamentoSheet({ aberto, vendaId, onFechar, onEstornado, onJaEstornado }: Props) {
  const { confirmar } = useFeedback();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const motivoLimpo = motivo.trim();

  const { enviando, executar } = useEnvio(async () => {
    const ok = await confirmar({
      titulo: 'Estornar fechamento?',
      mensagem: 'O estoque dos itens deste fechamento será devolvido.',
      textoConfirmar: 'Estornar',
      perigoso: true,
    });
    if (!ok) return;
    setErro(null);
    try {
      const resp = await api.post<ResultadoEstorno>(`/vendas/${vendaId}/estornar`, { motivo: motivoLimpo });
      onEstornado(resp.data);
      onFechar();
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        onJaEstornado();
        onFechar();
        return;
      }
      setErro(mensagemDeErro(error, 'Não foi possível estornar o fechamento.'));
    }
  });

  return (
    <Sheet
      open={aberto}
      onClose={onFechar}
      title="Desfazer fechamento"
      subtitle="Informe por que o fechamento está sendo desfeito."
      footer={
        <button
          type="button"
          disabled={!motivoLimpo || enviando}
          onClick={() => void executar()}
          className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? 'Estornando…' : 'Estornar fechamento'}
        </button>
      }
    >
      <div className="space-y-2">
        <label htmlFor="motivo-estorno" className="block text-xs font-semibold text-muted">
          Motivo do estorno
        </label>
        <textarea
          id="motivo-estorno"
          aria-label="Motivo do estorno"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, LIMITE_MOTIVO))}
          className="w-full bg-field border border-line rounded-2xl px-3 py-2 text-ink"
        />
        <p className="text-xs text-muted text-right">{motivo.length}/{LIMITE_MOTIVO}</p>
        {erro && (
          <p role="alert" className="bg-danger-soft border border-danger/40 text-danger rounded-xl p-3 text-xs font-semibold">
            {erro}
          </p>
        )}
      </div>
    </Sheet>
  );
}
