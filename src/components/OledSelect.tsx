import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

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
  searchable?: boolean;
  searchPlaceholder?: string;
}

function normalizeSearchStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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
  searchable = false,
  searchPlaceholder = 'Buscar...',
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = normalizeSearchStr(searchQuery);
    return options.filter((opt) => {
      const labelMatch = normalizeSearchStr(opt.label).includes(q);
      const sublabelMatch = opt.sublabel
        ? normalizeSearchStr(opt.sublabel).includes(q)
        : false;
      const valueMatch = normalizeSearchStr(opt.value).includes(q);
      return labelMatch || sublabelMatch || valueMatch;
    });
  }, [options, searchable, searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    if (searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [open, searchable]);

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
      const searchHeaderHeight = searchable ? 52 : 0;
      const estimatedHeight = Math.min(options.length * 38 + 16 + searchHeaderHeight, 320);

      let top = rect.bottom + 6;
      let maxHeight = Math.max(180, Math.min(320, spaceBelow));

      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        maxHeight = Math.max(180, Math.min(320, spaceAbove));
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
  }, [open, options.length, menuWidth, iconOnly, searchable]);

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
              'w-7 h-7 flex items-center justify-center rounded-lg liquid-btn-glass text-zinc-300 hover:text-[#bae6fd] cursor-pointer'
            : `w-full flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${
                buttonClassName ||
                'liquid-input hover:border-[#93c5fd]/40 rounded-xl px-3 py-2 text-xs text-zinc-100'
              }`
        }
      >
        {iconOnly ? (
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              open ? 'rotate-180 text-[#93c5fd]' : ''
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
              className={`w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
                open ? 'rotate-180 text-[#93c5fd]' : ''
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
            className="fixed z-[9999] liquid-popover rounded-2xl flex flex-col overflow-hidden text-left"
          >
            {searchable && (
              <div className="p-1.5 border-b border-white/10 bg-white/[0.03] shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#93c5fd]/75 absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredOptions.length > 0) {
                        e.preventDefault();
                        onChange(filteredOptions[0].value);
                        setOpen(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setOpen(false);
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full liquid-input rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-1.5 p-0.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="p-1.5 overflow-y-auto custom-table-scroll flex-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-zinc-500">
                  No se encontraron resultados
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value && opt.value !== '';
                  return (
                    <button
                      key={`${opt.value}-${opt.label}`}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#93c5fd]/20 text-[#bae6fd] font-semibold border border-[#93c5fd]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
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
                          <span className="text-[10px] font-mono text-[#bae6fd] bg-[#93c5fd]/15 border border-[#93c5fd]/25 px-1.5 py-0.5 rounded-md">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#93c5fd] shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
