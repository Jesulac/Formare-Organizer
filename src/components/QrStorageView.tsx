import React, { useState, useRef } from 'react';
import { Operation, ShippingCompany } from '../types/operation';
import { formatDateDisplay, compressImageFile } from '../utils/calculations';
import { 
  QrCode, 
  Upload, 
  Trash2, 
  Clock, 
  Maximize2, 
  X, 
  Truck, 
  ShieldCheck,
  CalendarClock
} from 'lucide-react';

interface QrStorageViewProps {
  operations: Operation[];
  onAttachQr: (id: string, fotoQr: string | undefined, empresaEnvio?: ShippingCompany) => void;
}

const SHIPPING_COMPANIES: ShippingCompany[] = ['Correos', 'InPost', 'Seur', 'Otro'];
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export const QrStorageView: React.FC<QrStorageViewProps> = ({
  operations,
  onAttachQr,
}) => {
  const [filterMode, setFilterMode] = useState<'activos' | 'todas'>('activos');
  const [scanModalOp, setScanModalOp] = useState<Operation | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadOpId, setActiveUploadOpId] = useState<string | null>(null);

  // Sales automatically generate a QR slot, EXCLUDING 'Pendiente de cobro' and 'Cancelado'
  const salesOperations = operations.filter(
    (op) =>
      op.tipo === 'venta' &&
      op.estado !== 'Pendiente de cobro' &&
      op.estado !== 'Cancelado'
  );

  const displayedSales = salesOperations.filter((op) => {
    if (filterMode === 'todas') return true;
    // Show sales that have a QR uploaded OR are in production / shipped (never 'Pendiente de cobro')
    return (
      Boolean(op.fotoQr) ||
      op.estado === 'En producción' ||
      op.estado === 'Enviado'
    );
  });

  // Fallback to showing the 15 most recent non-Pendiente-de-cobro sales if no active filter matches
  const finalSales = displayedSales.length > 0 ? displayedSales : salesOperations.slice(0, 15);

  const handleTriggerUpload = (opId: string) => {
    setActiveUploadOpId(opId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadOpId) return;
    try {
      const compressed = await compressImageFile(file, 900);
      const targetOp = operations.find((o) => o.id === activeUploadOpId);
      onAttachQr(activeUploadOpId, compressed, targetOp?.empresaEnvio || 'Correos');
    } catch (err) {
      console.error('Error al subir el código QR', err);
    } finally {
      setActiveUploadOpId(null);
    }
  };

  const getDaysRemaining = (fechaSubida?: number): number => {
    if (!fechaSubida) return 10;
    const elapsed = Date.now() - fechaSubida;
    const remaining = Math.ceil((TEN_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  };

  return (
    <section className="px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-[1600px] mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card rounded-2xl p-4 border border-white/10">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <span>Almacenamiento de QR y Etiquetas de Envío</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cada venta genera automáticamente un espacio con su <strong className="text-zinc-200">lugar de venta</strong> y <strong className="text-zinc-200">fecha límite</strong> para escanear en Correos, InPost o Seur.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 mt-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Auto-limpieza activa: Los pedidos en &laquo;Pendiente de cobro&raquo; y los QR con más de 10 días se borran automáticamente del almacén.
            </span>
          </div>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setFilterMode('activos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filterMode === 'activos'
                ? 'bg-emerald-500 text-black font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Envíos activos / Con QR
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filterMode === 'todas'
                ? 'bg-emerald-500 text-black font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todas las ventas ({salesOperations.length})
          </button>
        </div>
      </div>

      {/* QR Storage Slots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {finalSales.map((op) => {
          const daysLeft = getDaysRemaining(op.fechaSubidaQr);

          return (
            <div
              key={op.id}
              className={`glass-card rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                op.fotoQr
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : 'border-white/10'
              }`}
            >
              {/* Slot Header: Product, Platform & Deadline */}
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-white/10 text-zinc-200 font-semibold text-[10px] uppercase tracking-wider">
                    {op.lugarVenta}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                    <CalendarClock className="w-3 h-3" />
                    Límite: {op.fechaLimite ? formatDateDisplay(op.fechaLimite) : '—'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white leading-snug">
                  {op.producto}
                  {op.unidades > 1 && (
                    <span className="ml-1.5 text-xs font-mono text-emerald-300">
                      (×{op.unidades} uds)
                    </span>
                  )}
                </h3>

                <p className="text-[11px] text-zinc-400">
                  Venta del {formatDateDisplay(op.fecha)} · Estado: <strong className="text-zinc-200">{op.estado}</strong>
                </p>
              </div>

              {/* Shipping Carrier Selector (Correos, InPost, Seur, otro) */}
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-emerald-400" />
                  <span>Lugar de envío</span>
                </label>
                <select
                  value={op.empresaEnvio || 'Correos'}
                  onChange={(e) =>
                    onAttachQr(op.id, op.fotoQr, e.target.value as ShippingCompany)
                  }
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                >
                  {SHIPPING_COMPANIES.map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {carrier}
                    </option>
                  ))}
                </select>
              </div>

              {/* QR / Barcode Upload or Preview Area */}
              {op.fotoQr ? (
                <div className="space-y-2">
                  <div
                    onClick={() => setScanModalOp(op)}
                    className="relative group bg-white rounded-xl p-2.5 flex items-center justify-center cursor-pointer overflow-hidden h-40 border border-emerald-500/30"
                    title="Toca para abrir en pantalla completa para escanear"
                  >
                    <img
                      src={op.fotoQr}
                      alt={`QR de ${op.producto}`}
                      className="max-h-full max-w-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                      <Maximize2 className="w-4 h-4" />
                      <span>Ampliar para escáner</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <Clock className="w-3 h-3" />
                      Auto-borrado en {daysLeft} {daysLeft === 1 ? 'día' : 'días'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTriggerUpload(op.id)}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 cursor-pointer"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={() => onAttachQr(op.id, undefined, undefined)}
                        className="p-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 cursor-pointer"
                        title="Eliminar QR"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTriggerUpload(op.id)}
                  className="w-full h-32 rounded-xl border border-dashed border-white/20 hover:border-emerald-500/50 bg-white/[0.02] hover:bg-emerald-500/[0.05] flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-emerald-300 transition-all cursor-pointer"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs font-medium">Subir QR o Código de Barras</span>
                  <span className="text-[10px] text-zinc-500">Correos · InPost · Seur</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Fullscreen High-Contrast Scanner Modal for Correos / InPost */}
      {scanModalOp && scanModalOp.fotoQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setScanModalOp(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black">
                  {scanModalOp.empresaEnvio || 'Correos'} · {scanModalOp.lugarVenta}
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {scanModalOp.producto}
                </h3>
                <p className="text-xs text-zinc-400">
                  Fecha límite: {scanModalOp.fechaLimite ? formatDateDisplay(scanModalOp.fechaLimite) : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanModalOp(null)}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 flex items-center justify-center min-h-[280px]">
              <img
                src={scanModalOp.fotoQr}
                alt="Código QR para escaneo"
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            <p className="text-center text-xs text-zinc-400">
              Muestra este código en el mostrador o taquilla de{' '}
              <strong className="text-white">{scanModalOp.empresaEnvio || 'Correos'}</strong>.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
