import { useState } from 'react';
import { CaretDown, CaretRight, CaretUp, Clock, Warning } from './ui/icons';
import { formatarDataHora, formatarQuantidade } from '../lib/formatar';
import {
  rotuloAcaoRetida,
  rotuloMotivoRetida,
  textoAcaoAcessivelRetida,
  textoAguardandoEstado,
  textoTotalRetidas,
  textoVendasContagem,
  type AcaoVendaRetida,
  type VendasRetidasResposta,
} from '../lib/vendasRetidas';

interface Props {
  dados: VendasRetidasResposta | null | undefined;
  onCorrigirItem: (acao: AcaoVendaRetida) => void;
  onAbrirCardapio?: () => void;
  onCarregarMais?: () => void;
  carregandoMais?: boolean;
  limiteResumo?: number;
}

export default function VendasRetidasPainel({
  dados,
  onCorrigirItem,
  onAbrirCardapio,
  onCarregarMais,
  carregandoMais = false,
  limiteResumo,
}: Props) {
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  if (!dados || dados.totalRetidas <= 0) {
    return null;
  }

  const itensResumo =
    typeof limiteResumo === 'number'
      ? dados.resumoPorProduto.slice(0, limiteResumo)
      : dados.resumoPorProduto;
  const ocultosNoResumo = dados.resumoPorProduto.length - itensResumo.length;

  return (
    <section
      aria-label="Vendas retidas"
      className="bg-card border border-danger/40 rounded-3xl px-4 py-3 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-1.5 text-ink">
            <Warning size={18} weight="fill" className="text-danger shrink-0" />
            <span>{textoTotalRetidas(dados.totalRetidas)}</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Baixa de estoque pausada até o cardápio ser ajustado.
          </p>
        </div>
        {onAbrirCardapio && (
          <button
            type="button"
            onClick={onAbrirCardapio}
            className="text-xs font-semibold text-secondary flex items-center gap-0.5 cursor-pointer min-h-[44px] shrink-0"
          >
            Corrigir cardápio <CaretRight size={12} weight="bold" />
          </button>
        )}
      </div>

      {itensResumo.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {itensResumo.map((item) => {
            const labelBotao = rotuloAcaoRetida(item.tipo);
            const labelAcessivel = textoAcaoAcessivelRetida(item.tipo, item.produto);
            return (
              <div
                key={`${item.tipo}:${item.produto}`}
                className="flex items-center justify-between gap-2.5 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink break-words">
                    {item.produto || 'Item sem nome'}
                  </p>
                  <p className="text-xs text-muted break-words">
                    {textoVendasContagem(item.vendas)} · {rotuloMotivoRetida(item.tipo)}
                  </p>
                </div>
                {labelBotao && labelAcessivel && (
                  <button
                    type="button"
                    onClick={() => onCorrigirItem({ produto: item.produto, tipo: item.tipo })}
                    aria-label={labelAcessivel}
                    className="shrink-0 text-xs font-semibold px-3 rounded-full min-h-[44px] bg-primary-soft text-brand hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
                  >
                    {labelBotao}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {ocultosNoResumo > 0 && onAbrirCardapio && (
        <button
          type="button"
          onClick={onAbrirCardapio}
          className="text-xs font-semibold text-brand cursor-pointer min-h-[44px] flex items-center"
        >
          Ver mais {formatarQuantidade(ocultosNoResumo)} no cardápio
        </button>
      )}

      {dados.aguardandoEstado > 0 && (
        <div className="bg-card-2 border border-line rounded-2xl px-3 py-2 flex items-center gap-2 text-xs text-muted">
          <Clock size={15} className="shrink-0 text-secondary" />
          <span className="min-w-0 break-words">
            {textoAguardandoEstado(dados.aguardandoEstado)} (sem erro de cardápio).
          </span>
        </div>
      )}

      {dados.retidas.length > 0 && (
        <div className="pt-0.5">
          <button
            type="button"
            aria-expanded={mostrarDetalhes}
            onClick={() => setMostrarDetalhes((v) => !v)}
            className="text-xs font-semibold text-secondary flex items-center gap-1 cursor-pointer min-h-[44px]"
          >
            {mostrarDetalhes ? 'Ocultar detalhes' : `Ver detalhes (${formatarQuantidade(dados.retidas.length)})`}
            {mostrarDetalhes ? <CaretUp size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
          </button>

          {mostrarDetalhes && (
            <div className="space-y-2 mt-1">
              {dados.retidas.map((venda) => (
                <div
                  key={venda.id}
                  className="bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink truncate">
                      {venda.externalId ? `Pedido ${venda.externalId}` : `Venda ${venda.id.slice(0, 8)}`}
                    </span>
                    <span className="text-muted shrink-0">{formatarDataHora(venda.criadoEm)}</span>
                  </div>
                  <ul className="space-y-0.5 text-muted">
                    {venda.motivos.map((motivo, idx) => (
                      <li key={`${venda.id}-${motivo.tipo}-${idx}`} className="break-words">
                        <span className="text-danger font-medium">{rotuloMotivoRetida(motivo.tipo)}</span>
                        {motivo.detalhe ? ` — ${motivo.detalhe}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {dados.temMais && (
                <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted">
                  <span>
                    Analisadas {formatarQuantidade(dados.totalPendentesAnalisadas)} de{' '}
                    {formatarQuantidade(dados.totalPendentes)} pendentes.
                  </span>
                  {onCarregarMais && (
                    <button
                      type="button"
                      disabled={carregandoMais}
                      onClick={onCarregarMais}
                      className="text-xs font-semibold text-secondary underline cursor-pointer min-h-[44px] shrink-0 disabled:opacity-50"
                    >
                      {carregandoMais ? 'Carregando...' : 'Carregar próximas'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
