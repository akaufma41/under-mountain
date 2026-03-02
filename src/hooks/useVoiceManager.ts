'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { checkForDistress } from '@/lib/safety-filter';
import { getStore, setStore } from '@/lib/store';
import { buildSessionContext } from '@/lib/prompts';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceManagerOptions {
  isDrowsy?: boolean;
}

interface VoiceManagerState {
  isListening: boolean;
  isProcessing: boolean;
  isPlayingAudio: boolean;
  error: string | null;
  responseText: string;
  startListening: () => void;
  stopListening: () => void;
}

// Safety timeout — if TTS events never fire, force-reset isPlayingAudio
const TTS_TIMEOUT_MS = 15_000;

export function useVoiceManager(options: VoiceManagerOptions = {}): VoiceManagerState {
  const { isDrowsy = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const historyRef = useRef<ChatMessage[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionContextRef = useRef<string>('');
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted history and build session context on mount
  useEffect(() => {
    const store = getStore();

    // Restore last 5 turns from persisted history
    if (store.history && store.history.length > 0) {
      historyRef.current = store.history.slice(-10); // 5 turns = 10 messages
    }

    // Build session context (Wednesday Morning experience)
    sessionContextRef.current = buildSessionContext(store);
  }, []);

  // Clear TTS safety timeout
  const clearTtsTimeout = useCallback(() => {
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }
  }, []);

  // Start TTS safety timeout — force-resets isPlayingAudio if events never fire
  const startTtsTimeout = useCallback(() => {
    clearTtsTimeout();
    ttsTimeoutRef.current = setTimeout(() => {
      console.warn('[TTS] Safety timeout — force-resetting isPlayingAudio');
      setIsPlayingAudio(false);
    }, TTS_TIMEOUT_MS);
  }, [clearTtsTimeout]);

  // Mark audio done — clear timeout and reset state
  const markAudioDone = useCallback(() => {
    clearTtsTimeout();
    setIsPlayingAudio(false);
  }, [clearTtsTimeout]);

  // Cached voice ref — resolved once, reused
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voiceLoadedRef = useRef(false);

  // Eagerly load voices on mount
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0 && !voiceLoadedRef.current) {
        voiceLoadedRef.current = true;
        voiceRef.current =
          voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          null;
      }
    };

    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }, []);

  // Browser speechSynthesis fallback
  const speakWithBrowser = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.7;
    utterance.volume = 1.0;

    if (voiceRef.current) utterance.voice = voiceRef.current;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => markAudioDone();
    utterance.onerror = () => markAudioDone();

    startTtsTimeout();
    window.speechSynthesis.speak(utterance);
  }, [markAudioDone, startTtsTimeout]);

  // ElevenLabs TTS with browser fallback
  const speakWithElevenLabs = useCallback(
    async (text: string) => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error('TTS request failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (audioRef.current) {
          audioRef.current.pause();
          if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
        }

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => setIsPlayingAudio(true);
        audio.onended = () => {
          markAudioDone();
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          speakWithBrowser(text);
        };

        startTtsTimeout();
        await audio.play();
      } catch {
        speakWithBrowser(text);
      }
    },
    [speakWithBrowser, markAudioDone, startTtsTimeout]
  );

  const sendToChat = useCallback(
    async (transcript: string) => {
      // Safety: Panic detection — check for distress BEFORE hitting LLM
      const distressCheck = checkForDistress(transcript);
      if (distressCheck.isDistress) {
        console.warn('PANIC ALERT:', transcript);
        const response = distressCheck.safeResponse!;
        setResponseText(response);
        speakWithElevenLabs(response);
        return;
      }

      setIsProcessing(true);

      // Add user message to history
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: transcript },
      ];

      // Read current store for context
      const store = getStore();

      const requestBody = {
        message: transcript,
        history: historyRef.current.slice(0, -1),
        context: {
          object: store.currentObject || 'Shiny Penny',
          interpretation: store.mythicalInterpretation || 'a shield for a squirrel',
          childName: store.childName || '',
          sessionContext: sessionContextRef.current,
        },
        isDrowsy,
      };

      console.log('[CHAT] Sending to API:', {
        message: requestBody.message,
        historyLength: requestBody.history.length,
        history: requestBody.history,
      });

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(requestBody),
        });

        const data = await res.json();
        const text = data.text || "My armor is squeaking! Say that again?";
        console.log('[CHAT] Response:', text);

        // *** FIX: Reset isProcessing IMMEDIATELY after API response ***
        // TTS playback is guarded separately by isPlayingAudio
        setIsProcessing(false);

        // Add assistant response to history
        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant', content: text },
        ];

        if (historyRef.current.length > 20) {
          historyRef.current = historyRef.current.slice(-20);
        }

        // Persist last 5 turns (10 messages) and update lastActive
        setStore({
          history: historyRef.current.slice(-10),
          lastActive: Date.now(),
        });

        // Clear session context after first exchange (it's a one-time greeting)
        sessionContextRef.current = '';

        setResponseText(text);
        speakWithElevenLabs(text);
      } catch {
        setIsProcessing(false); // Always reset on error too
        const fallback = "My armor is squeaking! Say that again?";
        setResponseText(fallback);
        speakWithElevenLabs(fallback);
      }
    },
    [speakWithElevenLabs, isDrowsy]
  );

  const startListening = useCallback(() => {
    console.log('[BUTTON] Press — isPlayingAudio:', isPlayingAudio, 'isProcessing:', isProcessing);
    if (isPlayingAudio || isProcessing) return;

    setError(null);

    const SpeechRecognition =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognition) {
      setError("Sir Pomp can't hear you! Ask the Tall Giant to check the magic window settings.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        const transcript = last[0].transcript.trim();
        console.log('[STT] Transcript captured:', transcript);
        if (transcript) sendToChat(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        setError("Sir Pomp can't hear you! Ask the Tall Giant to check the magic window settings.");
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      console.log('[STT] Recognition started');
    } catch {
      setError("Sir Pomp can't hear you! Ask the Tall Giant to check the magic window settings.");
    }
  }, [isPlayingAudio, isProcessing, sendToChat]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    isProcessing,
    isPlayingAudio,
    error,
    responseText,
    startListening,
    stopListening,
  };
}
