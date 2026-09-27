import React, { useState, useRef } from 'react';
import { Operation, Carrier, Status } from '../types/operation';
import {
  QrCode,
  Upload,
  CalendarClock,
  Truck,
  Maximize2,
  Trash2,
  Clock,
  CheckCircle2,
  Search,
} from 'lucide-react';
import {
  formatDateSlash,
  compressImageFile,
  getQrDaysRemaining,
  formatCurrency,
} from '../utils/calculations';
import { StatusPill } from './StatusPill';

interface QrStorageSectionProps {
  operations: Operation[];
  onAttachPhoto: (id: string, base64Image: string, carrier?: Carrier) => void;
  onRemovePhoto: (id: string) => void;
  onUpdateCarrier: (id: string, carrier: Carrier) => void;
  onStatusChange: (id: string, status: Status) => void;
  onOpenQrModal: (op: Operation) => void;
}

const CARRIERS: Carrier[] = ['Correos', 'InPost', 'Seur', 'Otro'];

export const QrStorageSection: React.FC<QrStorageSectionProps> = ({
  operations,
  onAttachPhoto,
  onRemovePhoto,
  onUpdateCarrier,
  onStatusChange,
  onOpenQrModal,
}) => {
  const [filterTab, setFilterTab] = useState<'activos' | 'con_qr' | 'todas'>('activos');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadOp, setActiveUploadOp] = useState<Operation | null>(null);

  // Only sales generate a space in QR Storage
  const salesOperations = operations.filter((op) => op.tipo === 'venta');

  const filteredSales = salesOperations.filter((op) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        op.producto.toLowerCase().includes(q) ||
        op.lugarVenta.toLowerCase().includes(q) ||
        (op.vendedor || '').toLowerCase().includes(q) ||
        (op.comentarios || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterTab === 'con_qr') {
      return Boolean(op.qrImage);
    }

    if (filterTab === 'activos') {
      // Show sales that have a QR uploaded, or are in production / pending / shipped, or recent
      return (
        Boolean(op.qrImage) ||
        op.estado === 'En producción' ||
        op.estado === 'Pendiente de cobro' ||
        op.estado === 'Enviado'
      );
    }

    return true;
  });

  const handleTriggerUpload = (op: Operation) => {
    setActiveUploadOp(op);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadOp) return;
    setUploadingId(activeUploadOp.id);
    try {
      const compressed = await compressImageFile(file);
      onAttachPhoto(
        activeUploadOp.id,
        compressed,
        activeUploadOp.transportista || 'InPost'
      );
    } catch (err) {
      console.error('Error uploading QR:', err);
    } finally {
      setUploadingId(null);
      setActiveUploadOp(null);
      e.target.value = '';
    }
  };

  const withQrCount = salesOperations.filter((o) => Boolean(o.qrImage)).length;

  return (
    <section className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <QrCode className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Almacenamiento de QR y Códigos de Envío
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Cada venta genera automáticamente su espacio con lugar de venta y fecha límite. Los QR subidos se borran automáticamente a los 10 días.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-2 rounded-2xl bg-zinc-900 border border-white/8 text-xs">
            <span className="text-zinc-400">QR activos: </span>
            <span className="font-bold text-sky-400">{withQrCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-2xl border border-white/8">
          <button
            type="button"
            onClick={() => setFilterTab('activos')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterTab === 'activos'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Envíos activos
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('con_qr')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterTab === 'con_qr'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Con QR ({withQrCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('todas')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterTab === 'todas'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todas las ventas ({salesOperations.length})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar venta o plataforma..."
            className="w-full h-10 pl-9 pr-4 rounded-2xl bg-zinc-900/90 border border-white/8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Grid of Sale QR Slots */}
      {filteredSales.length === 0 ? (
        <div className="p-10 rounded-3xl bg-zinc-950/60 border border-white/8 text-center space-y-2">
          <QrCode className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-zinc-300">
            No hay ventas en esta vista
          </p>
          <p className="text-xs text-zinc-500">
            Cambia a &ldquo;Todas las ventas&rdquo; o crea una nueva venta para subir su código QR o código de barras.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSales.map((op) => {
            const carrier: Carrier = op.transportista || 'InPost';
            const daysRemaining = getQrDaysRemaining(op.qrUploadedAt);

            return (
              <div
                key={op.id}
                className={`rounded-3xl p-4 border transition-all flex flex-col justify-between gap-3.5 ${
                  op.qrImage
                    ? 'bg-zinc-900/75 border-sky-500/30 shadow-lg shadow-sky-950/10'
                    : 'bg-zinc-950/85 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Top Info */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {op.producto}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Venta: {formatDateSlash(op.fecha)} · {op.unidades || 1} ud. ·{' '}
                        <span className="text-emerald-400 font-semibold">
                          {formatCurrency(op.precio)}
                        </span>
                      </p>
                    </div>
                    <StatusPill
                      status={op.estado}
                      onStatusChange={(newSt) => onStatusChange(op.id, newSt)}
                      size="sm"
                    />
                  </div>

                  {/* Lugar de venta + Fecha límite */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="px-3 py-2 rounded-2xl bg-black/50 border border-white/6">
                      <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                        Lugar de venta
                      </span>
                      <span className="text-xs font-bold text-zinc-200">
                        {op.lugarVenta}
                      </span>
                    </div>

                    <div className="px-3 py-2 rounded-2xl bg-black/50 border border-white/6">
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                        <CalendarClock className="w-3 h-3 text-amber-400" />
                        Fecha límite
                      </span>
                      <span className="text-xs font-bold text-amber-300">
                        {op.fechaLimite ? formatDateSlash(op.fechaLimite) : 'Inmediato'}
                      </span>
                    </div>
                  </div>

                  {/* Lugar de envío dropdown */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-zinc-900/80 border border-white/8">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                      <Truck className="w-3.5 h-3.5 text-sky-400" />
                      Lugar de envío:
                    </span>
                    <select
                      value={carrier}
                      onChange={(e) =>
                        onUpdateCarrier(op.id, e.target.value as Carrier)
                      }
                      className="bg-zinc-800 text-white text-xs font-semibold px-2.5 py-1 rounded-xl border border-white/10 focus:outline-none focus:border-sky-400"
                    >
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* QR Preview or Upload Area */}
                <div>
                  {op.qrImage ? (
                    <div className="space-y-2">
                      <div
                        onClick={() => onOpenQrModal(op)}
                        className="relative group cursor-pointer rounded-2xl bg-white p-2.5 flex items-center justify-center h-36 overflow-hidden border border-white/20"
                      >
                        <img
                          src={op.qrImage}
                          alt={`QR ${op.producto}`}
                          className="max-h-full max-w-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                          <Maximize2 className="w-4 h-4" />
                          Ampliar para escanear
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] px-1">
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {carrier} listo
                        </span>
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400" />
                          Se borra en {daysRemaining}d
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenQrModal(op)}
                          className="flex-1 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          Escanear QR
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerUpload(op)}
                          className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
                          title="Cambiar imagen"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemovePhoto(op.id)}
                          className="py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-medium transition-all"
                          title="Eliminar QR"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTriggerUpload(op)}
                      disabled={uploadingId === op.id}
                      className="w-full py-5 px-3 rounded-2xl border border-dashed border-white/15 hover:border-sky-500/40 bg-zinc-900/40 hover:bg-zinc-900/80 transition-all flex flex-col items-center justify-center gap-1.5 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-sky-400" />
                      <span className="text-xs font-semibold">
                        {uploadingId === op.id
                          ? 'Subiendo QR...'
                          : 'Subir QR / Código de barras'}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {carrier} · Se borra automáticamente a los 10 días
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
