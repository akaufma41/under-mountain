'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getStore, setStore } from '@/lib/store';

const DROWSY_MINUTES = 18;
const SLEEPY_MINUTES = 20;
const CHECK_INTERVAL_MS = 30_000; // 30 seconds

interface SessionManagerState {
  isDrowsy: boolean;
  isSleepy: boolean;
  minutesRemaining: number;
  resetSession: () => void;
}

export function useSessionManager(): SessionManagerState {
  const [isDrowsy, setIsDrowsy] = useState(false);
  const [isSleepy, setIsSleepy] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(SLEEPY_MINUTES);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSession = useCallback(() => {
    const store = getStore();

    // Already sleepy from a previous session
    if (store.isSleepy) {
      setIsSleepy(true);
      setIsDrowsy(true);
      setMinutesRemaining(0);
      return;
    }

    // Initialize session start time if not set
    if (!store.sessionStartTime) {
      setStore({ sessionStartTime: Date.now() });
      return;
    }

    const elapsed = (Date.now() - store.sessionStartTime) / 1000 / 60; // minutes
    const remaining = Math.max(0, SLEEPY_MINUTES - elapsed);
    setMinutesRemaining(Math.round(remaining));

    if (elapsed >= SLEEPY_MINUTES) {
      setIsSleepy(true);
      setIsDrowsy(true);
      setStore({ isSleepy: true });
    } else if (elapsed >= DROWSY_MINUTES) {
      setIsDrowsy(true);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkSession();

    // Periodic check
    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkSession]);

  const resetSession = useCallback(() => {
    setStore({ sessionStartTime: null, isSleepy: false });
    setIsDrowsy(false);
    setIsSleepy(false);
    setMinutesRemaining(SLEEPY_MINUTES);
  }, []);

  return { isDrowsy, isSleepy, minutesRemaining, resetSession };
}
