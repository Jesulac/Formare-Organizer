import React from 'react';
import { Operation, Status } from '../types/operation';
import { formatEuro, formatDateDisplay } from '../utils/calculations';
import { StatusPill } from './StatusPill';
import { Edit3, Copy, Trash2, ChevronRight, User } from 'lucide-react';

interface OperationsListProps {
  operations: Operation[];
  onSelectOperation: (op: Operation) => void;
  onDuplicateOperation: (id: string) => void;
  onDeleteOperation: (id: string) => void;
  onStatusChange?: (id: string, newStatus: Status) => void;
}

export const OperationsList: React.FC<OperationsListProps> = ({
  operations,
  onSelectOperation,
  onDuplicateOperation,
  onDeleteOperation,
}) => {
  return (
    <div className="w-full">
      {/* 1. MOBILE VIEW (iPhone Card Layout) */}
      <div className="block lg:hidden space-y-2.5">
        {operations.map((op) => {
          const isVenta = op.tipo === 'venta';
          const isCierre = op.tipo === 'cierre';
          
          return (
            <div
              key={op.id}
              onClick={() => onSelectOperation(op)}
              className="glass-card glass-card-hover rounded-2xl p-3.5 relative cursor-pointer active:scale-[0.99] transition-all flex flex-col gap-2 border border-white/10"
            >
              {/* Card Top Row: Product Title & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                    <span className="truncate">{op.producto}</span>
                    {isCierre && (
                      <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded-md font-normal shrink-0">
                        Cierre
                      </span>
                    )}
                  </h4>
                  
                  {/* Subtitle: Platform · Date · Seller */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
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

                {/* Status Pill */}
                <StatusPill status={op.estado} />
              </div>

              {/* Material or Comments if present */}
              {(op.material || op.comentarios) && (
                <p className="text-[11px] text-zinc-400 line-clamp-1 italic">
                  {op.material && <span>{op.material}</span>}
                  {op.material && op.comentarios && <span> — </span>}
                  {op.comentarios && <span>{op.comentarios}</span>}
                </p>
              )}

              {/* Card Bottom Row: Financial Values */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                {/* Revenue / Price */}
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                    {op.tipo === 'compra' || op.tipo === 'inversion' ? 'Coste' : 'Precio'}
                  </span>
                  <span className="font-mono font-semibold text-zinc-200">
                    {op.precio !== null ? formatEuro(op.precio) : formatEuro(-op.costes)}
                  </span>
                </div>

                {/* Costs */}
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                    Costes
                  </span>
                  <span className="font-mono text-zinc-400">
                    {formatEuro(op.costes)}
                  </span>
                </div>

                {/* Profit */}
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
                    {formatEuro(op.beneficio)}
                  </span>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-600 self-center ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. DESKTOP VIEW (Elegantly Styled OLED Table) */}
      <div className="hidden lg:block overflow-x-auto glass-card rounded-2xl border border-white/10 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">
              <th className="py-3.5 px-4">Fecha</th>
              <th className="py-3.5 px-4">Producto</th>
              <th className="py-3.5 px-4">Material</th>
              <th className="py-3.5 px-4 text-right">Precio</th>
              <th className="py-3.5 px-4 text-right">Costes</th>
              <th className="py-3.5 px-4 text-right">C. Oper.</th>
              <th className="py-3.5 px-4 text-right">Beneficio</th>
              <th className="py-3.5 px-4">Canal</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4">Vendedor / Notas</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {operations.map((op) => {
              const isCierre = op.tipo === 'cierre';

              return (
                <tr
                  key={op.id}
                  className={`hover:bg-white/[0.03] transition-colors group ${
                    isCierre ? 'bg-purple-950/20' : ''
                  }`}
                >
                  {/* Fecha */}
                  <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                    {formatDateDisplay(op.fecha)}
                  </td>

                  {/* Producto */}
                  <td className="py-3 px-4 font-semibold text-white whitespace-nowrap max-w-xs truncate">
                    {op.producto}
                    {isCierre && (
                      <span className="ml-2 text-[10px] bg-purple-950 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-normal">
                        Cierre
                      </span>
                    )}
                  </td>

                  {/* Material */}
                  <td className="py-3 px-4 text-zinc-400 whitespace-nowrap max-w-xs truncate">
                    {op.material || '—'}
                  </td>

                  {/* Precio / Ingreso */}
                  <td className="py-3 px-4 text-right font-mono font-medium text-zinc-100 whitespace-nowrap">
                    {op.precio !== null ? formatEuro(op.precio) : '—'}
                  </td>

                  {/* Costes */}
                  <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                    {formatEuro(op.costes)}
                  </td>

                  {/* Costes Operativos */}
                  <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                    {op.costesOperativos > 0 ? formatEuro(op.costesOperativos) : '—'}
                  </td>

                  {/* Beneficio */}
                  <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                    <span
                      className={
                        op.beneficio > 0
                          ? 'text-emerald-400'
                          : op.beneficio < 0
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }
                    >
                      {formatEuro(op.beneficio)}
                    </span>
                  </td>

                  {/* Lugar Venta */}
                  <td className="py-3 px-4 text-zinc-300 font-medium whitespace-nowrap">
                    {op.lugarVenta}
                  </td>

                  {/* Estado */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusPill status={op.estado} />
                  </td>

                  {/* Vendedor & Comentarios */}
                  <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">
                    {op.vendedor && (
                      <span className="text-purple-300 font-medium mr-1.5">
                        [{op.vendedor}]
                      </span>
                    )}
                    <span>{op.comentarios || '—'}</span>
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onSelectOperation(op)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Editar operación"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDuplicateOperation(op.id)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Duplicar operación"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${op.producto}"?`)) {
                            onDeleteOperation(op.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        title="Eliminar operación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
