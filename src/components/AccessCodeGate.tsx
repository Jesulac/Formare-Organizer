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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 select-none">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      <div
        className={`relative w-full max-w-md bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl transition-transform duration-200 ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/20 scale-105'
                : 'bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 shadow-inner'
            }`}
          >
            {isSuccess ? (
              <Unlock className="w-8 h-8 text-emerald-400 animate-pulse" />
            ) : (
              <Lock className="w-8 h-8 text-zinc-300" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-mono font-medium text-emerald-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
                className={`w-full bg-zinc-950/80 border text-white text-sm rounded-xl px-4 py-3 pr-11 font-mono tracking-wider focus:outline-none transition-all placeholder:text-zinc-600 ${
                  error
                    ? 'border-red-500/80 ring-2 ring-red-500/20'
                    : isSuccess
                    ? 'border-emerald-500/80 ring-2 ring-emerald-500/20'
                    : 'border-zinc-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting || isSuccess}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
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
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs animate-in fade-in">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>¡Dispositivo autorizado con éxito! Entrando...</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all shadow-lg cursor-pointer ${
              isSuccess
                ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
        <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center">
          <p className="text-[11px] text-zinc-500">
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
