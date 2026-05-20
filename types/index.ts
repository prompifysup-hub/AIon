export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data?: string;     // base64 for binary; plain text for text files
  isText?: boolean;  // true when data is plain text
  preview?: string;  // data URL, only present for images
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'abc';
  attachments?: Omit<Attachment, 'data' | 'isText'>[];
  timestamp: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  model: string;
  icon: string;
  systemPrompt: string;
  color: string;
  badge?: string;
  maxTokens: number;
  provider: 'google' | 'openai';
  mode?: 'chat' | 'image';
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
