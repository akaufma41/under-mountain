'use client';

import { useMemo } from 'react';
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

/**
 * Per-mood framer-motion animation variants.
 */
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

export default function SirPompSprite({ mood }: SirPompSpriteProps) {
  // Build image src with fallback chain
  const src = useMemo(() => MOOD_IMAGES[mood] ?? FALLBACK, [mood]);
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
            onError={(e) => {
              // If mood image missing, swap to fallback
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== FALLBACK && !img.src.endsWith(FALLBACK)) {
                img.src = FALLBACK;
              }
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
