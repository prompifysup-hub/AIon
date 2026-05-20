// ─── New category-based model system ──────────────────────────────────────

export type Category =
  | 'text' | 'image' | 'audio' | 'video'
  | 'document' | 'study';

export interface AIModel {
  id: string;          // OpenRouter model ID, Pollinations model name, TTS voice, or MusicGen model
  name: string;
  description: string;
  icon: string;
  isImageGen?: boolean;  // routes to /api/generate/image
  isTTS?: boolean;       // routes to /api/generate/speech (OpenAI TTS voice)
  isMusicGen?: boolean;  // routes to /api/generate/audio (HuggingFace MusicGen)
  isVideoGen?: boolean;  // routes to /api/generate/video (Pollinations video)
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
      { id: 'openai/gpt-4o',                        name: 'GPT-4o',            description: 'Most capable GPT',   icon: '🟢' },
      { id: 'anthropic/claude-3.5-sonnet',           name: 'Claude 3.5 Sonnet', description: 'Best at reasoning',  icon: '🟣' },
      { id: 'google/gemini-2.0-flash-001',           name: 'Gemini 2.0 Flash',  description: 'Fast & multimodal',  icon: '✨' },
      { id: 'deepseek/deepseek-chat',                name: 'DeepSeek V3',       description: 'Strong at code',     icon: '🔵' },
      { id: 'meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',    description: 'Open & powerful',    icon: '🦙' },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    emoji: '🖼️',
    color: '#EC4899',
    models: [
      { id: 'flux-schnell',                         name: 'Flux Schnell',      description: 'Fastest generation', icon: '⚡', isImageGen: true },
      { id: 'flux',                                 name: 'Flux Dev',          description: 'High quality gen',   icon: '🎨', isImageGen: true },
      { id: 'turbo',                                name: 'Turbo',             description: 'Balanced speed',     icon: '🚀', isImageGen: true },
      { id: 'openai/gpt-4o',                        name: 'GPT-4o Vision',     description: 'Analyze images',    icon: '👁️' },
      { id: 'google/gemini-2.0-flash-001',          name: 'Gemini Vision',     description: 'Understand images', icon: '✨' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    emoji: '🎵',
    color: '#F59E0B',
    models: [
      // Music generation
      { id: 'classic', name: 'Classical',  description: 'Generate classical music', icon: '🎹', isMusicGen: true },
      { id: 'jazz',    name: 'Jazz',       description: 'Generate jazz music',      icon: '🎷', isMusicGen: true },
      { id: 'pop',     name: 'Pop',        description: 'Generate pop music',       icon: '🎸', isMusicGen: true },
      { id: 'ambient', name: 'Ambient',    description: 'Generate ambient music',   icon: '🌊', isMusicGen: true },
      // Text-to-speech
      { id: 'en',    name: 'English (TTS)',    description: 'Speak text in English',    icon: '🗣️', isTTS: true },
      { id: 'en-gb', name: 'British (TTS)',    description: 'Speak text in British',    icon: '🗣️', isTTS: true },
      { id: 'fr',    name: 'French (TTS)',     description: 'Speak text in French',     icon: '🗣️', isTTS: true },
      { id: 'th',    name: 'Thai (TTS)',       description: 'Speak text in Thai',       icon: '🗣️', isTTS: true },
      // Transcription / general
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini Flash', description: 'Transcription & audio help', icon: '✨' },
      { id: 'openai/gpt-4o',               name: 'GPT-4o',       description: 'Transcription & audio help', icon: '🟢' },
    ],
  },
  {
    id: 'video',
    label: 'Video',
    emoji: '🎬',
    color: '#10B981',
    models: [
      // Video generation
      { id: 'video-turbo',                           name: 'Video Gen',         description: 'Generate AI video clips', icon: '🎬', isVideoGen: true },
      { id: 'video-cinematic',                       name: 'Cinematic',         description: 'Cinematic quality video', icon: '🎥', isVideoGen: true },
      { id: 'video-animation',                       name: 'Animation',         description: 'Animated style video',    icon: '✨', isVideoGen: true },
      // Video analysis (text models)
      { id: 'openai/gpt-4o',                        name: 'GPT-4o Vision',     description: 'Analyze & describe video', icon: '🟢' },
      { id: 'google/gemini-2.0-flash-001',           name: 'Gemini Vision',     description: 'Video understanding',     icon: '✨' },
    ],
  },
  {
    id: 'document',
    label: 'Document',
    emoji: '📄',
    color: '#14B8A6',
    models: [
      { id: 'openai/gpt-4o',                        name: 'GPT-4o',            description: 'Document creation', icon: '🟢' },
      { id: 'anthropic/claude-3.5-sonnet',           name: 'Claude 3.5 Sonnet', description: 'Structured writing', icon: '🟣' },
      { id: 'google/gemini-2.0-flash-001',           name: 'Gemini 2.0 Flash',  description: 'Fast generation',   icon: '✨' },
      { id: 'deepseek/deepseek-chat',                name: 'DeepSeek V3',       description: 'Technical docs',    icon: '🔵' },
      { id: 'meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',    description: 'Long-form writing',  icon: '🦙' },
    ],
  },
  {
    id: 'study',
    label: 'Study',
    emoji: '🎓',
    color: '#F97316',
    models: [
      { id: 'openai/gpt-4o',                        name: 'GPT-4o',            description: 'Learning assistant', icon: '🟢' },
      { id: 'anthropic/claude-3.5-sonnet',           name: 'Claude 3.5 Sonnet', description: 'Explain concepts',  icon: '🟣' },
      { id: 'google/gemini-2.0-flash-001',           name: 'Gemini 2.0 Flash',  description: 'Study guide',       icon: '✨' },
      { id: 'deepseek/deepseek-chat',                name: 'DeepSeek V3',       description: 'Deep analysis',     icon: '🔵' },
      { id: 'meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',    description: 'Open & capable',    icon: '🦙' },
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
