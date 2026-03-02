'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ShieldButton from '@/components/ShieldButton';
import SquiggleSubtitles from '@/components/SquiggleSubtitles';
import SirPompSprite from '@/components/SirPompSprite';
import type { SpriteMood } from '@/components/SirPompSprite';
import Keyhole from '@/components/Keyhole';
import SleepyScreen from '@/components/SleepyScreen';
import DadDashboard from '@/components/DadDashboard';
import { useVoiceManager } from '@/hooks/useVoiceManager';
import { useSessionManager } from '@/hooks/useSessionManager';
import { getStore, setStore } from '@/lib/store';
import { type PompState, stateToMood, hasScaryWords } from '@/lib/mood';

export default function Home() {
  const [showKeyhole, setShowKeyhole] = useState<boolean | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isScared, setIsScared] = useState(false);
  const scaredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isDrowsy, isSleepy, resetSession } = useSessionManager();

  const {
    isListening,
    isProcessing,
    isPlayingAudio,
    error,
    responseText,
    startListening,
    stopListening,
  } = useVoiceManager({ isDrowsy });

  // Derive Sir Pomp's app-level state
  const pompState: PompState = useMemo(() => {
    if (isListening) return 'listening';
    if (isProcessing) return 'processing';
    if (isPlayingAudio) return 'speaking';
    return 'idle';
  }, [isListening, isProcessing, isPlayingAudio]);

  // Check for scary words in new responses → 3s scared override
  const prevResponseRef = useRef('');
  useEffect(() => {
    if (responseText && responseText !== prevResponseRef.current) {
      prevResponseRef.current = responseText;
      if (hasScaryWords(responseText)) {
        setIsScared(true);
        if (scaredTimer.current) clearTimeout(scaredTimer.current);
        scaredTimer.current = setTimeout(() => setIsScared(false), 3000);
      }
    }
  }, [responseText]);

  // Cleanup scared timer
  useEffect(() => {
    return () => {
      if (scaredTimer.current) clearTimeout(scaredTimer.current);
    };
  }, []);

  // Final mood: scared override > state-based mood
  const spriteMood: SpriteMood = isScared ? 'scared' : stateToMood(pompState);

  // Secret Screw — 3-second long press
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrewDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowDashboard(true);
    }, 3000);
  }, []);

  const handleScrewUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Skip keyhole for now — go straight to main screen
  useEffect(() => {
    const store = getStore();
    if (!store.hasSeenIntro) {
      setStore({ hasSeenIntro: true });
    }
    setShowKeyhole(false);
  }, []);

  // Loading state — wait for localStorage check
  if (showKeyhole === null) {
    return <main className="h-dvh bg-black" />;
  }

  // First-time experience
  if (showKeyhole) {
    return <Keyhole onComplete={() => setShowKeyhole(false)} />;
  }

  // Sleepy time — session expired
  if (isSleepy) {
    return <SleepyScreen />;
  }

  // Main talking screen — mobile-first vertical layout
  return (
    <main className="h-dvh bg-stone-900 flex flex-col justify-between relative overflow-hidden">
      {/* Secret Screw — invisible 3s long-press trigger */}
      <div
        className="absolute top-0 left-0 w-12 h-12 z-40"
        onPointerDown={handleScrewDown}
        onPointerUp={handleScrewUp}
        onPointerCancel={handleScrewUp}
        onPointerLeave={handleScrewUp}
        aria-hidden="true"
      />

      {/* Label */}
      <div className="pt-4 flex justify-center">
        <p className="text-stone-500 text-xs font-medium tracking-widest uppercase select-none">
          The Under-Mountain
        </p>
      </div>

      {/* Sir Pomp Sprite — centered in the upper area */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <SirPompSprite mood={spriteMood} />
      </div>

      {/* Squiggle Subtitles — middle area */}
      <div className="px-4 py-2 flex items-center justify-center min-h-[60px]">
        <div className="bg-stone-800/60 backdrop-blur-sm rounded-xl px-4 py-2 min-h-[48px] flex items-center justify-center">
          <SquiggleSubtitles text={responseText} />
        </div>
      </div>

      {/* Shield button — bottom area, lifted above browser controls */}
      <div
        className="py-4 flex justify-center"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
      >
        <ShieldButton
          isListening={isListening}
          isProcessing={isProcessing}
          isPlayingAudio={isPlayingAudio}
          onPointerDown={startListening}
          onPointerUp={stopListening}
        />
      </div>

      {/* Error display */}
      {error && (
        <p className="absolute bottom-36 left-1/2 -translate-x-1/2 text-red-400 text-sm text-center max-w-xs z-10">
          {error}
        </p>
      )}

      {/* Dad Dashboard modal */}
      {showDashboard && (
        <DadDashboard
          onClose={() => setShowDashboard(false)}
          onResetSleep={resetSession}
        />
      )}
    </main>
  );
}
