export const config = {
  runtime: 'edge',
};

const ALLOWED_ORIGINS = [
  'https://games.bodeebooks.com',
  'https://typingflyinggame.vercel.app',
];

const MAX_TEXT_LENGTH = 200; // SFX prompts should be short descriptions

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
    const duration = searchParams.get('duration') || '2';
    const influence = searchParams.get('influence') || '0.3';

    if (!text) {
      return new Response('Missing text parameter', { status: 400, headers: corsHeaders });
    }

    // ── Input length guard ──────────────────────────────────────────────────
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(`Text too long (max ${MAX_TEXT_LENGTH} chars)`, { status: 400, headers: corsHeaders });
    }

    // ── Duration guard (max 10 seconds to prevent abuse) ───────────────────
    const durationVal = Math.min(parseFloat(duration) || 2, 10);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response('API Key not configured on server', { status: 500, headers: corsHeaders });
    }

    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        duration_seconds: durationVal,
        prompt_influence: parseFloat(influence),
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
