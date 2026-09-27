import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Status } from '../types/operation';
import { normalizeStatus } from '../utils/calculations';
import { ChevronDown } from 'lucide-react';

interface StatusPillProps {
  status: Status | string;
  onStatusChange?: (newStatus: Status) => void;
}

const ALL_STATUSES: Status[] = [
  'Cobrado',
  'Pagado',
  'Pendiente de pago',
  'En producción',
  'Pendiente de cobro',
  'Enviado',
  'Cancelado',
  'Otro',
];

export const StatusPill: React.FC<StatusPillProps> = ({
  status: rawStatus,
  onStatusChange,
}) => {
  const status = normalizeStatus(rawStatus);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = 265;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < menuHeight && rect.top > menuHeight
          ? rect.top - menuHeight - 6
          : rect.bottom + 6;
      setMenuPos({ top, left });
    };

    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  const getStatusColors = (s: Status) => {
    switch (s) {
      case 'Cobrado':
        return {
          pill: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      case 'Pagado':
        return {
          pill: 'bg-red-950/85 text-red-300 border-red-500/45 shadow-sm shadow-red-950/40',
          dot: 'bg-red-500',
        };
      case 'Pendiente de cobro':
      case 'Pendiente de pago':
        return {
          pill: 'bg-amber-950/70 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'Enviado':
        return {
          pill: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/30',
          dot: 'bg-indigo-400',
        };
      case 'En producción':
        return {
          pill: 'bg-sky-950/70 text-sky-300 border-sky-500/30',
          dot: 'bg-sky-400',
        };
      case 'Cancelado':
        return {
          pill: 'bg-rose-950/70 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      default:
        return {
          pill: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50',
          dot: 'bg-zinc-400',
        };
    }
  };

  const { pill: styleClasses, dot: dotColor } = getStatusColors(status);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onStatusChange) {
            setOpen(!open);
          }
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-sm transition-all whitespace-nowrap ${styleClasses} ${
          onStatusChange ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''
        }`}
        title={onStatusChange ? `Estado: ${status} (clic para cambiar)` : status}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span>{status}</span>
        {onStatusChange && <ChevronDown className="w-3 h-3 opacity-60 shrink-0 -mr-0.5" />}
      </button>

      {open &&
        onStatusChange &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
            className="fixed w-44 z-[9999] bg-[#09090b]/98 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl border border-white/15 text-left"
          >
            {ALL_STATUSES.map((s) => {
              const itemColors = getStatusColors(s);
              const isSelected = s === status;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStatusChange(s);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] transition-colors cursor-pointer ${
                    isSelected
                      ? s === 'Pagado'
                        ? 'bg-red-500/20 text-red-300 font-semibold'
                        : 'bg-emerald-500/20 text-emerald-300 font-semibold'
                      : s === 'Pagado'
                      ? 'text-red-300 hover:bg-red-500/15'
                      : 'text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${itemColors.dot}`} />
                    <span>{s}</span>
                  </span>
                  {isSelected && (
                    <span className={`w-1.5 h-1.5 rounded-full ${itemColors.dot}`} />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
