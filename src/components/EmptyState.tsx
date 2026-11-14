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
    <div className="glass-card liquid-shimmer rounded-3xl p-8 lg:p-12 text-center flex flex-col items-center justify-center my-6 max-w-md mx-auto animate-spring-pop">
      <div className="w-14 h-14 rounded-2xl glass-card-pastel flex items-center justify-center text-[#bae6fd] mb-4 animate-liquid-float">
        <PackageX className="w-6 h-6 text-[#93c5fd]" />
      </div>

      <h3 className="text-base font-bold text-white mb-1 tracking-tight">
        {isFiltered ? 'Sin resultados' : 'Aún no hay operaciones'}
      </h3>

      <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
        {isFiltered
          ? 'No se encontraron operaciones con los filtros seleccionados.'
          : 'Añade tu primera venta o compra para empezar a controlar ingresos, costes y beneficios.'}
      </p>

      <button
        onClick={onNewOperation}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full liquid-btn-primary font-bold text-xs cursor-pointer"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>Nueva operación</span>
      </button>
    </div>
  );
};
