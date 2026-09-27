import React, { useRef, useState } from 'react';
import { Operation, Carrier } from '../types/operation';
import {
  X,
  QrCode,
  Upload,
  Trash2,
  Truck,
  CalendarClock,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  compressImageFile,
  formatDateSlash,
  getQrDaysRemaining,
} from '../utils/calculations';

interface QrPhotoModalProps {
  isOpen: boolean;
  operation: Operation | null;
  onClose: () => void;
  onAttachPhoto: (id: string, base64Image: string, carrier?: Carrier) => void;
  onRemovePhoto: (id: string) => void;
  onUpdateCarrier: (id: string, carrier: Carrier) => void;
}

const CARRIERS: Carrier[] = ['Correos', 'InPost', 'Seur', 'Otro'];

export const QrPhotoModal: React.FC<QrPhotoModalProps> = ({
  isOpen,
  operation,
  onClose,
  onAttachPhoto,
  onRemovePhoto,
  onUpdateCarrier,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen || !operation) return null;

  const selectedCarrier: Carrier = operation.transportista || 'InPost';
  const daysRemaining = getQrDaysRemaining(operation.qrUploadedAt);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file);
      onAttachPhoto(operation.id, compressed, selectedCarrier);
    } catch (err) {
      console.error('Error compressing image:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      <div className="relative z-10 w-full sm:max-w-md bg-zinc-950/95 border-t sm:border border-white/12 rounded-t-[32px] sm:rounded-[28px] p-5 pb-8 sm:p-6 shadow-2xl animate-sheet-up max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-zinc-800 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                {operation.producto}
              </h2>
              <p className="text-xs text-zinc-400">
                {operation.lugarVenta} · {operation.unidades || 1}{' '}
                {(operation.unidades || 1) === 1 ? 'unidad' : 'unidades'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info bar: Fecha límite & Auto-cleanup notice */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-white/8">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-0.5">
              <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
              <span>Fecha límite envío</span>
            </div>
            <p className="text-sm font-bold text-white">
              {operation.fechaLimite
                ? formatDateSlash(operation.fechaLimite)
                : 'Sin fecha límite'}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-white/8">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Caducidad QR (10d)</span>
            </div>
            <p className="text-sm font-bold text-white">
              {operation.qrImage
                ? `Quedan ${daysRemaining} días`
                : 'Se borra a los 10 días'}
            </p>
          </div>
        </div>

        {/* Carrier selector */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            <Truck className="w-3.5 h-3.5 text-zinc-400" />
            Lugar de envío (Transportista)
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {CARRIERS.map((carrier) => {
              const isSelected = selectedCarrier === carrier;
              return (
                <button
                  key={carrier}
                  type="button"
                  onClick={() => onUpdateCarrier(operation.id, carrier)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                      : 'bg-zinc-900/80 border-white/8 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {carrier}
                </button>
              );
            })}
          </div>
        </div>

        {/* QR / Barcode Image Display or Upload */}
        <div className="mb-4">
          {operation.qrImage ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-3 border border-white/20 shadow-inner flex flex-col items-center justify-center">
                <img
                  src={operation.qrImage}
                  alt={`QR / Código de barras de ${operation.producto}`}
                  className="max-h-72 w-auto object-contain rounded-lg"
                />
                <span className="mt-2 text-[11px] font-medium text-zinc-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Listo para escanear en {selectedCarrier}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-11 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Upload className="w-4 h-4" />
                  Cambiar imagen
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePhoto(operation.id)}
                  className="h-11 px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
                >
                  <Trash2 className="w-4 h-4" />
                  Borrar QR
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-10 px-4 rounded-2xl border-2 border-dashed border-white/15 hover:border-sky-500/40 bg-zinc-900/40 hover:bg-zinc-900/80 transition-all flex flex-col items-center justify-center gap-2.5 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">
                  {isUploading ? 'Procesando imagen...' : 'Subir foto de QR o código de barras'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Toca para elegir foto de tu galería o cámara para {selectedCarrier}
                </p>
              </div>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <p className="text-[11px] text-zinc-500 text-center">
          Los códigos QR e imágenes subidas se eliminan automáticamente a los 10 días para mantener ligera la aplicación.
        </p>
      </div>
    </div>
  );
};
