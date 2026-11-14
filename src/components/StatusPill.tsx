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
  'En producción',
  'Pendiente de envío',
  'Enviado',
  'Cobrado',
  'Pagado',
  'Pendiente de pago',
  'Pendiente de cobro',
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
      const menuHeight = 300;
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
          pill: 'bg-[#93c5fd]/16 text-[#bae6fd] border-[#93c5fd]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_-6px_rgba(147,197,253,0.4)]',
          dot: 'bg-[#93c5fd] animate-liquid-dot',
        };
      case 'Pagado':
        return {
          pill: 'bg-red-950/75 text-red-200 border-red-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
          dot: 'bg-red-400',
        };
      case 'Pendiente de cobro':
      case 'Pendiente de pago':
        return {
          pill: 'bg-amber-950/60 text-amber-200 border-amber-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
          dot: 'bg-amber-300',
        };
      case 'Pendiente de envío':
        return {
          pill: 'bg-purple-950/60 text-purple-200 border-purple-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
          dot: 'bg-purple-300',
        };
      case 'Enviado':
        return {
          pill: 'bg-indigo-950/60 text-indigo-200 border-indigo-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
          dot: 'bg-indigo-300',
        };
      case 'En producción':
        return {
          pill: 'bg-sky-950/60 text-sky-200 border-sky-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
          dot: 'bg-sky-300 animate-liquid-dot',
        };
      case 'Cancelado':
        return {
          pill: 'bg-rose-950/60 text-rose-200 border-rose-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
          dot: 'bg-rose-400',
        };
      default:
        return {
          pill: 'bg-white/10 text-zinc-200 border-white/15',
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all duration-200 whitespace-nowrap ${styleClasses} ${
          onStatusChange ? 'cursor-pointer hover:brightness-115 hover:scale-[1.03] active:scale-95' : ''
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
            className="fixed w-44 z-[9999] liquid-popover rounded-2xl p-1.5 text-left"
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
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? s === 'Pagado'
                        ? 'bg-red-500/20 text-red-200 font-semibold'
                        : 'bg-[#93c5fd]/20 text-[#bae6fd] font-semibold border border-[#93c5fd]/30'
                      : s === 'Pagado'
                      ? 'text-red-300 hover:bg-red-500/15'
                      : 'text-zinc-200 hover:bg-white/10 hover:text-white'
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
