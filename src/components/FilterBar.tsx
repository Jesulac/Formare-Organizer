import React, { useState } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  Calendar, 
  User, 
  Tag, 
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { FilterOptions, Platform, Status, TimeFilter, SortField, SortOrder } from '../types/operation';

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (updated: FilterOptions) => void;
  uniqueSellers: string[];
}

const timeFilterLabels: { id: TimeFilter; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'mes', label: 'Este mes' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'ano', label: 'Este año' },
];

const platformsList: Platform[] = [
  'Wallapop',
  'Vinted',
  'Etsy',
  'eBay',
  'Cults3D',
  'En persona',
  'Internet',
  'Otro',
];

const statusesList: Status[] = [
  'Cobrado✅',
  'Pagado⭕',
  'Pendiente de cobro',
  'Enviado📦',
  'En producción',
  'Cancelado',
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  uniqueSellers,
}) => {
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);

  const activeFiltersCount = 
    (filters.platform !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.tipo !== 'all' ? 1 : 0) +
    (filters.vendedor !== 'all' ? 1 : 0) +
    (filters.timeFilter !== 'todo' ? 1 : 0);

  const resetFilters = () => {
    onFilterChange({
      ...filters,
      search: '',
      timeFilter: 'todo',
      platform: 'all',
      status: 'all',
      tipo: 'all',
      vendedor: 'all',
      startDate: undefined,
      endDate: undefined,
    });
  };

  return (
    <section className="px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        
        {/* Search Bar & Mobile Filter Trigger */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              placeholder="Buscar por producto, material, vendedor..."
              className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
            {filters.search && (
              <button
                onClick={() => onFilterChange({ ...filters, search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Button */}
          <button
            onClick={() => setShowMobileFilterSheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/80 border border-white/10 text-xs text-zinc-200 font-medium hover:bg-zinc-800 transition-all active:scale-95 shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Time Filter Pills & Sort Select (Desktop/Tablet) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Time Segmented Buttons */}
          <div className="flex items-center p-1 bg-zinc-900/80 border border-white/10 rounded-xl shrink-0">
            {timeFilterLabels.map((t) => (
              <button
                key={t.id}
                onClick={() => onFilterChange({ ...filters, timeFilter: t.id })}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  filters.timeFilter === t.id
                    ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Platform Dropdown Quick Selector */}
          <select
            value={filters.platform}
            onChange={(e) => onFilterChange({ ...filters, platform: e.target.value })}
            className="hidden sm:block bg-zinc-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="all">Todas las plataformas</option>
            {platformsList.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/80 border border-white/10 rounded-xl px-2 py-1 shrink-0 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
            <select
              value={filters.sortBy}
              onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value as SortField })}
              className="bg-transparent border-none text-zinc-300 text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="fecha">Recientes</option>
              <option value="precio">Precio</option>
              <option value="costes">Costes</option>
              <option value="beneficio">Beneficio</option>
              <option value="producto">Producto</option>
            </select>
            <button
              onClick={() => onFilterChange({
                ...filters,
                sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'
              })}
              className="p-1 hover:text-white text-zinc-400 rounded-md"
              title={filters.sortOrder === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET FOR ADVANCED FILTERS */}
      {showMobileFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
            onClick={() => setShowMobileFilterSheet(false)}
          />
          
          <div className="relative w-full max-w-lg glass-modal rounded-t-3xl sm:rounded-3xl p-5 border border-white/10 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1 mb-4" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                Filtros & Ordenación
              </h3>
              <button
                onClick={() => setShowMobileFilterSheet(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Periodo de Tiempo */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Periodo
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {timeFilterLabels.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onFilterChange({ ...filters, timeFilter: t.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        filters.timeFilter === t.id
                          ? 'bg-emerald-500 text-black font-semibold'
                          : 'bg-zinc-900 border border-white/10 text-zinc-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plataforma */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  Plataforma
                </label>
                <select
                  value={filters.platform}
                  onChange={(e) => onFilterChange({ ...filters, platform: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="all">Todas las plataformas</option>
                  {platformsList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Estado</label>
                <select
                  value={filters.status}
                  onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="all">Todos los estados</option>
                  {statusesList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Vendedor */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  Vendedor
                </label>
                <select
                  value={filters.vendedor}
                  onChange={(e) => onFilterChange({ ...filters, vendedor: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="all">Todos los vendedores</option>
                  {uniqueSellers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de operación */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Tipo de Registro</label>
                <select
                  value={filters.tipo}
                  onChange={(e) => onFilterChange({ ...filters, tipo: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="venta">Venta</option>
                  <option value="compra">Compra de material</option>
                  <option value="inversion">Inversión / Activo</option>
                  <option value="cierre">Cierre mensual</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 mt-6 pt-3 border-t border-white/10">
              <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-zinc-300 font-medium text-xs hover:bg-white/5 active:scale-95 transition-all flex-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar
              </button>
              <button
                onClick={() => setShowMobileFilterSheet(false)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs active:scale-95 transition-all flex-1"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
