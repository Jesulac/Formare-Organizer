import React from 'react';
import { formatEuro } from '../utils/calculations';

interface DashboardSummaryProps {
  stats: {
    totalIngresos: number;
    gastosProduccion: number;
    gastosGenerales: number;
    totalCostes: number;
    totalBeneficio: number;
    pendienteCobro: number;
    count: number;
  };
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({ stats }) => {
  return (
    <section className="px-2.5 sm:px-3 lg:px-4 pt-3 pb-1 w-full max-w-none">
      <div className="w-full">
        {/* Responsive grid: 2 cols on mobile, 3 on tablet, 6 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          
          {/* Ingresos / Ventas */}
          <div className="glass-card glass-card-hover liquid-shimmer rounded-2xl p-3 sm:p-4 flex flex-col justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-300 truncate">
              Ventas (Ingresos)
            </span>
            <div className="mt-1 flex items-baseline justify-between min-w-0">
              <span className="text-base sm:text-2xl font-bold tracking-tight text-white font-mono tabular-nums truncate">
                {formatEuro(stats.totalIngresos)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Facturación bruta
            </span>
          </div>

          {/* Gastos de Producción (Solo Filamento de Ventas) */}
          <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 flex flex-col justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-theme-light/90 truncate">
              Gastos de Producción
            </span>
            <div className="mt-1 flex items-baseline justify-between min-w-0">
              <span className="text-base sm:text-2xl font-bold tracking-tight text-theme-light font-mono tabular-nums truncate">
                {formatEuro(stats.gastosProduccion)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Solo gasto de filamento
            </span>
          </div>

          {/* Gastos en General / Total (Bobinas y Compras aparte) */}
          <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 flex flex-col justify-between border-rose-400/20 min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-rose-300/90 truncate">
              Gastos en General
            </span>
            <div className="mt-1 flex items-baseline justify-between min-w-0">
              <span className="text-base sm:text-2xl font-bold tracking-tight text-rose-300 font-mono tabular-nums truncate">
                {formatEuro(stats.gastosGenerales)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Bobinas, compras y B. Sandra
            </span>
          </div>

          {/* Beneficio Neto (Hero Pastel Blue Liquid Glass Card) */}
          <div className="glass-card-pastel glass-card-hover rounded-2xl p-3 sm:p-4 flex flex-col justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-semibold text-theme-light flex items-center justify-between gap-1">
              <span className="truncate">Beneficio Neto</span>
              <span className="inline-block w-2 h-2 rounded-full bg-theme-accent animate-liquid-dot shrink-0" />
            </span>
            <div className="mt-1 flex items-baseline justify-between min-w-0">
              <span className={`text-lg sm:text-2xl font-extrabold tracking-tight font-mono tabular-nums truncate ${
                stats.totalBeneficio >= 0 ? 'text-theme-frost' : 'text-rose-400'
              }`}>
                {formatEuro(stats.totalBeneficio)}
              </span>
            </div>
            <span className="text-[10px] text-theme-accent/80 mt-0.5 truncate">
              Ventas - Producción - B. Sandra
            </span>
          </div>

          {/* Pendiente de cobro */}
          <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 flex flex-col justify-between border-amber-400/20 min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-amber-300/90 truncate">
              Pendiente
            </span>
            <div className="mt-1 flex items-baseline justify-between min-w-0">
              <span className="text-base sm:text-2xl font-bold tracking-tight text-amber-300 font-mono tabular-nums truncate">
                {formatEuro(stats.pendienteCobro)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Por cobrar / envío
            </span>
          </div>

          {/* Operaciones Count */}
          <div className="glass-card glass-card-hover rounded-2xl p-3 sm:p-4 flex flex-col justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-300 truncate">
              Operaciones
            </span>
            <div className="mt-1 flex items-baseline justify-between gap-1 min-w-0">
              <span className="text-base sm:text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
                {stats.count}
              </span>
              <span className="text-[10px] text-theme-accent/75 font-normal truncate">registros</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              En vista actual
            </span>
          </div>

        </div>
      </div>
    </section>
  );
};
