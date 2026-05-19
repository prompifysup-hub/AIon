import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt, imageData, imageMimeType, model: modelParam } = await req.json();
  const pollinationsModel = ['flux', 'flux-schnell', 'turbo', 'flux-realism'].includes(modelParam)
    ? modelParam : 'turbo';
  if (!prompt?.trim() && !imageData) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  let finalPrompt: string = prompt?.trim() ?? '';

  // When an image is attached, use Gemini vision to craft a rich generation prompt
  if (imageData && imageMimeType) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const instruction = finalPrompt
        ? `Based on this image, create a detailed image generation prompt that incorporates the following request: "${finalPrompt}". Describe style, mood, composition, colors, and key elements. Return only the prompt text.`
        : 'Describe this image in detail for use as an image generation prompt. Include style, mood, composition, colors, and key elements. Return only the prompt text.';
      const result = await model.generateContent([
        { inlineData: { mimeType: imageMimeType, data: imageData } },
        { text: instruction },
      ]);
      const derived = result.response.text().trim();
      if (derived) finalPrompt = derived;
    } catch {
      // fall back to original text prompt
    }
  }

  if (!finalPrompt) {
    return NextResponse.json({ error: 'Could not generate prompt' }, { status: 400 });
  }

  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&model=${pollinationsModel}&seed=${seed}`;

  return NextResponse.json({ url });
}
