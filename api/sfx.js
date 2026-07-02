export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const duration = searchParams.get('duration') || '2';
    const influence = searchParams.get('influence') || '0.3';

    if (!text) {
      return new Response('Missing text parameter', { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response('API Key not configured on server', { status: 500 });
    }

    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        duration_seconds: parseFloat(duration),
        prompt_influence: parseFloat(influence),
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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
