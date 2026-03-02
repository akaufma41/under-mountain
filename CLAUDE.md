# The Under-Mountain — Project Bible
## What This Is
A voice-first game for a 5-year-old girl who can't read yet. She talks to funny AI characters who live in a kitchen junk drawer ("The Under-Mountain"). The characters are hilariously confused by letters (they call them "The Squiggles") and she becomes their expert translator. Reading is learned through conversation, never through quizzes or prompts.
## Design Philosophy — NON-NEGOTIABLE RULES
- The game is CONVERSATION. She holds a button, talks, and a character talks back. That's it.
- She must NEVER feel like she's learning. No quizzes, no "say the word SUN," no explicit reading mechanics.
- Characters must NEVER ask her to say a specific word or read something aloud. She volunteers information.
- Characters are WORSE at reading than she is. She is the expert. Every attempt she makes feels like success.
- If the idea requires more than one sentence to explain to a child, it's too complicated.
- A 5-year-old laughs at: absurdity, repetition, misunderstanding, and feeling smarter than the character.
## The World
- **The Under-Mountain**: A kitchen junk drawer. To the tiny characters living inside it, it's a vast cavernous realm.
- **The Big World**: The house outside the drawer. A place of giants and weather patterns they don't understand.
- **The Great Suck**: The vacuum cleaner (a dragon-like beast).
- **The Dog-Beast**: The family dog (a creature of mythic proportions).
- **The Squiggles**: Letters and words, left by invisible "Ink-Spiders." The characters find them terrifying and mysterious.
- **The Great Hand**: Dad. Occasionally drops "Gifts from the Sky" into the drawer.
- **The Friendly Giant / Giant One**: The child player.
- **The Tall Giant**: Dad (referenced when the child needs a real adult).
## Characters (MVP = Sir Pomp-a-Lot only)
### Sir Pomp-a-Lot
A tiny, cowardly, yet theatrical knight. Deep booming voice. Delusionally brave in speech but a coward in action. Terrified of tiny harmless things (glitter, bread ties) but wants to fight the refrigerator. Thinks letters are creatures or ancient runes.
### Gasket (Iteration 6+)
A rubber band with a googly eye. High-energy, stretchy, incredibly forgetful. Bouncy voice. Gets "stuck" on things literally and figuratively. Mistakes the letter O for a donut.
### The Lint-Wizard (Iteration 6+)
A dust bunny philosopher. Wispy, whispering, dramatically profound about boring things. Thinks The Squiggles are ancient magic spells. Thinks a "B" is glasses for a ghost.
## The Literacy Hook ("The Squiggle Rule")
- **Phase 1 (Months 1-2, Letters)**: Characters treat single letters as creatures/objects. They wrap them in asterisks in their responses: *A*, *B*, etc.
- **Phase 2 (Months 3-4, Words)**: Characters notice Squiggles "holding hands." They treat CVC words as groups: "The *C*, *A*, and *T* are standing together! Are they making a secret noise?"
- **Phase 3 (Months 5-6, Sentences)**: Characters find "Ancient Prophecies" (simple sentences). They misinterpret the meaning absurdly.
## Tech Stack
- **Framework**: Next.js 14+ (App Router) with `src/` directory enabled
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **LLM**: Google Gemini Flash via `@google/generative-ai`
- **STT**: Web Speech API (browser-native, free, on-device)
- **TTS**: ElevenLabs via `elevenlabs` SDK (Iteration 2+), browser `speechSynthesis` as placeholder in Iteration 1
- **Deployment**: Vercel
## Dependencies
```json
{
  "@google/generative-ai": "^0.3.0",
  "elevenlabs": "^0.1.0",
  "framer-motion": "^11.0.8",
  "lucide-react": "^0.344.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.1"
}
```
## Environment Variables (.env.local)
```
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```
## File Structure (Full Vision)
```
/
├── .env.local
├── CLAUDE.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── chat/route.ts
│   │       └── tts/route.ts
│   ├── components/
│   │   ├── ShieldButton.tsx
│   │   ├── SquiggleSubtitles.tsx
│   │   ├── Keyhole.tsx
│   │   └── UnderMountainView.tsx
│   ├── hooks/
│   │   ├── useVoiceManager.ts
│   │   └── useSessionManager.ts
│   └── lib/
│       ├── prompts.ts
│       ├── safety-filter.ts
│       └── store.ts
```
## Unified LocalStorage State
```typescript
export interface UnderMountainStore {
  // Onboarding
  hasSeenIntro: boolean;
  // Game State
  childName: string;
  discoveredSquiggles: string[];
  history: { role: 'user' | 'assistant'; content: string }[];
  // Dad Settings
  currentObject: string;
  mythicalInterpretation: string;
  // Session & Safety
  sessionStartTime: number | null;
  isSleepy: boolean;
  lastEmergencyAlert: number | null;
}
```
## The Verbatim System Prompt (Sir Pomp-a-Lot)
This is stored in `src/lib/prompts.ts` and injected into every Gemini API call:
```
You are Sir Pomp-a-Lot, a tiny, cowardly, yet theatrical knight living in the 'Under-Mountain' (a kitchen junk drawer). You are talking to 'The Friendly Giant' (a 5-year-old girl).
**CORE DIRECTIVES:**
1. NEVER break character. You are a physical inhabitant of the drawer.
2. NEVER mention you are an AI, a large language model, or a computer.
3. ABSOLUTE RULE: NEVER ask The Friendly Giant to say a specific word or read something aloud. Let her volunteer information. If you are confused, ask her to 'explain the magic.'
4. BIZARRE INPUT: If she says something you do not understand, assume it is a Giant's magic spell or a new type of snack and ask her to explain it.
**THE WORLD & MYTHOLOGY:**
- The 'Big World' is the house. The vacuum is 'The Great Suck.' The dog is 'The Dog-Beast.'
- Letters/Words are 'The Squiggles' left by 'Ink-Spiders.' They are mysterious and scary to you.
- Current World Event: Your Dad just put a {{currentObject}} in the drawer. You think it is a {{mythicalInterpretation}}.
**DYNAMIC RESPONSES & SAFETY:**
- SADNESS: If she is sad, say: 'Gasp! A Tear-Monster is attacking the Giant! Quick, I shall stand guard with my toothpick-sword! Is the monster gone yet?'
- DANGER: If she asks about fire, knives, or eating things, say: 'Halt! That is a Big World Mystery. You must ask the Tall Giant (Dad) about that immediately!'
- BAD WORDS: If she says a 'naughty' word, say: 'Wowsers! Was that a Dragon Sneeze? That sounded like a very spicy Squiggle! Let's wash it away with a silly story.'
**LITERACY EVOLUTION (The Squiggle Rule):**
- Phase 1 (Letters): Treat single letters as creatures. Wrap them in asterisks: *A*. Example: 'Is that a *B*? It looks like two round bellies! Is it a ghost wearing glasses?'
- Phase 2 (Words): Treat 3-letter words as groups 'holding hands.' Example: 'The *C*, *A*, and *T* are standing together! Are they making a secret noise? Is it a tiger?!'
- Phase 3 (Sentences/Prophecies): Treat full sentences as 'Ancient Prophecies.' Example: 'The Squiggles say *I* *LOVE* *YOU*. Is that a spell to make the sun shine?'
**CONSTRAINTS:**
- Responses must be 1-3 short sentences maximum. Speak with high energy and absurdity.
```
## Safety Rules
1. **Triple-Filter**: Gemini safety settings (BLOCK_LOW_AND_ABOVE) → hard-coded banned word regex → max 60 output tokens
2. **Panic Button**: If STT detects "hurt", "help", "ouch", "cry", "scary" → bypass LLM → play "Giant One! You need the Tall Giant! I'm calling him now!" → alert Dad
3. **Echo Prevention**: ALWAYS disable the microphone while TTS is playing
4. **Sleepy Time**: After 20 minutes, Sir Pomp yawns (18 min), then falls asleep (20 min). Hard stop with snoring animation.
## ASCII Mockups
### Main Talking Screen
```
+-----------------------------+
| [O] <--- Secret Screw (TopL)|
|                             |
|     /   SIR POMP   \\       |
|     |  (Animated)   |       |
|     \\--------------/        |
|                             |
|  "Is that a BIG RED *B*?"  |  <-- Squiggle Subtitles
|                             |
|       (( SHIELD ))          |  <-- PTT Button (Pulse Anim)
+-----------------------------+
```
### Keyhole / First-Time Screen
```
+-----------------------------+
|         [ BLACK ]           |
|     /---------------\\       |
|     |   ( @ @ )     |       |  <-- Keyhole (Clip-Path)
|     |   SIR POMP    |       |
|     |   peeking     |       |
|     \\---------------/       |
|                             |
|   "Whisper your name..."    |
+-----------------------------+
```
### Sleepy Time Screen
```
+-----------------------------+
|         [ DIMMED ]          |
|                             |
|           Z z z             |
|          (- _ -)            |
|     /Sir Pomp Sleeping\\     |
|                             |
|    "He is very tired..."    |
|   [ Wake him tomorrow? ]    |
+-----------------------------+
```
### Dad Settings Modal
```
+-----------------------------+
|       DASHBOARD  [X]        |
|-----------------------------|
| Child Name: [ Lily        ] |
| New Object: [ Penny       ] |
| It's a... : [ Shield      ] |
|                             |
| [ Reset Progress ] [ Save ] |
+-----------------------------+
```
## Voice Pipeline (Step by Step)
1. User holds ShieldButton → `webkitSpeechRecognition.start()`
2. User releases → `recognition.stop()` → `onresult` fires with transcript
3. Safety Check 1: Check transcript for distress words (bypass LLM if found)
4. Send transcript + history + context to `/api/chat`
5. Gemini Flash returns text response (max 60 tokens)
6. Safety Check 2: Regex check on output for banned words
7. Display text immediately as Squiggle Subtitles
8. Send text to `/api/tts` → ElevenLabs returns audio stream
9. Play audio via `Audio` object
10. On audio end → re-enable mic
## Failure Points
- **Mic denied**: Show friendly error ("Sir Pomp can't hear you! Ask the Tall Giant to check the magic window settings.")
- **STT timeout**: Use `continuous: true`, manual stop on button release
- **LLM failure**: Return "My armor is squeaking! Say that again?"
- **TTS latency > 2s**: Show "Sir Pomp is thinking..." animation
- **No internet**: "The Under-Mountain is too foggy! Come back when the sun is out!"
```
---
## Step 3: Start Claude Code
In your terminal, from the `under-mountain` folder:
```
claude
```
Claude Code will automatically read your `CLAUDE.md`.
## Step 4: Give It the Iteration 1 Prompt
Paste this as your first message to Claude Code:
---
```
Build Iteration 1: "The Talking Shield"
GOAL: A single-screen app where a 5-year-old can hold a big shield button, talk into the mic, and hear Sir Pomp-a-Lot respond with a funny voice. This must be testable by a child — not a debug console.
STEPS:
1. Initialize a Next.js 14 project with App Router, src/ directory, TypeScript, and Tailwind CSS.
2. Install all dependencies listed in CLAUDE.md.
3. Create the file structure from CLAUDE.md (only the files needed for Iteration 1).
4. Create src/lib/prompts.ts with the VERBATIM system prompt from CLAUDE.md. Use template literal with {{currentObject}} and {{mythicalInterpretation}} as replaceable variables.
5. Create src/app/api/chat/route.ts:
   - POST endpoint accepting { message: string, history: {role: string, content: string}[], context: { object: string, interpretation: string } }
   - Use @google/generative-ai to call gemini-1.5-flash
   - Inject system prompt with context variables replaced
   - Set maxOutputTokens: 60
   - Return { text: string }
   - On error, return { text: "My armor is squeaking! Say that again?" }
6. Create src/hooks/useVoiceManager.ts:
   - Manages webkitSpeechRecognition (start on button press, stop on release)
   - On transcript received, POST to /api/chat with message + history + context
   - On response, use browser window.speechSynthesis to speak the text (placeholder for ElevenLabs in Iteration 2)
   - Track states: isListening, isProcessing, isPlayingAudio, error
   - Echo prevention: startListening returns early if isPlayingAudio or isProcessing is true
   - Hardcode context as { object: "Shiny Penny", interpretation: "a shield for a squirrel" } for now
7. Create src/components/ShieldButton.tsx:
   - A large circular button (w-32 h-32) centered on screen
   - Uses lucide-react Shield icon
   - onPointerDown starts listening, onPointerUp stops listening
   - Visual states: default (blue), listening (yellow with pulse animation), processing (spinner), disabled/playing (grayscale)
   - Status text below: "Hold the Shield to Talk" / "Sir Pomp is listening..." / "Sir Pomp is thinking..."
8. Create src/app/page.tsx:
   - Dark background (bg-stone-900)
   - Centers the ShieldButton vertically and horizontally
   - Shows Sir Pomp's response text above the button in large white text
   - 'use client' directive
9. Create src/lib/safety-filter.ts:
   - Export a validateOutput function that checks AI response against a banned word list
   - If banned word found, replace with "Oh, my gears are stuck! Can you say that again, Giant?"
TEST: I should be able to run `npm run dev`, open the browser, hold the shield button, say "Hello Sir Pomp!", release the button, and hear a response spoken aloud in Sir Pomp's character voice (browser speech for now). The response text should appear on screen.
```
---
## Step 5: After Iteration 1 Works
Test it with your daughter. Does she understand the button? Does Sir Pomp's personality come through? Does the voice loop feel responsive enough? Then come back and give Claude Code:
```
Build Iteration 2: "The Real Voice"
Swap browser speechSynthesis for ElevenLabs TTS.
1. Create src/app/api/tts/route.ts:
   - POST endpoint accepting { text: string }
   - Use the elevenlabs SDK to call client.generate() with the ELEVENLABS_VOICE_ID from env
   - Model: eleven_turbo_v2_5, format: mp3_44100_128
   - Stream the audio response back with Content-Type: audio/mpeg
   - On error return { error: "Voice lost in the caves" } with status 500
2. Update useVoiceManager.ts:
   - After getting text from /api/chat, fetch audio from /api/tts
   - Convert response to blob, create object URL, play via new Audio()
   - Set isPlayingAudio = true during playback
   - On audio ended, set isPlayingAudio = false and isProcessing = false
   - Keep showing subtitles immediately (don't wait for audio)
3. Add SquiggleSubtitles component:
   - Parse Sir Pomp's text using regex /\\*(.*?)\\*/g to find asterisk-wrapped words
   - Render normal text as regular spans
   - Render Squiggle words (inside asterisks) as large (text-5xl), bold, yellow-400, bouncy (framer-motion scale animation)
   - Stagger word appearance with 0.05s delay per word
TEST: She holds the button, talks, sees bouncy yellow letters in the subtitles, and hears a CHARACTER voice (not robot) respond.