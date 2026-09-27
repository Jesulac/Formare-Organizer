import React, { useState, useEffect, useMemo } from 'react';
import { useOperations } from './hooks/useOperations';
import { Header, ViewMode, ActiveSection } from './components/Header';
import { DashboardSummary } from './components/DashboardSummary';
import { FilterBar } from './components/FilterBar';
import { OperationsList } from './components/OperationsList';
import { EmptyState } from './components/EmptyState';
import { OperationModal } from './components/OperationModal';
import { PricingCalculatorModal } from './components/PricingCalculatorModal';
import { RevenueSplitModal } from './components/RevenueSplitModal';
import { FilamentStockView } from './components/FilamentStockView';
import { QrStorageView } from './components/QrStorageView';
import { Operation, Status } from './types/operation';
import { Plus, CheckCircle2 } from 'lucide-react';

const SECTION_STORAGE_KEY = 'formare3d_active_section';
const VIEW_MODE_STORAGE_KEY = 'formare3d_view_mode';

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

  // Active Section ('ventas' | 'filamentos' | 'qr'), persisted across reloads
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    try {
      const saved = localStorage.getItem(SECTION_STORAGE_KEY);
      if (saved === 'ventas' || saved === 'filamentos' || saved === 'qr') {
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

  // Modal States
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [initialModalData, setInitialModalData] = useState<Partial<Operation> | undefined>(undefined);

  const selectedOp = useMemo(
    () => (selectedOpId ? rawOperations.find((op) => op.id === selectedOpId) || null : null),
    [rawOperations, selectedOpId]
  );

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

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

  const handleSelectOp = (op: Operation) => {
    setSelectedOpId(op.id);
    setInitialModalData(undefined);
    setIsOpModalOpen(true);
  };

  const handleSaveNewOp = (opData: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>) => {
    addOperation(opData);
    // Ensure active filters do not hide the newly created operation
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
    recommendedPrice: number
  ) => {
    setSelectedOpId(null);
    setInitialModalData({
      producto: productName,
      precio: recommendedPrice,
      costes: materialCost,
      unidades: 1,
      tipo: 'venta',
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

  const uploadedQrCount = rawOperations.filter(
    (op) => Boolean(op.fotoQr) && op.estado !== 'Pendiente de cobro' && op.estado !== 'Cancelado'
  ).length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-black text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative pb-24 lg:pb-12">
      
      {/* Top Navigation Header */}
      <Header
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onNewOperation={handleOpenNewOp}
        onOpenPricingCalculator={() => setIsPricingModalOpen(true)}
        onOpenRevenueSplit={() => setIsRevenueModalOpen(true)}
        onExportJSON={exportJSON}
        onExportMonthlyPDF={() => exportMonthlyPDF()}
        onImportJSON={importJSON}
        onResetData={resetToDefaultData}
        onClearAllData={clearAllData}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        qrCount={uploadedQrCount}
      />

      {/* Instant Save / Sync Confirmation Banner */}
      {saveNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-950/95 border border-emerald-400/40 text-emerald-200 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveNotification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full min-w-0 mx-auto transition-all duration-300 ${
        viewMode === 'iphone' ? 'max-w-md' : 'max-w-[1600px]'
      }`}>
        {activeSection === 'ventas' && (
          <>
            {/* Top Financial Totals Summary */}
            <DashboardSummary stats={stats} />

            {/* Search, Filter & Sort Bar */}
            <FilterBar
              filters={filters}
              onFilterChange={setFilters}
              uniqueSellers={uniqueSellers}
            />

            {/* Operations List or Empty State */}
            <section className="px-2 sm:px-4 lg:px-6 py-2 w-full min-w-0 max-w-full">
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

        {activeSection === 'filamentos' && (
          <FilamentStockView
            spools={filamentStock}
            onAddFilamentOrder={addOperation}
            onUpdateFilamentRemaining={updateFilamentRemaining}
            onUpdateFilamentInitial={updateFilamentInitial}
            onDeleteFilamentSpool={deleteFilamentSpool}
          />
        )}

        {activeSection === 'qr' && (
          <QrStorageView
            operations={rawOperations}
            onAttachQr={attachQrToOperation}
            onStatusChange={handleQuickStatusChange}
          />
        )}
      </main>

      {/* Floating Action Button (+ Nueva) */}
      <button
        type="button"
        onClick={handleOpenNewOp}
        className={`${
          viewMode === 'iphone' ? 'flex' : 'lg:hidden flex'
        } fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black items-center justify-center shadow-2xl shadow-emerald-500/40 active:scale-90 transition-all cursor-pointer border border-emerald-300`}
        aria-label="Nueva operación"
      >
        <Plus className="w-7 h-7 stroke-[3]" />
      </button>

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
      />

      <PricingCalculatorModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        onCreateOperationWithPrice={handleCreateWithCalculatedPrice}
      />

      <RevenueSplitModal
        isOpen={isRevenueModalOpen}
        onClose={() => setIsRevenueModalOpen(false)}
      />

    </div>
  );
}
