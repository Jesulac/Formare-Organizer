import React, { useState } from 'react';
import {
  FilamentStockSummary,
  FilamentSpool,
} from '../types/operation';
import {
  Disc,
  Plus,
  Trash2,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

interface FilamentInventorySectionProps {
  inventory: FilamentStockSummary[];
  customSpools: FilamentSpool[];
  onAddSpool: (spool: Omit<FilamentSpool, 'id'>) => void;
  onRemoveSpool: (id: string) => void;
  onRegisterPurchaseOp: (nombre: string, precioTotal: number, bobinas: number) => void;
}

export const FilamentInventorySection: React.FC<FilamentInventorySectionProps> = ({
  inventory,
  customSpools,
  onAddSpool,
  onRemoveSpool,
  onRegisterPurchaseOp,
}) => {
  const [nombre, setNombre] = useState('');
  const [precioBobina, setPrecioBobina] = useState('15.99');
  const [bobinas, setBobinas] = useState('1');
  const [alsoAddExpense, setAlsoAddExpense] = useState(true);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const price = Math.max(1, parseFloat(precioBobina.replace(',', '.')) || 15.99);
    const count = Math.max(1, parseInt(bobinas, 10) || 1);

    if (alsoAddExpense) {
      // Creates a 'compra' operation in the ledger which automatically adds 1000g * count to the filament database
      onRegisterPurchaseOp(nombre.trim(), Number((price * count).toFixed(2)), count);
    } else {
      onAddSpool({
        nombre: nombre.trim(),
        precioBobina: price,
        gramosIniciales: count * 1000,
        fechaCompra: new Date().toISOString().split('T')[0],
      });
    }

    setNombre('');
    setBobinas('1');
  };

  const totalGramosComprados = inventory.reduce((acc, i) => acc + i.gramosTotales, 0);
  const totalGramosConsumidos = inventory.reduce((acc, i) => acc + i.gramosConsumidos, 0);
  const totalGramosRestantes = inventory.reduce((acc, i) => acc + i.gramosRestantes, 0);

  return (
    <section className="space-y-4">
      {/* Header & Global Metrics */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/90 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Disc className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Stock y Control de Filamentos (1000g / bobina)
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Cada bobina registrada suma 1000g. En cada venta se descuentan automáticamente los gramos consumidos mediante regla de tres: <code className="text-zinc-300">(Coste venta × 1000g) / Precio bobina</code>.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
          <div className="px-3.5 py-2.5 rounded-2xl bg-zinc-900/90 border border-white/8">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Stock Total
            </span>
            <span className="text-sm sm:text-base font-bold text-white">
              {totalGramosComprados.toLocaleString('es-ES')} g
            </span>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-zinc-900/90 border border-white/8">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Consumido
            </span>
            <span className="text-sm sm:text-base font-bold text-amber-400">
              {totalGramosConsumidos.toLocaleString('es-ES')} g
            </span>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/25">
            <span className="block text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">
              Restante
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400">
              {totalGramosRestantes.toLocaleString('es-ES')} g
            </span>
          </div>
        </div>
      </div>

      {/* Add New Filament Spool Form */}
      <form
        onSubmit={handleAdd}
        className="p-4 rounded-3xl bg-zinc-950/85 border border-white/10 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Registrar nueva bobina de filamento (1000g por unidad)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-5">
            <label className="block text-[10px] text-zinc-400 mb-1">
              Material / Filamento
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: PETG Negro (Elegoo), ASA Negro..."
              className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[10px] text-zinc-400 mb-1">
              Precio por bobina 1000g (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={precioBobina}
              onChange={(e) => setPrecioBobina(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] text-zinc-400 mb-1">
              Nº Bobinas (×1000g)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={bobinas}
              onChange={(e) => setBobinas(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Añadir +{Math.max(1, parseInt(bobinas, 10) || 1) * 1000}g
            </button>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={alsoAddExpense}
            onChange={(e) => setAlsoAddExpense(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-0"
          />
          <span>
            Registrar también como pedido de compra en la tabla principal de operaciones
          </span>
        </label>
      </form>

      {/* Filament Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {inventory.map((item) => {
          const isLow = item.gramosRestantes < 250;
          const isDepleted = item.gramosRestantes <= 0;

          return (
            <div
              key={item.id}
              className="p-4 rounded-3xl bg-zinc-950/85 border border-white/10 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {item.nombre}
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      {item.bobinasCount}{' '}
                      {item.bobinasCount === 1 ? 'bobina' : 'bobinas'} (
                      {item.gramosTotales}g) · Media:{' '}
                      {formatCurrency(item.precioMedioBobina)}/kg
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      isDepleted
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : isLow
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isDepleted || isLow ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {item.gramosRestantes} g libres
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden border border-white/5 my-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDepleted
                        ? 'bg-rose-500'
                        : isLow
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${item.porcentajeRestante}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 text-center">
                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase">
                    Comprado
                  </span>
                  <span className="text-xs font-semibold text-zinc-200">
                    {item.gramosTotales} g
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase">
                    Gastado Ventas
                  </span>
                  <span className="text-xs font-semibold text-amber-400">
                    -{item.gramosConsumidos} g
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase">
                    Disponible
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      isDepleted
                        ? 'text-rose-400'
                        : isLow
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {item.gramosRestantes} g
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom added spools list if any */}
      {customSpools.length > 0 && (
        <div className="p-4 rounded-3xl bg-zinc-950/60 border border-white/8 space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" />
            Bobinas manuales adicionales
          </h4>
          <div className="flex flex-wrap gap-2">
            {customSpools.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-300"
              >
                <span>
                  {s.nombre} ({s.gramosIniciales}g · {formatCurrency(s.precioBobina)})
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveSpool(s.id)}
                  className="text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-start gap-2.5 text-xs text-zinc-400">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p>
          <strong>Cómo funciona el descuento automático:</strong> Cada vez que registras una compra de filamento (por ejemplo, <em>Pedido filamento PETG Elegoo</em> por 15,99 €), se suman <strong>1000 gramos</strong> de ese material. Cuando registras una venta (por ejemplo, con coste de 1,60 € de filamento), se aplica una regla de tres con el precio de la bobina para descontar exactamente los gramos empleados.
        </p>
      </div>
    </section>
  );
};
