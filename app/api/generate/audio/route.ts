import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a music notation expert. Generate ABC notation for the requested music.

Rules:
- Respond ONLY with valid ABC notation, nothing else — no explanation, no markdown fences
- Always include headers: X:, T:, M:, L:, Q:, K:
- Write 16–32 bars of actual melody
- Use proper octave notation (uppercase = middle octave, lowercase = octave above)

Example of valid output:
X:1
T:Simple Waltz
M:3/4
L:1/8
Q:3/8=120
K:Cmaj
|:E2G2G2|F2A2A2|G2c2c2|B4z2|e2d2c2|B2A2G2|c4B2|A6:|`;

const STYLE_HINTS: Record<string, string> = {
  classic:  'Write a classical piano piece in the style of Mozart or Beethoven.',
  jazz:     'Write a jazz melody with swing feel, use blue notes.',
  pop:      'Write a catchy modern pop melody in major key.',
  ambient:  'Write a slow, calm, ambient melody with long notes.',
  folk:     'Write a simple folk tune in a minor or pentatonic key.',
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 503 });
    }

    const { prompt, model = 'classic' } = await req.json() as { prompt?: string; model?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const styleHint = STYLE_HINTS[model] ?? '';
    const userMessage = styleHint
      ? `${styleHint}\n\nUser request: ${prompt}`
      : prompt;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json({ error: err.error?.message || `OpenRouter error ${res.status}` }, { status: res.status });
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const notation = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (!notation || !notation.startsWith('X:')) {
      return NextResponse.json({ error: 'Could not generate valid music notation. Try a different prompt.' }, { status: 422 });
    }

    return NextResponse.json({ notation });
  } catch (err) {
    console.error('[/api/generate/audio]', err);
    return NextResponse.json({ error: 'Audio generation failed' }, { status: 500 });
  }
}
