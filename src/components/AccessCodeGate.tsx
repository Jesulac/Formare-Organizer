import React, { useState } from 'react';
import { verifyAndAuthorizeDevice } from '../utils/deviceAuth';
import { ShieldCheck, Lock, Unlock, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';

interface AccessCodeGateProps {
  onAuthorized: () => void;
}

export function AccessCodeGate({ onAuthorized }: AccessCodeGateProps) {
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Por favor, introduce el código de acceso.');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Artificial tiny delay for crisp feedback
    setTimeout(() => {
      const success = verifyAndAuthorizeDevice(code);
      if (success) {
        setIsSuccess(true);
        setTimeout(() => {
          onAuthorized();
        }, 700);
      } else {
        setIsSubmitting(false);
        setError('Código de acceso incorrecto. Acceso denegado.');
        triggerShake();
      }
    }, 250);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-zinc-100 p-4 select-none overflow-hidden">
      {/* Living OLED Liquid Glass Ambient Backdrop */}
      <div className="liquid-ambient-stage">
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
        <div className="liquid-prism-mesh" />
      </div>

      <div
        className={`relative z-10 w-full max-w-md glass-modal liquid-shimmer rounded-[2rem] p-6 sm:p-8 shadow-2xl transition-transform duration-200 ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 animate-liquid-float ${
              isSuccess
                ? 'glass-card-pastel text-[#bae6fd] scale-110'
                : 'glass-card text-[#a5d8ff] border-[#93c5fd]/30 shadow-[0_0_28px_-8px_rgba(147,197,253,0.45)]'
            }`}
          >
            {isSuccess ? (
              <Unlock className="w-8 h-8 text-[#bae6fd] animate-pulse" />
            ) : (
              <Lock className="w-8 h-8 text-[#a5d8ff]" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-pill border-[#93c5fd]/30 text-[11px] font-mono font-semibold text-[#bae6fd] mb-2.5 animate-liquid-halo">
            <ShieldCheck className="w-3.5 h-3.5 text-[#93c5fd]" />
            <span>FORMARE 3D SECURE GATE</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Autorizar Dispositivo
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed max-w-xs">
            Introduce la clave de acceso para registrar este dispositivo. Solo tendrás que ingresarla una vez.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Clave de Acceso
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                disabled={isSubmitting || isSuccess}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Introduce el código..."
                className={`w-full liquid-input text-white text-sm rounded-2xl px-4 py-3 pr-11 font-mono tracking-wider transition-all placeholder:text-zinc-600 ${
                  error
                    ? 'border-rose-500/80 ring-2 ring-rose-500/20'
                    : isSuccess
                    ? 'border-[#93c5fd] ring-2 ring-[#93c5fd]/30'
                    : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting || isSuccess}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#bae6fd] transition-colors p-1 cursor-pointer"
                title={showPassword ? 'Ocultar código' : 'Mostrar código'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-950/45 border border-rose-400/40 backdrop-blur-md text-rose-200 text-xs animate-spring-pop">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-2xl glass-card-pastel text-[#e0f2fe] text-xs animate-spring-pop">
              <Sparkles className="w-4 h-4 shrink-0 text-[#bae6fd]" />
              <span>¡Dispositivo autorizado con éxito! Entrando...</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-sm font-bold cursor-pointer liquid-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-[#03152a] border-t-transparent rounded-full animate-spin" />
                Verificando...
              </span>
            ) : isSuccess ? (
              <span>Acceso Concedido</span>
            ) : (
              <span>Desbloquear y Guardar Dispositivo</span>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <p className="text-[11px] text-zinc-400">
            🔒 Dispositivo seguro. Una vez autorizado, no volverá a pedirte la clave en este navegador.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>
    </div>
  );
}
