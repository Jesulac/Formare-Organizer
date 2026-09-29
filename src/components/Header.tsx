import React from 'react';
import {
  Plus,
  Smartphone,
  Monitor,
  FileText,
  Menu,
  Calculator,
} from 'lucide-react';

export type ViewMode = 'iphone' | 'desktop' | 'auto';
export type ActiveSection =
  | 'ventas'
  | 'produccion'
  | 'gastos'
  | 'filamentos'
  | 'qr'
  | 'calculadora';

interface HeaderProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  onNewOperation: () => void;
  onOpenPricingCalculator: () => void;
  onExportMonthlyPDF?: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenMobileSidebar: () => void;
}

const SECTION_META: Record<
  ActiveSection,
  { title: string; subtitle: string }
> = {
  ventas: {
    title: 'Panel General de Operaciones',
    subtitle: 'Control completo de ventas, producción, compras y cierres mensuales',
  },
  produccion: {
    title: 'Cola de Producción',
    subtitle: 'Pedidos actualmente en fabricación e impresión 3D',
  },
  gastos: {
    title: 'Gastos en General y Compras',
    subtitle: 'Compras de bobinas, material, inversiones y comisión 15% Sandra',
  },
  filamentos: {
    title: 'Stock de Filamentos (1000g)',
    subtitle: 'Inventario en gramos por bobina, consumo real y reposición',
  },
  qr: {
    title: 'Almacén de QR y Etiquetas',
    subtitle: 'Códigos de envío listos para escanear en Correos, InPost, Seur y Vinted Go',
  },
  calculadora: {
    title: 'Calculadora de Precios 3D',
    subtitle: 'Cálculo de costes por gramos de filamento, tornillería y multiplicadores',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNewOperation,
  onOpenPricingCalculator,
  onExportMonthlyPDF,
  viewMode,
  onViewModeChange,
  onOpenMobileSidebar,
}) => {
  const currentMeta = SECTION_META[activeSection] || SECTION_META.ventas;
  const showViewSwitcher =
    activeSection === 'ventas' ||
    activeSection === 'produccion' ||
    activeSection === 'gastos';

  return (
    <header className="sticky top-0 z-20 glass-header border-b border-white/[0.08] px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-3 transition-all duration-200">
      {/* Zone 1: Mobile Menu Trigger + Section Breadcrumb & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 -ml-1 rounded-xl text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-white truncate">
            {currentMeta.title}
          </h1>
          <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Zone 3: Contextual Controls & Primary Actions (No "Reparto" button) */}
      <div className="flex items-center gap-2 shrink-0">
        {showViewSwitcher && (
          <div className="flex items-center p-0.5 rounded-xl bg-zinc-900/90 border border-white/10">
            <button
              type="button"
              onClick={() => onViewModeChange('iphone')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'iphone'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Ver en formato tarjetas móviles"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('desktop')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'desktop'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Ver tabla completa"
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Tabla</span>
            </button>
          </div>
        )}

        {/* Quick Calculator Modal Trigger when not already in Calculator section */}
        {activeSection !== 'calculadora' && (
          <button
            type="button"
            onClick={onOpenPricingCalculator}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            title="Abrir calculadora rápida de precios"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden xl:inline">Calcular precio</span>
          </button>
        )}

        {/* Monthly PDF Report */}
        {onExportMonthlyPDF && (
          <button
            type="button"
            onClick={onExportMonthlyPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            title="Descargar resumen mensual en PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Resumen PDF</span>
          </button>
        )}

        {/* Primary Action: + Nueva Operación */}
        <button
          type="button"
          onClick={onNewOperation}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/15 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[2.75] shrink-0" />
          <span>Nueva Operación</span>
        </button>
      </div>
    </header>
  );
};
