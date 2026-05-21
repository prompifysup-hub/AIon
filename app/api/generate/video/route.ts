import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const maxDuration = 120;

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

// ─── Google Veo ────────────────────────────────────────────────────────────
const VEO_MAP: Record<string, { veoModel: string; promptPrefix: string }> = {
  'google/veo-3-fast': {
    veoModel: 'veo-3.0-fast-generate-001',
    promptPrefix: '',
  },
  'google/veo-3': {
    veoModel: 'veo-3.0-generate-001',
    promptPrefix: 'cinematic quality, high production value, ',
  },
};
const VEO_DEFAULT = VEO_MAP['google/veo-3-fast'];

async function generateVeo(prompt: string, modelId: string, apiKey: string): Promise<NextResponse> {
  const { veoModel, promptPrefix } = VEO_MAP[modelId] ?? VEO_DEFAULT;
  const enhancedPrompt = promptPrefix + prompt;

  const startRes = await fetch(
    `${GEMINI}/models/${veoModel}:predictLongRunning?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: enhancedPrompt }],
        parameters: { aspectRatio: '16:9', sampleCount: 1 },
      }),
    },
  );

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    const msg: string = err?.error?.message ?? `HTTP ${startRes.status}`;
    if (startRes.status === 429) {
      return NextResponse.json(
        { error: 'Google Veo quota reached — wait a minute and try again, or switch to a Sora model.' },
        { status: 429 },
      );
    }
    if (startRes.status === 400 && msg.toLowerCase().includes('billing')) {
      return NextResponse.json(
        { error: 'This Veo model requires GCP billing. Try Veo 3 Fast or switch to a Sora model.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: `Veo generation failed: ${msg}` }, { status: 502 });
  }

  let operation = await startRes.json();
  const opName: string = operation.name;

  const deadline = Date.now() + 115_000;
  while (!operation.done) {
    if (Date.now() > deadline) {
      return NextResponse.json({ error: 'Veo timed out. Try a shorter prompt.' }, { status: 504 });
    }
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(`${GEMINI}/${opName}?key=${apiKey}`);
    if (!pollRes.ok) break;
    operation = await pollRes.json();
  }

  if (!operation.done) {
    return NextResponse.json({ error: 'Veo generation did not complete.' }, { status: 502 });
  }

  const resp = operation.response ?? {};

  // Inline base64
  const inlinePred = resp.predictions?.[0];
  if (inlinePred?.bytesBase64Encoded) {
    const mime: string = inlinePred.mimeType ?? 'video/mp4';
    return NextResponse.json({ url: `data:${mime};base64,${inlinePred.bytesBase64Encoded}` });
  }

  // URI that needs proxying
  const samples = resp.generateVideoContentResponse?.generatedSamples ?? resp.generatedSamples;
  const videoUri: string | undefined = samples?.[0]?.video?.uri;
  if (!videoUri) {
    console.error('[veo] Unknown shape:', JSON.stringify(operation).slice(0, 600));
    return NextResponse.json({ error: 'Veo returned no video. Please try again.' }, { status: 502 });
  }

  const fileUrl = videoUri.includes('?') ? `${videoUri}&key=${apiKey}` : `${videoUri}?key=${apiKey}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) return NextResponse.json({ error: 'Failed to retrieve Veo video.' }, { status: 502 });

  const buf = await fileRes.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const mime = fileRes.headers.get('content-type') ?? 'video/mp4';
  return NextResponse.json({ url: `data:${mime};base64,${b64}` });
}

// ─── OpenAI Sora ───────────────────────────────────────────────────────────
const SORA_MAP: Record<string, string> = {
  'openai/sora-2':     'sora-2',
  'openai/sora-2-pro': 'sora-2-pro',
};

async function generateSora(prompt: string, modelId: string, apiKey: string): Promise<NextResponse> {
  const soraModel = SORA_MAP[modelId] ?? 'sora-2';

  const res = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: soraModel, prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg: string = err?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 && msg.toLowerCase().includes('billing')) {
      return NextResponse.json(
        { error: 'Sora requires OpenAI credits — your account balance is $0. Add credits at platform.openai.com/settings/billing, or switch to Veo 3 Fast / Veo 3.' },
        { status: 503 },
      );
    }
    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Sora rate limit hit — wait a moment and try again.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: `Sora generation failed: ${msg}` }, { status: 502 });
  }

  const data = await res.json();

  // Synchronous response: data.data[0].url
  const directUrl: string | undefined = data?.data?.[0]?.url ?? data?.data?.[0]?.b64_json;
  if (directUrl) {
    const url = directUrl.startsWith('http') ? directUrl : `data:video/mp4;base64,${directUrl}`;
    return NextResponse.json({ url });
  }

  // Task-based async response: poll until done
  const taskId: string | undefined = data?.id;
  if (!taskId) {
    console.error('[sora] Unexpected response:', JSON.stringify(data).slice(0, 400));
    return NextResponse.json({ error: 'Sora returned an unexpected response. Please try again.' }, { status: 502 });
  }

  const deadline = Date.now() + 115_000;
  let task = data;
  while (task.status !== 'succeeded' && task.status !== 'completed' && task.status !== 'failed') {
    if (Date.now() > deadline) {
      return NextResponse.json({ error: 'Sora timed out. Try a shorter prompt.' }, { status: 504 });
    }
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(`https://api.openai.com/v1/videos/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) break;
    task = await pollRes.json();
  }

  const videoUrl: string | undefined =
    task?.data?.[0]?.url ?? task?.output?.[0]?.url ?? task?.result?.url;

  if (!videoUrl) {
    return NextResponse.json({ error: 'Sora did not produce a video. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ url: videoUrl });
}

// ─── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt, model } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

  const googleKey = process.env.GOOGLE_API_KEY;

  if (model?.startsWith('openai/')) {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured.' }, { status: 503 });
    return generateSora(prompt.trim(), model, openaiKey);
  }

  if (!googleKey) return NextResponse.json({ error: 'GOOGLE_API_KEY not configured.' }, { status: 503 });
  return generateVeo(prompt.trim(), model, googleKey);
}
