import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

export interface SlidingSegmentedOption<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  title?: string;
}

interface SlidingSegmentedControlProps<T extends string = string> {
  options: SlidingSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  pillVariant?: 'primary' | 'amber' | 'glass';
}

export function SlidingSegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
  fullWidth = false,
  pillVariant = 'primary',
}: SlidingSegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bubbleStyle, setBubbleStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const updateBubblePosition = useCallback(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector<HTMLElement>(
      `[data-segmented-id="${CSS.escape(value)}"]`
    );

    if (activeBtn) {
      const left = activeBtn.offsetLeft;
      const top = activeBtn.offsetTop;
      const width = activeBtn.offsetWidth;
      const height = activeBtn.offsetHeight;

      setBubbleStyle((prev) => {
        if (
          prev.left === left &&
          prev.top === top &&
          prev.width === width &&
          prev.height === height &&
          prev.ready
        ) {
          return prev;
        }
        return {
          left,
          top,
          width,
          height,
          ready: true,
        };
      });
    }
  }, [value]);

  useLayoutEffect(() => {
    updateBubblePosition();
  }, [updateBubblePosition]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Fast initial frame sync
    const rafId = requestAnimationFrame(updateBubblePosition);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateBubblePosition();
      });
      resizeObserver.observe(container);
      Array.from(container.children).forEach((child) => {
        if (child instanceof HTMLElement && child.hasAttribute('data-segmented-id')) {
          resizeObserver?.observe(child);
        }
      });
    }

    window.addEventListener('resize', updateBubblePosition, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateBubblePosition);
    };
  }, [updateBubblePosition]);

  // Size configurations
  const paddingMap = {
    sm: 'p-0.5',
    md: 'p-1',
    lg: 'p-1.5',
  };

  const btnPaddingMap = {
    sm: 'px-2 py-1 text-[11px]',
    md: 'px-2.5 py-1.5 text-xs',
    lg: 'px-3.5 py-2 text-xs sm:text-sm',
  };

  // Pill styling variant
  const isAmber = pillVariant === 'amber';
  const isGlass = pillVariant === 'glass';

  const pillClass = isAmber
    ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-black shadow-[0_2px_14px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.8)]'
    : isGlass
    ? 'bg-white/15 border border-white/25 text-white shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)]'
    : 'text-theme-ink';

  const primaryBubbleInlineStyle: React.CSSProperties | undefined =
    !isAmber && !isGlass
      ? {
          background:
            'linear-gradient(135deg, var(--theme-tint) 0%, var(--theme-soft) 50%, var(--theme-deep) 100%)',
          boxShadow:
            '0 2px 14px rgba(var(--theme-rgb), 0.42), inset 0 1px 0 rgba(255,255,255,0.88)',
        }
      : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center rounded-xl liquid-segmented select-none ${
        paddingMap[size]
      } ${fullWidth ? 'w-full' : ''} ${className}`}
      role="tablist"
      style={{
        contain: 'paint layout',
      }}
    >
      {/* Sliding Bubble Indicator */}
      <div
        aria-hidden="true"
        className="absolute rounded-lg pointer-events-none z-0"
        style={{
          transform: `translate3d(${bubbleStyle.left}px, ${bubbleStyle.top}px, 0)`,
          width: `${bubbleStyle.width}px`,
          height: `${bubbleStyle.height}px`,
          opacity: bubbleStyle.ready ? 1 : 0,
          transitionProperty: 'transform, width, height, opacity',
          transitionDuration: '280ms',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform, width',
        }}
      >
        <div
          className={`w-full h-full rounded-lg transition-colors duration-300 ${pillClass}`}
          style={primaryBubbleInlineStyle}
        />
      </div>

      {/* Segment Option Buttons */}
      {options.map((opt) => {
        const isActive = value === opt.id;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            data-segmented-id={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={opt.title}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-180 whitespace-nowrap cursor-pointer ${
              btnPaddingMap[size]
            } ${fullWidth ? 'flex-1 text-center' : ''} ${
              isActive
                ? pillVariant === 'glass'
                  ? 'text-white font-bold'
                  : 'text-theme-ink font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                  isActive ? 'scale-110' : ''
                }`}
              />
            )}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-md ${
                  isActive
                    ? 'bg-black/15 text-theme-ink font-bold'
                    : 'bg-white/10 text-zinc-300'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
