import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getModel, providerModelMap, Provider, SYSTEM_PROMPT } from '@/lib/models';
import { retrieve, getDocs } from '@/lib/rag';

const encoder = new TextEncoder();

function sse(text: string) { return encoder.encode(`data: ${JSON.stringify({ text })}\n\n`); }
function sseError(msg: string) { return encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`); }
function sseDone() { return encoder.encode('data: [DONE]\n\n'); }

const LEGACY_TIERS = new Set(['fast', 'balanced', 'pro']);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const deepseekClient = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder',
    });
    const qwenClient = new OpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.QWEN_API_KEY || 'placeholder',
    });
    const openrouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'placeholder',
      defaultHeaders: {
        'HTTP-Referer': 'https://polychat.app',
        'X-Title': 'PolyChat',
      },
    });

    const { messages, modelId, provider = 'gemini', category, attachments = [] } = await req.json();

    // Deduct 1 credit; auto-init at 1000 for pre-migration users
    await db.query(
      `INSERT INTO user_credits (user_id, balance, lifetime_earned)
       VALUES ($1, 1000, 1000)
       ON CONFLICT (user_id) DO NOTHING`,
      [session.user.id],
    );
    const creditResult = await db.query<{ balance: string }>(
      `UPDATE user_credits
       SET balance = GREATEST(balance - 1, 0),
           lifetime_spent = lifetime_spent + 1,
           updated_at = NOW()
       WHERE user_id = $1 AND balance > 0
       RETURNING balance`,
      [session.user.id],
    );
    if (creditResult.rows.length === 0) {
      return NextResponse.json({ error: 'Insufficient credits. Please contact support.' }, { status: 402 });
    }
    const newBalance = Number(creditResult.rows[0].balance);
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
       VALUES ($1, -1, $2, 'deduction', 'AI message')`,
      [session.user.id, newBalance],
    );
    await db.query(
      `INSERT INTO daily_usage_stats (user_id, date, messages_sent, credits_used)
       VALUES ($1, CURRENT_DATE, 1, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET
         messages_sent = daily_usage_stats.messages_sent + 1,
         credits_used  = daily_usage_stats.credits_used  + 1`,
      [session.user.id],
    );
    // Notify when credits are low
    if (newBalance === 50) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1, 'credits_low', 'Credits running low', 'You have 50 credits remaining.')
         ON CONFLICT DO NOTHING`,
        [session.user.id],
      ).catch(() => {/* ignore duplicate */});
    }

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Bangkok', dateStyle: 'full', timeStyle: 'short',
    });

    let ragSection = '';
    const lastMessage = messages[messages.length - 1];
    if (getDocs().length > 0) {
      const chunks = await retrieve(lastMessage.content);
      if (chunks.length > 0) {
        ragSection = '\n\n---\nRelevant document context:\n' +
          chunks.map((c: string, i: number) => `[${i + 1}] ${c}`).join('\n\n') +
          '\n---\nUse the above when relevant. Cite [1], [2], etc.';
      }
    }

    // ── New-style request: modelId is a full OpenRouter ID (contains '/')
    if (modelId && !LEGACY_TIERS.has(modelId)) {
      const systemInstruction = `${SYSTEM_PROMPT}\n\nCurrent date/time: ${now} (ICT, Bangkok).${ragSection}`;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            await streamOpenAICompat(
              controller,
              openrouterClient,
              messages,
              systemInstruction,
              modelId,
              4096,
              attachments,
              true, // OpenRouter supports vision for capable models
            );
            controller.enqueue(sseDone());
            controller.close();
          } catch (err) {
            controller.enqueue(sseError(err instanceof Error ? err.message : 'Unknown error'));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    // ── Legacy request: modelId is 'fast'|'balanced'|'pro'
    const model = getModel(modelId ?? 'fast');
    const legacyProvider = (provider as Provider) in providerModelMap ? (provider as Provider) : 'gemini';
    const actualModel = providerModelMap[legacyProvider]?.[model.id as 'fast' | 'balanced' | 'pro']
      ?? providerModelMap.gemini[model.id as 'fast' | 'balanced' | 'pro'];
    const systemInstruction = `${model.systemPrompt}\n\nCurrent date/time: ${now} (ICT, Bangkok).${ragSection}`;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (legacyProvider === 'deepseek') {
            await streamOpenAICompat(controller, deepseekClient, messages, systemInstruction, actualModel, model.maxTokens, attachments, false);
          } else if (legacyProvider === 'qwen') {
            await streamOpenAICompat(controller, qwenClient, messages, systemInstruction, actualModel, model.maxTokens, attachments, false);
          } else {
            await streamGemini(controller, genAI, messages, systemInstruction, actualModel, model.maxTokens, attachments);
          }
          controller.enqueue(sseDone());
          controller.close();
        } catch (err) {
          controller.enqueue(sseError(err instanceof Error ? err.message : 'Unknown error'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function streamGemini(
  controller: ReadableStreamDefaultController,
  genAI: GoogleGenerativeAI,
  messages: { role: string; content: string }[],
  systemInstruction: string,
  modelName: string,
  maxTokens: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[] = [],
) {
  const history = messages
    .slice(0, -1)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '...' }],
    }))
    .filter((_: unknown, i: number, arr: { role: string }[]) => {
      const firstUser = arr.findIndex((x) => x.role === 'user');
      return firstUser === -1 || i >= firstUser;
    });

  const lastMessage = messages[messages.length - 1];
  const gemini = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: { maxOutputTokens: maxTokens },
  });
  const chat = gemini.startChat({ history });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  let textContent = lastMessage.content || '...';
  for (const att of attachments) {
    if (att.isText) textContent += `\n\n[Attached file: ${att.name}]\n${att.data}`;
  }
  parts.push({ text: textContent });
  for (const att of attachments) {
    if (!att.isText && att.data) parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
  }

  const result = await chat.sendMessageStream(parts.length === 1 ? parts[0].text : parts);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) controller.enqueue(sse(text));
  }
}

async function streamOpenAICompat(
  controller: ReadableStreamDefaultController,
  client: OpenAI,
  messages: { role: string; content: string }[],
  systemInstruction: string,
  modelName: string,
  maxTokens: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[] = [],
  supportsVision = false,
) {
  const history = messages
    .slice(0, -1)
    .filter((_: unknown, i: number, arr: { role: string }[]) => {
      const firstUser = arr.findIndex((x) => x.role === 'user');
      return firstUser === -1 || i >= firstUser;
    })
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content || '...',
    }));

  const lastMessage = messages[messages.length - 1];

  let textExtra = '';
  const imageParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
  for (const att of attachments) {
    if (att.isText) {
      textExtra += `\n\n[Attached file: ${att.name}]\n${att.data}`;
    } else if (att.mimeType?.startsWith('image/') && att.data) {
      if (supportsVision) {
        imageParts.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType};base64,${att.data}` },
        });
      } else {
        textExtra += `\n\n[Image attached: ${att.name}]`;
      }
    } else if (att.name) {
      textExtra += `\n\n[Attached file: ${att.name}]`;
    }
  }

  const lastUserContent: OpenAI.Chat.ChatCompletionMessageParam['content'] =
    imageParts.length > 0
      ? [{ type: 'text', text: (lastMessage.content || '') + textExtra }, ...imageParts]
      : (lastMessage.content || '') + textExtra;

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...history,
    { role: 'user', content: lastUserContent },
  ];

  const stream = await client.chat.completions.create({
    model: modelName,
    messages: chatMessages,
    stream: true,
    max_tokens: maxTokens,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) controller.enqueue(sse(text));
  }
}
