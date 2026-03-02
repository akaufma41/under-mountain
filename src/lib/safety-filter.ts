// --- Output Filter ---

const BANNED_WORDS = [
  // Violence
  'kill', 'die', 'dead', 'death', 'blood', 'murder', 'weapon', 'gun', 'shoot', 'bomb', 'stab',
  // Profanity
  'hell', 'damn', 'ass', 'crap', 'shit', 'fuck', 'bitch', 'bastard',
  // Insults
  'stupid', 'idiot', 'dumb', 'shut up', 'hate',
  // Adult content
  'sex', 'naked', 'porn',
  // Substances
  'drug', 'alcohol', 'beer', 'wine',
  // Scary (real scary, not in-character "Tear-Monster" style)
  'scary', 'monster',
];

// Words that are OK in Sir Pomp's world (don't false-positive on these)
const ALLOWED_COMPOUNDS = ['tear-monster', 'dog-beast'];

const SAFE_FALLBACK = "Oh, my gears are stuck! Can you say that again, Giant?";
const MAX_OUTPUT_LENGTH = 200;

export function validateOutput(text: string): string {
  // Check for banned words FIRST — before truncation, so long text can't bypass
  const lower = text.toLowerCase();
  const cleanedLower = ALLOWED_COMPOUNDS.reduce(
    (str, compound) => str.replaceAll(compound, ''),
    lower
  );

  for (const word of BANNED_WORDS) {
    if (cleanedLower.includes(word)) {
      return SAFE_FALLBACK;
    }
  }

  // Truncate monologues
  if (text.length > MAX_OUTPUT_LENGTH) {
    const truncated = text.slice(0, MAX_OUTPUT_LENGTH);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclaim = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    const cutPoint = Math.max(lastPeriod, lastExclaim, lastQuestion);
    if (cutPoint > 0) {
      return truncated.slice(0, cutPoint + 1);
    }
    return truncated + '...';
  }

  return text;
}

// --- Panic Detection (checks user's speech, not AI output) ---

const DISTRESS_WORDS = [
  'hurt', 'help me', 'ouch', 'owie', 'scared', 'scary',
  'bleeding', 'blood', 'cry', 'crying',
];

const DISTRESS_RESPONSE =
  "Giant One! You sound like you need the Tall Giant! I am calling him with my Magic Horn right now! Hang on!";

export function checkForDistress(transcript: string): { isDistress: boolean; safeResponse?: string } {
  const lower = transcript.toLowerCase();
  if (DISTRESS_WORDS.some((word) => lower.includes(word))) {
    return { isDistress: true, safeResponse: DISTRESS_RESPONSE };
  }
  return { isDistress: false };
}
