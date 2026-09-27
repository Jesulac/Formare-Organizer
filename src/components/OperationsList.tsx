import React, { useState, useRef } from 'react';
import { Operation, Status, MonthlySummary, ShippingCompany } from '../types/operation';
import {
  formatEuro,
  formatDateDisplay,
  parseDate,
  compressImageFile,
  calculateSandraCommission,
} from '../utils/calculations';
import { StatusPill } from './StatusPill';
import { OledSelect } from './OledSelect';
import {
  Edit3,
  Copy,
  Trash2,
  User,
  Check,
  X,
  QrCode,
  Image as ImageIcon,
  Upload,
  Clock,
  Layers,
  CalendarClock,
  BarChart3,
  Minus,
  Plus,
  FileText,
} from 'lucide-react';
import { ViewMode } from './Header';

interface OperationsListProps {
  operations: Operation[];
  monthlySummaries: Record<string, MonthlySummary>;
  onSelectOperation: (op: Operation) => void;
  onDuplicateOperation: (id: string) => void;
  onDeleteOperation: (id: string) => void;
  onStatusChange: (id: string, newStatus: Status) => void;
  onUnitsChange?: (id: string, newUnits: number) => void;
  onAttachQr: (id: string, fotoQr: string | undefined, empresaEnvio?: ShippingCompany) => void;
  onExportMonthPDF?: (monthKey: string) => void;
  viewMode: ViewMode;
  lastModifiedId?: string | null;
}

const SHIPPING_COMPANIES: ShippingCompany[] = ['Correos', 'InPost', 'Seur', 'Vinted Go', 'Otro'];

function getMonthKey(fechaStr: string): string {
  const d = parseDate(fechaStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatCompactDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatGramsMaxTwoDecimals(grams: number | undefined | null): string {
  const val = Number((grams || 0).toFixed(2));
  return val.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export const OperationsList: React.FC<OperationsListProps> = ({
  operations,
  monthlySummaries,
  onSelectOperation,
  onDuplicateOperation,
  onDeleteOperation,
  onStatusChange,
  onUnitsChange,
  onAttachQr,
  onExportMonthPDF,
  viewMode,
  lastModifiedId,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewQrOpId, setPreviewQrOpId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingForOpId, setUploadingForOpId] = useState<string | null>(null);

  const previewQrOp = operations.find((o) => o.id === previewQrOpId) || null;

  // Map each monthKey to its last index in the current operations list so month summaries never duplicate
  const lastIndexByMonth = new Map<string, number>();
  operations.forEach((op, idx) => {
    lastIndexByMonth.set(getMonthKey(op.fecha), idx);
  });

  const showMobileCards =
    viewMode === 'iphone' ? 'block' : viewMode === 'desktop' ? 'hidden' : 'block lg:hidden';
  const showDesktopTable =
    viewMode === 'desktop' ? 'block' : viewMode === 'iphone' ? 'hidden' : 'hidden lg:block';

  const handleTriggerPhotoUpload = (opId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadingForOpId(opId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingForOpId) return;
    try {
      const compressed = await compressImageFile(file, 750);
      const targetOp = operations.find((o) => o.id === uploadingForOpId);
      onAttachQr(uploadingForOpId, compressed, targetOp?.empresaEnvio || 'Correos');
    } catch (err) {
      console.error('Error al procesar la imagen', err);
    } finally {
      setUploadingForOpId(null);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full">
      {/* Hidden shared file input for quick row photo/QR attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 1. VISTA MÓVIL (Compact Cards + Monthly Summary Cards) */}
      <div className={`${showMobileCards} space-y-2.5 max-w-lg mx-auto`}>
        {operations.map((op, index) => {
          const isCompra = op.tipo === 'compra' || op.tipo === 'inversion';
          const isHighlighted = lastModifiedId === op.id;
          const currentMonthKey = getMonthKey(op.fecha);
          const isLastOfMonth = lastIndexByMonth.get(currentMonthKey) === index;
          const monthSummary = isLastOfMonth ? monthlySummaries[currentMonthKey] : null;
          const comisionSandra = calculateSandraCommission(op.precio, op.vendedor, op.tipo);

          return (
            <React.Fragment key={op.id}>
              <div
                onClick={() => onSelectOperation(op)}
                className={`glass-card glass-card-hover rounded-2xl p-3.5 relative cursor-pointer active:scale-[0.99] transition-all flex flex-col gap-2 border ${
                  isHighlighted
                    ? 'border-emerald-400/80 ring-1 ring-emerald-400/50 bg-emerald-950/20'
                    : 'border-white/10'
                }`}
              >
                {/* Card Top Row: Type badge, Units, Product Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          isCompra
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isCompra ? 'Compra' : 'Venta'}
                      </span>
                      <span className="text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                        {op.unidades || 1} {(op.unidades || 1) === 1 ? 'ud.' : 'uds.'}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white truncate">
                      {op.producto}
                    </h4>

                    {/* Subtitle: Platform · Date · Seller */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                      <span className="text-zinc-300 font-medium">{op.lugarVenta}</span>
                      <span>·</span>
                      <span>{formatDateDisplay(op.fecha)}</span>
                      {op.vendedor && (
                        <>
                          <span>·</span>
                          <span className="text-purple-300 font-medium flex items-center gap-0.5">
                            <User className="w-3 h-3" />
                            {op.vendedor}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Interactive Clean Status Pill */}
                  <StatusPill
                    status={op.estado}
                    onStatusChange={(newStatus) => onStatusChange(op.id, newStatus)}
                  />
                </div>

                {/* Material or Comments */}
                {(op.material || op.comentarios) && (
                  <p className="text-[11px] text-zinc-400 line-clamp-1">
                    {op.material && <span className="text-zinc-300">{op.material}</span>}
                    {op.material && op.comentarios && <span className="text-zinc-600"> · </span>}
                    {op.comentarios && <span className="italic">{op.comentarios}</span>}
                  </p>
                )}

                {/* Card Bottom Row: Financial Values & Units Stepper */}
                <div
                  className={`grid ${
                    comisionSandra > 0 ? 'grid-cols-5' : 'grid-cols-4'
                  } items-center gap-2 pt-2 border-t border-white/5 text-xs`}
                >
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                      Precio
                    </span>
                    <span className="font-mono font-semibold text-zinc-100">
                      {op.precio !== null ? formatEuro(op.precio) : '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                      Costes
                    </span>
                    <span className="font-mono text-zinc-400">
                      {formatEuro(op.costes)}
                    </span>
                  </div>

                  {comisionSandra > 0 && (
                    <div>
                      <span className="text-[10px] text-purple-300/90 uppercase tracking-wider block">
                        B. Sandra
                      </span>
                      <span className="font-mono font-semibold text-purple-300">
                        {formatEuro(comisionSandra)}
                      </span>
                    </div>
                  )}

                  <div onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                      Unidades
                    </span>
                    <div className="inline-flex items-center gap-1 mt-0.5">
                      {onUnitsChange && (
                        <button
                          type="button"
                          onClick={() => onUnitsChange(op.id, Math.max(1, (op.unidades || 1) - 1))}
                          className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <span className="font-mono text-zinc-100 font-bold px-0.5">
                        {op.unidades || 1}
                      </span>
                      {onUnitsChange && (
                        <button
                          type="button"
                          onClick={() => onUnitsChange(op.id, (op.unidades || 1) + 1)}
                          className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                      Beneficio
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        op.beneficio > 0
                          ? 'text-emerald-400'
                          : op.beneficio < 0
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {op.beneficio > 0 ? `+${formatEuro(op.beneficio)}` : formatEuro(op.beneficio)}
                    </span>
                  </div>
                </div>

                {/* Extra Footer: Fecha Límite & Adjuntar Foto/QR */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <CalendarClock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Fecha límite:{' '}
                      <strong className="text-amber-300 font-mono">
                        {op.tipo === 'venta' && op.fechaLimite
                          ? formatDateDisplay(op.fechaLimite)
                          : '—'}
                      </strong>
                    </span>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    {op.fotoQr ? (
                      <button
                        type="button"
                        onClick={() => setPreviewQrOpId(op.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Ver Foto / QR</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleTriggerPhotoUpload(op.id, e)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-[11px] cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Adjuntar Foto</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly Summary Card at end of each month */}
              {monthSummary && (
                <div className="rounded-2xl p-3.5 bg-emerald-950/25 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      <BarChart3 className="w-4 h-4" />
                      <span>Cierre Mensual: {monthSummary.monthLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-300">
                        {monthSummary.numVentas} ventas · {monthSummary.numPedidos} pedidos
                      </span>
                      {onExportMonthPDF && (
                        <button
                          type="button"
                          onClick={() => onExportMonthPDF(monthSummary.monthKey)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold cursor-pointer transition-colors"
                          title={`Descargar resumen de ${monthSummary.monthLabel} en PDF`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1.5 border-t border-emerald-500/20 text-[11px]">
                    <div>
                      <span className="text-zinc-400 block">Bruto generado</span>
                      <span className="font-mono font-semibold text-white">
                        {formatEuro(monthSummary.dineroBruto)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Gastos producción</span>
                      <span className="font-mono font-semibold text-sky-300">
                        {formatEuro(monthSummary.costesVentas)}
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-300/90 block">B. Sandra</span>
                      <span className="font-mono font-semibold text-purple-300">
                        {formatEuro(monthSummary.beneficioSandra || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Gastos en general</span>
                      <span className="font-mono font-semibold text-rose-300">
                        {formatEuro(monthSummary.dineroGastadoCompras)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Neto generado</span>
                      <span
                        className={`font-mono font-bold ${
                          monthSummary.dineroNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatEuro(monthSummary.dineroNeto)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Filamento consumido</span>
                      <span className="font-mono font-semibold text-sky-300">
                        {formatGramsMaxTwoDecimals(monthSummary.gramosConsumidos)} g
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 2. VISTA TABLA COMPLETA EN PANTALLA (Aprovechando el 100% del ancho disponible sin apretar columnas) */}
      <div
        className={`${showDesktopTable} w-full max-w-none glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden`}
      >
        <div className="w-full max-w-none overflow-x-auto">
          <table className="w-full table-auto text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-950/95 text-zinc-300 text-[11px] font-bold tracking-tight">
                <th className="py-3 px-2.5 whitespace-nowrap">Fecha</th>
                <th className="py-3 px-2 whitespace-nowrap">Tipo</th>
                <th className="py-3 px-2.5 min-w-[150px]">Producto</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">Unidades</th>
                <th className="py-3 px-2.5 min-w-[140px]">Material</th>
                <th className="py-3 px-2 text-right whitespace-nowrap">Precio</th>
                <th
                  className="py-3 px-2 text-right whitespace-nowrap text-purple-300"
                  title="Beneficio Sandra (Precio × 0,15) cuando el vendedor incluye a Sandra"
                >
                  B. Sandra
                </th>
                <th className="py-3 px-2 text-right whitespace-nowrap">Costes</th>
                <th className="py-3 px-2 text-right whitespace-nowrap">Beneficio</th>
                <th className="py-3 px-2 whitespace-nowrap">Lugar</th>
                <th className="py-3 px-2 whitespace-nowrap">Estado</th>
                <th className="py-3 px-2 whitespace-nowrap">Vendedor</th>
                <th className="py-3 px-2.5 min-w-[120px]">Comentarios</th>
                <th className="py-3 px-2 whitespace-nowrap">Fecha límite</th>
                <th className="py-3 px-1.5 text-center whitespace-nowrap">QR</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {operations.map((op, index) => {
                const isCompra = op.tipo === 'compra' || op.tipo === 'inversion';
                const isConfirmingDelete = confirmDeleteId === op.id;
                const isHighlighted = lastModifiedId === op.id;
                const comisionSandra = calculateSandraCommission(op.precio, op.vendedor, op.tipo);

                const currentMonthKey = getMonthKey(op.fecha);
                const isLastOfMonth = lastIndexByMonth.get(currentMonthKey) === index;
                const monthSummary = isLastOfMonth ? monthlySummaries[currentMonthKey] : null;

                return (
                  <React.Fragment key={op.id}>
                    <tr
                      onClick={() => onSelectOperation(op)}
                      className={`transition-colors group cursor-pointer ${
                        isHighlighted
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/20'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* 1. Fecha */}
                      <td className="py-2.5 px-2.5 font-mono tabular-nums text-xs text-zinc-300 whitespace-nowrap align-middle">
                        {formatDateDisplay(op.fecha)}
                      </td>

                      {/* 2. Venta / Compra */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        <span
                          className={`inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-md border ${
                            isCompra
                              ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isCompra ? 'Compra' : 'Venta'}
                        </span>
                      </td>

                      {/* 3. Producto */}
                      <td
                        className="py-2.5 px-2.5 font-semibold text-white text-xs leading-snug align-middle"
                        title={op.producto}
                      >
                        {op.producto}
                      </td>

                      {/* 4. Unidades */}
                      <td
                        className="py-2.5 px-2 text-center whitespace-nowrap align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-center gap-1 bg-zinc-900/90 border border-white/10 rounded-lg px-1.5 py-0.5">
                          {onUnitsChange && (
                            <button
                              type="button"
                              onClick={() =>
                                onUnitsChange(op.id, Math.max(1, (op.unidades || 1) - 1))
                              }
                              className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                              title="Restar 1 unidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                          <span className="font-mono tabular-nums font-bold text-emerald-300 text-xs min-w-[18px] text-center">
                            {op.unidades || 1}
                          </span>
                          {onUnitsChange && (
                            <button
                              type="button"
                              onClick={() => onUnitsChange(op.id, (op.unidades || 1) + 1)}
                              className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                              title="Sumar 1 unidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 5. Material */}
                      <td
                        className="py-2.5 px-2.5 text-zinc-300 text-xs leading-snug align-middle"
                        title={op.material || ''}
                      >
                        {op.material || '—'}
                      </td>

                      {/* 6. Precio */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-xs font-medium text-zinc-100 whitespace-nowrap align-middle">
                        {op.precio !== null ? formatEuro(op.precio) : '—'}
                      </td>

                      {/* 7. B. Sandra */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-xs whitespace-nowrap align-middle">
                        {comisionSandra > 0 ? (
                          <span className="text-purple-300 font-semibold">
                            {formatEuro(comisionSandra)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* 8. Costes */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-xs text-zinc-400 whitespace-nowrap align-middle">
                        {formatEuro(op.costes)}
                      </td>

                      {/* 9. Beneficio */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-xs font-bold whitespace-nowrap align-middle">
                        <span
                          className={
                            op.beneficio > 0
                              ? 'text-emerald-400'
                              : op.beneficio < 0
                              ? 'text-rose-400'
                              : 'text-zinc-400'
                          }
                        >
                          {op.beneficio > 0 ? `+${formatEuro(op.beneficio)}` : formatEuro(op.beneficio)}
                        </span>
                      </td>

                      {/* 10. Lugar */}
                      <td className="py-2.5 px-2 text-zinc-200 text-xs font-medium whitespace-nowrap align-middle">
                        {op.lugarVenta}
                      </td>

                      {/* 11. Estado */}
                      <td
                        className="py-2.5 px-2 whitespace-nowrap align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusPill
                          status={op.estado}
                          onStatusChange={(newStatus) => onStatusChange(op.id, newStatus)}
                        />
                      </td>

                      {/* 12. Vendedor */}
                      <td className="py-2.5 px-2 text-purple-300 text-xs font-medium whitespace-nowrap align-middle">
                        {op.vendedor || '—'}
                      </td>

                      {/* 13. Comentarios / Notas */}
                      <td
                        className="py-2.5 px-2.5 text-zinc-400 text-xs leading-snug align-middle"
                        title={op.comentarios || ''}
                      >
                        {op.comentarios || '—'}
                      </td>

                      {/* 14. Fecha límite */}
                      <td className="py-2.5 px-2 font-mono tabular-nums whitespace-nowrap align-middle">
                        {op.tipo === 'venta' && op.fechaLimite ? (
                          <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-semibold">
                            <Clock className="w-3 h-3 shrink-0 text-amber-400" />
                            <span>{formatDateDisplay(op.fechaLimite)}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* 15. Foto / QR */}
                      <td
                        className="py-2.5 px-1.5 text-center whitespace-nowrap align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {op.fotoQr ? (
                          <button
                            type="button"
                            onClick={() => setPreviewQrOpId(op.id)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
                            title="Ver foto / código QR adjunto"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleTriggerPhotoUpload(op.id, e)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 cursor-pointer transition-colors"
                            title="Adjuntar foto o código QR"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                        )}
                      </td>

                      {/* 16. Acciones */}
                      <td
                        className="py-2.5 px-2 text-center whitespace-nowrap align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1 bg-rose-950/90 border border-rose-500/40 rounded-lg px-1.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteOperation(op.id);
                                setConfirmDeleteId(null);
                              }}
                              className="p-0.5 text-rose-300 hover:text-white cursor-pointer"
                              title="Confirmar eliminación"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-0.5 text-zinc-400 hover:text-white cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onDuplicateOperation(op.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              title="Duplicar operación"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(op.id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Eliminar operación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Fila de Cierre Mensual automático al final de cada mes */}
                    {monthSummary && (
                      <tr className="bg-emerald-950/30 border-y border-emerald-500/30 text-xs">
                        <td colSpan={16} className="py-3 px-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            {/* Left: Month Title & Counts */}
                            <div className="flex items-center gap-2.5">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-300 uppercase tracking-wider">
                                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Cierre Mensual: {monthSummary.monthLabel}</span>
                              </div>
                              <span className="text-zinc-400 font-mono text-[11px]">
                                ({monthSummary.numVentas} ventas · {monthSummary.numPedidos} pedidos)
                              </span>
                            </div>

                            {/* Center/Right: All Monthly Closing Metrics including B. Sandra and 2-decimal Filament */}
                            <div className="flex flex-wrap items-center gap-5 sm:gap-6 font-mono tabular-nums">
                              <div>
                                <span className="text-[10px] font-sans text-zinc-400 block uppercase">
                                  Bruto Mes
                                </span>
                                <span className="font-bold text-white">
                                  {formatEuro(monthSummary.dineroBruto)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-sans text-zinc-400 block uppercase">
                                  Gastos Producción
                                </span>
                                <span className="font-semibold text-sky-300">
                                  {formatEuro(monthSummary.costesVentas)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-sans text-purple-300/90 block uppercase">
                                  B. Sandra
                                </span>
                                <span className="font-bold text-purple-300">
                                  {formatEuro(monthSummary.beneficioSandra || 0)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-sans text-zinc-400 block uppercase">
                                  Gastos en General
                                </span>
                                <span className="font-semibold text-rose-300">
                                  {formatEuro(monthSummary.dineroGastadoCompras)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-sans text-zinc-400 block uppercase">
                                  Beneficio Neto
                                </span>
                                <span
                                  className={`font-extrabold ${
                                    monthSummary.dineroNeto >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {formatEuro(monthSummary.dineroNeto)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-sans text-zinc-400 block uppercase">
                                  Filamento Consumido
                                </span>
                                <span className="font-bold text-sky-300">
                                  {formatGramsMaxTwoDecimals(monthSummary.gramosConsumidos)} g
                                </span>
                              </div>

                              {onExportMonthPDF && (
                                <button
                                  type="button"
                                  onClick={() => onExportMonthPDF(monthSummary.monthKey)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-sans font-semibold cursor-pointer transition-colors"
                                  title={`Descargar resumen de ${monthSummary.monthLabel} en PDF`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Descargar PDF</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lightbox para ver / gestionar la Foto o Código QR enlazado al pedido */}
      {previewQrOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setPreviewQrOpId(null)}
          />
          <div className="relative z-10 w-full max-w-md glass-modal rounded-3xl p-5 border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{previewQrOp.producto}</h3>
                <p className="text-[11px] text-zinc-400">
                  {previewQrOp.lugarVenta} · Fecha límite:{' '}
                  {previewQrOp.fechaLimite
                    ? formatDateDisplay(previewQrOp.fechaLimite)
                    : 'Sin fecha límite'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQrOpId(null)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewQrOp.fotoQr && (
              <div className="bg-white rounded-2xl p-3 flex items-center justify-center">
                <img
                  src={previewQrOp.fotoQr}
                  alt={`QR / Foto de ${previewQrOp.producto}`}
                  className="max-h-80 w-auto object-contain rounded-lg"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex-1">
                <label className="block text-zinc-400 text-[11px] mb-1">Empresa de envío</label>
                <OledSelect
                  value={previewQrOp.empresaEnvio || 'Correos'}
                  onChange={(val) => {
                    onAttachQr(previewQrOp.id, previewQrOp.fotoQr, val as ShippingCompany);
                  }}
                  options={SHIPPING_COMPANIES.map((c) => ({ value: c, label: c }))}
                />
              </div>

              <div className="flex items-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={(e) => handleTriggerPhotoUpload(previewQrOp.id, e)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium cursor-pointer"
                >
                  Cambiar foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAttachQr(previewQrOp.id, undefined, undefined);
                    setPreviewQrOpId(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium cursor-pointer"
                >
                  Borrar foto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
