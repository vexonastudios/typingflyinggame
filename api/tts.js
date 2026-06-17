export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');

    if (!text) {
      return new Response('Missing text parameter', { status: 400 });
    }

    // Force use of the explicitly provided key
    const apiKey = '8a6a22f61cbbb023df499360bc945b70045f93aeb50863bb08e42df5f617d46f';
    if (!apiKey) {
      return new Response('API Key not configured on server', { status: 500 });
    }

    const voiceId = searchParams.get('voiceId') || 'fnYMz3F5gMEDGMWcH1ex';
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.7
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`ElevenLabs API error: ${errorText}`, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });

  } catch (error) {
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
