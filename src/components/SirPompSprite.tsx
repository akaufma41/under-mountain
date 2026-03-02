'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, type TargetAndTransition, type Transition } from 'framer-motion';

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

const moodAnimations: Record<SpriteMood, { animate: TargetAndTransition; transition: Transition }> = {
  idle: {
    animate: { scale: [1, 1.02, 1] },
    transition: { scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } },
  },
  excited: {
    animate: { scale: [1, 1.06, 1], y: [0, -4, 0] },
    transition: {
      scale: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
      y: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  thinking: {
    animate: { rotate: [-2, 2, -2] },
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

// Cache which mood images exist
const imageExists: Record<string, boolean> = {};

function useResolvedSrc(mood: SpriteMood): string {
  const [src, setSrc] = useState(FALLBACK);

  useEffect(() => {
    const target = MOOD_IMAGES[mood];
    if (imageExists[target] === false) { setSrc(FALLBACK); return; }
    if (imageExists[target] === true) { setSrc(target); return; }

    const img = new window.Image();
    img.onload = () => { imageExists[target] = true; setSrc(target); };
    img.onerror = () => { imageExists[target] = false; setSrc(FALLBACK); };
    img.src = target;
  }, [mood]);

  return src;
}

export default function SirPompSprite({ mood }: SirPompSpriteProps) {
  const src = useResolvedSrc(mood);
  const anim = moodAnimations[mood] ?? moodAnimations.idle;

  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <motion.div
        animate={anim.animate}
        transition={anim.transition}
        className="relative w-full h-full max-w-[360px] max-h-[360px]"
      >
        <Image
          src={src}
          alt={`Sir Pomp-a-Lot is ${mood}`}
          fill
          sizes="360px"
          className="object-contain"
          priority
          unoptimized
        />
      </motion.div>
    </div>
  );
}
