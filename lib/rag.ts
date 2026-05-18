import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export interface RagChunk {
  id: string;
  docId: string;
  text: string;
  embedding: number[];
}

export interface RagDocument {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  chunkCount: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
const EMB_DIR = path.join(DATA_DIR, 'embeddings');

function ensureDirs() {
  try {
    if (!fs.existsSync(EMB_DIR)) fs.mkdirSync(EMB_DIR, { recursive: true });
    if (!fs.existsSync(DOCS_FILE)) fs.writeFileSync(DOCS_FILE, '[]');
  } catch { /* read-only filesystem (e.g. Vercel) — RAG disabled */ }
}

export function getDocs(): RagDocument[] {
  try {
    ensureDirs();
    return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveDocMeta(doc: RagDocument) {
  const docs = getDocs();
  docs.push(doc);
  fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2));
}

export function removeDoc(id: string) {
  const docs = getDocs().filter((d) => d.id !== id);
  fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2));
  const emb = path.join(EMB_DIR, `${id}.json`);
  if (fs.existsSync(emb)) fs.unlinkSync(emb);
}

export function getChunks(docId: string): RagChunk[] {
  const file = path.join(EMB_DIR, `${docId}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveChunks(docId: string, chunks: RagChunk[]) {
  ensureDirs();
  fs.writeFileSync(path.join(EMB_DIR, `${docId}.json`), JSON.stringify(chunks));
}

export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    chunks.push(cleaned.slice(start, start + size));
    start += size - overlap;
  }
  return chunks.filter((c) => c.trim().length > 30);
}

export async function embedText(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function retrieve(query: string, topK = 5): Promise<string[]> {
  const docs = getDocs();
  if (docs.length === 0) return [];

  const qEmb = await embedText(query);
  const scored: { text: string; score: number }[] = [];

  for (const doc of docs) {
    for (const chunk of getChunks(doc.id)) {
      scored.push({ text: chunk.text, score: cosineSim(qEmb, chunk.embedding) });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score > 0.4)
    .map((c) => c.text);
}
