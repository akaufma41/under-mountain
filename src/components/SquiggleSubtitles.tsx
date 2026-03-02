'use client';

import { motion } from 'framer-motion';

interface SquiggleSubtitlesProps {
  text: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export default function SquiggleSubtitles({ text }: SquiggleSubtitlesProps) {
  if (!text) return null;

  // Split text into segments: normal text and *squiggle* text
  const segments = text.split(/(\*[^*]+\*)/g).filter(Boolean);

  return (
    <motion.div
      className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 max-w-md"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {segments.map((segment, i) => {
        const isSquiggle = /^\*.*\*$/.test(segment);

        if (isSquiggle) {
          const letter = segment.replace(/\*/g, '');
          return (
            <motion.span
              key={i}
              variants={wordVariants}
              className="text-5xl font-bold text-yellow-400 inline-block"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              {letter}
            </motion.span>
          );
        }

        // Render normal text words individually for stagger effect
        const words = segment.split(/\s+/).filter(Boolean);
        return words.map((word, j) => (
          <motion.span
            key={`${i}-${j}`}
            variants={wordVariants}
            className="text-2xl text-white font-serif"
          >
            {word}
          </motion.span>
        ));
      })}
    </motion.div>
  );
}
