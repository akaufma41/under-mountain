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

  // --- TTS timeout helpers ---
  const clearTtsTimeout = useCallback(() => {
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
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

  // Reset ALL blocking state — called when audio ends or on any failure
  const resetPlaybackState = useCallback(() => {
    clearTtsTimeout();
    setIsPlayingAudio(false);
    setIsProcessing(false);
  }, [clearTtsTimeout]);

  // --- TTS playback via pre-unlocked Audio element ---
  const playTtsAudio = useCallback(
    async (text: string) => {
      // isProcessing stays true through TTS — no gap where button is active
      try {
        console.log('[TTS] Fetching audio for:', text.slice(0, 50));
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const audio = audioRef.current;
        if (!audio) {
          setResponseText(text);
          resetPlaybackState();
          return;
        }

        // Clean up previous object URL
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }

        audio.onplay = () => {
          console.log('[TTS] Audio playing');
          // Transition: processing → playing
          setIsProcessing(false);
          setIsPlayingAudio(true);
        };
        audio.onended = () => {
          console.log('[TTS] Audio ended');
          URL.revokeObjectURL(url);
          resetPlaybackState();
        };
        audio.onerror = (e) => {
          console.warn('[TTS] Audio error:', e);
          URL.revokeObjectURL(url);
          setResponseText(text);
          resetPlaybackState();
        };

        // Show text and play audio at the same moment
        audio.src = url;
        setResponseText(text);
        startTtsTimeout();
        await audio.play();
      } catch (err) {
        console.warn('[TTS] Playback failed:', err);
        setResponseText(text);
        resetPlaybackState();
      }
    },
    [resetPlaybackState, startTtsTimeout]
  );

  // --- Chat API ---
  const sendToChat = useCallback(
    async (transcript: string) => {
      const distressCheck = checkForDistress(transcript);
      if (distressCheck.isDistress) {
        console.warn('PANIC ALERT:', transcript);
        playTtsAudio(distressCheck.safeResponse!);
        return;
      }

      // isProcessing is already true (set in transcribeAudio) — keep it true

      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: transcript },
      ];

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

        // Do NOT reset isProcessing here — keep it true through TTS phase
        // so the button stays disabled the entire time

        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant', content: text },
        ];

        if (historyRef.current.length > 20) {
          historyRef.current = historyRef.current.slice(-20);
        }

        setStore({
          history: historyRef.current.slice(-10),
          lastActive: Date.now(),
        });

        sessionContextRef.current = '';

        // isProcessing stays true → playTtsAudio → onplay sets isPlayingAudio
        playTtsAudio(text);
      } catch {
        resetPlaybackState();
        playTtsAudio("My armor is squeaking! Say that again?");
      }
    },
    [playTtsAudio, resetPlaybackState, isDrowsy]
  );

  // --- Server-side STT via Gemini ---
  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      console.log('[STT] Sending audio for transcription:', {
        size: audioBlob.size,
        type: audioBlob.type,
      });
      setIsProcessing(true);

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording');

        const res = await fetch('/api/stt', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        const transcript = (data.transcript || '').trim();
        console.log('[STT] Transcript:', transcript);

        if (!transcript) {
          resetPlaybackState();
          setError("Sir Pomp didn't catch that! Try speaking a bit louder.");
          return;
        }

        sendToChat(transcript);
      } catch (err) {
        console.error('[STT] Error:', err);
        resetPlaybackState();
        setError("Sir Pomp can't hear through the mountain! Check your connection.");
      }
    },
    [sendToChat, resetPlaybackState]
  );

  // --- Recording: start / stop ---
  const startListening = useCallback(() => {
    console.log('[BUTTON] Press — isPlayingAudio:', isPlayingAudio, 'isProcessing:', isProcessing, 'micReady:', micReady);
    if (isPlayingAudio || isProcessing) return;

    setError(null);

    // iOS audio unlock: play silent audio DURING the user gesture
    if (audioRef.current) {
      audioRef.current.src = '/silence.wav';
      audioRef.current.play().catch(() => {});
    }

    // Request mic and start recording
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
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

          transcribeAudio(blob);
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
  }, [isPlayingAudio, isProcessing, micReady, transcribeAudio]);

  const stopListening = useCallback(() => {
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
