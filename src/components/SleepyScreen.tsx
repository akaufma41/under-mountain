'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SirPompSprite from '@/components/SirPompSprite';

export default function SleepyScreen() {
  const [showBubble, setShowBubble] = useState(false);

  const handleTap = () => {
    setShowBubble(true);
    setTimeout(() => setShowBubble(false), 2500);
  };

  return (
    <main
      className="h-dvh bg-stone-950 flex flex-col items-center justify-center px-6 cursor-pointer select-none"
      onClick={handleTap}
    >
      {/* Floating Z's */}
      <div className="relative mb-4 h-12 w-20">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute text-stone-600 font-bold"
            style={{ fontSize: `${28 - i * 6}px`, left: `${i * 20}px` }}
            animate={{
              y: [-10 - i * 15, -50 - i * 15],
              opacity: [0.8, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 2.5,
              delay: i * 0.6,
              ease: 'easeOut',
            }}
          >
            Z
          </motion.span>
        ))}
      </div>

      {/* Sleeping Sir Pomp */}
      <div className="w-[200px] h-[200px] mb-6">
        <SirPompSprite mood="sleeping" />
      </div>

      {/* Speech bubble on tap */}
      <AnimatePresence>
        {showBubble && (
          <motion.p
            className="text-stone-400 text-lg italic mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            &ldquo;Zzz... no more Squiggles... zzz...&rdquo;
          </motion.p>
        )}
      </AnimatePresence>

      {/* Status text */}
      <p className="text-stone-500 text-lg text-center">
        Sir Pomp is sleeping... come back tomorrow!
      </p>
    </main>
  );
}
