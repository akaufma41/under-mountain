'use client';

import Image from 'next/image';

export default function SirPompSprite() {
  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <div className="relative w-full h-full max-w-[360px] max-h-[360px]">
        <Image
          src="/sir-pomp.png"
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
