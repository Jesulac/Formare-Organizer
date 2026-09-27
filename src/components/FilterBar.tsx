import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  Calendar,
  User,
  Tag,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import {
  FilterOptions,
  Platform,
  Status,
  TimeFilter,
  SortField,
} from '../types/operation';
import { OledSelect } from './OledSelect';

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
  'Amazon',
  'Cults3D',
  'En persona',
  'Internet',
  'Otro',
];

const statusesList: Status[] = [
  'Cobrado',
  'Pagado',
  'Pendiente de pago',
  'En producción',
  'Pendiente de cobro',
  'Enviado',
  'Cancelado',
];

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'fecha', label: 'Recientes' },
  { value: 'precio', label: 'Precio' },
  { value: 'costes', label: 'Costes' },
  { value: 'beneficio', label: 'Beneficio' },
  { value: 'producto', label: 'Producto' },
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

  const platformSelectOptions = [
    { value: 'all', label: 'Todas las plataformas' },
    ...platformsList.map((p) => ({ value: p, label: p })),
  ];

  const statusSelectOptions = [
    { value: 'all', label: 'Todos los estados' },
    ...statusesList.map((s) => ({ value: s, label: s })),
  ];

  const sellerSelectOptions = [
    { value: 'all', label: 'Todos los vendedores' },
    ...uniqueSellers.map((s) => ({ value: s, label: s })),
  ];

  const tipoSelectOptions = [
    { value: 'all', label: 'Todos los tipos' },
    { value: 'venta', label: 'Venta' },
    { value: 'compra', label: 'Compra de material' },
    { value: 'inversion', label: 'Inversión / Activo' },
    { value: 'otro', label: 'Otro' },
  ];

  return (
    <section className="px-2 sm:px-3 lg:px-4 py-2.5 w-full max-w-none">
      <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Search Bar & Filter Trigger */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              placeholder="Buscar por producto, material, vendedor..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Modal Trigger Button */}
          <button
            type="button"
            onClick={() => setShowMobileFilterSheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-200 font-medium hover:bg-zinc-800 transition-all active:scale-95 shrink-0 cursor-pointer"
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

        {/* Quick Time Filter Segmented Buttons & Custom OLED Dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Time Segmented Buttons */}
          <div className="flex items-center p-1 bg-zinc-900/90 border border-white/10 rounded-xl shrink-0">
            {timeFilterLabels.map((t) => (
              <button
                key={t.id}
                type="button"
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

          {/* Platform Custom OLED Dropdown */}
          <div className="hidden sm:block w-44 shrink-0">
            <OledSelect
              value={filters.platform}
              onChange={(val) => onFilterChange({ ...filters, platform: val })}
              options={platformSelectOptions}
              buttonClassName="bg-zinc-900/90 hover:bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200"
            />
          </div>

          {/* Sort Custom OLED Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-white/10 rounded-xl px-2 py-1 shrink-0 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 ml-1 shrink-0" />
            <OledSelect
              value={filters.sortBy}
              onChange={(val) =>
                onFilterChange({ ...filters, sortBy: val as SortField })
              }
              options={sortOptions}
              menuWidth={160}
              buttonClassName="bg-transparent border-none px-1.5 py-0.5 text-xs text-zinc-200 hover:text-white"
            />
            <button
              type="button"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
                })
              }
              className="p-1 hover:text-white text-zinc-400 rounded-md cursor-pointer"
              title={
                filters.sortOrder === 'asc'
                  ? 'Orden ascendente'
                  : 'Orden descendente'
              }
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* ADVANCED FILTERS MODAL / SHEET */}
      {showMobileFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setShowMobileFilterSheet(false)}
          />

          <div className="relative w-full max-w-lg glass-modal rounded-t-3xl sm:rounded-3xl p-5 border border-white/10 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1 mb-4 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <span>Filtros y Ordenación</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileFilterSheet(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Periodo de Tiempo */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Periodo</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {timeFilterLabels.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onFilterChange({ ...filters, timeFilter: t.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
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
                  <span>Plataforma</span>
                </label>
                <OledSelect
                  value={filters.platform}
                  onChange={(val) => onFilterChange({ ...filters, platform: val })}
                  options={platformSelectOptions}
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Estado</label>
                <OledSelect
                  value={filters.status}
                  onChange={(val) => onFilterChange({ ...filters, status: val })}
                  options={statusSelectOptions}
                />
              </div>

              {/* Vendedor */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  <span>Vendedor</span>
                </label>
                <OledSelect
                  value={filters.vendedor}
                  onChange={(val) => onFilterChange({ ...filters, vendedor: val })}
                  options={sellerSelectOptions}
                />
              </div>

              {/* Tipo de operación */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">
                  Tipo de Registro
                </label>
                <OledSelect
                  value={filters.tipo}
                  onChange={(val) => onFilterChange({ ...filters, tipo: val })}
                  options={tipoSelectOptions}
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 mt-6 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-zinc-300 font-medium text-xs hover:bg-white/5 active:scale-95 transition-all flex-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilterSheet(false)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs active:scale-95 transition-all flex-1 cursor-pointer"
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
