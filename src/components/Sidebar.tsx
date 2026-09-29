import React, { useState } from 'react';
import {
  Table2,
  Printer,
  Receipt,
  Disc,
  QrCode,
  Calculator,
  Plus,
  FileText,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  ChevronUp,
  ChevronDown,
  X,
  Box,
  AlertTriangle,
} from 'lucide-react';
import { ActiveSection } from './Header';
import { formatEuro } from '../utils/calculations';

interface SidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  onNewOperation: () => void;
  onNewPurchase: () => void;
  onExportJSON: () => void;
  onExportMonthlyPDF: () => void;
  onImportJSON: (fileContent: string) => void;
  onResetData: () => void;
  onClearAllData: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  counts: {
    totalOperations: number;
    inProduction: number;
    spoolsCount: number;
    lowStockCount: number;
    qrCount: number;
    gastosGeneralesTotal: number;
    beneficioNeto: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  onNewOperation,
  onNewPurchase,
  onExportJSON,
  onExportMonthlyPDF,
  onImportJSON,
  onResetData,
  onClearAllData,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  counts,
}) => {
  const [showDataTools, setShowDataTools] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJSON(content);
      }
    };
    reader.readAsText(file);
    onCloseMobile();
  };

  const handleNavClick = (section: ActiveSection) => {
    onSectionChange(section);
    onCloseMobile();
  };

  const navGroups: {
    label: string;
    items: {
      id: ActiveSection;
      label: string;
      description: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string;
      badgeTone?: 'neutral' | 'sky' | 'rose' | 'amber' | 'emerald';
      alertDot?: boolean;
    }[];
  }[] = [
    {
      label: 'Operaciones y Finanzas',
      items: [
        {
          id: 'ventas',
          label: 'Panel General',
          description: 'Ventas, compras y cierres',
          icon: Table2,
          badge: String(counts.totalOperations),
          badgeTone: 'neutral',
        },
        {
          id: 'produccion',
          label: 'Cola de Producción',
          description: 'Productos en fabricación',
          icon: Printer,
          badge: counts.inProduction > 0 ? String(counts.inProduction) : undefined,
          badgeTone: counts.inProduction > 0 ? 'sky' : 'neutral',
        },
        {
          id: 'gastos',
          label: 'Gastos en General',
          description: 'Bobinas, compras y B. Sandra',
          icon: Receipt,
          badge: formatEuro(counts.gastosGeneralesTotal),
          badgeTone: 'rose',
        },
      ],
    },
    {
      label: 'Inventario y Logística',
      items: [
        {
          id: 'filamentos',
          label: 'Stock Filamentos',
          description: 'Control de bobinas 1000g',
          icon: Disc,
          badge: `${counts.spoolsCount} bob.`,
          badgeTone: counts.lowStockCount > 0 ? 'amber' : 'neutral',
          alertDot: counts.lowStockCount > 0,
        },
        {
          id: 'qr',
          label: 'Almacén de QR',
          description: 'Etiquetas Correos / InPost',
          icon: QrCode,
          badge: counts.qrCount > 0 ? String(counts.qrCount) : undefined,
          badgeTone: 'emerald',
        },
      ],
    },
    {
      label: 'Herramientas',
      items: [
        {
          id: 'calculadora',
          label: 'Calculadora 3D',
          description: 'Precios, márgenes y tornillería',
          icon: Calculator,
        },
      ],
    },
  ];

  const renderSidebarContent = (mobileMode = false) => {
    const collapsed = mobileMode ? false : isCollapsed;

    return (
      <div className="flex flex-col h-full bg-[#09090b] text-zinc-100 select-none">
        {/* Top Brand Zone */}
        <div
          className={`h-16 flex items-center justify-between border-b border-white/[0.08] shrink-0 ${
            collapsed ? 'px-3 justify-center' : 'px-4'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Box className="w-4 h-4 text-emerald-400" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-white block truncate">
                  Formare 3D
                </span>
                <span className="text-[11px] text-zinc-400 block truncate">
                  Gestión de Producción
                </span>
              </div>
            )}
          </div>

          {mobileMode ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !collapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Contraer menú lateral"
                aria-label="Contraer menú lateral"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Collapse expand button when in narrow rail mode */}
        {!mobileMode && collapsed && (
          <div className="px-2 pt-2.5 flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Expandir menú lateral"
              aria-label="Expandir menú lateral"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className={`p-3 border-b border-white/[0.08] space-y-2 ${collapsed ? 'px-2' : ''}`}>
          <button
            type="button"
            onClick={() => {
              onNewOperation();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-500/15 ${
              collapsed ? 'p-2.5' : 'py-2.5 px-3.5'
            }`}
            title="Añadir nueva venta u operación"
          >
            <Plus className="w-4 h-4 stroke-[2.75] shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">Nueva Operación</span>}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={() => {
                onNewPurchase();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white font-medium text-xs transition-all cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="whitespace-nowrap">Registrar Compra / Bobina</span>
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5 custom-table-scroll">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[11px] font-semibold text-zinc-500 tracking-tight">
                  {group.label}
                </div>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                const badgeColor =
                  item.badgeTone === 'sky'
                    ? 'text-sky-300'
                    : item.badgeTone === 'rose'
                    ? 'text-rose-300'
                    : item.badgeTone === 'amber'
                    ? 'text-amber-300'
                    : item.badgeTone === 'emerald'
                    ? 'text-emerald-300'
                    : 'text-zinc-400';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    title={collapsed ? `${item.label} — ${item.description}` : undefined}
                    className={`w-full group flex items-center justify-between gap-2.5 rounded-xl transition-all cursor-pointer text-left relative ${
                      collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-emerald-500/12 text-white border border-emerald-500/30 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {/* Left active indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-400" />
                    )}

                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            isActive
                              ? 'text-emerald-400'
                              : 'text-zinc-400 group-hover:text-zinc-200'
                          }`}
                        />
                        {item.alertDot && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#09090b]" />
                        )}
                      </div>

                      {!collapsed && (
                        <div className="min-w-0">
                          <div
                            className={`text-xs leading-tight truncate ${
                              isActive ? 'font-semibold text-white' : 'font-medium text-zinc-200'
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      )}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={`text-[11px] font-mono tabular-nums font-semibold shrink-0 ${
                          isActive ? 'text-emerald-300' : badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Summary & Data Management Footer */}
        <div className="p-2.5 border-t border-white/[0.08] bg-black/40 space-y-2 shrink-0">
          {!collapsed && (
            <div className="px-3 py-2.5 rounded-xl bg-zinc-900/70 border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 block">Beneficio Neto (Vista)</span>
                <span
                  className={`text-sm font-bold font-mono tabular-nums ${
                    counts.beneficioNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatEuro(counts.beneficioNeto)}
                </span>
              </div>
              {counts.lowStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleNavClick('filamentos')}
                  className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 font-medium cursor-pointer"
                  title="Ver bobinas con poco filamento"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{counts.lowStockCount} bajo stock</span>
                </button>
              )}
            </div>
          )}

          {/* Monthly PDF Report Quick Action */}
          <button
            type="button"
            onClick={() => {
              onExportMonthlyPDF();
              onCloseMobile();
            }}
            title="Descargar informe mensual en PDF"
            className={`w-full flex items-center gap-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium transition-colors cursor-pointer ${
              collapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
            {!collapsed && <span className="truncate">Descargar Resumen PDF</span>}
          </button>

          {/* Backup & Data Accordion */}
          {!collapsed && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setShowDataTools(!showDataTools);
                  setConfirmAction(null);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copia de Seguridad y Datos</span>
                </span>
                {showDataTools ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>

              {showDataTools && (
                <div className="mt-1.5 p-1.5 rounded-xl bg-zinc-900/90 border border-white/10 space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={onExportJSON}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-200 hover:bg-white/10 transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>Exportar Copia (JSON)</span>
                  </button>

                  <label className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer text-left">
                    <Upload className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>Importar Copia (JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="my-1 border-t border-white/10" />

                  {confirmAction === 'reset' ? (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                      <p className="text-[10px] text-amber-300 font-medium">
                        ¿Restaurar datos iniciales de Formare 3D?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onResetData();
                            setConfirmAction(null);
                            setShowDataTools(false);
                          }}
                          className="flex-1 py-1 rounded bg-amber-500 text-black font-semibold text-[10px] cursor-pointer"
                        >
                          Sí, restaurar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="flex-1 py-1 rounded bg-white/10 text-zinc-300 text-[10px] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('reset')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span>Restaurar Datos Iniciales</span>
                    </button>
                  )}

                  {confirmAction === 'clear' ? (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1.5">
                      <p className="text-[10px] text-rose-300 font-medium">
                        ¿Vaciar todas las operaciones?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onClearAllData();
                            setConfirmAction(null);
                            setShowDataTools(false);
                          }}
                          className="flex-1 py-1 rounded bg-rose-500 text-white font-semibold text-[10px] cursor-pointer"
                        >
                          Vaciar todo
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="flex-1 py-1 rounded bg-white/10 text-zinc-300 text-[10px] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('clear')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Vaciar Operaciones</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Permanent Left Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-white/[0.08] bg-[#09090b] sticky top-0 h-screen z-30 transition-all duration-200 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Left Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] h-full border-r border-white/10 shadow-2xl z-10">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
