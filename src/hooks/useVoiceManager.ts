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
  micReady: boolean;
  error: string | null;
  responseText: string;
  startListening: () => void;
  stopListening: () => void;
}

// Safety timeout — if audio never ends, force-reset
const TTS_TIMEOUT_MS = 10_000;

// Fetch timeout — abort if API takes too long
const FETCH_TIMEOUT_MS = 20_000;

// Helper: fetch with timeout
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Pick best supported recording format
function getRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// Convert a Blob to a base64 string (data URI prefix stripped)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Use onload (not onloadend) — onloadend fires on BOTH success and error,
    // which would cause a TypeError on reader.result when it's null after failure.
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceManager(options: VoiceManagerOptions = {}): VoiceManagerState {
  const { isDrowsy = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const historyRef = useRef<ChatMessage[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionContextRef = useRef<string>('');
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Generation counter — invalidates pending getUserMedia when user releases early
  const listenGenRef = useRef(0);

  // Master processing timeout — dead man's switch if everything else fails
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted history and build session context on mount
  useEffect(() => {
    const store = getStore();
    if (store.history && store.history.length > 0) {
      historyRef.current = store.history.slice(-10);
    }
    sessionContextRef.current = buildSessionContext(store);
  }, []);

  // Create persistent Audio element on mount
  useEffect(() => {
    const el = new Audio();
    el.setAttribute('playsinline', '');
    audioRef.current = el;
  }, []);

  // Request mic permission immediately on mount — gets the browser prompt
  // out of the way before the child tries to use the shield
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Permission granted — stop the stream immediately, we just needed the prompt
        stream.getTracks().forEach((t) => t.stop());
        setMicReady(true);
        console.log('[MIC] Permission granted');
      })
      .catch((err) => {
        console.error('[MIC] Permission denied on mount:', err);
        setError("Sir Pomp can't hear you! Ask the Tall Giant to check the magic window settings.");
      });
  }, []);

  // --- Timeout helpers ---
  const clearTtsTimeout = useCallback(() => {
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }
  }, []);

  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  const startTtsTimeout = useCallback(() => {
    clearTtsTimeout();
    ttsTimeoutRef.current = setTimeout(() => {
      console.warn('[TTS] Safety timeout — force-resetting state');
      setIsPlayingAudio(false);
      setIsProcessing(false);
    }, TTS_TIMEOUT_MS);
  }, [clearTtsTimeout]);

  // Master timeout — if the entire pipeline (audio→chat→TTS→playback)
  // takes longer than this, force-reset everything.
  const MASTER_TIMEOUT_MS = 45_000;

  const startProcessingTimeout = useCallback(() => {
    clearProcessingTimeout();
    processingTimeoutRef.current = setTimeout(() => {
      console.warn('[VOICE] Master safety timeout — force-resetting all state');
      clearTtsTimeout();
      setIsPlayingAudio(false);
      setIsProcessing(false);
    }, MASTER_TIMEOUT_MS);
  }, [clearProcessingTimeout, clearTtsTimeout]);

  // Reset ALL blocking state — called when audio ends or on any failure
  const resetPlaybackState = useCallback(() => {
    clearTtsTimeout();
    clearProcessingTimeout();
    setIsPlayingAudio(false);
    setIsProcessing(false);
  }, [clearTtsTimeout, clearProcessingTimeout]);

  // --- TTS playback via pre-unlocked Audio element ---
  const playTtsAudio = useCallback(
    async (text: string) => {
      // isProcessing stays true through TTS — no gap where button is active
      let objectUrl: string | null = null;
      try {
        console.log('[TTS] Fetching audio for:', text.slice(0, 50));
        const res = await fetchWithTimeout('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        const audio = audioRef.current;
        if (!audio) {
          URL.revokeObjectURL(objectUrl);
          setResponseText(text);
          resetPlaybackState();
          return;
        }

        // Clean up previous object URL
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }

        const currentUrl = objectUrl;
        audio.onplay = () => {
          console.log('[TTS] Audio playing');
          // Transition: processing → playing
          setIsProcessing(false);
          setIsPlayingAudio(true);
        };
        audio.onended = () => {
          console.log('[TTS] Audio ended');
          URL.revokeObjectURL(currentUrl);
          resetPlaybackState();
        };
        audio.onerror = (e) => {
          console.warn('[TTS] Audio error:', e);
          URL.revokeObjectURL(currentUrl);
          setResponseText(text);
          resetPlaybackState();
        };

        // Show text and play audio at the same moment
        audio.src = objectUrl;
        setResponseText(text);
        startTtsTimeout();
        await audio.play();
      } catch (err) {
        console.warn('[TTS] Playback failed:', err);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setResponseText(text);
        resetPlaybackState();
      }
    },
    [resetPlaybackState, startTtsTimeout]
  );

  // --- Combined STT + Chat: send audio directly to /api/chat ---
  const processRecording = useCallback(
    async (audioBlob: Blob) => {
      console.log('[PROCESS] Sending audio for combined STT+Chat:', {
        size: audioBlob.size,
        type: audioBlob.type,
      });
      setIsProcessing(true);
      startProcessingTimeout();

      try {
        // Convert blob to base64
        const audioBase64 = await blobToBase64(audioBlob);
        const audioMimeType = audioBlob.type || 'audio/webm';

        const store = getStore();

        const requestBody = {
          audioBase64,
          audioMimeType,
          history: historyRef.current,
          context: {
            object: store.currentObject || 'Shiny Penny',
            interpretation: store.mythicalInterpretation || 'a shield for a squirrel',
            childName: store.childName || '',
            sessionContext: sessionContextRef.current,
          },
          isDrowsy,
        };

        console.log('[PROCESS] Sending to /api/chat:', {
          audioSize: audioBase64.length,
          mimeType: audioMimeType,
          historyLength: requestBody.history.length,
        });

        const res = await fetchWithTimeout('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(requestBody),
        });

        const data = await res.json();
        const text = data.text || "My armor is squeaking! Say that again?";
        const transcript = (data.transcript || '').trim();

        console.log('[PROCESS] Heard:', transcript);
        console.log('[PROCESS] Reply:', text);

        // If no transcript was heard, reset and show error
        if (!transcript) {
          resetPlaybackState();
          setError("Sir Pomp didn't catch that! Try speaking a bit louder.");
          return;
        }

        // Distress check on what the child said
        const distressCheck = checkForDistress(transcript);
        if (distressCheck.isDistress) {
          console.warn('PANIC ALERT:', transcript);
          // Don't add to history — a lone user entry with no assistant reply
          // would create consecutive user messages on the next Gemini call,
          // violating the alternating-role requirement and causing an API error.
          playTtsAudio(distressCheck.safeResponse!);
          return;
        }

        // Update history with both sides of the conversation
        historyRef.current = [
          ...historyRef.current,
          { role: 'user', content: transcript },
          { role: 'assistant', content: text },
        ];

        if (historyRef.current.length > 20) {
          historyRef.current = historyRef.current.slice(-20);
        }

        setStore({
          history: historyRef.current.slice(-10),
          lastActive: Date.now(),
        });

        // Clear session context after first successful exchange
        sessionContextRef.current = '';

        // isProcessing stays true → playTtsAudio → onplay sets isPlayingAudio
        playTtsAudio(text);
      } catch (err) {
        console.error('[PROCESS] Error:', err);
        // Don't reset state — keep isProcessing true so the button stays
        // disabled while the fallback TTS plays.
        playTtsAudio("My armor is squeaking! Say that again?");
      }
    },
    [playTtsAudio, isDrowsy, resetPlaybackState, startProcessingTimeout]
  );

  // --- Recording: start / stop ---
  const startListening = useCallback(() => {
    console.log('[BUTTON] Press — isPlayingAudio:', isPlayingAudio, 'isProcessing:', isProcessing, 'micReady:', micReady);
    if (isPlayingAudio || isProcessing) return;

    setError(null);

    // Generation counter — if stopListening runs before getUserMedia resolves,
    // it increments listenGenRef, and the stale .then() callback sees a mismatch
    // and aborts instead of creating a zombie recorder.
    const gen = ++listenGenRef.current;

    // iOS audio unlock: play silent audio DURING the user gesture
    if (audioRef.current) {
      audioRef.current.src = '/silence.wav';
      audioRef.current.play().catch(() => {});
    }

    // Request mic and start recording
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // If user already released (or pressed again), this request is stale — abort
        if (gen !== listenGenRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        audioChunksRef.current = [];

        const mimeType = getRecorderMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;

          const chunks = audioChunksRef.current;
          if (chunks.length === 0) return;

          const blob = new Blob(chunks, {
            type: recorder.mimeType || 'audio/webm',
          });
          console.log('[REC] Recording complete:', {
            size: blob.size,
            type: blob.type,
          });

          if (blob.size < 1000) {
            console.log('[REC] Recording too short, ignoring');
            return;
          }

          processRecording(blob);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsListening(true);
        console.log('[REC] Recording started, mimeType:', recorder.mimeType);
      })
      .catch((err) => {
        console.error('[REC] Mic access denied:', err);
        setError(
          "Sir Pomp can't hear you! Ask the Tall Giant to check the magic window settings."
        );
      });
  }, [isPlayingAudio, isProcessing, micReady, processRecording]);

  const stopListening = useCallback(() => {
    // Invalidate any pending getUserMedia that hasn't resolved yet
    listenGenRef.current++;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    isProcessing,
    isPlayingAudio,
    micReady,
    error,
    responseText,
    startListening,
    stopListening,
  };
}
