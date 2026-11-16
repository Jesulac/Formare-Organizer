import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Layers, ChevronDown } from 'lucide-react';
import {
  APP_THEMES,
  APP_VISUAL_STYLES,
  ThemeId,
  VisualStyleId,
} from '../utils/themes';

interface ThemeSelectorProps {
  currentTheme: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  variant?: 'dots' | 'compact';
  size?: 'sm' | 'md';
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  variant = 'dots',
  size = 'sm',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const activeThemeObj =
    APP_THEMES.find((t) => t.id === currentTheme) || APP_THEMES[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (variant === 'compact') {
    return (
      <div ref={popoverRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 h-10 sm:h-auto sm:py-2 rounded-xl liquid-btn-glass cursor-pointer"
          title={`Color: ${activeThemeObj.name}`}
          aria-label="Cambiar color del tema"
        >
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/60 shadow-sm transition-transform duration-300"
            style={{
              background: activeThemeObj.swatch,
              boxShadow: `0 0 10px ${activeThemeObj.swatchRing}`,
            }}
          />
          <Palette className="w-3.5 h-3.5 text-zinc-300" />
        </button>

        {isOpen && (
          <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[min(15.5rem,calc(100vw-1rem))] max-h-[72dvh] overflow-y-auto custom-table-scroll rounded-2xl liquid-popover p-2.5 z-50 space-y-1.5">
            <div className="px-2 py-1 flex items-center justify-between border-b border-white/[0.08]">
              <span className="text-[11px] font-bold text-zinc-200 tracking-wide">
                Colores
              </span>
              <span className="text-[10px] text-zinc-400">
                {APP_THEMES.length} paletas
              </span>
            </div>

            <div className="space-y-1">
              {APP_THEMES.map((theme) => {
                const isSelected = theme.id === currentTheme;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onSelectTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2.5 sm:py-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-white/12 border border-white/25'
                        : 'hover:bg-white/[0.07] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border border-white/60 transition-transform duration-300"
                        style={{
                          background: theme.swatch,
                          boxShadow: isSelected
                            ? `0 0 12px ${theme.swatchRing}`
                            : 'none',
                          transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                        }}
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-white truncate">
                          {theme.name}
                        </span>
                        <span className="block text-[10px] text-zinc-400 truncate">
                          {theme.description}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: theme.accent }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const dotSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div
      className={`${className.includes('hidden') ? '' : 'inline-flex '}items-center gap-1.5 px-2.5 py-1.5 rounded-full glass-pill ${className}`}
      role="group"
      aria-label="Selector de color del tema"
    >
      {APP_THEMES.map((theme) => {
        const isSelected = theme.id === currentTheme;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelectTheme(theme.id)}
            title={`${theme.name} — ${theme.description}`}
            aria-label={`Color ${theme.name}`}
            aria-pressed={isSelected}
            className={`relative rounded-full transition-all duration-300 cursor-pointer shrink-0 ${dotSizeClass} ${
              isSelected
                ? 'scale-125 ring-2 ring-white/90 ring-offset-1 ring-offset-black'
                : 'opacity-75 hover:opacity-100 hover:scale-115'
            }`}
            style={{
              background: theme.swatch,
              boxShadow: isSelected
                ? `0 0 12px ${theme.swatchRing}, inset 0 1px 1px rgba(255,255,255,0.8)`
                : 'inset 0 1px 1px rgba(255,255,255,0.55)',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        );
      })}
    </div>
  );
};

interface StyleSelectorProps {
  currentStyle: VisualStyleId;
  onSelectStyle: (styleId: VisualStyleId) => void;
  className?: string;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  currentStyle,
  onSelectStyle,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const activeStyleObj =
    APP_VISUAL_STYLES.find((s) => s.id === currentStyle) || APP_VISUAL_STYLES[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  return (
    <div ref={popoverRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center justify-center gap-1.5 px-2.5 h-10 sm:h-auto sm:py-1.5 rounded-xl liquid-btn-glass text-xs font-medium text-zinc-100 cursor-pointer whitespace-nowrap"
        title={`Estilo visual: ${activeStyleObj.name}`}
        aria-label="Seleccionar estilo de tema"
      >
        <Layers className="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <span className="hidden lg:inline">{activeStyleObj.name}</span>
        <ChevronDown
          className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-theme-accent' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[min(16rem,calc(100vw-1rem))] max-h-[72dvh] overflow-y-auto custom-table-scroll rounded-2xl liquid-popover p-2.5 z-50 space-y-1.5">
          <div className="px-2 py-1 flex items-center justify-between border-b border-white/[0.08]">
            <span className="text-[11px] font-bold text-zinc-200 tracking-wide">
              Estilos de Tema
            </span>
            <span className="text-[10px] text-zinc-400">
              {APP_VISUAL_STYLES.length} estilos
            </span>
          </div>

          <div className="space-y-1">
            {APP_VISUAL_STYLES.map((styleItem) => {
              const isSelected = styleItem.id === currentStyle;
              return (
                <button
                  key={styleItem.id}
                  type="button"
                  onClick={() => {
                    onSelectStyle(styleItem.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-theme-accent/18 border border-theme-accent/40'
                      : 'hover:bg-white/[0.07] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-lg shrink-0 shadow-sm transition-transform duration-200"
                      style={{
                        background: styleItem.previewBg,
                        border: `1.5px solid ${styleItem.previewBorder}`,
                        transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                      }}
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-white truncate">
                        {styleItem.name}
                      </span>
                      <span className="block text-[10px] text-zinc-400 truncate">
                        {styleItem.description}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
