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
  Boxes,
  Clock,
  QrCode,
  Upload,
  Hash,
  Sparkles,
  Loader2,
  Plus,
  ChevronDown,
  Scale
} from 'lucide-react';
import { 
  Operation, 
  OperationType, 
  Platform, 
  Status,
  ProductCatalogItem,
  ShippingCompany,
  FilamentSpool,
  MaterialItem
} from '../types/operation';
import { 
  calculateBeneficio, 
  calculateDeadlineDate,
  calculateSandraCommission,
  compressImageFile,
  formatDateDisplay,
  formatDateInput, 
  formatEuro, 
  formatMaterialItems,
  normalizeStatus,
  parseEuro,
  parseMaterialItems
} from '../utils/calculations';
import { normalizeFilamentKey } from '../hooks/useOperations';
import { parseVoiceOperationSmartFallback } from '../utils/voiceParser';

interface OperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>) => void;
  onUpdate?: (id: string, data: Partial<Operation>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  operationToEdit?: Operation | null;
  initialData?: Partial<Operation>;
  productCatalog: ProductCatalogItem[];
  filamentStock?: FilamentSpool[];
}

interface MaterialDraftRow {
  material: string;
  gramos: string;
}

function buildInitialMaterialRows(
  rawMaterial?: string,
  existingDetalle?: MaterialItem[]
): MaterialDraftRow[] {
  const parsed = parseMaterialItems(rawMaterial, existingDetalle);
  if (parsed.length === 0) {
    return [{ material: '', gramos: '' }];
  }
  return parsed.map((item) => ({
    material: item.material || '',
    gramos: item.gramos && item.gramos > 0 ? String(item.gramos) : '',
  }));
}

const platformsList: Platform[] = [
  'Wallapop',
  'Vinted',
  'Etsy',
  'eBay',
  'Amazon',
  'Internet',
  'En persona',
  'Cults3D',
  'Otro',
];

const statusesList: Status[] = [
  'En producción',
  'Cobrado',
  'Pagado',
  'Pendiente de pago',
  'Pendiente de cobro',
  'Enviado',
  'Cancelado',
  'Otro',
];

const shippingCompanies: ShippingCompany[] = ['Correos', 'InPost', 'Seur', 'Vinted Go', 'Otro'];

const KNOWN_SELLERS = ['Jorge', 'Sandra', 'Alejandro', 'Jorge, Sandra'];

export const OperationModal: React.FC<OperationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  onDuplicate,
  operationToEdit,
  initialData,
  productCatalog,
  filamentStock = [],
}) => {
  const isEditing = Boolean(operationToEdit);

  const [tipo, setTipo] = useState<OperationType>('venta');
  const [producto, setProducto] = useState('');
  const [unidades, setUnidades] = useState<number>(1);
  const [costeUnitario, setCosteUnitario] = useState<number | undefined>(undefined);
  const [fecha, setFecha] = useState(formatDateInput(new Date().toISOString()));
  const [fechaLimiteCustom, setFechaLimiteCustom] = useState<string>('');
  const [material, setMaterial] = useState('');
  const [materialRows, setMaterialRows] = useState<MaterialDraftRow[]>([
    { material: '', gramos: '' },
  ]);
  const [precioStr, setPrecioStr] = useState('');
  const [costesStr, setCostesStr] = useState('');
  const [otrosCostesStr, setOtrosCostesStr] = useState('');
  const [lugarVenta, setLugarVenta] = useState<Platform>('Wallapop');
  const [estado, setEstado] = useState<Status>('En producción');
  const [vendedorSelect, setVendedorSelect] = useState<string>('Jorge');
  const [vendedorCustom, setVendedorCustom] = useState<string>('');
  const [comentarios, setComentarios] = useState('');
  const [fotoQr, setFotoQr] = useState<string | undefined>(undefined);
  const [empresaEnvio, setEmpresaEnvio] = useState<ShippingCompany>('Correos');
  const [esPedidoFilamento, setEsPedidoFilamento] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI Text Autocomplete States
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setConfirmingDelete(false);
    setErrorMsg(null);
    setVoiceStatusMsg(null);
    setVoiceTranscript('');

    const defaultToday = formatDateInput(new Date().toISOString());

    if (operationToEdit) {
      const editTipo = operationToEdit.tipo || 'venta';
      const editFecha = formatDateInput(operationToEdit.fecha);
      const editLugar = operationToEdit.lugarVenta || 'Wallapop';
      setTipo(editTipo);
      setProducto(operationToEdit.producto || '');
      const uds = operationToEdit.unidades && operationToEdit.unidades > 0 ? operationToEdit.unidades : 1;
      setUnidades(uds);
      const savedOtros =
        typeof operationToEdit.costesOperativos === 'number' && operationToEdit.costesOperativos > 0
          ? operationToEdit.costesOperativos
          : 0;
      const baseCostTotal = Math.max(
        0,
        Number(((operationToEdit.costes || 0) - savedOtros).toFixed(2))
      );
      setCosteUnitario(
        operationToEdit.costeUnitario ??
          (baseCostTotal > 0 ? Number((baseCostTotal / uds).toFixed(2)) : undefined)
      );
      setFecha(editFecha);
      setFechaLimiteCustom(
        editTipo === 'venta'
          ? operationToEdit.fechaLimite || calculateDeadlineDate(editFecha, editLugar, editTipo)
          : ''
      );
      setMaterial(operationToEdit.material || '');
      setMaterialRows(
        buildInitialMaterialRows(operationToEdit.material, operationToEdit.materialesDetalle)
      );
      setPrecioStr(operationToEdit.precio !== null ? String(operationToEdit.precio) : '');
      setCostesStr(baseCostTotal > 0 ? String(baseCostTotal) : operationToEdit.costes && savedOtros === 0 ? String(operationToEdit.costes) : '');
      setOtrosCostesStr(savedOtros > 0 ? String(savedOtros) : '');
      setLugarVenta(editLugar);
      setEstado(normalizeStatus(operationToEdit.estado));

      const vend = operationToEdit.vendedor || 'Jorge';
      if (KNOWN_SELLERS.includes(vend)) {
        setVendedorSelect(vend);
        setVendedorCustom('');
      } else {
        setVendedorSelect('Otro');
        setVendedorCustom(vend);
      }

      setComentarios(operationToEdit.comentarios || '');
      setFotoQr(operationToEdit.fotoQr);
      setEmpresaEnvio(operationToEdit.empresaEnvio || 'Correos');
      setEsPedidoFilamento(Boolean(operationToEdit.esPedidoFilamento));
    } else if (initialData) {
      const initTipo = initialData.tipo || 'venta';
      const initFecha = initialData.fecha ? formatDateInput(initialData.fecha) : defaultToday;
      const initLugar = initialData.lugarVenta || 'Wallapop';
      setTipo(initTipo);
      setProducto(initialData.producto || '');
      const uds = initialData.unidades && initialData.unidades > 0 ? initialData.unidades : 1;
      setUnidades(uds);
      setCosteUnitario(initialData.costes ? Number((initialData.costes / uds).toFixed(2)) : undefined);
      setFecha(initFecha);
      setFechaLimiteCustom(
        initTipo === 'venta'
          ? initialData.fechaLimite || calculateDeadlineDate(initFecha, initLugar, initTipo)
          : ''
      );
      setMaterial(initialData.material || '');
      setMaterialRows(
        buildInitialMaterialRows(initialData.material, initialData.materialesDetalle)
      );
      setPrecioStr(initialData.precio !== null && initialData.precio !== undefined ? String(initialData.precio) : '');
      setCostesStr(initialData.costes ? String(initialData.costes) : '');
      setOtrosCostesStr(initialData.costesOperativos ? String(initialData.costesOperativos) : '');
      setLugarVenta(initLugar);
      setEstado(normalizeStatus(initialData.estado || 'En producción'));
      setVendedorSelect('Jorge');
      setVendedorCustom('');
      setComentarios(initialData.comentarios || '');
      setFotoQr(initialData.fotoQr);
      setEmpresaEnvio(initialData.empresaEnvio || 'Correos');
      setEsPedidoFilamento(Boolean(initialData.esPedidoFilamento));
    } else {
      setTipo('venta');
      setProducto('');
      setUnidades(1);
      setCosteUnitario(undefined);
      setFecha(defaultToday);
      setFechaLimiteCustom(calculateDeadlineDate(defaultToday, 'Wallapop', 'venta'));
      setMaterial('');
      setMaterialRows([{ material: '', gramos: '' }]);
      setPrecioStr('');
      setCostesStr('');
      setOtrosCostesStr('');
      setLugarVenta('Wallapop');
      setEstado('En producción');
      setVendedorSelect('Jorge');
      setVendedorCustom('');
      setComentarios('');
      setFotoQr(undefined);
      setEmpresaEnvio('Correos');
      setEsPedidoFilamento(false);
    }
  }, [operationToEdit, initialData, isOpen]);

  if (!isOpen) return null;

  const precioNum = precioStr !== '' ? parseEuro(precioStr) : null;
  const costesBaseNum = parseEuro(costesStr);
  const otrosCostesNum = parseEuro(otrosCostesStr);
  const costesNum = Number((costesBaseNum + otrosCostesNum).toFixed(2));
  const autoFechaLimite = calculateDeadlineDate(fecha, lugarVenta, tipo);
  const effectiveFechaLimite = tipo === 'venta' ? (fechaLimiteCustom || autoFechaLimite) : '';
  const previewBeneficio = calculateBeneficio(precioNum, costesNum, 0, tipo);
  const effectiveVendedorPreview =
    vendedorSelect === 'Otro' ? vendedorCustom.trim() || 'Otro' : vendedorSelect;
  const previewSandraCommission = calculateSandraCommission(
    precioNum,
    effectiveVendedorPreview,
    tipo
  );

  // Apply extracted AI data into all form fields
  const applyExtractedAiData = (data: any) => {
    if (!data) return;

    if (data.transcripcion) {
      setVoiceTranscript(data.transcripcion);
    }

    const aiTipo: OperationType =
      data.tipo === 'compra' || data.tipo === 'inversion' ? data.tipo : 'venta';
    setTipo(aiTipo);

    const aiUnits = typeof data.unidades === 'number' && data.unidades >= 1 ? Math.round(data.unidades) : 1;
    setUnidades(aiUnits);

    let matchedCatalogItem: ProductCatalogItem | undefined;
    if (data.producto && typeof data.producto === 'string') {
      const cleanName = data.producto.trim();
      setProducto(cleanName);
      matchedCatalogItem = productCatalog.find(
        (item) => item.producto.toLowerCase() === cleanName.toLowerCase()
      );
    }

    const aiFecha =
      data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)
        ? data.fecha
        : fecha;
    setFecha(aiFecha);

    const validPlatform = platformsList.find(
      (p) => p.toLowerCase() === String(data.lugarVenta || '').toLowerCase()
    );
    const nextLugar: Platform = validPlatform || (aiTipo === 'venta' ? 'Wallapop' : 'Internet');
    setLugarVenta(nextLugar);

    setFechaLimiteCustom(
      aiTipo === 'venta' ? calculateDeadlineDate(aiFecha, nextLugar, aiTipo) : ''
    );

    if (data.material && typeof data.material === 'string' && data.material.trim()) {
      const aiMat = data.material.trim();
      setMaterial(aiMat);
      setMaterialRows(buildInitialMaterialRows(aiMat));
    } else if (matchedCatalogItem?.material) {
      setMaterial(matchedCatalogItem.material);
      setMaterialRows(
        buildInitialMaterialRows(
          matchedCatalogItem.material,
          matchedCatalogItem.materialesDetalle
        )
      );
    }

    if (aiTipo === 'venta') {
      if (typeof data.precio === 'number' && data.precio > 0) {
        setPrecioStr(String(Number(data.precio.toFixed(2))));
      }
    } else {
      setPrecioStr('');
    }

    if (typeof data.costes === 'number' && data.costes > 0) {
      const cTotal = Number(data.costes.toFixed(2));
      setCostesStr(String(cTotal));
      setCosteUnitario(Number((cTotal / aiUnits).toFixed(2)));
    } else if (matchedCatalogItem && matchedCatalogItem.costeUnitario > 0) {
      setCosteUnitario(matchedCatalogItem.costeUnitario);
      setCostesStr(String(Number((matchedCatalogItem.costeUnitario * aiUnits).toFixed(2))));
    }

    if (data.estado) {
      setEstado(normalizeStatus(data.estado));
    } else {
      setEstado(aiTipo === 'venta' ? 'En producción' : 'Pagado');
    }

    if (data.vendedor && typeof data.vendedor === 'string') {
      const vTrim = data.vendedor.trim();
      const matchedSeller = KNOWN_SELLERS.find(
        (s) => s.toLowerCase() === vTrim.toLowerCase()
      );
      if (matchedSeller) {
        setVendedorSelect(matchedSeller);
        setVendedorCustom('');
      } else {
        setVendedorSelect('Otro');
        setVendedorCustom(vTrim);
      }
    }

    if (data.comentarios && typeof data.comentarios === 'string') {
      setComentarios(data.comentarios.trim());
    }

    if (typeof data.esPedidoFilamento === 'boolean') {
      setEsPedidoFilamento(data.esPedidoFilamento);
    }

    setErrorMsg(null);
    setVoiceStatusMsg(
      'Todos los apartados se han rellenado automáticamente con Inteligencia Artificial.'
    );
  };

  const processTextWithAi = async (customText?: string) => {
    const textToUse = (customText ?? voiceTranscript).trim();
    if (!textToUse) {
      setErrorMsg('Escribe los datos de la operación en la caja de texto para que la Inteligencia Artificial los rellene.');
      return;
    }

    setIsProcessingVoice(true);
    setErrorMsg(null);
    setVoiceStatusMsg('Analizando el texto con Inteligencia Artificial y rellenando todos los apartados...');

    const todayDate = formatDateInput(new Date().toISOString());

    try {
      const res = await fetch('/api/ai/voice-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToUse,
          transcriptText: textToUse,
          productCatalog,
          todayDate,
        }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result || !result.ok) {
        const fallbackData = parseVoiceOperationSmartFallback(
          textToUse,
          productCatalog,
          todayDate
        );
        applyExtractedAiData(fallbackData);
        return;
      }

      applyExtractedAiData(result.data);
    } catch {
      const fallbackData = parseVoiceOperationSmartFallback(
        textToUse,
        productCatalog,
        todayDate
      );
      applyExtractedAiData(fallbackData);
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Helper to get spool price per 1000g for any filament name
  const getSpoolPriceForMaterial = (matName: string): number => {
    if (!matName.trim()) return 15.99;
    const normalized = normalizeFilamentKey(matName);
    const matched =
      filamentStock.find((s) => s.nombre.toLowerCase() === matName.trim().toLowerCase()) ||
      filamentStock.find((s) => s.nombre.toLowerCase() === normalized.toLowerCase());
    return matched ? matched.precioBobina : 15.99;
  };

  // Sync materialRows changes to `material` string and auto-calculate filament cost when grams are provided
  const updateMaterialRowsAndSync = (
    nextRows: MaterialDraftRow[],
    currentUnidades: number = unidades
  ) => {
    setMaterialRows(nextRows);

    const isMulti = nextRows.length > 1 || Boolean(nextRows[0]?.gramos?.trim());
    const structuredItems: MaterialItem[] = nextRows
      .map((r) => {
        const g = parseFloat((r.gramos || '').replace(',', '.'));
        return {
          material: r.material.trim(),
          gramos: isMulti && !isNaN(g) && g > 0 ? Number(g.toFixed(2)) : undefined,
        };
      })
      .filter((i) => i.material.length > 0);

    const formattedStr = formatMaterialItems(structuredItems, isMulti);
    setMaterial(formattedStr);

    // If in multi-material/grams mode and at least one row has positive grams, auto-calculate unit and total filament cost
    if (isMulti && tipo === 'venta') {
      let totalGramsPerUnit = 0;
      let calculatedUnitCost = 0;

      nextRows.forEach((r) => {
        const g = parseFloat((r.gramos || '').replace(',', '.'));
        if (!isNaN(g) && g > 0) {
          totalGramsPerUnit += g;
          const spoolPrice = getSpoolPriceForMaterial(r.material);
          calculatedUnitCost += (g * spoolPrice) / 1000;
        }
      });

      if (totalGramsPerUnit > 0) {
        const roundedUnitCost = Number(calculatedUnitCost.toFixed(2));
        const totalCost = Number((roundedUnitCost * (currentUnidades || 1)).toFixed(2));
        setCosteUnitario(roundedUnitCost);
        setCostesStr(String(totalCost));
      }
    }
  };

  const handleAddMaterialRow = () => {
    const nextRows = [...materialRows, { material: '', gramos: '' }];
    updateMaterialRowsAndSync(nextRows);
  };

  const handleRemoveMaterialRow = (idxToRemove: number) => {
    if (materialRows.length <= 1) {
      updateMaterialRowsAndSync([{ material: '', gramos: '' }]);
      return;
    }
    const filtered = materialRows.filter((_, idx) => idx !== idxToRemove);
    // If only 1 row remains after deleting, clear its grams so it returns to single-material mode without grams
    if (filtered.length === 1) {
      const singleRow = [{ material: filtered[0].material, gramos: '' }];
      updateMaterialRowsAndSync(singleRow);
    } else {
      updateMaterialRowsAndSync(filtered);
    }
  };

  const handleChangeMaterialRow = (
    idx: number,
    field: 'material' | 'gramos',
    value: string
  ) => {
    const nextRows = materialRows.map((row, i) =>
      i === idx ? { ...row, [field]: value } : row
    );
    updateMaterialRowsAndSync(nextRows);
  };

  // Handle selecting an existing product from catalog
  const handleSelectCatalogProduct = (selectedName: string) => {
    if (!selectedName) return;
    setProducto(selectedName);
    const found = productCatalog.find(
      (item) => item.producto.toLowerCase() === selectedName.toLowerCase()
    );
    if (found) {
      setCosteUnitario(found.costeUnitario);
      const totalCost = Number((found.costeUnitario * (unidades || 1)).toFixed(2));
      setCostesStr(String(totalCost));
      if (found.material || found.materialesDetalle) {
        setMaterial(found.material || '');
        setMaterialRows(
          buildInitialMaterialRows(found.material, found.materialesDetalle)
        );
      }
    }
  };

  // Handle changing units -> automatically multiplies unit cost if known
  const handleUnitsChange = (newUnitsRaw: string) => {
    const parsed = parseInt(newUnitsRaw, 10);
    const validUnits = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setUnidades(validUnits);

    if (costeUnitario !== undefined && costeUnitario > 0) {
      const multipliedCost = Number((costeUnitario * validUnits).toFixed(2));
      setCostesStr(String(multipliedCost));
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 900);
      setFotoQr(compressed);
    } catch (err) {
      console.error('Error al adjuntar foto', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!producto.trim()) {
      setErrorMsg('Introduce o selecciona el nombre del producto.');
      return;
    }

    const finalVendedor =
      vendedorSelect === 'Otro' ? vendedorCustom.trim() || 'Otro' : vendedorSelect;

    const unitCostFinal =
      costeUnitario !== undefined
        ? costeUnitario
        : unidades > 0
        ? Number((costesBaseNum / unidades).toFixed(2))
        : costesBaseNum;

    const isMulti = materialRows.length > 1 || Boolean(materialRows[0]?.gramos?.trim());
    const validDetalle: MaterialItem[] = materialRows
      .map((r) => {
        const g = parseFloat((r.gramos || '').replace(',', '.'));
        return {
          material: r.material.trim(),
          gramos: isMulti && !isNaN(g) && g > 0 ? Number(g.toFixed(2)) : undefined,
        };
      })
      .filter((i) => i.material.length > 0);

    const finalMaterialStr = isMulti
      ? formatMaterialItems(validDetalle, true)
      : (materialRows[0]?.material || material).trim();

    const payload: Omit<Operation, 'id' | 'createdAt' | 'beneficio'> = {
      tipo,
      producto: producto.trim(),
      unidades: unidades || 1,
      costeUnitario: unitCostFinal,
      fecha,
      material: finalMaterialStr || undefined,
      materialesDetalle: isMulti && validDetalle.length > 0 ? validDetalle : undefined,
      precio: tipo === 'compra' || tipo === 'inversion' ? null : precioNum,
      costes: costesNum,
      costesOperativos: otrosCostesNum,
      lugarVenta,
      estado,
      vendedor: finalVendedor,
      comentarios: comentarios.trim() || undefined,
      fechaLimite: tipo === 'venta' ? effectiveFechaLimite : '',
      fotoQr,
      empresaEnvio: fotoQr ? empresaEnvio : operationToEdit?.empresaEnvio,
      fechaSubidaQr: fotoQr ? operationToEdit?.fechaSubidaQr || Date.now() : undefined,
      esPedidoFilamento:
        tipo === 'compra' &&
        (esPedidoFilamento ||
          producto.toLowerCase().includes('filamento') ||
          /(pla|petg|asa|tpu)/i.test(finalMaterialStr)),
    };

    if (isEditing && operationToEdit && onUpdate) {
      onUpdate(operationToEdit.id, payload);
    } else {
      onSave(payload);
    }

    onClose();
  };

  const isMultiMaterialMode =
    materialRows.length > 1 || Boolean(materialRows[0]?.gramos?.trim());

  const totalMultiGramsPerUnit = Number(
    materialRows
      .reduce((acc, r) => {
        const g = parseFloat((r.gramos || '').replace(',', '.'));
        return acc + (!isNaN(g) && g > 0 ? g : 0);
      }, 0)
      .toFixed(2)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dark backdrop blur */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Main Glass Modal/Sheet */}
      <div className="relative w-full max-w-lg glass-modal rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 border border-white/10 shadow-2xl z-10 max-h-[92vh] overflow-y-auto">
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1 mb-3 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3.5">
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
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* APARTADO DE INTELIGENCIA ARTIFICIAL */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-zinc-900/90 to-zinc-950 border border-emerald-500/35 space-y-2.5 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Autocompletar con Inteligencia Artificial</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Escribe los detalles de la operación y la Inteligencia Artificial rellenará todos los apartados automáticamente.
                </p>
              </div>
              {voiceTranscript.trim() && !isProcessingVoice && (
                <button
                  type="button"
                  onClick={() => {
                    setVoiceTranscript('');
                    setVoiceStatusMsg(null);
                  }}
                  className="text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="space-y-2">
              <textarea
                rows={3}
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && voiceTranscript.trim()) {
                    e.preventDefault();
                    void processTextWithAi(voiceTranscript);
                  }
                }}
                placeholder="Ej: Venta de 2 Volantes F1 Logitech G29 por 36 euros en Wallapop, en producción, vendedor Jorge..."
                className="w-full bg-black/70 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-500">
                  Pulsa <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px]">Enter</kbd> o el botón para rellenar
                </span>

                <button
                  type="button"
                  disabled={isProcessingVoice || !voiceTranscript.trim()}
                  onClick={() => void processTextWithAi(voiceTranscript)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-black font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  {isProcessingVoice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando con IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 stroke-[2.2]" />
                      <span>Rellenar automáticamente con IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {voiceStatusMsg && (
              <div className="text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{voiceStatusMsg}</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {errorMsg}
            </div>
          )}
          
          {/* Casilla de Venta / Compra */}
          <div>
            <label className="block text-zinc-400 font-medium mb-1.5">
              Casilla de Venta / Compra
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 border border-white/10 rounded-2xl">
              {[
                { id: 'venta', label: 'Venta' },
                { id: 'compra', label: 'Compra (Pedido)' },
                { id: 'inversion', label: 'Inversión / Activo' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const newTipo = t.id as OperationType;
                    setTipo(newTipo);
                    if (newTipo === 'compra' || newTipo === 'inversion') {
                      setEstado('Pagado');
                      setLugarVenta('Internet');
                      setFechaLimiteCustom('');
                    } else if (newTipo === 'venta') {
                      setEstado('En producción');
                      setLugarVenta('Wallapop');
                      setFechaLimiteCustom(calculateDeadlineDate(fecha, 'Wallapop', 'venta'));
                    }
                  }}
                  className={`py-2 px-2 rounded-xl text-[11px] font-medium transition-all text-center cursor-pointer ${
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

          {/* Producto: Desplegable de productos vendidos + campo para escribir/añadir nuevo */}
          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-medium">
              Producto *
            </label>

            {tipo === 'venta' && productCatalog.length > 0 && (
              <select
                value=""
                onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                className="w-full bg-zinc-900/90 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">
                  Seleccionar producto registrado (carga coste y material)...
                </option>
                {productCatalog.map((item) => (
                  <option key={item.producto} value={item.producto}>
                    {item.producto} — Coste base: {formatEuro(item.costeUnitario)}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              required
              value={producto}
              onChange={(e) => {
                setProducto(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={
                tipo === 'compra'
                  ? 'Ej: Pedido filamento PETG negro, Tornillos M4...'
                  : 'Escribe un producto nuevo o selecciona arriba...'
              }
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Fecha & Lugar de Venta */}
          <div className="grid grid-cols-12 gap-2.5 items-start">
            <div className="col-span-6 pr-2.5 sm:pr-0 min-w-0 overflow-hidden">
              <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Fecha</span>
              </label>
              <div className="w-[88%] sm:w-full max-w-[142px] sm:max-w-none overflow-hidden">
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => {
                    const nextFecha = e.target.value;
                    setFecha(nextFecha);
                    if (tipo === 'venta') {
                      setFechaLimiteCustom(calculateDeadlineDate(nextFecha, lugarVenta, tipo));
                    }
                  }}
                  className="block w-full min-w-0 appearance-none box-border bg-zinc-900/90 border border-white/10 rounded-xl px-2 py-2 h-[38px] text-[11px] sm:text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="col-span-6 min-w-0">
              <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Lugar</span>
              </label>
              <select
                value={lugarVenta}
                onChange={(e) => {
                  const nextLugar = e.target.value as Platform;
                  setLugarVenta(nextLugar);
                  if (tipo === 'venta') {
                    setFechaLimiteCustom(calculateDeadlineDate(fecha, nextLugar, tipo));
                  }
                }}
                className="block w-full min-w-0 bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 h-[38px] text-xs text-white focus:outline-none focus:border-emerald-500/50"
              >
                {platformsList.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha límite automática y editable para ventas */}
          {tipo === 'venta' && (
            <div className="bg-amber-950/25 border border-amber-500/25 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-amber-300/90 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Fecha límite envío ({lugarVenta === 'Wallapop' ? '5 días nat.' : lugarVenta === 'Vinted' ? '5 días lab.' : '3 días lab.'}):
                </span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={effectiveFechaLimite}
                  onChange={(e) => setFechaLimiteCustom(e.target.value)}
                  className="bg-zinc-900/90 border border-amber-500/30 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                />
                {effectiveFechaLimite && (
                  <span className="font-mono font-bold text-amber-300 hidden sm:inline">
                    ({formatDateDisplay(effectiveFechaLimite)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Checkbox para pedido de filamento de 1000g en Compras */}
          {tipo === 'compra' && (
            <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-sky-950/25 border border-sky-500/30 cursor-pointer">
              <input
                type="checkbox"
                checked={esPedidoFilamento}
                onChange={(e) => setEsPedidoFilamento(e.target.checked)}
                className="rounded accent-emerald-500 w-4 h-4"
              />
              <span className="text-xs text-sky-200">
                Es pedido de bobina de filamento (+1000g por unidad al stock)
              </span>
            </label>
          )}

          {/* Material / Filamento (1 material sin gramos por defecto, al pulsar + se convierte en lista de Filamento + Gramos) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isMultiMaterialMode
                    ? 'Lista de Materiales (Filamento y Gramos)'
                    : 'Material / Filamento'}
                </span>
              </label>

              <button
                type="button"
                onClick={handleAddMaterialRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/35 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer"
                title="Añadir más filamento y especificar gramos"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isMultiMaterialMode ? 'Añadir otro filamento' : 'Añadir material (+)'}</span>
              </button>
            </div>

            {/* Datalist of stock filaments for autocomplete */}
            <datalist id="stock-filaments-datalist">
              {filamentStock.map((spool) => (
                <option key={spool.nombre} value={spool.nombre}>
                  {formatEuro(spool.precioBobina)} / kg · {spool.gramosRestantes}g disp.
                </option>
              ))}
            </datalist>

            {!isMultiMaterialMode ? (
              /* MODO 1 SOLO MATERIAL: Sin casilla de gramos, con selector rápido + botón + */
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0 flex items-center">
                  <input
                    type="text"
                    list="stock-filaments-datalist"
                    value={materialRows[0]?.material || ''}
                    onChange={(e) => handleChangeMaterialRow(0, 'material', e.target.value)}
                    placeholder="Ej: PETG Negro (Elegoo), ASA Negro (Winkle)..."
                    className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  {filamentStock.length > 0 && (
                    <div
                      className="absolute right-1.5 inset-y-1 w-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                      title="Elegir filamento del stock"
                    >
                      <ChevronDown className="w-3.5 h-3.5 pointer-events-none" />
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleChangeMaterialRow(0, 'material', e.target.value);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Seleccionar filamento del stock"
                      >
                        <option value="">Seleccionar filamento del stock...</option>
                        {filamentStock.map((spool) => (
                          <option key={spool.nombre} value={spool.nombre}>
                            {spool.nombre} ({spool.gramosRestantes}g disp.)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  className="h-[36px] w-[36px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Añadir otro filamento con gramos"
                >
                  <Plus className="w-4 h-4 stroke-[2.8]" />
                </button>
              </div>
            ) : (
              /* MODO LISTA MULTIMATERIAL: Cada fila tiene Filamento + Gramos + botón borrar y se puede seguir dando a + */
              <div className="p-3 rounded-2xl bg-zinc-900/70 border border-emerald-500/30 space-y-2.5">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                  <div className="col-span-7">Filamento</div>
                  <div className="col-span-4">Gramos (g)</div>
                  <div className="col-span-1 text-right"></div>
                </div>

                <div className="space-y-2">
                  {materialRows.map((row, idx) => {
                    const rowGrams = parseFloat((row.gramos || '').replace(',', '.'));
                    const validRowGrams = !isNaN(rowGrams) && rowGrams > 0 ? rowGrams : 0;
                    const rowSpoolPrice = getSpoolPriceForMaterial(row.material);
                    const rowCost = (validRowGrams * rowSpoolPrice) / 1000;

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          {/* Filamento input + quick dropdown */}
                          <div className="col-span-7 relative flex items-center min-w-0">
                            <input
                              type="text"
                              list="stock-filaments-datalist"
                              value={row.material}
                              onChange={(e) =>
                                handleChangeMaterialRow(idx, 'material', e.target.value)
                              }
                              placeholder={`Filamento ${idx + 1}...`}
                              className="w-full bg-black/80 border border-white/15 rounded-xl pl-2.5 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                            />
                            {filamentStock.length > 0 && (
                              <div
                                className="absolute right-1 inset-y-1 w-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                                title="Seleccionar filamento del stock"
                              >
                                <ChevronDown className="w-3.5 h-3.5 pointer-events-none" />
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleChangeMaterialRow(idx, 'material', e.target.value);
                                    }
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  aria-label={`Seleccionar filamento ${idx + 1}`}
                                >
                                  <option value="">Elegir del stock...</option>
                                  {filamentStock.map((spool) => (
                                    <option key={spool.nombre} value={spool.nombre}>
                                      {spool.nombre} ({formatEuro(spool.precioBobina)}/kg)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Gramos input (supports decimals with dot or comma) */}
                          <div className="col-span-4 relative flex items-center min-w-0">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.gramos}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*[.,]?\d*$/.test(val)) {
                                  handleChangeMaterialRow(idx, 'gramos', val);
                                }
                              }}
                              placeholder="0.0"
                              className="w-full bg-black/80 border border-white/15 rounded-xl pl-2.5 pr-6 py-2 text-xs text-emerald-300 font-mono font-bold placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                            />
                            <span className="absolute right-2 text-[11px] font-mono text-zinc-400 pointer-events-none">
                              g
                            </span>
                          </div>

                          {/* Delete row button */}
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRow(idx)}
                              className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                              title={
                                materialRows.length <= 2
                                  ? 'Quitar y volver a 1 material sin gramos'
                                  : 'Quitar este filamento'
                              }
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {row.material.trim() && validRowGrams > 0 && (
                          <div className="flex items-center justify-between px-2 text-[10px] font-mono text-zinc-400">
                            <span>
                              {normalizeFilamentKey(row.material)} ({formatEuro(rowSpoolPrice)}/kg)
                            </span>
                            <span className="text-sky-300">
                              {Number(validRowGrams.toFixed(2))}g = {formatEuro(rowCost)} / ud.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer inside multi-material list: + button & live summary */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleAddMaterialRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Añadir más filamento</span>
                  </button>

                  {totalMultiGramsPerUnit > 0 && (
                    <div className="text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Total: <strong>{totalMultiGramsPerUnit} g</strong>
                        {unidades > 1
                          ? ` × ${unidades} uds = ${Number((totalMultiGramsPerUnit * unidades).toFixed(2))} g`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Financials Row: Precio, Costes, Otros Costes, Nº Unidades */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-0.5">
            {/* Precio */}
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
                onChange={(e) => {
                  setCostesStr(e.target.value);
                  const val = parseEuro(e.target.value);
                  if (unidades > 0) {
                    setCosteUnitario(Number((val / unidades).toFixed(2)));
                  }
                }}
                placeholder="0.00"
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Otros costes (se suman a Costes) */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Otros costes (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={otrosCostesStr}
                onChange={(e) => setOtrosCostesStr(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Nº de Unidades (por defecto 1, multiplica el coste unitario) */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-emerald-400" />
                <span>Unidades</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={unidades}
                onChange={(e) => handleUnitsChange(e.target.value)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Calculated Profit Banner Preview */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400 font-medium block">Beneficio Calculado</span>
              {otrosCostesNum > 0 ? (
                <span className="text-[10px] text-zinc-400 font-mono">
                  Costes {formatEuro(costesBaseNum)} + Otros costes {formatEuro(otrosCostesNum)} = Total {formatEuro(costesNum)}
                </span>
              ) : (
                costeUnitario !== undefined &&
                costeUnitario > 0 &&
                unidades > 1 && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Coste base {formatEuro(costeUnitario)} × {unidades} uds = {formatEuro(costesNum)}
                  </span>
                )
              )}
            </div>
            <span className={`text-base font-bold font-mono ${
              previewBeneficio > 0 ? 'text-emerald-400' : previewBeneficio < 0 ? 'text-rose-400' : 'text-zinc-300'
            }`}>
              {previewBeneficio > 0 ? `+${formatEuro(previewBeneficio)}` : formatEuro(previewBeneficio)}
            </span>
          </div>

          {/* Estado & Vendedor */}
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
              <select
                value={vendedorSelect}
                onChange={(e) => setVendedorSelect(e.target.value)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="Jorge">Jorge</option>
                <option value="Sandra">Sandra</option>
                <option value="Alejandro">Alejandro</option>
                <option value="Jorge, Sandra">Jorge, Sandra</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          {vendedorSelect === 'Otro' && (
            <div>
              <label className="block text-zinc-400 text-[11px] mb-1">Nombre del vendedor</label>
              <input
                type="text"
                value={vendedorCustom}
                onChange={(e) => setVendedorCustom(e.target.value)}
                placeholder="Escribe el nombre del vendedor..."
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          )}

          {previewSandraCommission > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-xs">
              <span className="text-rose-200/90">
                Precio × 0,15 ({effectiveVendedorPreview}) → <strong className="text-rose-300">Gastos en General</strong>:
              </span>
              <span className="font-mono font-bold text-rose-300">
                {formatEuro(previewSandraCommission)}
              </span>
            </div>
          )}

          {/* Adjuntar Foto / Código QR / Etiqueta de Envío enlazada al pedido */}
          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-400" />
                Foto / Código QR o Etiqueta de Envío
              </span>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{fotoQr ? 'Cambiar foto' : 'Subir foto / QR'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>

            {fotoQr && (
              <div className="flex items-center gap-3 pt-1">
                <img
                  src={fotoQr}
                  alt="Vista previa QR"
                  className="w-14 h-14 object-cover rounded-xl border border-white/15 bg-white p-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <label className="block text-[11px] text-zinc-400">Empresa de envío</label>
                  <select
                    value={empresaEnvio}
                    onChange={(e) => setEmpresaEnvio(e.target.value as ShippingCompany)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  >
                    {shippingCompanies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setFotoQr(undefined)}
                  className="p-2 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                  title="Quitar foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
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
              placeholder="Observaciones libres, detalles del comprador, grabados..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Save Action Button */}
          <div className="pt-1">
            <button
              type="submit"
              className="w-full h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
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
