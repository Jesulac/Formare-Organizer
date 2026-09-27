import React, { useState } from 'react';
import { useOperations } from './hooks/useOperations';
import { Header } from './components/Header';
import { DashboardSummary } from './components/DashboardSummary';
import { FilterBar } from './components/FilterBar';
import { OperationsList } from './components/OperationsList';
import { EmptyState } from './components/EmptyState';
import { OperationModal } from './components/OperationModal';
import { PricingCalculatorModal } from './components/PricingCalculatorModal';
import { RevenueSplitModal } from './components/RevenueSplitModal';
import { Operation } from './types/operation';
import { Plus } from 'lucide-react';

export default function App() {
  const {
    operations,
    rawOperations,
    stats,
    filters,
    setFilters,
    uniqueSellers,
    addOperation,
    updateOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    exportJSON,
    importJSON,
  } = useOperations();

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

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative pb-20 lg:pb-12">
      
      {/* Top Navigation Header */}
      <Header
        onNewOperation={handleOpenNewOp}
        onOpenPricingCalculator={() => setIsPricingModalOpen(true)}
        onOpenRevenueSplit={() => setIsRevenueModalOpen(true)}
        onExportJSON={exportJSON}
        onImportJSON={importJSON}
        onResetData={resetToDefaultData}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        
        {/* Top Financial Totals Summary */}
        <DashboardSummary stats={stats} />

        {/* Search, Filter & Sort Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          uniqueSellers={uniqueSellers}
        />

        {/* Operations List or Empty State */}
        <section className="px-4 lg:px-8 py-2">
          {operations.length > 0 ? (
            <OperationsList
              operations={operations}
              onSelectOperation={handleSelectOp}
              onDuplicateOperation={duplicateOperation}
              onDeleteOperation={deleteOperation}
            />
          ) : (
            <EmptyState
              onNewOperation={handleOpenNewOp}
              isFiltered={isFiltered}
            />
          )}
        </section>

      </main>

      {/* Floating Action Button for Mobile (+ Nueva) */}
      <button
        onClick={handleOpenNewOp}
        className="lg:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-2xl shadow-emerald-500/40 active:scale-90 transition-all cursor-pointer border border-emerald-400"
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
