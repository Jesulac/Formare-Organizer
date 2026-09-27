import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Copy, 
  Check, 
  Calendar, 
  Tag, 
  User, 
  FileText,
  Boxes
} from 'lucide-react';
import { 
  Operation, 
  OperationType, 
  Platform, 
  Status 
} from '../types/operation';
import { 
  calculateBeneficio, 
  formatDateInput, 
  formatEuro, 
  parseEuro 
} from '../utils/calculations';

interface OperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>) => void;
  onUpdate?: (id: string, data: Partial<Operation>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  operationToEdit?: Operation | null;
  initialData?: Partial<Operation>;
}

const platformsList: Platform[] = [
  'Wallapop',
  'Vinted',
  'Etsy',
  'eBay',
  'Cults3D',
  'En persona',
  'Internet',
  'Otro',
];

const statusesList: Status[] = [
  'Cobrado✅',
  'Pagado⭕',
  'Pendiente de cobro',
  'Enviado📦',
  'En producción',
  'Cancelado',
  'Otro',
];

export const OperationModal: React.FC<OperationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  onDuplicate,
  operationToEdit,
  initialData,
}) => {
  const isEditing = Boolean(operationToEdit);

  const [tipo, setTipo] = useState<OperationType>('venta');
  const [producto, setProducto] = useState('');
  const [fecha, setFecha] = useState(formatDateInput(new Date().toISOString()));
  const [material, setMaterial] = useState('');
  const [precioStr, setPrecioStr] = useState('');
  const [costesStr, setCostesStr] = useState('');
  const [costesOperativosStr, setCostesOperativosStr] = useState('');
  const [lugarVenta, setLugarVenta] = useState<Platform>('Wallapop');
  const [estado, setEstado] = useState<Status>('Cobrado✅');
  const [vendedor, setVendedor] = useState('Jorge');
  const [comentarios, setComentarios] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setConfirmingDelete(false);
    setErrorMsg(null);
    if (operationToEdit) {
      setTipo(operationToEdit.tipo || 'venta');
      setProducto(operationToEdit.producto || '');
      setFecha(formatDateInput(operationToEdit.fecha));
      setMaterial(operationToEdit.material || '');
      setPrecioStr(operationToEdit.precio !== null ? String(operationToEdit.precio) : '');
      setCostesStr(operationToEdit.costes ? String(operationToEdit.costes) : '');
      setCostesOperativosStr(operationToEdit.costesOperativos ? String(operationToEdit.costesOperativos) : '');
      setLugarVenta(operationToEdit.lugarVenta || 'Wallapop');
      setEstado(operationToEdit.estado || 'Cobrado✅');
      setVendedor(operationToEdit.vendedor || 'Jorge');
      setComentarios(operationToEdit.comentarios || '');
    } else if (initialData) {
      setTipo(initialData.tipo || 'venta');
      setProducto(initialData.producto || '');
      setFecha(initialData.fecha ? formatDateInput(initialData.fecha) : formatDateInput(new Date().toISOString()));
      setMaterial(initialData.material || '');
      setPrecioStr(initialData.precio !== null && initialData.precio !== undefined ? String(initialData.precio) : '');
      setCostesStr(initialData.costes ? String(initialData.costes) : '');
      setCostesOperativosStr(initialData.costesOperativos ? String(initialData.costesOperativos) : '');
      setLugarVenta(initialData.lugarVenta || 'Wallapop');
      setEstado(initialData.estado || 'Cobrado✅');
      setVendedor(initialData.vendedor || 'Jorge');
      setComentarios(initialData.comentarios || '');
    } else {
      setTipo('venta');
      setProducto('');
      setFecha(formatDateInput(new Date().toISOString()));
      setMaterial('');
      setPrecioStr('');
      setCostesStr('');
      setCostesOperativosStr('');
      setLugarVenta('Wallapop');
      setEstado('Cobrado✅');
      setVendedor('Jorge');
      setComentarios('');
    }
  }, [operationToEdit, initialData, isOpen]);

  if (!isOpen) return null;

  const precioNum = precioStr !== '' ? parseEuro(precioStr) : null;
  const costesNum = parseEuro(costesStr);
  const costesOpNum = parseEuro(costesOperativosStr);

  const previewBeneficio = calculateBeneficio(precioNum, costesNum, costesOpNum, tipo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!producto.trim()) {
      setErrorMsg('Introduce el nombre del producto o concepto.');
      return;
    }

    const payload = {
      tipo,
      producto: producto.trim(),
      fecha,
      material: material.trim() || undefined,
      precio: tipo === 'compra' || tipo === 'inversion' ? null : precioNum,
      costes: costesNum,
      costesOperativos: costesOpNum,
      lugarVenta,
      estado,
      vendedor: vendedor.trim() || undefined,
      comentarios: comentarios.trim() || undefined,
    };

    if (isEditing && operationToEdit && onUpdate) {
      onUpdate(operationToEdit.id, payload);
    } else {
      onSave(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dark backdrop blur */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Main Glass Modal/Sheet */}
      <div className="relative w-full max-w-lg glass-modal rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl z-10 max-h-[92vh] overflow-y-auto">
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1 mb-4 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>{isEditing ? 'Editar operación' : 'Nueva operación'}</span>
          </h2>
          
          <div className="flex items-center gap-2">
            {isEditing && operationToEdit && onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onDuplicate(operationToEdit.id);
                  onClose();
                }}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Duplicar esta operación"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}

            {isEditing && operationToEdit && onDelete && (
              confirmingDelete ? (
                <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500/40 rounded-full px-2 py-0.5 text-[11px]">
                  <span className="text-rose-200 font-medium mr-1">¿Eliminar?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(operationToEdit.id);
                      onClose();
                    }}
                    className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-semibold cursor-pointer"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="px-1.5 py-0.5 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="p-1.5 rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Eliminar operación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {errorMsg}
            </div>
          )}
          
          {/* Tipo de Operación Segmented Control */}
          <div>
            <label className="block text-zinc-400 font-medium mb-1.5">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-1 bg-zinc-900 border border-white/10 rounded-2xl">
              {[
                { id: 'venta', label: 'Venta' },
                { id: 'compra', label: 'Compra' },
                { id: 'inversion', label: 'Inversión' },
                { id: 'cierre', label: 'Cierre' },
                { id: 'otro', label: 'Otro' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const newTipo = t.id as OperationType;
                    setTipo(newTipo);
                    if (newTipo === 'compra' || newTipo === 'inversion') {
                      setEstado('Pagado⭕');
                      setLugarVenta('Internet');
                    } else if (newTipo === 'venta') {
                      setEstado('Cobrado✅');
                    }
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all text-center cursor-pointer ${
                    tipo === t.id
                      ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Producto Name */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center justify-between">
              <span>Producto / Concepto *</span>
            </label>
            <input
              type="text"
              required
              value={producto}
              onChange={(e) => {
                setProducto(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ej: Volante F1 Logitech, Bobina PETG, Pedido filamento..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Fecha & Platform Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Fecha
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                Lugar de venta
              </label>
              <select
                value={lugarVenta}
                onChange={(e) => setLugarVenta(e.target.value as Platform)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              >
                {platformsList.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Material Used */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-zinc-400" />
              Material
            </label>
            <input
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Ej: PETG negro (eSun) + PLA rojo (Elegoo) + tornillos"
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Financials Row: Precio, Costes, Costes Operativos */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Precio / Ingreso */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Precio (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={precioStr}
                onChange={(e) => setPrecioStr(e.target.value)}
                placeholder="0.00"
                disabled={tipo === 'compra' || tipo === 'inversion'}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-40"
              />
            </div>

            {/* Costes */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Costes (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={costesStr}
                onChange={(e) => setCostesStr(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Costes Operativos */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                C. Operativos (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={costesOperativosStr}
                onChange={(e) => setCostesOperativosStr(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Calculated Profit Banner Preview */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Beneficio Calculado</span>
            <span className={`text-base font-bold font-mono ${
              previewBeneficio > 0 ? 'text-emerald-400' : previewBeneficio < 0 ? 'text-rose-400' : 'text-zinc-300'
            }`}>
              {previewBeneficio > 0 ? `+${formatEuro(previewBeneficio)}` : formatEuro(previewBeneficio)}
            </span>
          </div>

          {/* Estado & Vendedor Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as Status)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              >
                {statusesList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                Vendedor
              </label>
              <input
                type="text"
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                placeholder="Jorge, Sandra, Alejandro..."
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Comentarios / Observaciones */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              Comentarios
            </label>
            <textarea
              rows={2}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Unidades, pedido, comprador, incidencias..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Save Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Guardar</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
