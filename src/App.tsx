import React, { useState, useEffect, useMemo } from 'react';
import { useOperations } from './hooks/useOperations';
import { Header, ViewMode, ActiveSection } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardSummary } from './components/DashboardSummary';
import { FilterBar } from './components/FilterBar';
import { OperationsList } from './components/OperationsList';
import { EmptyState } from './components/EmptyState';
import { OperationModal } from './components/OperationModal';
import { PricingCalculatorModal } from './components/PricingCalculatorModal';
import { PricingCalculatorView } from './components/PricingCalculatorView';
import { FilamentStockView } from './components/FilamentStockView';
import { QrStorageView } from './components/QrStorageView';
import { Operation, Status } from './types/operation';
import { calculateSandraCommission, formatEuro, parseDate } from './utils/calculations';
import {
  Plus,
  CheckCircle2,
  Printer,
  Receipt,
  Table2,
  Disc,
  QrCode,
  Clock,
  Truck,
  AlertCircle,
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
];

export default function App() {
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

  // Sub-filters for dedicated sections ('produccion' and 'gastos')
  const [prodSubFilter, setProdSubFilter] = useState<
    'all_active' | 'En producción' | 'Enviado' | 'Pendiente de cobro'
  >('all_active');
  const [gastosSubFilter, setGastosSubFilter] = useState<
    'all_gastos' | 'compras' | 'sandra15'
  >('all_gastos');

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

  // Automatically dismiss save notification after 2.8 seconds
  useEffect(() => {
    if (!saveNotification) return;
    const timer = setTimeout(() => {
      clearNotification();
    }, 2800);
    return () => clearTimeout(timer);
  }, [saveNotification, clearNotification]);

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

  // Operations for 'Cola de Producción y Envíos' section
  const productionOperations = useMemo(() => {
    return rawOperations.filter((op) => {
      if (op.tipo === 'cierre' || op.estado === 'Cancelado') return false;
      if (prodSubFilter === 'En producción') return op.estado === 'En producción';
      if (prodSubFilter === 'Enviado') return op.estado === 'Enviado';
      if (prodSubFilter === 'Pendiente de cobro') {
        return (
          op.estado === 'Pendiente de cobro' || op.estado === 'Pendiente de pago'
        );
      }
      return (
        op.estado === 'En producción' ||
        op.estado === 'Enviado' ||
        op.estado === 'Pendiente de cobro' ||
        op.estado === 'Pendiente de pago'
      );
    });
  }, [rawOperations, prodSubFilter]);

  const prodStats = useMemo(() => {
    let enProd = 0;
    let enviados = 0;
    let pendientes = 0;
    let importeActivo = 0;

    rawOperations.forEach((op) => {
      if (op.tipo === 'cierre' || op.estado === 'Cancelado') return;
      if (op.estado === 'En producción') {
        enProd += 1;
        importeActivo += op.precio || 0;
      } else if (op.estado === 'Enviado') {
        enviados += 1;
        importeActivo += op.precio || 0;
      } else if (
        op.estado === 'Pendiente de cobro' ||
        op.estado === 'Pendiente de pago'
      ) {
        pendientes += 1;
        importeActivo += op.precio || 0;
      }
    });

    return { enProd, enviados, pendientes, importeActivo };
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-black text-zinc-100 flex font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative">
      {/* Left Navigation Sidebar (Desktop Rail + Mobile Drawer) */}
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
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-10">
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
        />

        {/* Instant Save / Sync Confirmation Toast */}
        {saveNotification && (
          <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-950/95 border border-emerald-400/40 text-emerald-200 text-xs font-semibold shadow-2xl backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveNotification}</span>
          </div>
        )}

        {/* Main Content Viewport */}
        <main
          className={`flex-1 w-full min-w-0 transition-all duration-300 ${
            viewMode === 'iphone' &&
            (activeSection === 'ventas' ||
              activeSection === 'produccion' ||
              activeSection === 'gastos')
              ? 'max-w-md mx-auto'
              : 'max-w-none'
          }`}
        >
          {/* 1. PANEL GENERAL (VENTAS Y COMPRAS) */}
          {activeSection === 'ventas' && (
            <>
              <DashboardSummary stats={stats} />

              <FilterBar
                filters={filters}
                onFilterChange={setFilters}
                uniqueSellers={uniqueSellers}
              />

              <section className="px-2 sm:px-3 lg:px-4 py-2 w-full min-w-0 max-w-none">
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

          {/* 2. COLA DE PRODUCCIÓN Y ENVÍOS */}
          {activeSection === 'produccion' && (
            <div className="space-y-3 pt-3 w-full max-w-none">
              {/* Production Overview Cards */}
              <section className="px-2 sm:px-3 lg:px-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-sky-500/25 bg-sky-950/15">
                    <span className="text-xs font-medium text-sky-300 flex items-center justify-between">
                      <span>En Producción</span>
                      <Printer className="w-4 h-4 text-sky-400" />
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-white mt-1 block">
                      {prodStats.enProd}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Piezas imprimiéndose o en cola
                    </span>
                  </div>

                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10">
                    <span className="text-xs font-medium text-indigo-300 flex items-center justify-between">
                      <span>Enviados en Tránsito</span>
                      <Truck className="w-4 h-4 text-indigo-400" />
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-white mt-1 block">
                      {prodStats.enviados}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Pendientes de recepción final
                    </span>
                  </div>

                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10">
                    <span className="text-xs font-medium text-amber-300 flex items-center justify-between">
                      <span>Pendientes de Cobro</span>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1 block">
                      {prodStats.pendientes}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Reservados o por liquidar
                    </span>
                  </div>

                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10">
                    <span className="text-xs font-medium text-emerald-400 flex items-center justify-between">
                      <span>Importe en Curso</span>
                      <Clock className="w-4 h-4 text-emerald-400" />
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-emerald-300 mt-1 block">
                      {formatEuro(prodStats.importeActivo)}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Facturación activa en curso
                    </span>
                  </div>
                </div>
              </section>

              {/* Segmented Filter Bar for Production Queue */}
              <section className="px-2 sm:px-3 lg:px-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center p-1 bg-zinc-900/90 border border-white/10 rounded-xl overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all_active', label: 'Todos los activos' },
                    { id: 'En producción', label: `En producción (${prodStats.enProd})` },
                    { id: 'Enviado', label: `Enviados (${prodStats.enviados})` },
                    {
                      id: 'Pendiente de cobro',
                      label: `Pendientes (${prodStats.pendientes})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setProdSubFilter(
                          tab.id as
                            | 'all_active'
                            | 'En producción'
                            | 'Enviado'
                            | 'Pendiente de cobro'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                        prodSubFilter === tab.id
                          ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleOpenNewOp}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-semibold cursor-pointer"
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
              <section className="px-2 sm:px-3 lg:px-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-rose-500/30 bg-rose-950/15">
                    <span className="text-xs font-medium text-rose-300">
                      Total Gastos en General
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-rose-300 mt-1 block">
                      {formatEuro(gastosBreakdown.totalGastosGenerales)}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Bobinas + compras + B. Sandra
                    </span>
                  </div>

                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10">
                    <span className="text-xs font-medium text-zinc-300">
                      Compras de Bobinas (1000g)
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-white mt-1 block">
                      {formatEuro(gastosBreakdown.comprasBobinas)}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Reposición de stock de filamento
                    </span>
                  </div>

                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10">
                    <span className="text-xs font-medium text-purple-300">
                      B. Sandra (Beneficio Sandra)
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-purple-300 mt-1 block">
                      {formatEuro(gastosBreakdown.totalSandra15)}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Acumulado de ventas de Sandra
                    </span>
                  </div>

                  <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10">
                    <span className="text-xs font-medium text-zinc-300">
                      Otros Gastos e Inversiones
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-zinc-200 mt-1 block">
                      {formatEuro(gastosBreakdown.otrosGastos)}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Recambios, accesorios y otros
                    </span>
                  </div>
                </div>
              </section>

              {/* Filter & Action Bar for Gastos en General */}
              <section className="px-2 sm:px-3 lg:px-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center p-1 bg-zinc-900/90 border border-white/10 rounded-xl overflow-x-auto no-scrollbar">
                  {[
                    {
                      id: 'all_gastos',
                      label: `Todos los Gastos en General (${gastosBreakdown.totalCount})`,
                    },
                    {
                      id: 'compras',
                      label: `Solo Compras y Bobinas (${gastosBreakdown.comprasCount})`,
                    },
                    {
                      id: 'sandra15',
                      label: `Ventas con B. Sandra (${gastosBreakdown.sandraCount})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setGastosSubFilter(
                          tab.id as 'all_gastos' | 'compras' | 'sandra15'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                        gastosSubFilter === tab.id
                          ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleOpenNewPurchase}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Compra / Gasto</span>
                </button>
              </section>

              <section className="px-2 sm:px-3 lg:px-4 py-1 w-full min-w-0 max-w-none">
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
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< lg) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/10 px-2 flex items-center justify-around">
        {[
          { id: 'ventas' as ActiveSection, label: 'General', icon: Table2 },
          {
            id: 'produccion' as ActiveSection,
            label: 'Producción',
            icon: Printer,
            badge: inProductionCount > 0 ? inProductionCount : undefined,
          },
          { id: 'gastos' as ActiveSection, label: 'Gastos', icon: Receipt },
          { id: 'filamentos' as ActiveSection, label: 'Stock 1kg', icon: Disc },
          {
            id: 'qr' as ActiveSection,
            label: 'QR Envíos',
            icon: QrCode,
            badge: uploadedQrCount > 0 ? uploadedQrCount : undefined,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSectionChange(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors cursor-pointer min-w-[56px] ${
                isActive ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[14px] h-3.5 rounded-full bg-emerald-500 text-black text-[9px] font-bold font-mono flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-0.5 truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

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
