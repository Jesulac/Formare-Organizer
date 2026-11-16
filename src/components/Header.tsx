import React from 'react';
import { Menu, Calculator, Camera, FileText, Plus, LayoutGrid, Table } from 'lucide-react';
import { SlidingSegmentedControl } from './SlidingSegmentedControl';
import { ThemeSelector, StyleSelector } from './ThemeSelector';
import { ThemeId, VisualStyleId } from '../utils/themes';

export type ViewMode = 'iphone' | 'desktop' | 'auto';
export type ActiveSection =
  | 'ventas'
  | 'produccion'
  | 'gastos'
  | 'filamentos'
  | 'qr'
  | 'calculadora'
  | 'camara';

interface HeaderProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  onNewOperation: () => void;
  onOpenPricingCalculator: () => void;
  onExportMonthlyPDF?: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenMobileSidebar: () => void;
  currentTheme: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  currentStyle: VisualStyleId;
  onSelectStyle: (styleId: VisualStyleId) => void;
}

const SECTION_META: Record<
  ActiveSection,
  { title: string; shortTitle: string; subtitle: string }
> = {
  ventas: {
    title: 'Panel General de Operaciones',
    shortTitle: 'Panel General',
    subtitle: 'Control completo de ventas, producción, compras y cierres mensuales',
  },
  produccion: {
    title: 'Cola de Producción',
    shortTitle: 'Producción',
    subtitle: 'Pedidos actualmente en fabricación e impresión 3D',
  },
  gastos: {
    title: 'Gastos en General y Compras',
    shortTitle: 'Gastos',
    subtitle: 'Compras de bobinas, material, inversiones y comisión 15% Sandra',
  },
  filamentos: {
    title: 'Stock de Filamentos (1000g)',
    shortTitle: 'Filamentos',
    subtitle: 'Inventario en gramos por bobina, consumo real y reposición',
  },
  qr: {
    title: 'Almacén de QR y Etiquetas',
    shortTitle: 'Almacén QR',
    subtitle: 'Códigos de envío listos para escanear en Correos, InPost, Seur y Vinted Go',
  },
  calculadora: {
    title: 'Calculadora de Precios 3D',
    shortTitle: 'Calculadora',
    subtitle: 'Cálculo de costes por gramos de filamento, tornillería y multiplicadores',
  },
  camara: {
    title: 'Cámara de la Impresora 3D',
    shortTitle: 'Cámara 3D',
    subtitle: 'Control y transmisión en directo a través de OctoEverywhere',
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
  currentTheme,
  onSelectTheme,
  currentStyle,
  onSelectStyle,
}) => {
  const currentMeta = SECTION_META[activeSection] || SECTION_META.ventas;
  const showViewSwitcher =
    activeSection === 'ventas' ||
    activeSection === 'produccion' ||
    activeSection === 'gastos';

  return (
    <header className="sticky top-0 z-20 glass-header border-b border-white/[0.1] px-2.5 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3 transition-all duration-300">
      {/* Zone 1: Mobile Menu Trigger + Section Breadcrumb & Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-zinc-200 hover:text-white liquid-btn-glass cursor-pointer shrink-0"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] sm:text-base lg:text-lg font-bold tracking-tight text-white truncate">
            <span className="sm:hidden">{currentMeta.shortTitle}</span>
            <span className="hidden sm:inline">{currentMeta.title}</span>
          </h1>
          <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Zone 3: Contextual Controls & Primary Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Color Theme Circles + Visual Style Selector (al lado de Tarjetas / Tabla) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <ThemeSelector
            currentTheme={currentTheme}
            onSelectTheme={onSelectTheme}
            variant="dots"
            size="sm"
            className="hidden xl:inline-flex"
          />
          <ThemeSelector
            currentTheme={currentTheme}
            onSelectTheme={onSelectTheme}
            variant="compact"
            className="xl:hidden"
          />

          <StyleSelector
            currentStyle={currentStyle}
            onSelectStyle={onSelectStyle}
          />
        </div>

        {/* View Mode Switcher (Tarjetas / Tabla) con Burbuja Deslizante */}
        {showViewSwitcher && (
          <div className="hidden sm:block">
            <SlidingSegmentedControl
              options={[
                { id: 'iphone', label: 'Tarjetas', icon: LayoutGrid },
                { id: 'desktop', label: 'Tabla', icon: Table },
              ]}
              value={viewMode === 'desktop' ? 'desktop' : 'iphone'}
              onChange={(val) => onViewModeChange(val as ViewMode)}
              size="sm"
            />
          </div>
        )}

        {/* Quick Calculator Modal Trigger when not already in Calculator section */}
        {activeSection !== 'calculadora' && (
          <button
            type="button"
            onClick={onOpenPricingCalculator}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-100 liquid-btn-glass cursor-pointer whitespace-nowrap"
            title="Abrir calculadora rápida de precios"
          >
            <Calculator className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span className="hidden xl:inline">Calcular precio</span>
          </button>
        )}

        {/* Quick Camera Link (OctoEverywhere) */}
        <a
          href="https://formare3d.octoeverywhere.com/network-device-manager/network/control"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium liquid-btn-pastel-glass cursor-pointer whitespace-nowrap"
          title="Ver cámara de la impresora (OctoEverywhere)"
        >
          <Camera className="w-3.5 h-3.5 text-theme-light shrink-0 animate-liquid-float-slow" />
          <span className="hidden md:inline">Ver cámara</span>
        </a>

        {/* Monthly PDF Report */}
        {onExportMonthlyPDF && (
          <button
            type="button"
            onClick={onExportMonthlyPDF}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium liquid-btn-pastel-glass cursor-pointer whitespace-nowrap"
            title="Descargar resumen mensual en PDF"
          >
            <FileText className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span className="hidden sm:inline">Resumen PDF</span>
          </button>
        )}

        {/* Primary Action: + Nueva Operación */}
        <button
          type="button"
          onClick={onNewOperation}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 h-10 sm:h-auto sm:py-2 rounded-xl liquid-btn-primary font-bold text-xs cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[2.75] shrink-0" />
          <span className="sm:hidden">Nueva</span>
          <span className="hidden sm:inline">Nueva Operación</span>
        </button>
      </div>
    </header>
  );
};
