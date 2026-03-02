'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, animate } from 'framer-motion';
import { setStore } from '@/lib/store';

interface KeyholeProps {
  onComplete: () => void;
}

const INTRO_LINE =
  "WHO GOES THERE?! Oh... it's a GIANT! A friendly one! I am Sir Pomp-a-Lot, knight of the Under-Mountain!";

// Get a good voice — waits for voices to load if needed
function pickVoice(): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const pick =
        voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
        voices.find((v) => v.lang.startsWith('en'));
      resolve(pick || null);
      return;
    }
    // Voices not loaded yet — wait for the event
    window.speechSynthesis.onvoiceschanged = () => {
      const loaded = window.speechSynthesis.getVoices();
      const pick =
        loaded.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
        loaded.find((v) => v.lang.startsWith('en'));
      resolve(pick || null);
    };
    // Safety timeout — don't wait forever
    setTimeout(() => resolve(null), 2000);
  });
}

export default function Keyhole({ onComplete }: KeyholeProps) {
  const [revealed, setRevealed] = useState(false);
  const [clipRadius, setClipRadius] = useState(40);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const hasTriggeredRef = useRef(false);

  // Speak intro — try ElevenLabs, fall back to browser speech with proper voice
  const speakIntro = useCallback(async () => {
    // Try ElevenLabs first
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: INTRO_LINE }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          onComplete();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          onComplete();
        };
        await audio.play();
        return;
      }
    } catch {
      // Fall through to browser speech
    }

    // Browser speech fallback — wait for voices to load
    if (!window.speechSynthesis) {
      setTimeout(onComplete, 500);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(INTRO_LINE);
    utterance.rate = 0.95;
    utterance.pitch = 0.7;
    utterance.volume = 1.0;

    const voice = await pickVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => onComplete();
    utterance.onerror = () => onComplete();
    window.speechSynthesis.speak(utterance);
  }, [onComplete]);

  const triggerReveal = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    // Stop listening
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setRevealed(true);

    // Animate clip-path radius from 40px to fill entire screen
    const maxRadius = Math.max(window.innerWidth, window.innerHeight) * 1.5;
    animate(40, maxRadius, {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: (value) => setClipRadius(value),
      onComplete: () => {
        // Mark intro as seen
        setStore({ hasSeenIntro: true });

        // Speak Sir Pomp's introduction via ElevenLabs (or browser fallback)
        speakIntro();
      },
    });
  }, [speakIntro]);

  // Start passive speech recognition on mount
  useEffect(() => {
    const SpeechRecognition =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = () => {
      triggerReveal();
    };

    recognition.onerror = () => {
      // Allow tap fallback
    };

    recognition.onend = () => {
      if (!hasTriggeredRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started or unavailable
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // Speech recognition unavailable
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [triggerReveal]);

  // The "content behind the keyhole" — dark stone background that gets revealed
  // The black overlay has a circular hole punched in it via clip-path on this inner layer
  return (
    <div
      className="fixed inset-0 z-50 cursor-pointer"
      onClick={triggerReveal}
    >
      {/* The content visible through the keyhole (stone-900 bg like the main app) */}
      <div
        className="absolute inset-0 bg-stone-900 flex flex-col items-center justify-center"
        style={{
          clipPath: `circle(${clipRadius}px at 50% 45%)`,
        }}
      >
        {/* Sir Pomp's eye peeking through */}
        <motion.span
          className="text-5xl select-none"
          animate={{ rotate: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          👁️
        </motion.span>
      </div>

      {/* The black surrounding area (visible when circle is small) */}
      <div
        className="absolute inset-0 bg-black pointer-events-none"
        style={{
          // This black layer disappears as the circle grows to cover it
          clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`,
          // We mask out the circle area using a radial-gradient mask
          WebkitMaskImage: `radial-gradient(circle ${clipRadius}px at 50% 45%, transparent ${clipRadius}px, black ${clipRadius}px)`,
          maskImage: `radial-gradient(circle ${clipRadius}px at 50% 45%, transparent ${clipRadius}px, black ${clipRadius}px)`,
        }}
      />

      {/* "Whisper your name..." prompt — sits on top of the black area */}
      {!revealed && (
        <motion.p
          className="absolute left-1/2 -translate-x-1/2 text-stone-600 text-lg select-none pointer-events-none"
          style={{ top: '65%' }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        >
          Whisper your name...
        </motion.p>
      )}
    </div>
  );
}
