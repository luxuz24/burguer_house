import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Plus, Trash2, Edit2, ChevronDown } from 'lucide-react';

interface Ingrediente {
  id: string;
  nome: string;
  quantidadeBruta: string;
  perda: number;
}

export default function FichaTecnica() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([
    { id: '1', nome: 'Pão Brioche Tradicional', quantidadeBruta: '1 un', perda: 0 },
    { id: '2', nome: 'Blend Bovino 160g', quantidadeBruta: '320g', perda: 5 },
    { id: '3', nome: 'Bacon Fatiado Defumado', quantidadeBruta: '60g', perda: 8 },
    { id: '4', nome: 'Queijo Cheddar Fatiado', quantidadeBruta: '40g', perda: 2 },
    { id: '5', nome: 'Molho Especial da Casa', quantidadeBruta: '30ml', perda: 3 },
  ]);

  return (
    <div className="bg-gray-50 flex flex-col min-h-full pb-20">
      {/* Header Ficha Tecnica */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <button className="text-gray-600 p-1 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Ficha Técnica: X-Bacon Duplo
            </h1>
            <p className="text-xs text-gray-500">
              Hambúrgueres Artesanais • <span className="text-blue-500">Cód: #BRG-012</span>
            </p>
          </div>
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-green-200">
            <CheckCircle2 size={14} /> Ativo
          </span>
        </div>

        {/* Info Block */}
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center">
                {/* Ícone sanduíche simplificado */}
                🍔
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Estrutura de Montagem</p>
              <p className="text-xs text-gray-500">{ingredientes.length} insumos na ficha</p>
            </div>
          </div>
        </div>

        <button className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm">
          <Plus size={20} strokeWidth={2.5} />
          Adicionar Insumo
        </button>
      </div>

      {/* Lista de Ingredientes */}
      <div className="p-4 flex-1">
        <h2 className="text-xs font-semibold text-gray-500 tracking-wider mb-3 px-1 uppercase">
          Ingredientes da Receita
        </h2>

        <div className="flex flex-col gap-3">
          {ingredientes.map((ing) => (
            <div key={ing.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{ing.nome}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium text-gray-800 text-sm">{ing.quantidadeBruta}</span>
                    <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      Perda: {ing.perda}%
                    </span>
                  </div>
                </div>
                
                <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors -mt-1 -mr-1">
                  <Trash2 size={18} />
                </button>
              </div>
              
              {/* Ajuste de Quantidade Rápido */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">Desconto final aplicado automaticamente</span>
                <button className="text-blue-600 flex items-center gap-1 text-xs font-medium hover:bg-blue-50 px-2 py-1 rounded-md transition-colors">
                  <Edit2 size={12} /> Editar Qtd
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Fixo */}
      <div className="bg-white border-t border-gray-200 p-4 pb-6 mt-auto">
        <button className="w-full bg-green-600 text-white rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm text-lg">
          <CheckCircle2 size={22} />
          Salvar Ficha Técnica
        </button>
      </div>
    </div>
  );
}
