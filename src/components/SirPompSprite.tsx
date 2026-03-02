'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

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

  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <div className="relative w-full h-full max-w-[360px] max-h-[360px] transition-opacity duration-300">
        <Image
          src={src}
          alt={`Sir Pomp-a-Lot is ${mood}`}
          fill
          sizes="360px"
          className="object-contain"
          priority
          unoptimized
        />
      </div>
    </div>
  );
}
