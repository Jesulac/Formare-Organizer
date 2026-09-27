import React from 'react';
import { Status } from '../types/operation';

interface StatusPillProps {
  status: Status;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  onClick,
  interactive = false,
}) => {
  let styleClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50';

  switch (status) {
    case 'Cobrado✅':
      styleClasses = 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30';
      break;
    case 'Pagado⭕':
      styleClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-600/40';
      break;
    case 'Pendiente de cobro':
      styleClasses = 'bg-amber-950/60 text-amber-300 border-amber-500/30';
      break;
    case 'Enviado📦':
      styleClasses = 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30';
      break;
    case 'En producción':
      styleClasses = 'bg-sky-950/60 text-sky-300 border-sky-500/30';
      break;
    case 'Cancelado':
      styleClasses = 'bg-rose-950/60 text-rose-300 border-rose-500/30';
      break;
    default:
      styleClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50';
      break;
  }

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-sm transition-all whitespace-nowrap ${styleClasses} ${
        interactive ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      }`}
    >
      <span>{status}</span>
    </span>
  );
};
