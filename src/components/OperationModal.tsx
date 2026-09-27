import React, { useState, useEffect, useRef } from 'react';
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
  Mic,
  Square,
  Sparkles,
  Loader2
} from 'lucide-react';
import { 
  Operation, 
  OperationType, 
  Platform, 
  Status,
  ProductCatalogItem,
  ShippingCompany
} from '../types/operation';
import { 
  calculateBeneficio, 
  calculateDeadlineDate,
  compressImageFile,
  formatDateDisplay,
  formatDateInput, 
  formatEuro, 
  normalizeStatus,
  parseEuro 
} from '../utils/calculations';
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
  'Cobrado',
  'Pagado',
  'Pendiente de pago',
  'En producción',
  'Pendiente de cobro',
  'Enviado',
  'Cancelado',
  'Otro',
];

const shippingCompanies: ShippingCompany[] = ['Correos', 'InPost', 'Seur', 'Otro'];

const KNOWN_SELLERS = ['Jorge', 'Sandra', 'Alejandro', 'Jorge, Sandra'];

function downsampleTo16kHzPcm16Base64(
  chunks: Float32Array[],
  inputSampleRate: number
): string {
  let totalLength = 0;
  for (const c of chunks) {
    totalLength += c.length;
  }
  if (totalLength === 0) return '';

  const merged = new Float32Array(totalLength);
  let mergeOffset = 0;
  for (const c of chunks) {
    merged.set(c, mergeOffset);
    mergeOffset += c.length;
  }

  const targetRate = 16000;
  const ratio = inputSampleRate > 0 ? inputSampleRate / targetRate : 1;
  const outputLength = Math.max(1, Math.floor(totalLength / ratio));
  const pcm16 = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = Math.min(totalLength - 1, Math.floor(i * ratio));
    const s = Math.max(-1, Math.min(1, merged[srcIdx]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

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
}) => {
  const isEditing = Boolean(operationToEdit);

  const [tipo, setTipo] = useState<OperationType>('venta');
  const [producto, setProducto] = useState('');
  const [unidades, setUnidades] = useState<number>(1);
  const [costeUnitario, setCosteUnitario] = useState<number | undefined>(undefined);
  const [fecha, setFecha] = useState(formatDateInput(new Date().toISOString()));
  const [fechaLimiteCustom, setFechaLimiteCustom] = useState<string>('');
  const [material, setMaterial] = useState('');
  const [precioStr, setPrecioStr] = useState('');
  const [costesStr, setCostesStr] = useState('');
  const [lugarVenta, setLugarVenta] = useState<Platform>('Wallapop');
  const [estado, setEstado] = useState<Status>('Cobrado');
  const [vendedorSelect, setVendedorSelect] = useState<string>('Jorge');
  const [vendedorCustom, setVendedorCustom] = useState<string>('');
  const [comentarios, setComentarios] = useState('');
  const [fotoQr, setFotoQr] = useState<string | undefined>(undefined);
  const [empresaEnvio, setEmpresaEnvio] = useState<ShippingCompany>('Correos');
  const [esPedidoFilamento, setEsPedidoFilamento] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voice AI Dictation States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sampleRateRef = useRef<number>(16000);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTranscriptRef = useRef<string>('');

  const cleanupVoiceResources = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
      speechRecognitionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      scriptProcessorRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        // Ignore close error
      }
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    setConfirmingDelete(false);
    setErrorMsg(null);
    setVoiceStatusMsg(null);
    setVoiceTranscript('');
    liveTranscriptRef.current = '';
    cleanupVoiceResources();

    const defaultToday = formatDateInput(new Date().toISOString());

    if (operationToEdit) {
      const editTipo = operationToEdit.tipo || 'venta';
      const editFecha = formatDateInput(operationToEdit.fecha);
      const editLugar = operationToEdit.lugarVenta || 'Wallapop';
      setTipo(editTipo);
      setProducto(operationToEdit.producto || '');
      const uds = operationToEdit.unidades && operationToEdit.unidades > 0 ? operationToEdit.unidades : 1;
      setUnidades(uds);
      setCosteUnitario(
        operationToEdit.costeUnitario ??
          (operationToEdit.costes ? Number((operationToEdit.costes / uds).toFixed(2)) : undefined)
      );
      setFecha(editFecha);
      setFechaLimiteCustom(
        editTipo === 'venta'
          ? operationToEdit.fechaLimite || calculateDeadlineDate(editFecha, editLugar, editTipo)
          : ''
      );
      setMaterial(operationToEdit.material || '');
      setPrecioStr(operationToEdit.precio !== null ? String(operationToEdit.precio) : '');
      setCostesStr(operationToEdit.costes ? String(operationToEdit.costes) : '');
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
      setPrecioStr(initialData.precio !== null && initialData.precio !== undefined ? String(initialData.precio) : '');
      setCostesStr(initialData.costes ? String(initialData.costes) : '');
      setLugarVenta(initLugar);
      setEstado(normalizeStatus(initialData.estado || 'Cobrado'));
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
      setPrecioStr('');
      setCostesStr('');
      setLugarVenta('Wallapop');
      setEstado('Cobrado');
      setVendedorSelect('Jorge');
      setVendedorCustom('');
      setComentarios('');
      setFotoQr(undefined);
      setEmpresaEnvio('Correos');
      setEsPedidoFilamento(false);
    }

    return () => {
      cleanupVoiceResources();
    };
  }, [operationToEdit, initialData, isOpen]);

  if (!isOpen) return null;

  const precioNum = precioStr !== '' ? parseEuro(precioStr) : null;
  const costesNum = parseEuro(costesStr);
  const autoFechaLimite = calculateDeadlineDate(fecha, lugarVenta, tipo);
  const effectiveFechaLimite = tipo === 'venta' ? (fechaLimiteCustom || autoFechaLimite) : '';
  const previewBeneficio = calculateBeneficio(precioNum, costesNum, 0, tipo);

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
      setMaterial(data.material.trim());
    } else if (matchedCatalogItem?.material) {
      setMaterial(matchedCatalogItem.material);
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
      setEstado(aiTipo === 'venta' ? 'Cobrado' : 'Pagado');
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
      'Todos los apartados se han rellenado con Gemini 3 Flash Live.'
    );
  };

  const processVoiceWithGemini = async (pcmBase64?: string | null, textFallback?: string) => {
    setIsProcessingVoice(true);
    setErrorMsg(null);
    setVoiceStatusMsg('Conectando con Gemini 3 Flash Live y rellenando campos...');

    const transcriptToUse = (textFallback ?? liveTranscriptRef.current ?? voiceTranscript).trim();
    const todayDate = formatDateInput(new Date().toISOString());

    try {
      const audioBase64 = pcmBase64 || '';
      const mimeType = 'audio/pcm;rate=16000';

      if (!audioBase64 && !transcriptToUse) {
        setErrorMsg('No se detectó voz. Habla cerca del micrófono o escribe el dictado.');
        setVoiceStatusMsg(null);
        setIsProcessingVoice(false);
        return;
      }

      const res = await fetch('/api/ai/voice-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: audioBase64 || undefined,
          mimeType,
          transcriptText: transcriptToUse,
          productCatalog,
          todayDate,
        }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result || !result.ok) {
        if (transcriptToUse) {
          const fallbackData = parseVoiceOperationSmartFallback(
            transcriptToUse,
            productCatalog,
            todayDate
          );
          applyExtractedAiData(fallbackData);
          return;
        }
        throw new Error(
          result?.error || 'No se pudo escuchar el audio con claridad. Habla más cerca del micrófono o escribe el dictado.'
        );
      }

      applyExtractedAiData(result.data);
    } catch (err: any) {
      console.warn('Fallback local tras error de red/API en dictado por voz:', err);
      if (transcriptToUse) {
        const fallbackData = parseVoiceOperationSmartFallback(
          transcriptToUse,
          productCatalog,
          todayDate
        );
        applyExtractedAiData(fallbackData);
      } else {
        const rawMsg = String(err?.message || '');
        const cleanMsg =
          rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.startsWith('{')
            ? 'Gemini 3 Flash Live tiene alta demanda puntual. Vuelve a pulsar Dictar por Voz o escribe el dictado.'
            : rawMsg || 'Error al procesar el dictado por voz con Gemini 3 Flash Live.';
        setErrorMsg(cleanMsg);
        setVoiceStatusMsg(null);
      }
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleStartVoiceRecording = async () => {
    setErrorMsg(null);
    setVoiceStatusMsg(null);
    liveTranscriptRef.current = '';
    setVoiceTranscript('');
    pcmChunksRef.current = [];
    setRecordingSeconds(0);

    // Parallel Web Speech API for live visual transcript preview while speaking
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'es-ES';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
          }
          const clean = transcript.trim();
          if (clean) {
            liveTranscriptRef.current = clean;
            setVoiceTranscript(clean);
          }
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch {
        // Ignore if browser blocks Web Speech API; 16kHz PCM audio capture handles it
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      sampleRateRef.current = audioCtx.sampleRate || 16000;
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRecording(true);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access error:', err);
      cleanupVoiceResources();
      setErrorMsg(
        'No se pudo acceder al micrófono. Permite el acceso al micrófono en tu navegador o escribe el dictado en el cuadro de voz.'
      );
    }
  };

  const handleStopVoiceRecording = () => {
    const capturedPcmBase64 = downsampleTo16kHzPcm16Base64(
      pcmChunksRef.current,
      sampleRateRef.current
    );
    const capturedTranscript = liveTranscriptRef.current;
    cleanupVoiceResources();
    void processVoiceWithGemini(capturedPcmBase64, capturedTranscript);
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
      if (found.material) {
        setMaterial(found.material);
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
        ? Number((costesNum / unidades).toFixed(2))
        : costesNum;

    const payload: Omit<Operation, 'id' | 'createdAt' | 'beneficio'> = {
      tipo,
      producto: producto.trim(),
      unidades: unidades || 1,
      costeUnitario: unitCostFinal,
      fecha,
      material: material.trim() || undefined,
      precio: tipo === 'compra' || tipo === 'inversion' ? null : precioNum,
      costes: costesNum,
      costesOperativos: 0,
      lugarVenta,
      estado,
      vendedor: finalVendedor,
      comentarios: comentarios.trim() || undefined,
      fechaLimite: tipo === 'venta' ? effectiveFechaLimite : '',
      fotoQr,
      empresaEnvio: fotoQr ? empresaEnvio : undefined,
      fechaSubidaQr: fotoQr ? operationToEdit?.fechaSubidaQr || Date.now() : undefined,
      esPedidoFilamento:
        tipo === 'compra' &&
        (esPedidoFilamento ||
          producto.toLowerCase().includes('filamento') ||
          /(pla|petg|asa|tpu)/i.test(material)),
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
          {/* APARTADO DE VOZ CON IA (Gemini) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-zinc-900/90 to-zinc-950 border border-emerald-500/35 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Autocompletar por Voz con IA</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                  Modelo: <span className="font-mono text-emerald-300/90">Gemini 3 Flash Live</span> (<span className="font-mono text-emerald-300/90">gemini-3.1-flash-live-preview</span>). Di por ejemplo:{' '}
                  <em className="text-zinc-300">
                    &laquo;Venta de Volante F1 Logitech por 18 euros en Wallapop, en producción, vendedor Jorge&raquo;
                  </em>
                </p>
              </div>

              {isRecording ? (
                <button
                  type="button"
                  onClick={handleStopVoiceRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-500/30 animate-pulse cursor-pointer shrink-0"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Parar ({recordingSeconds}s)</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isProcessingVoice}
                  onClick={handleStartVoiceRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  {isProcessingVoice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 stroke-[2.5]" />
                      <span>Dictar por Voz</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Live transcript or manual voice text fallback */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={voiceTranscript}
                onChange={(e) => {
                  setVoiceTranscript(e.target.value);
                  liveTranscriptRef.current = e.target.value;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && voiceTranscript.trim()) {
                    e.preventDefault();
                    void processVoiceWithGemini(null, voiceTranscript);
                  }
                }}
                placeholder={
                  isRecording
                    ? 'Escuchando tu voz... habla ahora y pulsa Parar al terminar'
                    : 'Transcripción de voz o escribe aquí qué operación quieres rellenar...'
                }
                className="flex-1 min-w-0 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
              {voiceTranscript.trim() && !isRecording && (
                <button
                  type="button"
                  disabled={isProcessingVoice}
                  onClick={() => void processVoiceWithGemini(null, voiceTranscript)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  Rellenar con IA
                </button>
              )}
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
                      setEstado('Cobrado');
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

          {/* Material empleado */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-zinc-400" />
              Material
            </label>
            <input
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Ej: PETG negro (Elegoo), ASA negro (Winkle), PLA negro..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Financials Row: Precio, Costes, Nº Unidades */}
          <div className="grid grid-cols-3 gap-2.5 pt-0.5">
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
              {costeUnitario !== undefined && costeUnitario > 0 && unidades > 1 && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  Coste base {formatEuro(costeUnitario)} × {unidades} uds = {formatEuro(costesNum)}
                </span>
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
