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
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-md glass-modal rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl z-10">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1 mb-4 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            Calculadora de Reparto de Ingresos
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
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
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Breakdown Grid */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-zinc-400 block">
              Desglose Porcentual
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Costes Operativos */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Costes Operativos (20%)
                </span>
                <span className="text-lg font-bold font-mono text-amber-300 mt-1 block">
                  {formatEuro(split.operativos)}
                </span>
              </div>

              {/* Stock / Material */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Stock / Material (20%)
                </span>
                <span className="text-lg font-bold font-mono text-sky-300 mt-1 block">
                  {formatEuro(split.stock)}
                </span>
              </div>

              {/* Productor */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Productor (30%)
                </span>
                <span className="text-lg font-bold font-mono text-purple-300 mt-1 block">
                  {formatEuro(split.productor)}
                </span>
              </div>

              {/* Beneficio Empresa */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3">
                <span className="text-[10px] text-emerald-400 block font-semibold">
                  Beneficio Empresa (30%)
                </span>
                <span className="text-lg font-extrabold font-mono text-emerald-300 mt-1 block">
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
