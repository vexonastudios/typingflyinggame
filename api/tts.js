export const config = {
  runtime: 'edge',
};

const ALLOWED_ORIGINS = [
  'https://games.bodeebooks.com',
  'https://typingflyinggame.vercel.app',
];

const MAX_TEXT_LENGTH = 500; // characters

export default async function handler(req) {
  // ── Origin / Referer guard ──────────────────────────────────────────────
  const origin  = req.headers.get('origin')  || '';
  const referer = req.headers.get('referer') || '';
  const originOk  = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  const refererOk = ALLOWED_ORIGINS.some(o => referer.startsWith(o));

  // Allow same-origin requests (no origin header = direct browser navigation)
  if (origin && !originOk && !refererOk) {
    return new Response('Forbidden', { status: 403 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');

    if (!text) {
      return new Response('Missing text parameter', { status: 400, headers: corsHeaders });
    }

    // ── Input length guard ──────────────────────────────────────────────────
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(`Text too long (max ${MAX_TEXT_LENGTH} chars)`, { status: 400, headers: corsHeaders });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response('API Key not configured on server', { status: 500, headers: corsHeaders });
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
      return new Response(`ElevenLabs API error: ${errorText}`, { status: response.status, headers: corsHeaders });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    return new Response(`Server error: ${error.message}`, { status: 500, headers: corsHeaders });
  }
}
