import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { buildSystemPrompt } from '@/lib/prompts';
import { validateOutput } from '@/lib/safety-filter';

// Force dynamic — never cache this route
export const dynamic = 'force-dynamic';

const FALLBACK = "My armor is squeaking! Say that again?";

const DROWSY_ADDENDUM =
  'You are getting very sleepy. Yawn between sentences. Tell The Friendly Giant that your armor is getting heavy and you need to nap soon. Keep responses to 1 sentence.';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message?: string;
      audioBase64?: string;
      audioMimeType?: string;
      history: { role: string; content: string }[];
      context: { object: string; interpretation: string; childName?: string; sessionContext?: string };
      isDrowsy?: boolean;
    };

    const { message, audioBase64, audioMimeType, history, context, isDrowsy } = body;

    console.log('[CHAT API] Received:', {
      hasAudio: !!audioBase64,
      audioSize: audioBase64?.length,
      message: message?.slice(0, 50),
      historyLength: history.length,
      isDrowsy,
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json({ text: FALLBACK });
    }

    // Build system prompt
    let systemPrompt = buildSystemPrompt(
      context.object || 'Shiny Penny',
      context.interpretation || 'a shield for a squirrel',
      context.childName || undefined
    );

    if (context.sessionContext) {
      systemPrompt += `\n\n**SESSION CONTEXT:**\n${context.sessionContext}`;
    }

    if (isDrowsy) {
      systemPrompt += `\n\n**SLEEPY MODE:** ${DROWSY_ADDENDUM}`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // --- Audio path: combined STT + Chat in one call ---
    if (audioBase64 && audioMimeType) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        // No safety settings — system prompt mentions "fire, knives, naughty" which
        // triggers aggressive filters. We use our own safety layer instead.
        generationConfig: {
          maxOutputTokens: 1024,
        },
      });

      // Bake system prompt + conversation history into a single text part.
      // Must use FLAT ARRAY format — generateContent([part, part]) — not the
      // structured multi-turn { contents: [{role, parts}] } format, because
      // the multi-turn format does not process audio inlineData correctly.
      let textPrompt = systemPrompt;

      if (history.length > 0) {
        textPrompt += '\n\n**Previous conversation:**';
        for (const msg of history) {
          const speaker = msg.role === 'assistant' ? 'Sir Pomp-a-Lot' : 'The Friendly Giant';
          textPrompt += `\n${speaker}: ${msg.content}`;
        }
      }

      textPrompt += '\n\nNow listen to the audio from The Friendly Giant. On the first line write HEARD: followed by what she said. On the second line write REPLY: followed by your in-character response.\nExample:\nHEARD: hello sir pomp\nREPLY: Hark! The Giant speaks! Did you bring any cheese?';

      // Flat array of parts — same format as the working STT endpoint
      const result = await model.generateContent([
        { inlineData: { mimeType: audioMimeType, data: audioBase64 } },
        { text: textPrompt },
      ]);

      const response = result.response;

      // Check if response was blocked
      if (!response.candidates || response.candidates.length === 0) {
        const blockReason = response.promptFeedback?.blockReason || 'unknown';
        console.error('[CHAT API] Response blocked:', blockReason);
        return NextResponse.json(
          { text: FALLBACK, transcript: '', error: `blocked: ${blockReason}` },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
        );
      }

      const rawText = response.text();
      console.log('[CHAT API] Audio response raw:', rawText);

      let heard = '';
      let reply = '';

      // Parse HEARD:/REPLY: format
      const heardMatch = rawText.match(/HEARD:\s*(.*)/i);
      const replyMatch = rawText.match(/REPLY:\s*([\s\S]*)/i);

      if (heardMatch) heard = heardMatch[1].trim();
      if (replyMatch) reply = replyMatch[1].trim();

      // If REPLY parsing failed, use the whole response as the reply
      if (!reply) {
        reply = rawText.trim() || FALLBACK;
      }

      console.log('[CHAT API] Heard:', heard);
      console.log('[CHAT API] Reply:', reply);

      const safeText = validateOutput(reply);

      return NextResponse.json(
        { text: safeText, transcript: heard },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    // Build chat history for Gemini (text path only)
    const chatHistory = history.map((msg) => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: msg.content }],
    }));

    // --- Text path: backward compatibility ---
    if (message) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: 1024,
        },
      });

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: `System: ${systemPrompt}` }] },
          { role: 'model', parts: [{ text: 'Hark! Sir Pomp-a-Lot reporting for duty! What news from the Big World, Giant One?' }] },
          ...chatHistory,
        ],
      });

      const result = await chat.sendMessage(message);
      const text = result.response.text();
      console.log('[CHAT API] Text response:', text);

      const safeText = validateOutput(text);

      return NextResponse.json(
        { text: safeText },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    return NextResponse.json({ text: FALLBACK });
  } catch (error: unknown) {
    const err = error as Error & { status?: number; statusText?: string; message?: string };
    const errMsg = err?.message || String(error);
    console.error('[CHAT API] ERROR:', errMsg);

    if (errMsg.includes('429') || errMsg.includes('quota')) {
      return NextResponse.json({ text: "Sir Pomp is catching his breath! Too many adventures today. Try again in a minute!", transcript: '' });
    }

    // Surface error details so client can log them for debugging
    return NextResponse.json({ text: FALLBACK, transcript: '', error: errMsg });
  }
}
