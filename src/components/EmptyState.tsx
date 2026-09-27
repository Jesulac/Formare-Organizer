import React from 'react';
import { PackageX, Plus } from 'lucide-react';

interface EmptyStateProps {
  onNewOperation: () => void;
  isFiltered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNewOperation,
  isFiltered = false,
}) => {
  return (
    <div className="glass-card rounded-3xl p-8 lg:p-12 text-center flex flex-col items-center justify-center my-6 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 mb-4">
        <PackageX className="w-6 h-6 text-zinc-400" />
      </div>

      <h3 className="text-base font-semibold text-white mb-1">
        {isFiltered ? 'Sin resultados' : 'Aún no hay operaciones'}
      </h3>

      <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
        {isFiltered
          ? 'No se encontraron operaciones con los filtros seleccionados.'
          : 'Añade tu primera venta o compra para empezar a controlar ingresos, costes y beneficios.'}
      </p>

      <button
        onClick={onNewOperation}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 text-black font-semibold text-xs active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>+ Nueva operación</span>
      </button>
    </div>
  );
};
