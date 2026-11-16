import React, { useState, useEffect, useMemo } from 'react';
import { useOperations } from './hooks/useOperations';
import { Header, ViewMode, ActiveSection } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SectionTransition } from './components/SectionTransition';
import { DashboardSummary } from './components/DashboardSummary';
import { FilterBar } from './components/FilterBar';
import { OperationsList } from './components/OperationsList';
import { EmptyState } from './components/EmptyState';
import { OperationModal } from './components/OperationModal';
import { PricingCalculatorModal } from './components/PricingCalculatorModal';
import { PricingCalculatorView } from './components/PricingCalculatorView';
import { FilamentStockView } from './components/FilamentStockView';
import { QrStorageView } from './components/QrStorageView';
import { AccessCodeGate } from './components/AccessCodeGate';
import { SlidingSegmentedControl } from './components/SlidingSegmentedControl';
import { Operation, Status, SortField, SortOrder } from './types/operation';
import {
  formatEuro,
  parseDate,
  calculateSandraCommission,
} from './utils/calculations';
import { isDeviceAuthorized } from './utils/deviceAuth';
import {
  ThemeId,
  VisualStyleId,
  getStoredThemeId,
  getStoredStyleId,
  applyThemeToDocument,
  applyStyleToDocument,
} from './utils/themes';

import {
  Plus,
  CheckCircle2,
  Printer,
  Receipt,
  Table2,
  Disc,
  QrCode,
  Clock,
  Layers,
  Camera,
  ExternalLink,
} from 'lucide-react';

const SECTION_STORAGE_KEY = 'formare3d_active_section';
const VIEW_MODE_STORAGE_KEY = 'formare3d_view_mode';
const SIDEBAR_COLLAPSED_KEY = 'formare3d_sidebar_collapsed';

const VALID_SECTIONS: ActiveSection[] = [
  'ventas',
  'produccion',
  'gastos',
  'filamentos',
  'qr',
  'calculadora',
  'camara',
];

function FormareApp() {
  const {
    operations,
    rawOperations,
    productCatalog,
    filamentStock,
    monthlySummaries,
    stats,
    filters,
    setFilters,
    uniqueSellers,
    lastModifiedId,
    saveNotification,
    clearNotification,
    addOperation,
    updateOperation,
    updateFilamentRemaining,
    updateFilamentInitial,
    updateFilamentPrice,
    deleteFilamentSpool,
    attachQrToOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    clearAllData,
    exportJSON,
    exportMonthlyPDF,
    importJSON,
  } = useOperations();

  // Active Section persisted across reloads
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    try {
      const saved = localStorage.getItem(SECTION_STORAGE_KEY) as ActiveSection | null;
      if (saved && VALID_SECTIONS.includes(saved)) {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return 'ventas';
  });

  // View Mode ('auto' | 'iphone' | 'desktop'), persisted across reloads
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'auto' || saved === 'iphone' || saved === 'desktop') {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return 'auto';
  });

  // Desktop Sidebar Collapsed State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Mobile Sidebar Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Active Visual Theme & Style State (persisted & applied immediately)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() =>
    getStoredThemeId()
  );
  const [currentStyle, setCurrentStyle] = useState<VisualStyleId>(() =>
    getStoredStyleId()
  );

  useEffect(() => {
    applyThemeToDocument(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    applyStyleToDocument(currentStyle);
  }, [currentStyle]);

  const handleSelectTheme = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyThemeToDocument(themeId);
  };

  const handleSelectStyle = (styleId: VisualStyleId) => {
    setCurrentStyle(styleId);
    applyStyleToDocument(styleId);
  };

  // Sub-filter for dedicated 'gastos' section
  const [gastosSubFilter, setGastosSubFilter] = useState<
    'all_gastos' | 'compras' | 'sandra15'
  >('all_gastos');

  // Sort state for 'Cola de Producción' section
  const [prodSort, setProdSort] = useState<{
    sortBy: SortField;
    sortOrder: SortOrder;
  }>({
    sortBy: 'fechaLimite',
    sortOrder: 'desc',
  });

  const handleSectionChange = (section: ActiveSection) => {
    setActiveSection(section);
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, section);
    } catch {
      // Ignore storage error
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage error
    }
  };

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Modal States
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [initialModalData, setInitialModalData] = useState<
    Partial<Operation> | undefined
  >(undefined);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const selectedOp = useMemo(
    () =>
      selectedOpId
        ? rawOperations.find((op) => op.id === selectedOpId) || null
        : null,
    [rawOperations, selectedOpId]
  );



  const handleOpenNewOp = () => {
    setSelectedOpId(null);
    setInitialModalData(undefined);
    setIsOpModalOpen(true);
  };

  const handleOpenNewPurchase = () => {
    setSelectedOpId(null);
    setInitialModalData({
      tipo: 'compra',
      producto: 'Pedido filamento ',
      unidades: 1,
      costes: 15.99,
      precio: null,
      lugarVenta: 'Internet',
      estado: 'Pagado',
      esPedidoFilamento: true,
    });
    setIsOpModalOpen(true);
  };

  const handleSelectOp = (op: Operation) => {
    setSelectedOpId(op.id);
    setInitialModalData(undefined);
    setIsOpModalOpen(true);
  };

  const handleSaveNewOp = (
    opData: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>
  ) => {
    addOperation(opData);
    if (
      filters.search ||
      filters.platform !== 'all' ||
      filters.status !== 'all' ||
      filters.tipo !== 'all' ||
      filters.vendedor !== 'all' ||
      filters.timeFilter !== 'todo'
    ) {
      setFilters((prev) => ({
        ...prev,
        search: '',
        platform: 'all',
        status: 'all',
        tipo: 'all',
        vendedor: 'all',
        timeFilter: 'todo',
      }));
    }
  };

  const handleQuickStatusChange = (id: string, newStatus: Status) => {
    updateOperation(id, { estado: newStatus });
  };

  const handleQuickUnitsChange = (id: string, newUnits: number) => {
    updateOperation(id, { unidades: Math.max(1, newUnits) });
  };

  const handleCreateWithCalculatedPrice = (
    productName: string,
    materialCost: number,
    recommendedPrice: number,
    materialSummary?: string
  ) => {
    setSelectedOpId(null);
    setInitialModalData({
      producto: productName,
      material: materialSummary || 'Negro',
      precio: recommendedPrice,
      costes: materialCost,
      unidades: 1,
      tipo: 'venta',
      estado: 'En producción',
    });
    setIsOpModalOpen(true);
  };

  const isFiltered = Boolean(
    filters.search ||
      filters.platform !== 'all' ||
      filters.status !== 'all' ||
      filters.tipo !== 'all' ||
      filters.vendedor !== 'all' ||
      filters.timeFilter !== 'todo'
  );

  // Live navigation counts & metrics for Sidebar and specialized views
  const uploadedQrCount = useMemo(
    () =>
      rawOperations.filter(
        (op) =>
          Boolean(op.fotoQr) &&
          op.estado !== 'Pendiente de cobro' &&
          op.estado !== 'Cobrado' &&
          op.estado !== 'Cancelado'
      ).length,
    [rawOperations]
  );

  const inProductionCount = useMemo(
    () =>
      rawOperations.filter(
        (op) => op.tipo !== 'cierre' && op.estado === 'En producción'
      ).length,
    [rawOperations]
  );

  const lowStockCount = useMemo(
    () => filamentStock.filter((s) => s.gramosRestantes < 200).length,
    [filamentStock]
  );

  // Operations for 'Cola de Producción' section: ONLY products in 'En producción'
  const productionOperations = useMemo(() => {
    return rawOperations
      .filter((op) => op.tipo !== 'cierre' && op.estado === 'En producción')
      .sort((a, b) => {
        if (prodSort.sortBy === 'fechaLimite') {
          const aHasDeadline = Boolean(a.tipo === 'venta' && a.fechaLimite);
          const bHasDeadline = Boolean(b.tipo === 'venta' && b.fechaLimite);
          if (aHasDeadline !== bHasDeadline) {
            return aHasDeadline ? -1 : 1;
          }
          if (aHasDeadline && bHasDeadline) {
            const valA = parseDate(a.fechaLimite!).getTime();
            const valB = parseDate(b.fechaLimite!).getTime();
            if (valA !== valB) {
              return prodSort.sortOrder === 'asc' ? valA - valB : valB - valA;
            }
          }
          const dateA = parseDate(a.fecha).getTime();
          const dateB = parseDate(b.fecha).getTime();
          if (dateA !== dateB) {
            return prodSort.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          }
          return (b.createdAt || 0) - (a.createdAt || 0);
        }

        if (prodSort.sortBy === 'fecha') {
          const valA = parseDate(a.fecha).getTime();
          const valB = parseDate(b.fecha).getTime();
          if (valA !== valB) {
            return prodSort.sortOrder === 'asc' ? valA - valB : valB - valA;
          }
          return (b.createdAt || 0) - (a.createdAt || 0);
        }

        let valA: any = 0;
        let valB: any = 0;
        if (prodSort.sortBy === 'precio') {
          valA = a.precio || 0;
          valB = b.precio || 0;
        } else if (prodSort.sortBy === 'costes') {
          valA = a.costes || 0;
          valB = b.costes || 0;
        } else if (prodSort.sortBy === 'beneficio') {
          valA = a.beneficio || 0;
          valB = b.beneficio || 0;
        } else if (prodSort.sortBy === 'producto') {
          valA = a.producto.toLowerCase();
          valB = b.producto.toLowerCase();
        }
        if (valA < valB) return prodSort.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return prodSort.sortOrder === 'asc' ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [rawOperations, prodSort]);

  const prodStats = useMemo(() => {
    let enProd = 0;
    let unidadesEnProd = 0;
    let importeEnProd = 0;

    rawOperations.forEach((op) => {
      if (op.tipo === 'cierre' || op.estado !== 'En producción') return;
      enProd += 1;
      unidadesEnProd += op.unidades && op.unidades > 0 ? op.unidades : 1;
      importeEnProd += op.precio || 0;
    });

    return { enProd, unidadesEnProd, importeEnProd };
  }, [rawOperations]);

  // Operations and breakdown for 'Gastos en General' section
  const gastosOperations = useMemo(() => {
    return rawOperations
      .filter((op) => {
        if (!op || op.tipo === 'cierre' || op.estado === 'Cancelado') return false;
        const sandraExp = calculateSandraCommission(op.precio, op.vendedor, op.tipo);
        const isCompraGasto =
          op.tipo === 'compra' || op.tipo === 'inversion' || op.tipo === 'otro';
        const isVentaConSandra = op.tipo === 'venta' && sandraExp > 0;

        if (gastosSubFilter === 'compras') {
          return isCompraGasto;
        }
        if (gastosSubFilter === 'sandra15') {
          return isVentaConSandra;
        }
        return isCompraGasto || isVentaConSandra;
      })
      .sort((a, b) => {
        const aIsRecentUser = (a.createdAt || 0) >= 1800000000000;
        const bIsRecentUser = (b.createdAt || 0) >= 1800000000000;
        if (aIsRecentUser !== bIsRecentUser) {
          return aIsRecentUser ? -1 : 1;
        }
        const diff = parseDate(b.fecha).getTime() - parseDate(a.fecha).getTime();
        if (diff !== 0) return diff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [rawOperations, gastosSubFilter]);

  const gastosBreakdown = useMemo(() => {
    let comprasBobinas = 0;
    let otrosGastos = 0;
    let totalSandra15 = 0;
    let comprasCount = 0;
    let sandraCount = 0;

    rawOperations.forEach((op) => {
      if (!op || op.tipo === 'cierre' || op.estado === 'Cancelado') return;
      const sandraExp = calculateSandraCommission(op.precio, op.vendedor, op.tipo);
      if (op.tipo === 'venta' && sandraExp > 0) {
        totalSandra15 += sandraExp;
        sandraCount += 1;
      }

      const isCompraGasto =
        op.tipo === 'compra' || op.tipo === 'inversion' || op.tipo === 'otro';

      if (isCompraGasto) {
        comprasCount += 1;
        const totalOpCost = Math.abs(op.costes || 0);
        if (
          op.esPedidoFilamento ||
          op.producto.toLowerCase().includes('filamento') ||
          op.producto.toLowerCase().includes('bobina')
        ) {
          comprasBobinas += totalOpCost;
        } else {
          otrosGastos += totalOpCost;
        }
      }
    });

    const totalGastosGenerales = Number(
      (comprasBobinas + otrosGastos + totalSandra15).toFixed(2)
    );

    return {
      comprasBobinas: Number(comprasBobinas.toFixed(2)),
      otrosGastos: Number(otrosGastos.toFixed(2)),
      totalSandra15: Number(totalSandra15.toFixed(2)),
      totalGastosGenerales,
      comprasCount,
      sandraCount,
      totalCount: comprasCount + sandraCount,
    };
  }, [rawOperations]);

  return (
    <div className="min-h-screen w-full max-w-full bg-black text-zinc-100 flex font-sans selection:bg-theme-accent/35 selection:text-theme-frost relative overflow-x-clip">
      {/* Hardware-accelerated OLED Ambient Gradient Stage (0 blur layers = 120fps) */}
      <div className="liquid-ambient-stage" aria-hidden="true" />

      {/* Left Navigation Sidebar (Desktop Fixed Rail + Mobile Drawer) */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onNewOperation={handleOpenNewOp}
        onNewPurchase={handleOpenNewPurchase}
        onExportJSON={exportJSON}
        onExportMonthlyPDF={() => exportMonthlyPDF()}
        onImportJSON={importJSON}
        onResetData={resetToDefaultData}
        onClearAllData={clearAllData}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        counts={{
          totalOperations: stats.count,
          inProduction: inProductionCount,
          spoolsCount: filamentStock.length,
          lowStockCount,
          qrCount: uploadedQrCount,
          gastosGeneralesTotal: stats.gastosGenerales,
          beneficioNeto: stats.totalBeneficio,
        }}
      />

      {/* Right Workspace Column (Contextual Header + Main Content Viewport) */}
      <div
        className={`relative z-10 flex-1 flex flex-col min-w-0 pb-[calc(6.25rem+env(safe-area-inset-bottom))] lg:pb-10 ${
          isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72'
        }`}
        style={{
          transition: 'padding-left 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Contextual Top Header */}
        <Header
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onNewOperation={handleOpenNewOp}
          onOpenPricingCalculator={() => setIsPricingModalOpen(true)}
          onExportMonthlyPDF={() => exportMonthlyPDF()}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          currentTheme={currentTheme}
          onSelectTheme={handleSelectTheme}
          currentStyle={currentStyle}
          onSelectStyle={handleSelectStyle}
        />

        {/* Instant Save / Sync Confirmation Toast */}
        {saveNotification && (
          <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 px-4 py-2.5 rounded-full glass-card-pastel animate-spring-pop text-theme-frost text-xs font-semibold w-max max-w-[calc(100vw-1.5rem)]">
            <CheckCircle2 className="w-4 h-4 text-theme-accent shrink-0" />
            <span className="truncate">{saveNotification}</span>
          </div>
        )}

        {/* Main Content Viewport */}
        <main
          key={activeSection}
          className={`flex-1 w-full min-w-0 animate-fade-in ${
            viewMode === 'iphone' &&
            (activeSection === 'ventas' ||
              activeSection === 'produccion' ||
              activeSection === 'gastos')
              ? 'w-full sm:max-w-md sm:mx-auto'
              : 'max-w-none'
          }`}
          style={{
            animation: 'fadeSlideIn 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* 1. PANEL GENERAL (VENTAS Y COMPRAS) */}
          {activeSection === 'ventas' && (
            <>
              <DashboardSummary stats={stats} />

              <FilterBar
                filters={filters}
                onFilterChange={setFilters}
                uniqueSellers={uniqueSellers}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />

              <section className="px-2.5 sm:px-3 lg:px-4 py-2 w-full min-w-0 max-w-none">
                {operations.length > 0 ? (
                  <OperationsList
                    operations={operations}
                    monthlySummaries={monthlySummaries}
                    onSelectOperation={handleSelectOp}
                    onDuplicateOperation={duplicateOperation}
                    onDeleteOperation={deleteOperation}
                    onStatusChange={handleQuickStatusChange}
                    onUnitsChange={handleQuickUnitsChange}
                    onAttachQr={attachQrToOperation}
                    onExportMonthPDF={exportMonthlyPDF}
                    viewMode={viewMode}
                    lastModifiedId={lastModifiedId}
                    sortBy={filters.sortBy}
                    sortOrder={filters.sortOrder}
                    onSortChange={(field, order) =>
                      setFilters({ ...filters, sortBy: field, sortOrder: order })
                    }
                  />
                ) : (
                  <EmptyState
                    onNewOperation={handleOpenNewOp}
                    isFiltered={isFiltered}
                  />
                )}
              </section>
            </>
          )}

          {/* 2. COLA DE PRODUCCIÓN (Solo productos En producción) */}
          {activeSection === 'produccion' && (
            <div className="space-y-3 pt-3 w-full max-w-none">
              {/* Production Overview Cards */}
              <section className="px-2.5 sm:px-3 lg:px-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 min-w-0">
                    <span className="text-[11px] sm:text-xs font-medium text-theme-light flex items-center justify-between gap-1">
                      <span className="truncate">En Producción</span>
                      <Printer className="w-4 h-4 text-theme-accent animate-liquid-float shrink-0" />
                    </span>
                    <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-1 block">
                      {prodStats.enProd}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Pedidos en cola
                    </span>
                  </div>

                  <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 min-w-0">
                    <span className="text-[11px] sm:text-xs font-medium text-zinc-300 flex items-center justify-between gap-1">
                      <span className="truncate">Unidades</span>
                      <Layers className="w-4 h-4 text-theme-accent shrink-0" />
                    </span>
                    <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-1 block">
                      {prodStats.unidadesEnProd}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Piezas a imprimir
                    </span>
                  </div>

                  <div className="glass-card-pastel liquid-shimmer rounded-2xl p-3 sm:p-4 col-span-2 sm:col-span-1 min-w-0">
                    <span className="text-xs font-medium text-theme-light flex items-center justify-between gap-1">
                      <span className="truncate">Importe en Producción</span>
                      <Clock className="w-4 h-4 text-theme-accent shrink-0" />
                    </span>
                    <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-theme-frost mt-1 block truncate">
                      {formatEuro(prodStats.importeEnProd)}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Valor de los pedidos en fabricación
                    </span>
                  </div>
                </div>
              </section>

              {/* Action Bar for Production Queue */}
              <section className="px-2.5 sm:px-3 lg:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 glass-pill rounded-xl text-xs font-semibold text-theme-light shrink-0">
                    <span className="w-2 h-2 rounded-full bg-theme-accent animate-liquid-dot" />
                    <Printer className="w-3.5 h-3.5 text-theme-accent" />
                    <span>Solo productos en producción ({prodStats.enProd})</span>
                  </div>

                  <SlidingSegmentedControl
                    options={[
                      { id: 'fechaLimite', label: 'Fecha límite' },
                      { id: 'fecha', label: 'Recientes' },
                      { id: 'precio', label: 'Importe' },
                    ]}
                    value={prodSort.sortBy}
                    onChange={(val) =>
                      setProdSort({
                        sortBy: val as SortField,
                        sortOrder: val === 'fechaLimite' ? 'asc' : 'desc',
                      })
                    }
                    size="sm"
                    className="shrink-0"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenNewOp}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] sm:min-h-0 sm:py-1.5 rounded-xl liquid-btn-pastel-glass text-xs font-semibold cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir pedido a producción</span>
                </button>
              </section>

              <section className="px-2 sm:px-3 lg:px-4 py-1 w-full min-w-0 max-w-none">
                {productionOperations.length > 0 ? (
                  <OperationsList
                    operations={productionOperations}
                    monthlySummaries={{}}
                    onSelectOperation={handleSelectOp}
                    onDuplicateOperation={duplicateOperation}
                    onDeleteOperation={deleteOperation}
                    onStatusChange={handleQuickStatusChange}
                    onUnitsChange={handleQuickUnitsChange}
                    onAttachQr={attachQrToOperation}
                    viewMode={viewMode}
                    lastModifiedId={lastModifiedId}
                    sortBy={prodSort.sortBy}
                    sortOrder={prodSort.sortOrder}
                    onSortChange={(field, order) =>
                      setProdSort({ sortBy: field, sortOrder: order })
                    }
                  />
                ) : (
                  <EmptyState
                    onNewOperation={handleOpenNewOp}
                    isFiltered={true}
                  />
                )}
              </section>
            </div>
          )}

          {/* 3. GASTOS EN GENERAL Y COMPRAS */}
          {activeSection === 'gastos' && (
            <div className="space-y-3 pt-3 w-full max-w-none">
              {/* Gastos en General KPI Breakdown */}
              <section className="px-2.5 sm:px-3 lg:px-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 border-rose-400/30 bg-rose-500/[0.06] min-w-0">
                    <span className="text-[11px] sm:text-xs font-medium text-rose-200 block truncate">
                      Total Gastos
                    </span>
                    <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-rose-300 mt-1 block truncate">
                      {formatEuro(gastosBreakdown.totalGastosGenerales)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Bobinas + compras + Sandra
                    </span>
                  </div>

                  <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 min-w-0">
                    <span className="text-[11px] sm:text-xs font-medium text-theme-light block truncate">
                      Bobinas (1000g)
                    </span>
                    <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-white mt-1 block truncate">
                      {formatEuro(gastosBreakdown.comprasBobinas)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Stock de filamento
                    </span>
                  </div>

                  <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 min-w-0">
                    <span className="text-[11px] sm:text-xs font-medium text-purple-300 block truncate">
                      B. Sandra (15%)
                    </span>
                    <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-purple-300 mt-1 block truncate">
                      {formatEuro(gastosBreakdown.totalSandra15)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Ventas de Sandra
                    </span>
                  </div>

                  <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 min-w-0">
                    <span className="text-[11px] sm:text-xs font-medium text-zinc-300 block truncate">
                      Otros Gastos
                    </span>
                    <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-zinc-200 mt-1 block truncate">
                      {formatEuro(gastosBreakdown.otrosGastos)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 block truncate">
                      Recambios y otros
                    </span>
                  </div>
                </div>
              </section>

              {/* Gastos Sub-Filter Bar con Burbuja Deslizante */}
              <section className="px-2.5 sm:px-3 lg:px-4 overflow-x-auto no-scrollbar">
                <SlidingSegmentedControl
                  options={[
                    {
                      id: 'all_gastos',
                      label: (
                        <>
                          <span className="sm:hidden">Todos</span>
                          <span className="hidden sm:inline">Todos los gastos</span>
                        </>
                      ),
                      badge: gastosBreakdown.totalCount,
                    },
                    {
                      id: 'compras',
                      label: (
                        <>
                          <span className="sm:hidden">Bobinas</span>
                          <span className="hidden sm:inline">Bobinas e inversiones</span>
                        </>
                      ),
                      badge: gastosBreakdown.comprasCount,
                    },
                    {
                      id: 'sandra15',
                      label: 'B. Sandra',
                      badge: gastosBreakdown.sandraCount,
                    },
                  ]}
                  value={gastosSubFilter}
                  onChange={(val) =>
                    setGastosSubFilter(
                      val as 'all_gastos' | 'compras' | 'sandra15'
                    )
                  }
                  size="sm"
                  className="shrink-0"
                />
              </section>

              <section className="px-2.5 sm:px-3 lg:px-4 py-1 w-full min-w-0 max-w-none">
                {gastosOperations.length > 0 ? (
                  <OperationsList
                    operations={gastosOperations}
                    monthlySummaries={{}}
                    onSelectOperation={handleSelectOp}
                    onDuplicateOperation={duplicateOperation}
                    onDeleteOperation={deleteOperation}
                    onStatusChange={handleQuickStatusChange}
                    onUnitsChange={handleQuickUnitsChange}
                    onAttachQr={attachQrToOperation}
                    viewMode={viewMode}
                    lastModifiedId={lastModifiedId}
                  />
                ) : (
                  <EmptyState
                    onNewOperation={handleOpenNewPurchase}
                    isFiltered={true}
                  />
                )}
              </section>
            </div>
          )}

          {/* 4. STOCK DE FILAMENTOS (1000g) */}
          {activeSection === 'filamentos' && (
            <FilamentStockView
              spools={filamentStock}
              onAddFilamentOrder={addOperation}
              onUpdateFilamentRemaining={updateFilamentRemaining}
              onUpdateFilamentInitial={updateFilamentInitial}
              onUpdateFilamentPrice={updateFilamentPrice}
              onDeleteFilamentSpool={deleteFilamentSpool}
            />
          )}

          {/* 5. ALMACÉN DE QR Y ENVÍOS */}
          {activeSection === 'qr' && (
            <QrStorageView
              operations={rawOperations}
              onAttachQr={attachQrToOperation}
              onStatusChange={handleQuickStatusChange}
            />
          )}

          {/* 6. CALCULADORA DE PRECIOS 3D */}
          {activeSection === 'calculadora' && (
            <PricingCalculatorView
              spools={filamentStock}
              onCreateOperationWithPrice={handleCreateWithCalculatedPrice}
            />
          )}

          {/* 7. VER CÁMARA DE LA IMPRESORA (OctoEverywhere) */}
          {activeSection === 'camara' && (
            <div className="px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
              <div className="glass-card-pastel liquid-shimmer rounded-3xl p-5 sm:p-8 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="space-y-2.5 min-w-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-pill border-theme-accent/35 text-theme-light text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-theme-accent animate-liquid-dot" />
                      <span>Transmisión en Directo</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                      <Camera className="w-7 h-7 text-theme-accent animate-liquid-float-slow shrink-0" />
                      <span>Cámara de la Impresora 3D</span>
                    </h2>
                    <p className="text-sm text-zinc-300 max-w-xl leading-relaxed">
                      Accede en directo a la cámara de la impresora y al gestor de red OctoEverywhere para supervisar tus impresiones y estado del taller en tiempo real.
                    </p>
                  </div>

                  <a
                    href="https://formare3d.octoeverywhere.com/network-device-manager/network/control"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl liquid-btn-primary font-bold text-sm cursor-pointer shrink-0"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Ver Cámara en OctoEverywhere</span>
                    <ExternalLink className="w-4 h-4 opacity-75" />
                  </a>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                    <span className="text-zinc-500 font-medium shrink-0">Enlace directo:</span>
                    <a
                      href="https://formare3d.octoeverywhere.com/network-device-manager/network/control"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl liquid-btn-glass text-theme-light hover:text-theme-frost font-mono text-[11px] flex items-center gap-1.5 break-all max-w-full"
                    >
                      <span className="break-all">https://formare3d.octoeverywhere.com/network-device-manager/network/control</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  <span className="text-zinc-400 font-medium shrink-0">OctoEverywhere Network Control</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Floating 5-Column Liquid Dock Navigation con Burbuja Deslizante */}
      {(() => {
        const dockItems: {
          id: ActiveSection;
          label: string;
          icon: React.ComponentType<{ className?: string }>;
          badge?: number;
        }[] = [
          { id: 'ventas', label: 'Panel', icon: Table2 },
          {
            id: 'produccion',
            label: 'Cola',
            icon: Printer,
            badge: inProductionCount > 0 ? inProductionCount : undefined,
          },
          { id: 'gastos', label: 'Gastos', icon: Receipt },
          { id: 'filamentos', label: 'Bobinas', icon: Disc },
          { id: 'qr', label: 'QR', icon: QrCode },
        ];
        const activeDockIndex = dockItems.findIndex((item) => item.id === activeSection);

        return (
          <nav
            className="lg:hidden fixed bottom-[max(0.625rem,env(safe-area-inset-bottom))] left-2.5 right-2.5 z-30 glass-header liquid-segmented rounded-2xl p-1 shadow-[0_14px_40px_rgba(0,0,0,0.92)]"
            aria-label="Navegación rápida móvil"
          >
            <div className="relative grid grid-cols-5 items-center">
              {/* GPU Sliding Theme Bubble */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/5 p-0.5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `translate3d(${Math.max(0, activeDockIndex) * 100}%, 0, 0)`,
                  opacity: activeDockIndex >= 0 ? 1 : 0,
                  willChange: 'transform, opacity',
                }}
              >
                <div
                  className="w-full h-full rounded-xl"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--theme-tint) 0%, var(--theme-soft) 50%, var(--theme-deep) 100%)',
                    boxShadow:
                      '0 2px 14px rgba(var(--theme-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.88)',
                  }}
                />
              </div>

              {dockItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSectionChange(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative z-10 min-h-[50px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors duration-200 cursor-pointer select-none ${
                      isActive ? 'text-theme-ink font-bold' : 'text-zinc-400 active:text-white'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      <Icon
                        className={`w-[18px] h-[18px] transition-transform duration-200 ${
                          isActive ? 'scale-110 stroke-[2.25]' : ''
                        }`}
                      />
                      {item.badge !== undefined && (
                        <span
                          className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-mono font-extrabold flex items-center justify-center leading-none ${
                            isActive
                              ? 'bg-theme-ink text-theme-frost'
                              : 'bg-theme-accent text-theme-ink shadow-[0_0_8px_rgba(var(--theme-rgb),0.75)]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] leading-tight tracking-tight truncate max-w-full">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        );
      })()}

      {/* Modals & Bottom Sheets */}
      <OperationModal
        isOpen={isOpModalOpen}
        onClose={() => {
          setIsOpModalOpen(false);
          setSelectedOpId(null);
          setInitialModalData(undefined);
        }}
        onSave={handleSaveNewOp}
        onUpdate={updateOperation}
        onDelete={deleteOperation}
        onDuplicate={duplicateOperation}
        operationToEdit={selectedOp}
        initialData={initialModalData}
        productCatalog={productCatalog}
        filamentStock={filamentStock}
      />

      <PricingCalculatorModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        onCreateOperationWithPrice={handleCreateWithCalculatedPrice}
      />
    </div>
  );
}

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => isDeviceAuthorized());

  useEffect(() => {
    applyThemeToDocument(getStoredThemeId());
    applyStyleToDocument(getStoredStyleId());
  }, []);

  if (!isAuthorized) {
    return <AccessCodeGate onAuthorized={() => setIsAuthorized(true)} />;
  }

  return <FormareApp />;
}

