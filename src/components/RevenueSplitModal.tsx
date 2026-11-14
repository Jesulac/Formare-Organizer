import React, { useState } from 'react';
import { X, PieChart } from 'lucide-react';
import { calculateRevenueSplit, formatEuro } from '../utils/calculations';

interface RevenueSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RevenueSplitModal: React.FC<RevenueSplitModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [amountStr, setAmountStr] = useState('100');

  if (!isOpen) return null;

  const numAmount = parseFloat(amountStr.replace(',', '.')) || 0;
  const split = calculateRevenueSplit(numAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-md animate-backdrop-fade" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-md glass-modal rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-white/25 rounded-full mx-auto -mt-1 mb-4 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#93c5fd] animate-liquid-float-slow" />
            Calculadora de Reparto de Ingresos
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Amount Input */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Importe Total a Repartir (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Ej: 100"
              className="w-full liquid-input rounded-xl px-3.5 py-2.5 text-base text-white font-mono tabular-nums font-bold"
            />
          </div>

          {/* Breakdown Grid */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-zinc-400 block">
              Desglose Porcentual
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Costes Operativos */}
              <div className="glass-card glass-card-hover rounded-2xl p-3">
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Costes Operativos (20%)
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-amber-300 mt-1 block">
                  {formatEuro(split.operativos)}
                </span>
              </div>

              {/* Stock / Material */}
              <div className="glass-card glass-card-hover rounded-2xl p-3">
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Stock / Material (20%)
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-[#bae6fd] mt-1 block">
                  {formatEuro(split.stock)}
                </span>
              </div>

              {/* Productor */}
              <div className="glass-card glass-card-hover rounded-2xl p-3">
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Productor (30%)
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-purple-300 mt-1 block">
                  {formatEuro(split.productor)}
                </span>
              </div>

              {/* Beneficio Empresa */}
              <div className="glass-card-pastel glass-card-hover rounded-2xl p-3">
                <span className="text-[10px] text-[#bae6fd] block font-semibold">
                  Beneficio Empresa (30%)
                </span>
                <span className="text-lg font-extrabold font-mono tabular-nums text-[#e0f2fe] mt-1 block">
                  {formatEuro(split.empresa)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
