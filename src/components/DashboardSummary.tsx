import React from 'react';
import { formatEuro } from '../utils/calculations';

interface DashboardSummaryProps {
  stats: {
    totalIngresos: number;
    totalCostes: number;
    totalBeneficio: number;
    pendienteCobro: number;
    count: number;
  };
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({ stats }) => {
  return (
    <section className="px-4 lg:px-8 pt-4 pb-2">
      <div className="max-w-7xl mx-auto">
        {/* Responsive grid: 2 cols on mobile (Operaciones next to Pendiente), 5 cols on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          
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
          </div>

          {/* Costes */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-400">
              Costes Totales
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-300 font-mono">
                {formatEuro(stats.totalCostes)}
              </span>
            </div>
          </div>

          {/* Beneficio Neto (FEATURED PROMINENCE) */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between border-emerald-500/30 bg-emerald-950/20 col-span-2 lg:col-span-1 transition-all">
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
          </div>

          {/* Pendiente de cobro */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between col-span-1 transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-amber-400/90">
              Pendiente
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-amber-300 font-mono">
                {formatEuro(stats.pendienteCobro)}
              </span>
            </div>
          </div>

          {/* Operaciones Count - sits right next to Pendiente on mobile */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between col-span-1 transition-all">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-400">
              Operaciones
            </span>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-white font-mono">
                {stats.count}
              </span>
              <span className="text-[10px] text-zinc-500 font-normal truncate">registros</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
