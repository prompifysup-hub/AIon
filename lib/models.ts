// ─── New category-based model system ──────────────────────────────────────

export type Category =
  | 'text' | 'image' | 'embeddings' | 'audio' | 'video'
  | 'rerank' | 'speech' | 'transcription' | 'document' | 'study';

export interface AIModel {
  id: string;          // OpenRouter model ID, or Pollinations model name for image gen
  name: string;
  description: string;
  icon: string;
  isImageGen?: boolean; // routes to image generation API instead of chat
}

export interface CategoryInfo {
  id: Category;
  label: string;
  emoji: string;
  color: string;       // accent color for theming
  models: AIModel[];
}

export const categories: CategoryInfo[] = [
  {
    id: 'text',
    label: 'Text',
    emoji: '💬',
    color: '#3B82F6',
    models: [
      { id: 'google/gemini-2.0-flash-001',           name: 'Gemini 2.0 Flash',  description: 'Fast & multimodal',  icon: '✨' },
      { id: 'openai/gpt-4o-mini',                    name: 'GPT-4o Mini',       description: 'Smart & efficient',  icon: '🟢' },
      { id: 'anthropic/claude-3.5-haiku',             name: 'Claude 3.5 Haiku',  description: 'Fast reasoning',     icon: '🟣' },
      { id: 'deepseek/deepseek-chat',                 name: 'DeepSeek V3',       description: 'Strong at code',     icon: '🔵' },
      { id: 'meta-llama/llama-3.3-70b-instruct',     name: 'Llama 3.3 70B',    description: 'Open & powerful',    icon: '🦙' },
      { id: 'mistralai/mistral-7b-instruct:free',    name: 'Mistral 7B',        description: 'Lightweight',        icon: '🌊' },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    emoji: '🖼️',
    color: '#EC4899',
    models: [
      { id: 'flux-schnell', name: 'Flux Schnell',  description: 'Fastest generation', icon: '⚡', isImageGen: true },
      { id: 'flux',         name: 'Flux Dev',      description: 'High quality gen',   icon: '🎨', isImageGen: true },
      { id: 'turbo',        name: 'Turbo',         description: 'Balanced speed',     icon: '🚀', isImageGen: true },
      { id: 'openai/gpt-4o',                       name: 'GPT-4o Vision',  description: 'Analyze images', icon: '👁️' },
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini Vision',  description: 'Understand images', icon: '✨' },
    ],
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    emoji: '🔢',
    color: '#8B5CF6',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Semantic analysis',  icon: '✨' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Text embeddings',    icon: '🟢' },
      { id: 'deepseek/deepseek-chat',               name: 'DeepSeek V3',      description: 'Code & text',        icon: '🔵' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    emoji: '🎵',
    color: '#F59E0B',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Audio understanding', icon: '✨' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Audio tasks',         icon: '🟢' },
      { id: 'anthropic/claude-3.5-haiku',           name: 'Claude 3.5 Haiku', description: 'Audio analysis',     icon: '🟣' },
    ],
  },
  {
    id: 'video',
    label: 'Video',
    emoji: '🎬',
    color: '#10B981',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Video understanding', icon: '✨' },
      { id: 'openai/gpt-4o',                       name: 'GPT-4o',           description: 'Visual analysis',     icon: '🟢' },
      { id: 'meta-llama/llama-3.3-70b-instruct',   name: 'Llama 3.3 70B',   description: 'Open source',         icon: '🦙' },
    ],
  },
  {
    id: 'rerank',
    label: 'Rerank',
    emoji: '↕️',
    color: '#6366F1',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Relevance ranking',  icon: '✨' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Content reranking',  icon: '🟢' },
      { id: 'anthropic/claude-3.5-haiku',           name: 'Claude 3.5 Haiku', description: 'Semantic ranking',   icon: '🟣' },
    ],
  },
  {
    id: 'speech',
    label: 'Speech',
    emoji: '🗣️',
    color: '#EF4444',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Speech synthesis',  icon: '✨' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Text-to-speech',    icon: '🟢' },
      { id: 'deepseek/deepseek-chat',               name: 'DeepSeek V3',      description: 'Multilingual',      icon: '🔵' },
    ],
  },
  {
    id: 'transcription',
    label: 'Transcription',
    emoji: '📝',
    color: '#0EA5E9',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Audio transcription', icon: '✨' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Fast transcription',  icon: '🟢' },
      { id: 'anthropic/claude-3.5-haiku',           name: 'Claude 3.5 Haiku', description: 'Accurate output',    icon: '🟣' },
    ],
  },
  {
    id: 'document',
    label: 'Document',
    emoji: '📄',
    color: '#14B8A6',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Document creation',  icon: '✨' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Document writing',   icon: '🟢' },
      { id: 'anthropic/claude-3.5-haiku',           name: 'Claude 3.5 Haiku', description: 'Structured content', icon: '🟣' },
      { id: 'deepseek/deepseek-chat',               name: 'DeepSeek V3',      description: 'Technical docs',     icon: '🔵' },
    ],
  },
  {
    id: 'study',
    label: 'Study',
    emoji: '🎓',
    color: '#F97316',
    models: [
      { id: 'google/gemini-2.0-flash-001',         name: 'Gemini 2.0 Flash', description: 'Learning assistant', icon: '✨' },
      { id: 'anthropic/claude-3.5-haiku',           name: 'Claude 3.5 Haiku', description: 'Explain concepts',   icon: '🟣' },
      { id: 'openai/gpt-4o-mini',                  name: 'GPT-4o Mini',      description: 'Study guide',        icon: '🟢' },
      { id: 'meta-llama/llama-3.3-70b-instruct',   name: 'Llama 3.3 70B',   description: 'Deep analysis',      icon: '🦙' },
    ],
  },
];

export function getCategoryInfo(id: string): CategoryInfo | undefined {
  return categories.find(c => c.id === id);
}

export function getDefaultModelId(categoryId: string): string {
  return getCategoryInfo(categoryId)?.models[0]?.id ?? 'google/gemini-2.0-flash-001';
}

export function getModelInfo(categoryId: string, modelId: string): AIModel | undefined {
  return getCategoryInfo(categoryId)?.models.find(m => m.id === modelId);
}

// ─── Backward compatibility for old conversations ──────────────────────────

export type Provider = 'gemini' | 'deepseek' | 'qwen';
export type ModelTier = 'fast' | 'balanced' | 'pro';

export interface Model {
  id: ModelTier;
  name: string;
  description: string;
  geminiModel: string;
  icon: string;
  systemPrompt: string;
  maxTokens: number;
}

export interface ProviderInfo {
  id: Provider;
  name: string;
  available: boolean;
}

export const providerList: ProviderInfo[] = [
  { id: 'gemini',   name: 'Gemini',   available: true },
  { id: 'deepseek', name: 'DeepSeek', available: true },
  { id: 'qwen',     name: 'Qwen',     available: true },
];

export const providerModelMap: Record<Provider, Record<ModelTier, string>> = {
  gemini:   { fast: 'gemini-2.5-flash', balanced: 'gemini-2.5-flash', pro: 'gemini-2.5-pro' },
  deepseek: { fast: 'deepseek-chat',    balanced: 'deepseek-chat',    pro: 'deepseek-reasoner' },
  qwen:     { fast: 'qwen-turbo',       balanced: 'qwen-plus',        pro: 'qwen-max' },
};

const STUDY_INSTRUCTIONS = `

IMAGE GENERATION EXCEPTION — HIGHEST PRIORITY: If the user asks to "generate/create/make/draw/render/paint/produce an image/photo/picture/artwork/illustration/painting/portrait/wallpaper/avatar" (any combination of those verbs and nouns), DO NOT output mermaid, exam, or flashcard blocks. The image is generated by an external system. Simply reply with one short sentence like "Generating your image…" and nothing else.

STUDY MODE — when the user asks for an exam, quiz, test, or practice questions, respond with ONLY a fenced code block:
\`\`\`exam
{"title":"Quiz Title","questions":[{"id":1,"text":"Question text?","options":["Option A","Option B","Option C","Option D"],"correct":0,"explanation":"Why A is correct."}]}
\`\`\`
The "correct" field is the 0-based index of the correct option. Include 4-10 questions. Always include an explanation.

When the user asks for flashcards, respond with ONLY a fenced code block:
\`\`\`flashcards
{"title":"Deck Title","cards":[{"front":"Question or term","back":"Answer or definition"}]}
\`\`\`
Include 6-20 cards. Keep fronts concise and backs informative.

When the user asks for a mind map, diagram, flowchart, ER diagram, sequence diagram, class diagram, or any visual graph — and the request is NOT an image/photo/picture/artwork request — respond with ONLY a fenced mermaid code block. Never wrap mermaid in another code block or add any text outside the fence.

Mermaid syntax rules — follow EXACTLY:

flowchart / graph:
- Always use --> for arrows. NEVER use -> or => or ==>.
- Quote ANY node label that contains parentheses, colons, ampersands, pipes, or angle brackets: A["Label (detail)"] not A[Label (detail)].
- Node IDs must be single words with no spaces.

sequenceDiagram:
- Solid filled arrow: A->>B: message
- Solid open arrow: A->B: message
- Dotted filled: A-->>B: message
- NEVER use => or =>> as arrows.
- Participant names with spaces must use: participant "Full Name" as alias

erDiagram:
- Attribute format is EXACTLY: type name or type name PK or type name FK or type name UK
- Types must be plain words: string int float date boolean text — no parentheses, no numbers
- No extra tokens, comments, or quotes after the key annotation

classDiagram:
- Use <|-- for inheritance, --> for association, --o for aggregation
- Method signatures: +methodName(param) returnType

mindmap:
- Start with mindmap, then root((Topic))
- Use indentation only — no bullet characters or dashes

Always include the diagram type declaration as the very first line.`;

const FILE_INSTRUCTIONS = `
IMPORTANT: When the user asks you to create any of the following file types, you MUST use the exact code block format shown. Do not use plain text or regular markdown. The app will automatically show a download button.

For a DOCUMENT / report / essay / letter:
\`\`\`document
# Title
Content in markdown...
\`\`\`

For a SPREADSHEET / table / data / CSV:
\`\`\`spreadsheet
Header1,Header2,Header3
value1,value2,value3
\`\`\`

For a PRESENTATION / slides / PowerPoint:
\`\`\`slides
---
# Slide Title
- bullet point
- another point
---
# Next Slide
More content
---
\`\`\`

For a PDF document:
\`\`\`pdf
# Title
Content in markdown...
\`\`\`

Always use these exact code block types. Never skip them for file creation requests.`;

export const SYSTEM_PROMPT = `You are a helpful, capable AI assistant. ${FILE_INSTRUCTIONS}${STUDY_INSTRUCTIONS}`;

export const models: Model[] = [
  {
    id: 'fast',
    name: 'Fast',
    geminiModel: 'gemini-2.5-flash',
    icon: '⚡',
    description: 'Quick answers, images & files',
    systemPrompt: `You are a fast, concise AI assistant. Answer directly and briefly. ${FILE_INSTRUCTIONS}${STUDY_INSTRUCTIONS}`,
    maxTokens: 1024,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    geminiModel: 'gemini-2.5-flash',
    icon: '🌟',
    description: 'Thoughtful answers, images & files',
    systemPrompt: `You are a thoughtful, balanced AI assistant. Provide clear and comprehensive responses. ${FILE_INSTRUCTIONS}${STUDY_INSTRUCTIONS}`,
    maxTokens: 2048,
  },
  {
    id: 'pro',
    name: 'Pro',
    geminiModel: 'gemini-2.5-pro',
    icon: '🧠',
    description: 'Deep reasoning, images & files',
    systemPrompt: `You are a highly capable AI assistant. Think step by step and provide deep, nuanced responses. ${FILE_INSTRUCTIONS}${STUDY_INSTRUCTIONS}`,
    maxTokens: 4096,
  },
];

export function getModel(id: string): Model {
  return models.find((m) => m.id === id) ?? models[0];
}
