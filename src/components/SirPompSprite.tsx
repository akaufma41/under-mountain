'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export type SpriteMood = 'idle' | 'excited' | 'thinking' | 'sleeping' | 'scared';

interface SirPompSpriteProps {
  mood: SpriteMood;
}

const MOOD_IMAGES: Record<SpriteMood, string> = {
  idle: '/sir-pomp-idle.png',
  excited: '/sir-pomp-excited.png',
  thinking: '/sir-pomp-thinking.png',
  sleeping: '/sir-pomp-sleeping.png',
  scared: '/sir-pomp-scared.png',
};

const FALLBACK = '/sir-pomp.png';

const moodAnimations: Record<SpriteMood, { animate: object; transition: object }> = {
  idle: {
    animate: { scale: [1, 1.02, 1], rotate: 0 },
    transition: { scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } },
  },
  excited: {
    animate: { scale: [1, 1.08, 1], y: [0, -6, 0] },
    transition: {
      scale: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
      y: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  thinking: {
    animate: { rotate: [-2, 2, -2], scale: 1 },
    transition: { rotate: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } },
  },
  sleeping: {
    animate: { scale: [1, 1.01, 1], y: [0, 2, 0] },
    transition: {
      scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
      y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  scared: {
    animate: { x: [-2, 2, -2, 2, 0], scale: 0.95 },
    transition: { x: { duration: 0.3, repeat: Infinity, ease: 'linear' } },
  },
};

// Check which mood images actually exist (cached after first probe)
const imageExists: Record<string, boolean> = {};

function useResolvedSrc(mood: SpriteMood): string {
  const [src, setSrc] = useState(FALLBACK);

  useEffect(() => {
    const target = MOOD_IMAGES[mood];
    // Already know it doesn't exist
    if (imageExists[target] === false) {
      setSrc(FALLBACK);
      return;
    }
    // Already know it exists
    if (imageExists[target] === true) {
      setSrc(target);
      return;
    }
    // Probe with a raw img element (bypasses next/image optimizer)
    const img = new window.Image();
    img.onload = () => {
      imageExists[target] = true;
      setSrc(target);
    };
    img.onerror = () => {
      imageExists[target] = false;
      setSrc(FALLBACK);
    };
    img.src = target;
  }, [mood]);

  return src;
}

export default function SirPompSprite({ mood }: SirPompSpriteProps) {
  const src = useResolvedSrc(mood);
  const anim = moodAnimations[mood] ?? moodAnimations.idle;

  return (
    <div className="flex items-center justify-center w-full h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={mood}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, ...anim.animate }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            opacity: { duration: 0.25 },
            ...anim.transition,
          }}
          className="relative w-[200px] h-[200px]"
        >
          <Image
            src={src}
            alt={`Sir Pomp-a-Lot is ${mood}`}
            fill
            sizes="200px"
            className="object-contain"
            priority
            unoptimized
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
