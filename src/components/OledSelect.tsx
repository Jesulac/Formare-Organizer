import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface OledSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface OledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: OledSelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuWidth?: number;
  iconOnly?: boolean;
  title?: string;
  ariaLabel?: string;
}

export const OledSelect: React.FC<OledSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  buttonClassName = '',
  menuWidth,
  iconOnly = false,
  title,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 220,
    maxHeight: 280,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const computedWidth = menuWidth || Math.max(rect.width, 210);
      const safeWidth = Math.min(computedWidth, window.innerWidth - 16);

      let left = iconOnly ? rect.right - safeWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - safeWidth - 8));

      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const estimatedHeight = Math.min(options.length * 38 + 16, 300);

      let top = rect.bottom + 6;
      let maxHeight = Math.max(160, Math.min(300, spaceBelow));

      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        maxHeight = Math.max(160, Math.min(300, spaceAbove));
        top = Math.max(8, rect.top - Math.min(estimatedHeight, maxHeight) - 6);
      }

      setMenuPos({ top, left, width: safeWidth, maxHeight });
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (
        dropdownRef.current &&
        e.target instanceof Node &&
        dropdownRef.current.contains(e.target)
      ) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, options.length, menuWidth, iconOnly]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        title={title}
        aria-label={ariaLabel || title || placeholder}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={
          iconOnly
            ? buttonClassName ||
              'w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer'
            : `w-full flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${
                buttonClassName ||
                'bg-zinc-900/95 hover:bg-zinc-900 border border-white/12 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60'
              }`
        }
      >
        {iconOnly ? (
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              open ? 'rotate-180 text-emerald-400' : ''
            }`}
          />
        ) : (
          <>
            <span
              className={`truncate ${
                selectedOption ? 'text-zinc-100 font-medium' : 'text-zinc-400'
              }`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150 ${
                open ? 'rotate-180 text-emerald-400' : ''
              }`}
            />
          </>
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              maxHeight: `${menuPos.maxHeight}px`,
            }}
            className="fixed z-[9999] bg-[#09090b]/98 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl border border-white/15 overflow-y-auto custom-table-scroll text-left"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value && opt.value !== '';
              return (
                <button
                  key={`${opt.value}-${opt.label}`}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                      : 'text-zinc-200 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
