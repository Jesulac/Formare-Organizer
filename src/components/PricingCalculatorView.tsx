import React, { useState } from 'react';
import { Calculator, Plus, Scale, Wrench, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  calculatePricingRules,
  calculateFastenerCost,
  formatEuro,
} from '../utils/calculations';
import { FilamentSpool } from '../types/operation';

interface PricingCalculatorViewProps {
  spools: FilamentSpool[];
  onCreateOperationWithPrice: (
    productName: string,
    materialCost: number,
    price: number,
    materialSummary?: string
  ) => void;
}

export const PricingCalculatorView: React.FC<PricingCalculatorViewProps> = ({
  spools,
  onCreateOperationWithPrice,
}) => {
  const [productName, setProductName] = useState('');
  const [calcMode, setCalcMode] = useState<'grams' | 'direct'>('grams');
  const [selectedSpool, setSelectedSpool] = useState<string>(spools[0]?.nombre || 'Negro');
  const [spoolPriceStr, setSpoolPriceStr] = useState<string>(
    String(spools[0]?.costePorBobina || 15.99)
  );
  const [gramsStr, setGramsStr] = useState<string>('150');
  const [directMaterialCostStr, setDirectMaterialCostStr] = useState('2.40');
  const [numScrews, setNumScrews] = useState(0);
  const [numNuts, setNumNuts] = useState(0);
  const [customPriceStr, setCustomPriceStr] = useState('');

  const handleSelectSpool = (name: string) => {
    setSelectedSpool(name);
    const found = spools.find((s) => s.nombre === name);
    if (found && found.costePorBobina > 0) {
      setSpoolPriceStr(String(found.costePorBobina));
    }
  };

  const spoolPrice = parseFloat(spoolPriceStr.replace(',', '.')) || 15.99;
  const grams = parseFloat(gramsStr.replace(',', '.')) || 0;
  const calculatedFilamentCost =
    calcMode === 'grams'
      ? Number(((grams * spoolPrice) / 1000).toFixed(2))
      : parseFloat(directMaterialCostStr.replace(',', '.')) || 0;

  const fastenersCost = calculateFastenerCost(numScrews, numNuts);
  const totalMaterialCost = Number((calculatedFilamentCost + fastenersCost).toFixed(2));
  const calc = calculatePricingRules(totalMaterialCost);

  const customPrice = parseFloat(customPriceStr.replace(',', '.')) || 0;
  const customProfit = Number((customPrice - totalMaterialCost).toFixed(2));

  const materialSummary =
    calcMode === 'grams' && grams > 0
      ? `${selectedSpool} (${Math.round(grams)}g)`
      : selectedSpool || 'PLA';

  return (
    <section className="px-3 sm:px-4 lg:px-6 py-4 max-w-[1400px] mx-auto space-y-5">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <span>Calculadora de Costes y Estrategia de Precios 3D</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Calcula el coste real por gramos de bobina (1000g) + tornillería y obtén el precio recomendado de venta al instante.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Nombre de la Pieza / Producto
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ej: Volante F1 Logitech, Alerón Coche, Soporte Reloj..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Mode Selector: Por Gramos vs Coste Directo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-300">
                Método de Cálculo de Filamento
              </span>
              <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-white/10">
                <button
                  type="button"
                  onClick={() => setCalcMode('grams')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    calcMode === 'grams'
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Por gramos (1000g)
                </button>
                <button
                  type="button"
                  onClick={() => setCalcMode('direct')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    calcMode === 'direct'
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Coste directo (€)
                </button>
              </div>
            </div>

            {calcMode === 'grams' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/50 border border-white/[0.08] rounded-xl p-3.5">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Bobina / Color
                  </label>
                  <select
                    value={selectedSpool}
                    onChange={(e) => handleSelectSpool(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    {spools.map((s) => (
                      <option key={s.nombre} value={s.nombre}>
                        {s.nombre} ({s.gramosRestantes}g disp.)
                      </option>
                    ))}
                    {spools.length === 0 && <option value="Negro">Negro</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Gramos de la pieza (g)
                  </label>
                  <div className="relative">
                    <Scale className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={gramsStr}
                      onChange={(e) => setGramsStr(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg pl-8 pr-2.5 py-2 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Precio bobina 1kg (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={spoolPriceStr}
                    onChange={(e) => setSpoolPriceStr(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                  <span className="text-zinc-400">
                    Coste de filamento ({Math.round(grams)}g × {formatEuro(spoolPrice)} / 1000g):
                  </span>
                  <span className="font-mono tabular-nums font-bold text-sky-300">
                    {formatEuro(calculatedFilamentCost)}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Coste directo del filamento (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={directMaterialCostStr}
                  onChange={(e) => setDirectMaterialCostStr(e.target.value)}
                  placeholder="Ej: 2.40"
                  className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            )}
          </div>

          {/* Fasteners / Tornillería */}
          <div className="bg-zinc-900/50 border border-white/[0.08] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-zinc-400" />
                <span>Tornillería y Herrajes Adicionales</span>
              </span>
              {fastenersCost > 0 && (
                <span className="text-xs font-mono tabular-nums text-emerald-400 font-semibold">
                  +{formatEuro(fastenersCost)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Tornillos (0,07 €/ud)
                </label>
                <input
                  type="number"
                  min="0"
                  value={numScrews}
                  onChange={(e) => setNumScrews(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Tuercas / Insertos (0,04 €/ud)
                </label>
                <input
                  type="number"
                  min="0"
                  value={numNuts}
                  onChange={(e) => setNumNuts(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Total Cost Summary Bar */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-sky-950/25 border border-sky-500/25">
            <div>
              <span className="text-xs font-semibold text-sky-300 block">
                Gasto Total de Producción de la Pieza
              </span>
              <span className="text-[11px] text-zinc-400">
                Filamento ({formatEuro(calculatedFilamentCost)}) + Tornillería ({formatEuro(fastenersCost)})
              </span>
            </div>
            <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-sky-300">
              {formatEuro(totalMaterialCost)}
            </span>
          </div>
        </div>

        {/* Right Column: Recommended Pricing Cards */}
        <div className="lg:col-span-5 space-y-4">
          {/* Recommended Price Card */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-emerald-500/35 bg-emerald-950/15 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Precio Recomendado (Multiplicador ×{calc.multiplier})</span>
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono tabular-nums text-white">
                {formatEuro(calc.recommendedPrice)}
              </span>
              <span className="text-xs font-mono tabular-nums text-emerald-300 font-semibold">
                Beneficio: +{formatEuro(calc.profitRecommended)}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onCreateOperationWithPrice(
                  productName.trim() || 'Producto Impreso 3D',
                  totalMaterialCost,
                  calc.recommendedPrice,
                  materialSummary
                )
              }
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-500/15"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Crear Venta con Precio Recomendado</span>
            </button>
          </div>

          {/* Max Discount Price Card */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">
                Precio Mínimo con Rebaja (×5)
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-zinc-200">
                {formatEuro(calc.maxDiscountPrice)}
              </span>
              <span className="text-xs font-mono tabular-nums text-zinc-400">
                Beneficio: +{formatEuro(calc.profitDiscount)}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onCreateOperationWithPrice(
                  productName.trim() || 'Producto Impreso 3D',
                  totalMaterialCost,
                  calc.maxDiscountPrice,
                  materialSummary
                )
              }
              className="w-full py-2 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Venta con Precio Rebajado</span>
            </button>
          </div>

          {/* Custom Price Simulator */}
          <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
            <label className="block text-xs font-medium text-zinc-300">
              Simular Otro Precio de Venta (€)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                value={customPriceStr}
                onChange={(e) => setCustomPriceStr(e.target.value)}
                placeholder="Ej: 18.00"
                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-emerald-500/50"
              />
              {customPrice > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onCreateOperationWithPrice(
                      productName.trim() || 'Producto Impreso 3D',
                      totalMaterialCost,
                      customPrice,
                      materialSummary
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs whitespace-nowrap cursor-pointer"
                >
                  Usar {formatEuro(customPrice)}
                </button>
              )}
            </div>
            {customPrice > 0 && (
              <div className="flex items-center justify-between text-[11px] pt-1 text-zinc-400">
                <span>Beneficio neto estimado:</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    customProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatEuro(customProfit)}
                </span>
              </div>
            )}
          </div>

          {/* Business Rules Box */}
          <div className="rounded-xl bg-zinc-900/50 border border-white/[0.06] p-3.5 text-[11px] text-zinc-400 space-y-1">
            <div className="font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tabla de Multiplicadores Formare 3D</span>
            </div>
            <p>• Coste de producción &lt; 1,00 € → Multiplicador ×8</p>
            <p>• Coste entre 1,00 € y 3,00 € → Multiplicador ×7</p>
            <p>• Coste superior a 3,00 € → Multiplicador ×6</p>
            <p>• Descuento máximo permitido: Coste ×5</p>
          </div>
        </div>
      </div>
    </section>
  );
};
