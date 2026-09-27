import React, { useState } from 'react';
import { 
  Plus, 
  Calculator, 
  PieChart, 
  Download, 
  Upload, 
  RotateCcw, 
  Trash2,
  MoreVertical,
  Smartphone,
  Monitor,
  Disc,
  QrCode,
  Table2
} from 'lucide-react';

export type ViewMode = 'iphone' | 'desktop' | 'auto';
export type ActiveSection = 'ventas' | 'filamentos' | 'qr';

interface HeaderProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  onNewOperation: () => void;
  onOpenPricingCalculator: () => void;
  onOpenRevenueSplit: () => void;
  onExportJSON: () => void;
  onImportJSON: (fileContent: string) => void;
  onResetData: () => void;
  onClearAllData: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  qrCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onSectionChange,
  onNewOperation,
  onOpenPricingCalculator,
  onOpenRevenueSplit,
  onExportJSON,
  onImportJSON,
  onResetData,
  onClearAllData,
  viewMode,
  onViewModeChange,
  qrCount = 0,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

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
    <header className="sticky top-0 z-30 glass-header border-b border-white/10 px-3 sm:px-4 lg:px-6 py-2.5 pt-safe transition-all duration-200">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Left: App Logo, Title & Subtitle */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/favicon.svg"
              alt="Formare 3D Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-emerald-500/30 shadow-md shadow-emerald-500/10 shrink-0"
            />
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-white truncate">
                  Formare 3D
                </h1>
              </div>
              <span className="text-[11px] font-normal text-zinc-400 -mt-0.5 truncate">
                Producción, ventas y aprovisionamiento
              </span>
            </div>
          </div>

          {/* Center: Section Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-zinc-900/90 border border-white/10">
            <button
              type="button"
              onClick={() => onSectionChange('ventas')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeSection === 'ventas'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Control Ventas / Compras</span>
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('filamentos')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeSection === 'filamentos'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Stock Filamentos (1000g)</span>
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('qr')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeSection === 'qr'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Almacenamiento QR</span>
              {qrCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSection === 'qr' ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {qrCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* View Switcher: Vista móvil vs Tabla */}
            <div className="flex items-center p-0.5 rounded-full bg-zinc-900/90 border border-white/10">
              <button
                type="button"
                onClick={() => onViewModeChange('iphone')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  viewMode === 'iphone'
                    ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Ver en formato Vista móvil"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Vista móvil</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('desktop')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  viewMode === 'desktop'
                    ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Ver tabla completa"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Tabla</span>
              </button>
            </div>

            {/* Quick Tool: Calculator */}
            <button
              type="button"
              onClick={onOpenPricingCalculator}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 cursor-pointer"
              title="Calcular precio recomendado"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Calcular precio</span>
            </button>

            {/* Quick Tool: Revenue Split */}
            <button
              type="button"
              onClick={onOpenRevenueSplit}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 cursor-pointer"
              title="Calculadora de reparto de ingresos"
            >
              <PieChart className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Reparto</span>
            </button>

            {/* Extra Options Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(!showMenu);
                  setConfirmAction(null);
                }}
                className="p-2 rounded-full text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 cursor-pointer"
                aria-label="Opciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => {
                      setShowMenu(false);
                      setConfirmAction(null);
                    }} 
                  />
                  <div className="absolute right-0 mt-2 w-60 z-50 glass-modal rounded-2xl p-1.5 shadow-2xl border border-white/15 text-xs">
                    <div className="px-3 py-2 border-b border-white/10 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Vista y Herramientas
                    </div>

                    <div className="px-2 py-1.5 flex gap-1 border-b border-white/10 mb-1">
                      <button
                        type="button"
                        onClick={() => {
                          onViewModeChange('iphone');
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
                          viewMode === 'iphone' ? 'bg-emerald-500 text-black font-semibold' : 'bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        Vista móvil
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onViewModeChange('desktop');
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
                          viewMode === 'desktop' ? 'bg-emerald-500 text-black font-semibold' : 'bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        Tabla
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        onOpenPricingCalculator();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors text-left cursor-pointer"
                    >
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      Calcular Precio
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenRevenueSplit();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors text-left cursor-pointer"
                    >
                      <PieChart className="w-4 h-4 text-blue-400" />
                      Calculadora Reparto
                    </button>

                    <div className="my-1 border-t border-white/10" />

                    <button
                      type="button"
                      onClick={() => {
                        onExportJSON();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors text-left cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-zinc-400" />
                      Exportar Copia (JSON)
                    </button>

                    <label className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer text-left">
                      <Upload className="w-4 h-4 text-zinc-400" />
                      Importar Copia (JSON)
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <div className="my-1 border-t border-white/10" />

                    {confirmAction === 'reset' ? (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <p className="text-[11px] text-amber-300 font-medium">
                          ¿Restaurar las operaciones originales de Formare 3D?
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onResetData();
                              setConfirmAction(null);
                              setShowMenu(false);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-amber-500 text-black font-semibold text-[11px] cursor-pointer"
                          >
                            Sí, restaurar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="flex-1 py-1.5 rounded-lg bg-white/10 text-zinc-300 text-[11px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmAction('reset')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restaurar Datos Iniciales
                      </button>
                    )}

                    {confirmAction === 'clear' ? (
                      <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 mt-1">
                        <p className="text-[11px] text-rose-300 font-medium">
                          ¿Vaciar todas las operaciones y empezar de cero?
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onClearAllData();
                              setConfirmAction(null);
                              setShowMenu(false);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-semibold text-[11px] cursor-pointer"
                          >
                            Vaciar todo
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="flex-1 py-1.5 rounded-lg bg-white/10 text-zinc-300 text-[11px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmAction('clear')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar Datos de Ejemplo
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Primary Action Button: + Nueva Operación */}
            <button
              type="button"
              onClick={onNewOperation}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs lg:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nueva</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Section Navigation Bar */}
        <nav className="flex lg:hidden items-center gap-1 p-1 rounded-2xl bg-zinc-900/90 border border-white/10">
          <button
            type="button"
            onClick={() => onSectionChange('ventas')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
              activeSection === 'ventas'
                ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Table2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Ventas / Compras</span>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('filamentos')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
              activeSection === 'filamentos'
                ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Filamentos (g)</span>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('qr')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
              activeSection === 'qr'
                ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Almacén QR</span>
            {qrCount > 0 && (
              <span className={`px-1.5 rounded-full text-[10px] font-bold ${
                activeSection === 'qr' ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {qrCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
