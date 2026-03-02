/**
 * Mood detection for Sir Pomp-a-Lot.
 *
 * SpriteMood drives the avatar image & animation.
 * PompState is the app-level voice pipeline state.
 */

import type { SpriteMood } from '@/components/SirPompSprite';

// App-level states (used by page.tsx to derive mood)
export type PompState = 'idle' | 'listening' | 'processing' | 'speaking';

// Scary words that trigger the 3-second scared reaction
const SCARY_WORDS = [
  'spider', 'ghost', 'monster', 'dragon', 'dark', 'scary',
  'skeleton', 'witch', 'zombie', 'giant', 'demon', 'beast',
  'scream', 'afraid', 'terrif', 'fright', 'creep', 'spook',
];

/**
 * Check if response text contains scary words.
 */
export function hasScaryWords(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SCARY_WORDS.some((word) => lower.includes(word));
}

/**
 * Derive the sprite mood from the app state.
 * The `scared` override is handled in page.tsx via a timer.
 */
export function stateToMood(state: PompState): SpriteMood {
  switch (state) {
    case 'listening':  return 'excited';
    case 'processing': return 'thinking';
    case 'speaking':   return 'idle';
    default:           return 'idle';
  }
}
