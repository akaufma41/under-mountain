'use client';

import { Shield, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface ShieldButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  isPlayingAudio: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
}

export default function ShieldButton({
  isListening,
  isProcessing,
  isPlayingAudio,
  onPointerDown,
  onPointerUp,
}: ShieldButtonProps) {
  const disabled = isProcessing || isPlayingAudio;

  const statusText = isListening
    ? 'Sir Pomp is listening...'
    : isProcessing
      ? 'Sir Pomp is thinking...'
      : isPlayingAudio
        ? 'Sir Pomp is speaking...'
        : 'Hold to Talk';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onPointerDown={disabled ? undefined : onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className={clsx(
          'w-28 h-28 rounded-full flex items-center justify-center transition-all duration-200 select-none touch-none',
          {
            'bg-blue-600 hover:bg-blue-500 active:scale-95': !isListening && !isProcessing && !isPlayingAudio,
            'bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50': isListening,
            'bg-stone-500 cursor-wait': isProcessing,
            'bg-stone-600 opacity-60 cursor-not-allowed': isPlayingAudio,
          }
        )}
        aria-label={statusText}
      >
        {isProcessing ? (
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        ) : (
          <Shield
            className={clsx('w-12 h-12', {
              'text-white': !isPlayingAudio,
              'text-stone-400': isPlayingAudio,
            })}
          />
        )}
      </button>
      <p className="text-stone-500 text-sm font-medium select-none">
        {statusText}
      </p>
    </div>
  );
}
