import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from 'elevenlabs';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json() as { text: string };

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      console.error('ElevenLabs API key or voice ID not set');
      return NextResponse.json(
        { error: 'Voice lost in the caves' },
        { status: 500 }
      );
    }

    const client = new ElevenLabsClient({ apiKey });

    const audioStream = await client.generate({
      voice: voiceId,
      text,
      model_id: 'eleven_turbo_v2_5',
      output_format: 'mp3_44100_128',
    });

    // Collect the readable stream into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Voice lost in the caves' },
      { status: 500 }
    );
  }
}
