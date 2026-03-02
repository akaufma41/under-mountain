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
        text: 'Transcribe exactly what the child says in this audio. Return only the spoken words, nothing else. If the audio is silent or unintelligible, return an empty string.',
      },
    ]);

    const transcript = result.response.text().trim();
    console.log('[STT] Transcript:', transcript);

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('[STT] Error:', error);
    return NextResponse.json({ transcript: '' });
  }
}
