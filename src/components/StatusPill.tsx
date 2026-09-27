import React, { useState, useRef, useEffect } from 'react';
import { Status } from '../types/operation';

interface StatusPillProps {
  status: Status;
  onStatusChange?: (newStatus: Status) => void;
}

const ALL_STATUSES: Status[] = [
  'Cobrado✅',
  'Pendiente de cobro',
  'Enviado📦',
  'En producción',
  'Pagado⭕',
  'Cancelado',
  'Otro',
];

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  onStatusChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  let styleClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50';

  switch (status) {
    case 'Cobrado✅':
      styleClasses = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30';
      break;
    case 'Pagado⭕':
      styleClasses = 'bg-zinc-800/90 text-zinc-300 border-zinc-600/40';
      break;
    case 'Pendiente de cobro':
      styleClasses = 'bg-amber-950/70 text-amber-300 border-amber-500/30';
      break;
    case 'Enviado📦':
      styleClasses = 'bg-indigo-950/70 text-indigo-300 border-indigo-500/30';
      break;
    case 'En producción':
      styleClasses = 'bg-sky-950/70 text-sky-300 border-sky-500/30';
      break;
    case 'Cancelado':
      styleClasses = 'bg-rose-950/70 text-rose-300 border-rose-500/30';
      break;
    default:
      styleClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50';
      break;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onStatusChange) {
            setOpen(!open);
          }
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-sm transition-all whitespace-nowrap ${styleClasses} ${
          onStatusChange ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''
        }`}
        title={onStatusChange ? 'Toca para cambiar el estado' : status}
      >
        <span>{status}</span>
      </button>

      {open && onStatusChange && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-1.5 w-44 z-50 glass-modal rounded-2xl p-1 shadow-2xl border border-white/15 text-left"
        >
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onStatusChange(s);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] transition-colors cursor-pointer ${
                s === status
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <span>{s}</span>
              {s === status && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
