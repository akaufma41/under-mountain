'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface SirPompSpriteProps {
  isTalking?: boolean;
}

const MOUTH_TOGGLE_MS = 150;

export default function SirPompSprite({ isTalking = false }: SirPompSpriteProps) {
  const [mouthOpen, setMouthOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isTalking) {
      intervalRef.current = setInterval(() => {
        setMouthOpen((prev) => !prev);
      }, MOUTH_TOGGLE_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setMouthOpen(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTalking]);

  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <div className="relative w-full h-full max-w-[360px] max-h-[360px]">
        <Image
          src={mouthOpen ? '/sir-pomp-talk.png' : '/sir-pomp.png'}
          alt="Sir Pomp-a-Lot"
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
