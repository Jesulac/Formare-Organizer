import React, { useState } from 'react';
import { FilamentSpool, Operation } from '../types/operation';
import { formatEuro, formatDateDisplay, formatDateInput, calculateFilamentGrams } from '../utils/calculations';
import { Disc, Plus, AlertTriangle, CheckCircle2, Scale, Calculator, Edit3, Check, X, Trash2, RotateCcw, Search, Sparkles } from 'lucide-react';

interface FilamentStockViewProps {
  spools: FilamentSpool[];
  onAddFilamentOrder: (opData: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>) => void;
  onUpdateFilamentRemaining: (spoolName: string, newRemainingGrams: number) => void;
  onUpdateFilamentInitial?: (spoolName: string, newInitialGrams: number) => void;
  onDeleteFilamentSpool?: (spoolName: string) => void;
}

export const FilamentStockView: React.FC<FilamentStockViewProps> = ({
  spools,
  onAddFilamentOrder,
  onUpdateFilamentRemaining,
  onUpdateFilamentInitial,
  onDeleteFilamentSpool,
}) => {
  const [newSpoolName, setNewSpoolName] = useState('');
  const [newSpoolPrice, setNewSpoolPrice] = useState('15.99');
  const [newSpoolUnits, setNewSpoolUnits] = useState('1');
  const [newSpoolSeller, setNewSpoolSeller] = useState('Jorge');
  const [newSpoolGramsPerUnit, setNewSpoolGramsPerUnit] = useState('1000');
  const [showAddForm, setShowAddForm] = useState(false);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // State for editing remaining grams on a specific filament spool
  const [editingSpoolName, setEditingSpoolName] = useState<string | null>(null);
  const [editRemainingValue, setEditRemainingValue] = useState<string>('');

  // State for editing initial grams on a specific filament spool
  const [editingInitialSpoolName, setEditingInitialSpoolName] = useState<string | null>(null);
  const [editInitialValue, setEditInitialValue] = useState<string>('');

  const [confirmingDeleteSpool, setConfirmingDeleteSpool] = useState<string | null>(null);

  // Quick Rule of Three Tester
  const [testSpoolPrice, setTestSpoolPrice] = useState('15.99');
  const [testSaleCost, setTestSaleCost] = useState('3.27');

  const totalInitialGrams = spools.reduce((acc, s) => acc + s.gramosIniciales, 0);
  const totalConsumedGrams = spools.reduce((acc, s) => acc + s.gramosConsumidos, 0);
  const totalRemainingGrams = spools.reduce((acc, s) => acc + s.gramosRestantes, 0);

  const handleStartEditRemaining = (spool: FilamentSpool) => {
    setEditingInitialSpoolName(null);
    setEditingSpoolName(spool.nombre);
    setEditRemainingValue(String(spool.gramosRestantes));
  };

  const handleSaveRemaining = (spoolName: string) => {
    const parsed = parseFloat(editRemainingValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateFilamentRemaining(spoolName, Math.round(parsed));
    }
    setEditingSpoolName(null);
  };

  const handleAdjustDraftAndSave = (spoolName: string, delta: number) => {
    const current = parseFloat(editRemainingValue.replace(',', '.')) || 0;
    const nextVal = Math.max(0, Math.round(current + delta));
    setEditRemainingValue(String(nextVal));
    onUpdateFilamentRemaining(spoolName, nextVal);
  };

  const handleStartEditInitial = (spool: FilamentSpool) => {
    setEditingSpoolName(null);
    setEditingInitialSpoolName(spool.nombre);
    setEditInitialValue(String(spool.gramosIniciales));
  };

  const handleSaveInitial = (spoolName: string) => {
    const parsed = parseFloat(editInitialValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateFilamentInitial?.(spoolName, Math.round(parsed));
    }
    setEditingInitialSpoolName(null);
  };

  const handleSetInitialQuickAndSave = (spoolName: string, targetVal: number) => {
    const valid = Math.max(0, Math.round(targetVal));
    setEditInitialValue(String(valid));
    onUpdateFilamentInitial?.(spoolName, valid);
  };

  const handleCreateSpoolPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSpoolName.trim();
    if (!cleanName) return;
    const pricePerUnit = parseFloat(newSpoolPrice.replace(',', '.')) || 15.99;
    const units = Math.max(1, parseInt(newSpoolUnits, 10) || 1);
    const gramsPerSpool = parseInt(newSpoolGramsPerUnit, 10) || 1000;
    const totalCost = Number((pricePerUnit * units).toFixed(2));
    const totalGrams = units * gramsPerSpool;

    onAddFilamentOrder({
      tipo: 'compra',
      producto: `Pedido filamento ${cleanName}`,
      material: cleanName,
      unidades: units,
      costeUnitario: pricePerUnit,
      precio: null,
      costes: totalCost,
      costesOperativos: 0,
      lugarVenta: 'Internet',
      estado: 'Pagado',
      vendedor: newSpoolSeller,
      fecha: formatDateInput(new Date().toISOString()),
      fechaLimite: '',
      esPedidoFilamento: true,
      comentarios: `${units} bobina(s) de ${gramsPerSpool}g (${totalGrams}g)`,
    });

    setToastSuccess(`✓ Filamento "${cleanName}" añadido correctamente al stock (+${totalGrams}g)`);
    setTimeout(() => {
      setToastSuccess(null);
    }, 5000);

    setNewSpoolName('');
    setShowAddForm(false);
  };

  const handleResetTo1000g = (spool: FilamentSpool) => {
    onUpdateFilamentRemaining(spool.nombre, 1000);
    if (editingSpoolName === spool.nombre) {
      setEditRemainingValue('1000');
      setEditingSpoolName(null);
    }
  };

  const sampleGrams = calculateFilamentGrams(
    parseFloat(testSaleCost.replace(',', '.')) || 0,
    parseFloat(testSpoolPrice.replace(',', '.')) || 15.99
  );

  const filteredSpools = spools.filter((s) => {
    if (!searchQuery.trim()) return true;
    return s.nombre.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const popularFilaments = [
    'PLA Azul Cielo (Elegoo)',
    'PLA Negro (Elegoo)',
    'PLA Blanco (Elegoo)',
    'PLA Rojo (Elegoo)',
    'PETG Negro (Elegoo)',
    'PETG Rojo (Winkle)',
    'ASA Negro (Winkle)',
    'TPU Negro',
  ];

  return (
    <section className="px-2 sm:px-3 lg:px-4 py-4 space-y-5 w-full max-w-none">
      {/* Toast notification */}
      {toastSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-sm">{toastSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastSuccess(null)}
            className="text-emerald-300 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card rounded-2xl p-4 border border-white/10">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-emerald-400" />
            <span>Control de Stock de Filamentos</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cada bobina nueva suma <strong className="text-zinc-200">1000 g</strong> al taller. Cada venta resta automáticamente los gramos usados mediante regla de tres:{' '}
            <span className="font-mono text-emerald-300">(Coste venta × 1000 g) / Precio bobina</span>. También puedes ajustar manualmente gramos restantes en cualquier momento.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{showAddForm ? 'Cerrar formulario' : 'Añadir Filamento al Stock (+)'}</span>
        </button>
      </div>

      {/* Add New Spool Purchase Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateSpoolPurchase}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-emerald-500/40 bg-emerald-950/20 space-y-4 text-xs shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-emerald-300 text-sm">
                Añadir Filamento / Bobina al Stock
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-zinc-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-zinc-200 font-medium mb-1">Nombre / Color / Marca del Filamento *</label>
              <input
                type="text"
                required
                value={newSpoolName}
                onChange={(e) => setNewSpoolName(e.target.value)}
                placeholder="Ej: PLA Azul Cielo (Elegoo), PETG Blanco, ASA Negro..."
                className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-zinc-300 mb-1">Precio por bobina (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newSpoolPrice}
                onChange={(e) => setNewSpoolPrice(e.target.value)}
                className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 mb-1">Nº de bobinas</label>
              <input
                type="number"
                min="1"
                step="1"
                value={newSpoolUnits}
                onChange={(e) => setNewSpoolUnits(e.target.value)}
                className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 mb-1">Comprador</label>
              <select
                value={newSpoolSeller}
                onChange={(e) => setNewSpoolSeller(e.target.value)}
                className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Jorge">Jorge</option>
                <option value="Sandra">Sandra</option>
                <option value="Empresa">Empresa</option>
              </select>
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1.5">Sugerencias rápidas:</span>
            <div className="flex flex-wrap gap-1.5">
              {popularFilaments.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewSpoolName(preset)}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-[11px] transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[11px] text-zinc-400">
              Se sumará <strong className="text-emerald-400">{(parseInt(newSpoolUnits, 10) || 1) * 1000}g</strong> al stock de filamentos y se registrará la compra.
            </span>
            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer transition-transform active:scale-95"
            >
              Guardar y Añadir al Stock (+{(parseInt(newSpoolUnits, 10) || 1) * 1000}g)
            </button>
          </div>
        </form>
      )}

      {/* Summary Totals & Rule-of-three Quick Verifier */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-white/10">
          <span className="text-xs text-zinc-400">Stock Total Adquirido</span>
          <div className="mt-1 text-2xl font-bold font-mono text-white">
            {totalInitialGrams.toLocaleString('es-ES')} g
          </div>
          <span className="text-[11px] text-zinc-500">
            {(totalInitialGrams / 1000).toFixed(1)} bobinas de 1000g
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-white/10">
          <span className="text-xs text-zinc-400">Consumido en Ventas</span>
          <div className="mt-1 text-2xl font-bold font-mono text-sky-400">
            {totalConsumedGrams.toLocaleString('es-ES')} g
          </div>
          <span className="text-[11px] text-zinc-500">
            Calculado por regla de tres según coste
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/20">
          <span className="text-xs text-emerald-300 font-medium">Filamento Restante</span>
          <div className="mt-1 text-2xl font-extrabold font-mono text-emerald-400">
            {totalRemainingGrams.toLocaleString('es-ES')} g
          </div>
          <span className="text-[11px] text-emerald-300/70">
            Disponible en taller (incluye ajustes manuales)
          </span>
        </div>

        {/* Rule of 3 Quick Calculator */}
        <div className="glass-card rounded-2xl p-3.5 border border-white/10 text-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-zinc-300 font-semibold mb-1.5">
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulador Regla de 3 (Gramos)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block">Bobina 1000g (€)</label>
              <input
                type="number"
                step="0.01"
                value={testSpoolPrice}
                onChange={(e) => setTestSpoolPrice(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block">Coste venta (€)</label>
              <input
                type="number"
                step="0.01"
                value={testSaleCost}
                onChange={(e) => setTestSaleCost(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs"
              />
            </div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Consumo pieza:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{sampleGrams} g</span>
          </div>
        </div>
      </div>

      {/* Spools Search & Counter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar filamento por nombre, material o color..."
            className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
          <span>{filteredSpools.length} filamentos {searchQuery ? 'encontrados' : 'en stock'}</span>
        </div>
      </div>

      {/* Filament Spools Grid */}
      {filteredSpools.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 border border-white/10 text-center space-y-3">
          <Scale className="w-10 h-10 text-zinc-500 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">
            {searchQuery ? `No hay filamentos que coincidan con "${searchQuery}"` : 'No hay filamentos registrados'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {searchQuery
              ? 'Prueba a cambiar el texto de búsqueda o pulsa en añadir filamento para registrar uno nuevo.'
              : 'Haz clic en el botón superior para añadir una nueva bobina o filamento a tu taller.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setShowAddForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Añadir Filamento al Stock</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSpools.map((spool) => {
            const pct =
              spool.gramosIniciales > 0
                ? Math.min(100, Math.max(0, Math.round((spool.gramosRestantes / spool.gramosIniciales) * 100)))
                : 0;
            const isLow = spool.gramosRestantes < 250;
            const isEditingThis = editingSpoolName === spool.nombre;
          const isEditingInitialThis = editingInitialSpoolName === spool.nombre;
          const isConfirmingDelete = confirmingDeleteSpool === spool.nombre;
          const hasManualAdjust = Boolean(spool.ajusteManualGramos && spool.ajusteManualGramos !== 0);

          return (
            <div
              key={spool.nombre}
              className={`glass-card rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                isLow ? 'border-amber-500/40 bg-amber-950/10' : 'border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{spool.nombre}</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                    Precio bobina (1000g): <strong className="text-zinc-200">{formatEuro(spool.precioBobina)}</strong>
                    {spool.ultimaCompraFecha && ` · Últ. pedido: ${formatDateDisplay(spool.ultimaCompraFecha)}`}
                  </p>
                </div>

                {isLow ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    Stock bajo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    OK ({pct}%)
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isLow ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 text-[11px] pt-1">
                  <div>
                    <span className="text-zinc-500 block">Inicial ({spool.bobinasCompradas} bob.)</span>
                    <button
                      type="button"
                      onClick={() => handleStartEditInitial(spool)}
                      className="inline-flex items-center gap-1 font-mono font-bold text-sm text-zinc-200 hover:text-sky-300 cursor-pointer hover:underline"
                      title="Editar gramos iniciales"
                    >
                      <span>{spool.gramosIniciales} g</span>
                      <Edit3 className="w-3 h-3 opacity-75 text-sky-400" />
                    </button>
                  </div>
                  <div className="text-center">
                    <span className="text-zinc-500 block">Gastado ventas</span>
                    <span className="font-mono font-semibold text-sky-300">-{spool.gramosConsumidos} g</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 block">Restante</span>
                    <button
                      type="button"
                      onClick={() => handleStartEditRemaining(spool)}
                      className={`inline-flex items-center gap-1 font-mono font-bold text-sm cursor-pointer hover:underline ${
                        isLow ? 'text-amber-300' : 'text-emerald-400'
                      }`}
                      title="Editar gramos restantes"
                    >
                      <span>{spool.gramosRestantes} g</span>
                      <Edit3 className="w-3 h-3 opacity-75" />
                    </button>
                  </div>
                </div>

                {hasManualAdjust && (
                  <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between pt-0.5">
                    <span>
                      Ajuste manual/desgaste:{' '}
                      <strong className={spool.ajusteManualGramos! >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                        {spool.ajusteManualGramos! > 0 ? `+${spool.ajusteManualGramos}` : spool.ajusteManualGramos} g
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Inline Editor for Initial Filament Grams */}
              {isEditingInitialThis && (
                <div className="p-3 rounded-xl bg-zinc-900/95 border border-sky-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-sky-300">
                      Actualizar gramos iniciales (g)
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditingInitialSpoolName(null)}
                      className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editInitialValue}
                      onChange={(e) => setEditInitialValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveInitial(spool.nombre);
                        }
                      }}
                      className="flex-1 min-w-0 bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                      autoFocus
                    />
                    <span className="text-xs font-mono text-zinc-400">g</span>
                    <button
                      type="button"
                      onClick={() => handleSaveInitial(spool.nombre)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Guardar</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="text-zinc-400">Valores rápidos:</span>
                    <div className="flex items-center gap-1">
                      {[1000, 2000, 3000, 5000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSetInitialQuickAndSave(spool.nombre, preset)}
                          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-zinc-300 font-mono cursor-pointer border border-white/10"
                        >
                          {preset}g
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Editor for Remaining Filament */}
              {isEditingThis && (
                <div className="p-3 rounded-xl bg-zinc-900/95 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-emerald-300">
                      Actualizar filamento restante (g)
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditingSpoolName(null)}
                      className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editRemainingValue}
                      onChange={(e) => setEditRemainingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRemaining(spool.nombre);
                        }
                      }}
                      className="flex-1 min-w-0 bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    <span className="text-xs font-mono text-zinc-400">g</span>
                    <button
                      type="button"
                      onClick={() => handleSaveRemaining(spool.nombre)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Guardar</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="text-zinc-400">Ajuste rápido:</span>
                    <div className="flex items-center gap-1">
                      {[-100, -50, -10, +10, +50].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => handleAdjustDraftAndSave(spool.nombre, delta)}
                          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-zinc-300 font-mono cursor-pointer border border-white/10"
                        >
                          {delta > 0 ? `+${delta}g` : `${delta}g`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Banner before Deleting Filament */}
              {isConfirmingDelete && (
                <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/40 space-y-2.5">
                  <p className="text-[11px] font-medium text-rose-200 leading-snug">
                    ¿Seguro que quieres eliminar <strong className="text-white">{spool.nombre}</strong> del stock de filamentos?
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteSpool(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteFilamentSpool?.(spool.nombre);
                        setConfirmingDeleteSpool(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] shadow-lg shadow-rose-500/20 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sí, eliminar</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-500 font-mono">
                  1g = {formatEuro(spool.precioBobina / 1000)}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      isEditingInitialThis
                        ? setEditingInitialSpoolName(null)
                        : handleStartEditInitial(spool)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-200 border border-white/10 text-[11px] font-medium cursor-pointer transition-colors"
                    title="Editar gramos iniciales"
                  >
                    <Edit3 className="w-3 h-3 text-sky-400" />
                    <span>Editar inicial</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      isEditingThis ? setEditingSpoolName(null) : handleStartEditRemaining(spool)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-200 border border-white/10 text-[11px] font-medium cursor-pointer transition-colors"
                    title="Editar gramos restantes"
                  >
                    <Edit3 className="w-3 h-3 text-emerald-400" />
                    <span>Editar restante</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetTo1000g(spool)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                    title="Restablecer filamento restante directamente a 1000g"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>1000g</span>
                  </button>
                  {onDeleteFilamentSpool && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmingDeleteSpool(isConfirmingDelete ? null : spool.nombre)
                      }
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer transition-colors"
                      title="Eliminar filamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
};
