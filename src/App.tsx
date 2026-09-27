import React, { useState } from 'react';
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
import { Plus } from 'lucide-react';

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
    addOperation,
    updateOperation,
    attachQrToOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    clearAllData,
    exportJSON,
    importJSON,
  } = useOperations();

  // Active Section ('ventas' | 'filamentos' | 'qr')
  const [activeSection, setActiveSection] = useState<ActiveSection>('ventas');

  // View Mode ('auto' adapts to screen width; user can also toggle 'iphone' (Vista móvil) or 'desktop' (Tabla))
  const [viewMode, setViewMode] = useState<ViewMode>('auto');

  // Modal States
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);
  const [initialModalData, setInitialModalData] = useState<Partial<Operation> | undefined>(undefined);

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

  const handleOpenNewOp = () => {
    setSelectedOp(null);
    setInitialModalData(undefined);
    setIsOpModalOpen(true);
  };

  const handleSelectOp = (op: Operation) => {
    setSelectedOp(op);
    setInitialModalData(undefined);
    setIsOpModalOpen(true);
  };

  const handleQuickStatusChange = (id: string, newStatus: Status) => {
    updateOperation(id, { estado: newStatus });
  };

  const handleCreateWithCalculatedPrice = (
    productName: string,
    materialCost: number,
    recommendedPrice: number
  ) => {
    setSelectedOp(null);
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

  const uploadedQrCount = rawOperations.filter((op) => Boolean(op.fotoQr)).length;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative pb-24 lg:pb-12">
      
      {/* Top Navigation Header */}
      <Header
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onNewOperation={handleOpenNewOp}
        onOpenPricingCalculator={() => setIsPricingModalOpen(true)}
        onOpenRevenueSplit={() => setIsRevenueModalOpen(true)}
        onExportJSON={exportJSON}
        onImportJSON={importJSON}
        onResetData={resetToDefaultData}
        onClearAllData={clearAllData}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        qrCount={uploadedQrCount}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto transition-all duration-300 ${
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
            <section className="px-3 sm:px-4 lg:px-6 py-2">
              {operations.length > 0 ? (
                <OperationsList
                  operations={operations}
                  monthlySummaries={monthlySummaries}
                  onSelectOperation={handleSelectOp}
                  onDuplicateOperation={duplicateOperation}
                  onDeleteOperation={deleteOperation}
                  onStatusChange={handleQuickStatusChange}
                  onAttachQr={attachQrToOperation}
                  viewMode={viewMode}
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
          />
        )}

        {activeSection === 'qr' && (
          <QrStorageView
            operations={rawOperations}
            onAttachQr={attachQrToOperation}
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
          setSelectedOp(null);
          setInitialModalData(undefined);
        }}
        onSave={addOperation}
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
