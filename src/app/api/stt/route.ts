import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ transcript: '' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[STT] GEMINI_API_KEY is not set');
      return NextResponse.json({ transcript: '' }, { status: 500 });
    }

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Detect MIME type — iOS sends audio/mp4, desktop sends audio/webm
    const mimeType = audioFile.type || 'audio/webm';
    console.log('[STT] Received audio:', { size: audioFile.size, mimeType });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      {
        text: 'Listen to this audio recording of a young child speaking. Transcribe ONLY the exact spoken words. Rules: return ONLY the words spoken, no punctuation except periods and question marks, no descriptions like "(child laughing)" or "(background noise)", no quotation marks. If you cannot hear any clear speech, return exactly the word EMPTY and nothing else.',
      },
    ]);

    let transcript = result.response.text().trim();
    console.log('[STT] Raw transcript:', transcript);

    // Strip common Gemini artifacts
    transcript = transcript
      .replace(/^["']|["']$/g, '')   // Remove wrapping quotes
      .replace(/^\(.*?\)\s*/g, '')   // Remove (descriptions)
      .replace(/\*+/g, '')          // Remove asterisks
      .trim();

    // Treat "EMPTY" or very short non-word results as no speech
    if (transcript === 'EMPTY' || transcript.length < 2) {
      transcript = '';
    }

    console.log('[STT] Clean transcript:', transcript);

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('[STT] Error:', error);
    return NextResponse.json({ transcript: '' });
  }
}
