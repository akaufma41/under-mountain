import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType } from '@google/generative-ai';
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

    // Build chat history for Gemini
    const chatHistory = history.map((msg) => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: msg.content }],
    }));

    const genAI = new GoogleGenerativeAI(apiKey);

    // --- Audio path: combined STT + Chat in one call ---
    if (audioBase64 && audioMimeType) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              heard: {
                type: SchemaType.STRING,
                description: 'Brief transcript of what the child said',
              },
              reply: {
                type: SchemaType.STRING,
                description: 'Your in-character response as Sir Pomp-a-Lot',
              },
            },
            required: ['heard', 'reply'],
          },
        },
      });

      const contents = [
        { role: 'user' as const, parts: [{ text: `System: ${systemPrompt}` }] },
        { role: 'model' as const, parts: [{ text: 'Hark! Sir Pomp-a-Lot reporting for duty! What news from the Big World, Giant One?' }] },
        ...chatHistory,
        {
          role: 'user' as const,
          parts: [
            { inlineData: { mimeType: audioMimeType, data: audioBase64 } },
          ],
        },
      ];

      const result = await model.generateContent({ contents });
      const rawText = result.response.text();
      console.log('[CHAT API] Audio response raw:', rawText);

      let heard = '';
      let reply = FALLBACK;

      try {
        const json = JSON.parse(rawText);
        heard = (json.heard || '').trim();
        reply = (json.reply || FALLBACK).trim();
      } catch {
        // If JSON parsing fails, treat the whole response as the reply
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
    console.error('[CHAT API] ERROR:', err?.message || error);

    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('quota')) {
      return NextResponse.json({ text: "Sir Pomp is catching his breath! Too many adventures today. Try again in a minute!" });
    }

    return NextResponse.json({ text: FALLBACK });
  }
}
