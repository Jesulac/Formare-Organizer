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
  AlertTriangle,
  Camera,
  ExternalLink,
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
      externalUrl?: string;
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
      label: 'Herramientas y Dispositivos',
      items: [
        {
          id: 'calculadora',
          label: 'Calculadora 3D',
          description: 'Precios, márgenes y tornillería',
          icon: Calculator,
        },
        {
          id: 'camara',
          label: 'Ver cámara de la impresora',
          description: 'Cámara en directo OctoEverywhere',
          icon: Camera,
          externalUrl: 'https://formare3d.octoeverywhere.com/network-device-manager/network/control',
        },
      ],
    },
  ];

  // The rail used to spring open on hover, so clicking "Contraer menú" while the
  // cursor was still over it did nothing. The button is now the only control.
  const effectivelyCollapsed = isCollapsed;

  const renderSidebarContent = (mobileMode = false) => {
    const collapsed = mobileMode ? false : effectivelyCollapsed;

    return (
      <div 
        className="flex flex-col h-full glass-sidebar text-zinc-100 select-none"
        style={{
          transition: 'opacity 350ms ease-out',
        }}
      >
        {/* Top Control Bar */}
        <div
          className={`h-14 flex items-center border-b border-white/[0.09] shrink-0 transition-all duration-300 ${
            collapsed ? 'px-2 justify-center' : 'px-4 justify-end'
          }`}
        >
          {mobileMode ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-xl text-zinc-300 hover:text-white liquid-btn-glass cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white liquid-btn-glass cursor-pointer"
              title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
              aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {isCollapsed ? (
                <>
                  {!collapsed && <span className="whitespace-nowrap">Expandir</span>}
                  <PanelLeftOpen className="w-5 h-5 text-[#93c5fd] transition-transform duration-300 group-hover:rotate-12" />
                </>
              ) : (
                <>
                  <span className="whitespace-nowrap">Contraer</span>
                  <PanelLeftClose className="w-5 h-5 text-[#bae6fd] transition-transform duration-300 group-hover:-rotate-12" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className={`p-4 border-b border-white/[0.09] space-y-3 transition-all duration-300 ${collapsed ? 'px-2' : ''}`}>
          <button
            type="button"
            onClick={() => {
              onNewOperation();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-center gap-2.5 rounded-2xl liquid-btn-primary font-bold text-sm cursor-pointer ${
              collapsed ? 'p-3' : 'py-3 px-4'
            }`}
            title="Añadir nueva venta u operación"
          >
            <Plus className="w-5 h-5 stroke-[2.5] shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">Nueva Operación</span>}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={() => {
                onNewPurchase();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl liquid-btn-glass text-zinc-200 hover:text-white font-semibold text-sm cursor-pointer"
            >
              <Disc className="w-4 h-4 text-rose-300 shrink-0" />
              <span className="whitespace-nowrap">Registrar Compra / Bobina</span>
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-table-scroll">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[11px] font-bold text-[#93c5fd]/65 tracking-wider uppercase">
                  {group.label}
                </div>
              )}

              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  const badgeColor =
                    item.badgeTone === 'sky'
                      ? 'text-[#bae6fd]'
                      : item.badgeTone === 'rose'
                      ? 'text-rose-300'
                      : item.badgeTone === 'amber'
                      ? 'text-amber-300'
                      : item.badgeTone === 'emerald'
                      ? 'text-[#bae6fd]'
                      : 'text-zinc-400';

                  const itemContent = (
                    <>
                      {/* Left active glowing glass indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#93c5fd] shadow-[0_0_12px_rgba(147,197,253,0.9)]" />
                      )}

                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Icon
                            className={`w-5 h-5 transition-all duration-300 ${
                              isActive
                                ? 'text-[#bae6fd] scale-110 drop-shadow-[0_0_8px_rgba(147,197,253,0.65)]'
                                : 'text-zinc-400 group-hover:text-[#bae6fd] group-hover:scale-110'
                            }`}
                          />
                          {item.alertDot && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-[#06090f] animate-pulse" />
                          )}
                        </div>

                        {!collapsed && (
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm font-semibold leading-tight truncate ${
                                isActive ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                              }`}
                            >
                              {item.label}
                            </div>
                            <div className="text-xs text-zinc-500 truncate mt-0.5">
                              {item.description}
                            </div>
                          </div>
                        )}
                      </div>

                      {!collapsed && (
                        item.externalUrl ? (
                          <span className="text-zinc-500 group-hover:text-[#bae6fd] transition-colors shrink-0">
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        ) : item.badge ? (
                          <span
                            className={`text-xs font-mono tabular-nums font-bold shrink-0 px-2 py-1 rounded-lg border ${
                              isActive
                                ? 'bg-[#93c5fd]/20 border-[#93c5fd]/35 text-[#e0f2fe]'
                                : `bg-white/[0.05] border-white/[0.08] ${badgeColor}`
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : null
                      )}
                    </>
                  );

                  if (item.externalUrl) {
                    return (
                      <a
                        key={item.id}
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          onCloseMobile();
                        }}
                        title={collapsed ? `${item.label} — ${item.description}` : undefined}
                        className={`w-full group flex items-center justify-between gap-3 rounded-2xl cursor-pointer text-left relative transition-all duration-300 ${
                          collapsed ? 'p-3 justify-center' : 'px-4 py-3'
                        } text-zinc-300 hover:text-white hover:bg-[#93c5fd]/12 border border-transparent hover:border-[#93c5fd]/30 hover:scale-[1.015]`}
                      >
                        {itemContent}
                      </a>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      title={collapsed ? `${item.label} — ${item.description}` : undefined}
                      className={`w-full group flex items-center justify-between gap-3 rounded-2xl cursor-pointer text-left relative transition-all duration-300 ${
                        collapsed ? 'p-3 justify-center' : 'px-4 py-3'
                      } ${
                        isActive
                          ? 'glass-card-pastel text-white scale-[1.015]'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] hover:scale-[1.01]'
                      }`}
                    >
                      {itemContent}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Summary & Data Management Footer */}
        <div className="p-3 border-t border-white/[0.09] bg-black/35 space-y-3 shrink-0 backdrop-blur-xl">
          {!collapsed && (
            <div className="px-4 py-3 rounded-2xl glass-card flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block font-medium">Beneficio Neto (Vista)</span>
                <span
                  className={`text-base font-bold font-mono tabular-nums mt-1 block ${
                    counts.beneficioNeto >= 0 ? 'text-[#bae6fd]' : 'text-rose-400'
                  }`}
                >
                  {formatEuro(counts.beneficioNeto)}
                </span>
              </div>
              {counts.lowStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleNavClick('filamentos')}
                  className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-semibold cursor-pointer transition-all duration-200 hover:scale-105"
                  title="Ver bobinas con poco filamento"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
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
            className={`w-full flex items-center gap-3 rounded-2xl liquid-btn-pastel-glass text-sm font-semibold cursor-pointer ${
              collapsed ? 'p-3 justify-center' : 'px-4 py-2.5'
            }`}
          >
            <FileText className="w-5 h-5 text-[#bae6fd] shrink-0" />
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
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-all duration-200 cursor-pointer hover:scale-[1.01]"
              >
                <span className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-[#93c5fd]/70" />
                  <span>Copia de Seguridad y Datos</span>
                </span>
                <div
                  className="transition-transform duration-300"
                  style={{
                    transform: showDataTools ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  {showDataTools ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </div>
              </button>

              {showDataTools && (
                <div className="mt-2 p-2 rounded-2xl glass-card space-y-1.5 text-sm animate-spring-pop">
                  <button
                    type="button"
                    onClick={onExportJSON}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-all duration-200 text-left cursor-pointer hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4 text-[#93c5fd] shrink-0" />
                    <span>Exportar Copia (JSON)</span>
                  </button>

                  <label className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-white/10 transition-all duration-200 cursor-pointer text-left hover:scale-[1.02]">
                    <Upload className="w-4 h-4 text-[#93c5fd] shrink-0" />
                    <span>Importar Copia (JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="my-1.5 border-t border-white/10" />

                  {confirmAction === 'reset' ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-2">
                      <p className="text-xs text-amber-200 font-semibold">
                        ¿Restaurar datos iniciales de Formare 3D?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onResetData();
                            setConfirmAction(null);
                            setShowDataTools(false);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black font-bold text-xs cursor-pointer hover:bg-amber-300 transition-colors duration-200"
                        >
                          Sí, restaurar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="flex-1 py-1.5 rounded-lg bg-white/10 text-zinc-300 text-xs cursor-pointer hover:bg-white/15 transition-colors duration-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('reset')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-300 hover:bg-amber-500/10 transition-all duration-200 text-left cursor-pointer hover:scale-[1.02]"
                    >
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      <span>Restaurar Datos Iniciales</span>
                    </button>
                  )}

                  {confirmAction === 'clear' ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-400/30 space-y-2">
                      <p className="text-xs text-rose-200 font-semibold">
                        ¿Vaciar todas las operaciones?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClearAllData();
                            setConfirmAction(null);
                            setShowDataTools(false);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-bold text-xs cursor-pointer hover:bg-rose-400 transition-colors duration-200"
                        >
                          Vaciar todo
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="flex-1 py-1.5 rounded-lg bg-white/10 text-zinc-300 text-xs cursor-pointer hover:bg-white/15 transition-colors duration-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('clear')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all duration-200 text-left cursor-pointer hover:scale-[1.02]"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
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
        className={`hidden lg:flex flex-col shrink-0 border-r border-white/[0.1] glass-sidebar fixed inset-y-0 left-0 h-screen z-40 shadow-2xl ${
          effectivelyCollapsed ? 'w-[72px] shadow-black/60' : 'w-72 shadow-black/80'
        }`}
        style={{
          transition: 'width 450ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Left Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300"
            onClick={onCloseMobile}
            style={{
              animation: 'fadeIn 300ms ease-out',
            }}
          />
          <aside 
            className="relative w-80 max-w-[85vw] h-full border-r border-white/15 shadow-2xl z-10 glass-sidebar"
            style={{
              animation: 'slideInFromLeft 380ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};
