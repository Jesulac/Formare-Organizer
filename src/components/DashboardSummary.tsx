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
    <section className="px-3 sm:px-4 lg:px-6 pt-3 pb-1">
      <div className="max-w-[1600px] mx-auto">
        {/* Responsive grid: 2 cols on mobile, 3 on tablet, 6 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          
          {/* Ingresos / Ventas */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-400">
              Ventas (Ingresos)
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-white font-mono">
                {formatEuro(stats.totalIngresos)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Facturación bruta
            </span>
          </div>

          {/* Gastos de Producción (Solo Filamento de Ventas) */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-sky-400/90">
              Gastos de Producción
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-sky-300 font-mono">
                {formatEuro(stats.gastosProduccion)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Solo gasto de filamento
            </span>
          </div>

          {/* Gastos en General / Total (Bobinas y Compras aparte) */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-rose-400/90">
              Gastos en General
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-rose-300 font-mono">
                {formatEuro(stats.gastosGenerales)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Bobinas, compras y 15% Sandra
            </span>
          </div>

          {/* Beneficio Neto */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between border-emerald-500/30 bg-emerald-950/20 transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-emerald-400 flex items-center justify-between">
              <span>Beneficio Neto</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={`text-xl sm:text-2xl font-extrabold tracking-tight font-mono ${
                stats.totalBeneficio >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {formatEuro(stats.totalBeneficio)}
              </span>
            </div>
            <span className="text-[10px] text-emerald-300/70 mt-0.5 truncate">
              Ventas - Gastos producción
            </span>
          </div>

          {/* Pendiente de cobro */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-amber-400/90">
              Pendiente
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-amber-300 font-mono">
                {formatEuro(stats.pendienteCobro)}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Por cobrar / envío
            </span>
          </div>

          {/* Operaciones Count */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-400">
              Operaciones
            </span>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-white font-mono">
                {stats.count}
              </span>
              <span className="text-[10px] text-zinc-500 font-normal truncate">registros</span>
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
