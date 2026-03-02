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

// Echo prevention — brief delay after audio ends before mic re-enables
const ECHO_DELAY_MS = 300;

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
  return ''; // Let browser pick default
}

export function useVoiceManager(options: VoiceManagerOptions = {}): VoiceManagerState {
  const { isDrowsy = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
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
      historyRef.current = store.history.slice(-10); // 5 turns = 10 messages
    }
    sessionContextRef.current = buildSessionContext(store);
  }, []);

  // Create persistent Audio element on mount — reused for ALL TTS playback.
  // Reusing the same element is critical for iOS: once "unlocked" by a user
  // gesture, subsequent .play() calls on the same element work without a gesture.
  useEffect(() => {
    const el = new Audio();
    el.setAttribute('playsinline', '');
    audioRef.current = el;
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
      console.warn('[TTS] Safety timeout — force-resetting isPlayingAudio');
      setIsPlayingAudio(false);
    }, TTS_TIMEOUT_MS);
  }, [clearTtsTimeout]);

  const markAudioDone = useCallback(() => {
    clearTtsTimeout();
    // Echo prevention: brief delay before enabling mic again
    setTimeout(() => setIsPlayingAudio(false), ECHO_DELAY_MS);
  }, [clearTtsTimeout]);

  // --- TTS playback via pre-unlocked Audio element ---
  // Shows subtitle text at the same moment audio starts playing (no silent gap).
  const playTtsAudio = useCallback(
    async (text: string) => {
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
          markAudioDone();
          return;
        }

        // Clean up previous object URL
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }

        audio.onplay = () => {
          console.log('[TTS] Audio playing');
          setIsPlayingAudio(true);
        };
        audio.onended = () => {
          console.log('[TTS] Audio ended');
          markAudioDone();
          URL.revokeObjectURL(url);
        };
        audio.onerror = (e) => {
          console.warn('[TTS] Audio error:', e);
          setResponseText(text); // Show text even if audio fails
          markAudioDone();
          URL.revokeObjectURL(url);
        };

        // Show text and play audio at the same moment
        audio.src = url;
        setResponseText(text);
        startTtsTimeout();
        await audio.play();
      } catch (err) {
        console.warn('[TTS] Playback failed:', err);
        setResponseText(text); // Show text even if TTS fails entirely
        markAudioDone();
      }
    },
    [markAudioDone, startTtsTimeout]
  );

  // --- Chat API ---
  const sendToChat = useCallback(
    async (transcript: string) => {
      // Safety: Panic detection — check for distress BEFORE hitting LLM
      const distressCheck = checkForDistress(transcript);
      if (distressCheck.isDistress) {
        console.warn('PANIC ALERT:', transcript);
        playTtsAudio(distressCheck.safeResponse!);
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

        // Clear session context after first exchange (one-time greeting)
        sessionContextRef.current = '';

        playTtsAudio(text);
      } catch {
        setIsProcessing(false);
        playTtsAudio("My armor is squeaking! Say that again?");
      }
    },
    [playTtsAudio, isDrowsy]
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
          setIsProcessing(false);
          setError("Sir Pomp didn't catch that! Try speaking a bit louder.");
          return;
        }

        sendToChat(transcript);
      } catch (err) {
        console.error('[STT] Error:', err);
        setIsProcessing(false);
        setError("Sir Pomp can't hear through the mountain! Check your connection.");
      }
    },
    [sendToChat]
  );

  // --- Recording: start / stop ---
  const startListening = useCallback(() => {
    console.log('[BUTTON] Press — isPlayingAudio:', isPlayingAudio, 'isProcessing:', isProcessing);
    if (isPlayingAudio || isProcessing) return;

    setError(null);

    // iOS audio unlock: play silent audio DURING the user gesture.
    // This "warms up" the Audio element so TTS playback works later
    // even though it happens outside a gesture context.
    if (audioRef.current) {
      audioRef.current.src = '/silence.wav';
      audioRef.current.play().catch(() => {
        // Ignore — first-tap unlock attempt, may fail on some browsers
      });
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
          // Release mic
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

          // Ignore very short recordings (accidental taps)
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
  }, [isPlayingAudio, isProcessing, transcribeAudio]);

  const stopListening = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    // Stop stream tracks if still running
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
    error,
    responseText,
    startListening,
    stopListening,
  };
}
