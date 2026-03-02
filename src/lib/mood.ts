/**
 * Mood detection for Sir Pomp-a-Lot.
 * Currently unused — kept for future mood/animation work.
 */

// Scary words that trigger reactions
const SCARY_WORDS = [
  'spider', 'ghost', 'monster', 'dragon', 'dark', 'scary',
  'skeleton', 'witch', 'zombie', 'giant', 'demon', 'beast',
  'scream', 'afraid', 'terrif', 'fright', 'creep', 'spook',
];

export function hasScaryWords(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SCARY_WORDS.some((word) => lower.includes(word));
}
