import React, { useState } from 'react';
import { X, Calculator, Plus, ArrowRight, Check } from 'lucide-react';
import { 
  calculatePricingRules, 
  calculateFastenerCost, 
  formatEuro 
} from '../utils/calculations';

interface PricingCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOperationWithPrice: (productName: string, materialCost: number, price: number) => void;
}

export const PricingCalculatorModal: React.FC<PricingCalculatorModalProps> = ({
  isOpen,
  onClose,
  onCreateOperationWithPrice,
}) => {
  const [productName, setProductName] = useState('');
  const [materialCostStr, setMaterialCostStr] = useState('2.40');
  const [numScrews, setNumScrews] = useState(0);
  const [numNuts, setNumNuts] = useState(0);

  if (!isOpen) return null;

  const baseMaterialCost = parseFloat(materialCostStr.replace(',', '.')) || 0;
  const fastenersCost = calculateFastenerCost(numScrews, numNuts);
  const totalMaterialCost = baseMaterialCost + fastenersCost;

  const calc = calculatePricingRules(totalMaterialCost);

  const handleCreate = (selectedPrice: number) => {
    onCreateOperationWithPrice(
      productName.trim() || 'Producto Impreso 3D',
      totalMaterialCost,
      selectedPrice
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-md animate-backdrop-fade" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg glass-modal rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-white/25 rounded-full mx-auto -mt-1 mb-4 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#93c5fd] animate-liquid-float-slow" />
            Estrategia & Calculadora de Precios
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Optional Product Name */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Nombre del Producto (opcional)
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ej: Volante F1 Logitech, Soporte Reloj BMW..."
              className="w-full liquid-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500"
            />
          </div>

          {/* Material Cost Input */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Coste del Filamento / Material (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={materialCostStr}
              onChange={(e) => setMaterialCostStr(e.target.value)}
              placeholder="Ej: 2.40"
              className="w-full liquid-input rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tabular-nums"
            />
          </div>

          {/* Screws & Nuts Helper */}
          <div className="glass-card rounded-2xl p-3 space-y-2">
            <span className="text-[11px] font-semibold text-zinc-300 block">
              Tornillería Adicional
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">
                  Tornillos (0,07 €/ud)
                </label>
                <input
                  type="number"
                  min="0"
                  value={numScrews}
                  onChange={(e) => setNumScrews(parseInt(e.target.value, 10) || 0)}
                  className="w-full liquid-input rounded-lg px-2.5 py-1.5 text-xs text-white font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">
                  Tuercas (0,04 €/ud)
                </label>
                <input
                  type="number"
                  min="0"
                  value={numNuts}
                  onChange={(e) => setNumNuts(parseInt(e.target.value, 10) || 0)}
                  className="w-full liquid-input rounded-lg px-2.5 py-1.5 text-xs text-white font-mono tabular-nums"
                />
              </div>
            </div>
            {fastenersCost > 0 && (
              <p className="text-[10px] text-[#bae6fd] font-mono tabular-nums text-right">
                + {formatEuro(fastenersCost)} tornillería
              </p>
            )}
          </div>

          {/* Calculation Strategy Results */}
          <div className="space-y-2.5 pt-2">
            <div className="text-[11px] font-semibold text-zinc-400">
              Resultado según Reglas de Negocio
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Recommended Price Card */}
              <div className="glass-card-pastel rounded-2xl p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#bae6fd] font-semibold block">
                    Precio Recomendado (×{calc.multiplier})
                  </span>
                  <span className="text-xl font-extrabold font-mono tabular-nums text-[#e0f2fe] mt-1 block">
                    {formatEuro(calc.recommendedPrice)}
                  </span>
                  <span className="text-[10px] text-[#93c5fd]/85 block mt-1">
                    Beneficio: +{formatEuro(calc.profitRecommended)}
                  </span>
                </div>

                <button
                  onClick={() => handleCreate(calc.recommendedPrice)}
                  className="mt-3 w-full py-1.5 px-2 rounded-xl liquid-btn-primary font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear con este precio</span>
                </button>
              </div>

              {/* Max Discount Price Card */}
              <div className="glass-card rounded-2xl p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                    Descuento Máximo (×5)
                  </span>
                  <span className="text-xl font-bold font-mono tabular-nums text-zinc-200 mt-1 block">
                    {formatEuro(calc.maxDiscountPrice)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    Beneficio: +{formatEuro(calc.profitDiscount)}
                  </span>
                </div>

                <button
                  onClick={() => handleCreate(calc.maxDiscountPrice)}
                  className="mt-3 w-full py-1.5 px-2 rounded-xl liquid-btn-glass text-zinc-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear con rebaja</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rules Explanation Box */}
          <div className="glass-card rounded-2xl p-3 text-[10px] text-zinc-400 space-y-1">
            <span className="font-semibold text-zinc-200 block mb-1">Reglas Aplicadas:</span>
            <p>• Coste &lt; 1,00 € → Multiplicador ×8</p>
            <p>• Coste entre 1,00 € y 3,00 € → Multiplicador ×7</p>
            <p>• Coste &gt; 3,00 € → Multiplicador ×6</p>
            <p>• Mínimo de descuento: Coste ×5</p>
          </div>
        </div>
      </div>
    </div>
  );
};
