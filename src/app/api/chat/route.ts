import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { buildSystemPrompt } from '@/lib/prompts';
import { validateOutput } from '@/lib/safety-filter';

// Force dynamic — never cache this route
export const dynamic = 'force-dynamic';

const FALLBACK = "My armor is squeaking! Say that again?";

const DROWSY_ADDENDUM =
  'You are getting very sleepy. Yawn between sentences. Tell The Friendly Giant that your armor is getting heavy and you need to nap soon. Keep responses to 1 sentence.';

export async function POST(req: NextRequest) {
  try {
    const { message, history, context, isDrowsy } = await req.json() as {
      message: string;
      history: { role: string; content: string }[];
      context: { object: string; interpretation: string; childName?: string; sessionContext?: string };
      isDrowsy?: boolean;
    };

    console.log('[CHAT API] Received:', { message, historyLength: history.length, context, isDrowsy });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json({ text: FALLBACK });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
      ],
      generationConfig: {
        maxOutputTokens: 60,
      },
    });

    let systemPrompt = buildSystemPrompt(
      context.object || 'Shiny Penny',
      context.interpretation || 'a shield for a squirrel',
      context.childName || undefined
    );

    // Append session context (Wednesday Morning experience)
    if (context.sessionContext) {
      systemPrompt += `\n\n**SESSION CONTEXT:**\n${context.sessionContext}`;
    }

    // Append drowsy behavior if session timer is past 18 minutes
    if (isDrowsy) {
      systemPrompt += `\n\n**SLEEPY MODE:** ${DROWSY_ADDENDUM}`;
    }

    // Build chat history for Gemini
    const chatHistory = history.map((msg) => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: msg.content }],
    }));

    console.log('[CHAT API] Chat history entries:', chatHistory.length);

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: `System: ${systemPrompt}` }] },
        { role: 'model', parts: [{ text: 'Hark! Sir Pomp-a-Lot reporting for duty! What news from the Big World, Giant One?' }] },
        ...chatHistory,
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    console.log('[CHAT API] Gemini response:', text);

    // Run safety filter on output
    const safeText = validateOutput(text);

    return NextResponse.json(
      { text: safeText },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: unknown) {
    const err = error as Error & { status?: number; statusText?: string; message?: string };
    console.error('[CHAT API] ERROR:', err?.message || error);

    // Surface rate-limit errors so they don't look like "same response" bugs
    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('quota')) {
      return NextResponse.json({ text: "Sir Pomp is catching his breath! Too many adventures today. Try again in a minute!" });
    }

    return NextResponse.json({ text: FALLBACK });
  }
}
