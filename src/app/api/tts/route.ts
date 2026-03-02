import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text: string };

    if (!text) {
      return NextResponse.json({ error: 'No text' }, { status: 400 });
    }

    // Try ElevenLabs first if configured
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const elevenVoice = process.env.ELEVENLABS_VOICE_ID;

    if (elevenKey && elevenVoice) {
      try {
        const { ElevenLabsClient } = await import('elevenlabs');
        const client = new ElevenLabsClient({ apiKey: elevenKey });

        const audioStream = await client.generate({
          voice: elevenVoice,
          text,
          model_id: 'eleven_turbo_v2_5',
          output_format: 'mp3_44100_128',
        });

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
      } catch (e) {
        console.warn('[TTS] ElevenLabs failed, trying Gemini TTS:', e);
      }
    }

    // Fallback: Gemini TTS (free, uses same GEMINI_API_KEY)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'No TTS key' }, { status: 500 });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Orus' },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('[TTS] Gemini TTS error:', err);
      return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
    }

    const data = await geminiRes.json();
    const audioPart = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!audioPart?.data) {
      console.error('[TTS] No audio in Gemini response');
      return NextResponse.json({ error: 'No audio' }, { status: 500 });
    }

    // Gemini returns base64 PCM audio — convert to a WAV
    const pcmBuffer = Buffer.from(audioPart.data, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);

    return new Response(new Uint8Array(wavBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[TTS] Error:', error);
    return NextResponse.json({ error: 'Voice lost in the caves' }, { status: 500 });
  }
}

/**
 * Wrap raw PCM data in a WAV header.
 */
function pcmToWav(
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // chunk size
  buffer.writeUInt16LE(1, 20);            // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);

  return buffer;
}
