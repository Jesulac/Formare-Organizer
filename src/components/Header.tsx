import React, { useState } from 'react';
import { 
  Plus, 
  Calculator, 
  PieChart, 
  Download, 
  Upload, 
  RotateCcw, 
  MoreVertical,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  onNewOperation: () => void;
  onOpenPricingCalculator: () => void;
  onOpenRevenueSplit: () => void;
  onExportJSON: () => void;
  onImportJSON: (fileContent: string) => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewOperation,
  onOpenPricingCalculator,
  onOpenRevenueSplit,
  onExportJSON,
  onImportJSON,
  onResetData,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJSON(content);
      }
    };
    reader.readAsText(file);
    setShowMenu(false);
  };

  return (
    <header className="sticky top-0 z-30 glass-header border-b border-white/10 px-4 lg:px-8 py-3 pt-safe transition-all duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: App Title & Subtitle */}
        <div className="flex flex-col justify-center">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Ventas
          </h1>
          <span className="text-xs font-normal text-zinc-400 -mt-0.5">
            Tu actividad
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Tool: Calculator */}
          <button
            onClick={onOpenPricingCalculator}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
            title="Calcular precio recomendado"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Precio</span>
          </button>

          {/* Quick Tool: Revenue Split */}
          <button
            onClick={onOpenRevenueSplit}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
            title="Calculadora de reparto de ingresos"
          >
            <PieChart className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Reparto</span>
          </button>

          {/* Extra Options Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
              aria-label="Opciones"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-52 z-50 glass-modal rounded-2xl p-1.5 shadow-2xl border border-white/10 text-xs">
                  <div className="px-3 py-2 border-b border-white/10 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                    Herramientas
                  </div>
                  
                  <button
                    onClick={() => {
                      onOpenPricingCalculator();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors sm:hidden text-left"
                  >
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    Calcular Precio
                  </button>

                  <button
                    onClick={() => {
                      onOpenRevenueSplit();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors sm:hidden text-left"
                  >
                    <PieChart className="w-4 h-4 text-blue-400" />
                    Calculadora Reparto
                  </button>

                  <button
                    onClick={() => {
                      onExportJSON();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors text-left"
                  >
                    <Download className="w-4 h-4 text-zinc-400" />
                    Exportar Copia (JSON)
                  </button>

                  <label className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer text-left">
                    <Upload className="w-4 h-4 text-zinc-400" />
                    Restaurar Copia (JSON)
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      if (confirm('¿Restablecer los datos originales de demostración?')) {
                        onResetData();
                      }
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar Datos Ejemplo
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Primary Action Button: + Nueva Operación */}
          <button
            onClick={onNewOperation}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs lg:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva</span>
          </button>
        </div>
      </div>
    </header>
  );
};
