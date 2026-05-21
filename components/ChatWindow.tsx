'use client';

import { useState, useRef, useEffect, useCallback, startTransition, memo, useMemo, useId } from 'react';
import { useSession } from 'next-auth/react';
import { Message, Attachment } from '@/types';
import { Category, AIModel, getCategoryInfo, getModelInfo } from '@/lib/models';
import { Conversation, saveConversation } from '@/lib/history';
import { getCategoryTheme, ProviderTheme } from '@/lib/providerThemes';
import { useAccent } from '@/lib/accent';
import {
  Send, StopCircle, Loader2,
  ChevronDown, ChevronLeft, ChevronRight, Paperclip, Download, Mic,
  Copy, Check, Volume2, VolumeX, RotateCcw, X, FileText,
  ThumbsUp, ThumbsDown, Flag,
} from 'lucide-react';
import { ExamBlock, FlashcardBlock, MermaidBlock } from './StudyBlocks';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { DocumentPanel } from './DocumentPanel';
import { detectScriptLang, getBestVoice } from '@/lib/tts';

interface Props {
  conversation: Conversation | null;
  category: Category;
  defaultModelId: string;
  onConversationUpdate: (conv: Conversation) => void;
  botSlug?: string;
  botHeader?: { name: string; description?: string; avatarUrl?: string | null };
}

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}
function fallbackCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

export function ChatWindow({ conversation, category, defaultModelId, onConversationUpdate, botSlug, botHeader }: Props) {
  useSession();
  const accentHex = useAccent();
  const catInfo = useMemo(() => getCategoryInfo(category), [category]);
  const catColor = catInfo?.color ?? '#3B82F6';
  const theme = useMemo(() => getCategoryTheme(catColor, accentHex), [catColor, accentHex]);

  const [messages, setMessages] = useState<Message[]>(conversation?.messages ?? []);
  const [modelId, setModelId] = useState<string>(conversation?.modelId ?? defaultModelId);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [msgVersions, setMsgVersions] = useState<Map<string, { versions: string[]; idx: number }>>(new Map());
  const [feedbackRatings, setFeedbackRatings] = useState<Map<string, number>>(new Map());
  const [videoLoadingId] = useState<string | null>(null); // kept for storyboard legacy messages

  const convIdRef = useRef<string>(conversation?.id ?? crypto.randomUUID());
  const convCreatedAtRef = useRef<string>(conversation?.createdAt ?? new Date().toISOString());
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const isScrollActiveRef = useRef(false);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Removed: const model = getModel(modelId); — now using catInfo directly

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages);
      setModelId(conversation.modelId);
      convIdRef.current = conversation.id;
      convCreatedAtRef.current = conversation.createdAt;
    } else {
      setMessages([]);
      setModelId(defaultModelId);
      convIdRef.current = crypto.randomUUID();
      convCreatedAtRef.current = new Date().toISOString();
    }
    setInput('');
    setIsStreaming(false);
    setIsThinking(false);
    setAttachments([]);
    setMsgVersions(new Map());
    setFeedbackRatings(new Map());
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
    setIsListening(false);
    autoScrollRef.current = true;
    setTimeout(scrollToBottom, 0);
  }, [conversation?.id]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    // Throttle during active streaming to prevent layout-thrash twitching
    if (isScrollActiveRef.current) {
      if (scrollThrottleRef.current) return;
      scrollThrottleRef.current = setTimeout(() => {
        scrollThrottleRef.current = null;
        const el2 = scrollAreaRef.current;
        if (!el2) return;
        programmaticScrollRef.current = true;
        el2.scrollTop = el2.scrollHeight;
        requestAnimationFrame(() => { programmaticScrollRef.current = false; });
      }, 120);
      return;
    }
    programmaticScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => { programmaticScrollRef.current = false; });
  }, []);

  const msgCountRef = useRef(messages.length);

  // Scroll when a new message is added (always) or when streaming is active and user is at bottom.
  // isScrollActiveRef is set synchronously in finally before React batches setState, so by the
  // time this effect fires for an error message the ref is already false — no spring.
  useEffect(() => {
    const prevCount = msgCountRef.current;
    msgCountRef.current = messages.length;
    if (messages.length > prevCount || (autoScrollRef.current && isScrollActiveRef.current)) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const handleScrollArea = () => {
    // Ignore scrolls that we triggered ourselves
    if (programmaticScrollRef.current) return;
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollRef.current = distFromBottom < 100;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const stop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsThinking(false);
  };

  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = detectScriptLang(input) || navigator.languages?.[0] || navigator.language || 'en-US';
    rec.onresult = (e: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
      const t = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${t}` : t));
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        }
      });
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);

  const persistConversation = useCallback(
    (msgs: Message[], mid: string) => {
      const title = msgs.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'New conversation';
      const now = new Date().toISOString();
      const conv: Conversation = {
        id: convIdRef.current,
        title,
        modelId: mid,
        provider: category,
        messages: msgs,
        createdAt: convCreatedAtRef.current,
        updatedAt: now,
      };
      saveConversation(conv)
        .catch((e) => console.error('[history] save failed:', e))
        .finally(() => window.dispatchEvent(new Event('aion:history')));
      onConversationUpdate(conv);
    },
    [onConversationUpdate, category],
  );

  const handleFeedback = useCallback(async (messageId: string, rating: number) => {
    setFeedbackRatings((prev) => {
      const next = new Map(prev);
      if (rating === 0) { next.delete(messageId); } else { next.set(messageId, rating); }
      return next;
    });
    if (rating === 0) return;
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: convIdRef.current,
        messageUuid: messageId,
        rating,
      }),
    }).catch(() => {/* ignore */});
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if ((!content.trim() && attachments.length === 0) || isStreaming) return;

      autoScrollRef.current = true;
      const pendingAttachments = attachments;
      setAttachments([]);

      const displayAtts = pendingAttachments.map(({ id, name, mimeType, preview }) => ({ id, name, mimeType, preview }));
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        attachments: displayAtts.length > 0 ? displayAtts : undefined,
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const assistantId = crypto.randomUUID();
      const withAssistant: Message[] = [
        ...newMessages,
        { id: assistantId, role: 'assistant', content: '', modelId, timestamp: new Date().toISOString() },
      ];
      setMessages(withAssistant);
      setIsThinking(true);
      setIsStreaming(true);

      abortRef.current = new AbortController();

      const updateAssistant = (update: Partial<Message>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...update } : m)));

      const showError = (msg: string) => updateAssistant({ content: `⚠️ ${msg}` });

      // Route to image generation when a generation verb is at the start AND an image noun
      // appears anywhere in the message. Splitting the two checks makes it resilient to
      // any word order between the verb and the noun ("create a high-res image of…", etc.).
      const IMAGE_VERB_RE = /^(generate|create|draw|make|produce|paint|design|render|sketch)\b/i;
      const IMAGE_NOUN_RE = /\b(image|photo|picture|artwork|illustration|painting|portrait|landscape|wallpaper|avatar|headshot|photograph)\b/i;
      const trimmed = content.trim();
      const hasTextAttachment = pendingAttachments.some(a => a.isText);
      const imageAtt = pendingAttachments.find(a => !a.isText && a.mimeType.startsWith('image/'));
      const selectedModelInfo = getModelInfo(category, modelId);
      const isImageGenModel = selectedModelInfo?.isImageGen ?? false;
      const isImageRequest = (isImageGenModel || (IMAGE_VERB_RE.test(trimmed) && IMAGE_NOUN_RE.test(trimmed))) && !hasTextAttachment;

      const MUSIC_RE = /\b(generat|creat|compos|make|produc|play).{0,30}(music|song|melody|tune|jazz|classical|pop|ambient|folk|beat|track|audio)\b|\b(music|song|melody|tune|jazz|classical|ambient|folk)\b/i;
      const SPEECH_RE = /\b(speak|say|read\s+aloud|text.to.speech|tts|convert.{0,20}(to\s+)?(speech|audio|voice|mp3)|voice\s+over|narrat)\b/i;
      const VIDEO_VERB_RE = /\b(generate|create|make|produce|render|animate)\b/i;
      const VIDEO_NOUN_RE = /\b(video|clip|animation|movie|film|reel|timelapse|motion|animated)\b/i;
      const isTTSRequest = selectedModelInfo?.isTTS || SPEECH_RE.test(content.trim());
      const isMusicGenRequest = selectedModelInfo?.isMusicGen || (category === 'audio' && MUSIC_RE.test(content.trim()) && !isTTSRequest);
      // In the video category, any isVideoGen model always generates; analysis models
      // generate when both a creation verb + a video noun appear anywhere in the prompt.
      const isVideoGenRequest = (selectedModelInfo?.isVideoGen ?? false) ||
        (category === 'video' && VIDEO_VERB_RE.test(trimmed) && VIDEO_NOUN_RE.test(trimmed));

      if (isTTSRequest) {
        try {
          const res = await fetch('/api/generate/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content.trim(), voice: modelId }),
            signal: abortRef.current.signal,
          });
          const data = await res.json() as { url?: string; error?: string };
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          const label = content.trim().slice(0, 60) + (content.trim().length > 60 ? '…' : '');
          const patch: Partial<Message> = {
            content: `🗣️ *"${label}"*`,
            mediaUrl: data.url,
            mediaType: 'audio',
          };
          updateAssistant(patch);
          persistConversation(
            withAssistant.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
            modelId,
          );
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== 'AbortError') showError(err.message);
        } finally {
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      if (isMusicGenRequest) {
        try {
          const res = await fetch('/api/generate/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: content.trim(), model: modelId }),
            signal: abortRef.current.signal,
          });
          const data = await res.json() as { notation?: string; error?: string };
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          const label = content.trim().slice(0, 60) + (content.trim().length > 60 ? '…' : '');
          const patch: Partial<Message> = {
            content: `🎵 *"${label}"*`,
            mediaUrl: data.notation,
            mediaType: 'abc',
          };
          updateAssistant(patch);
          persistConversation(
            withAssistant.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
            modelId,
          );
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== 'AbortError') showError(err.message);
        } finally {
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      if (isImageRequest) {
        try {
          const res = await fetch('/api/generate/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: content.trim(),
              model: isImageGenModel ? modelId : undefined,
              imageData: imageAtt?.data,
              imageMimeType: imageAtt?.mimeType,
            }),
            signal: abortRef.current.signal,
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          const patch: Partial<Message> = {
            content: `Here's your image for: *${content.trim()}*`,
            mediaUrl: data.url,
            mediaType: 'image',
          };
          updateAssistant(patch);
          persistConversation(
            withAssistant.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
            modelId,
          );
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== 'AbortError') showError(err.message);
        } finally {
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      if (isVideoGenRequest) {
        try {
          const res = await fetch('/api/generate/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: content.trim(), model: modelId }),
            signal: abortRef.current.signal,
          });
          const data = await res.json() as { url?: string; error?: string };
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          const label = content.trim().slice(0, 60) + (content.trim().length > 60 ? '…' : '');
          const patch: Partial<Message> = {
            content: `🎬 *"${label}"*`,
            mediaUrl: data.url,
            mediaType: 'video',
          };
          updateAssistant(patch);
          persistConversation(
            withAssistant.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
            modelId,
          );
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== 'AbortError') showError(err.message);
        } finally {
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId,
            category,
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            attachments: pendingAttachments,
            botSlug,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}`);
        }

        setIsThinking(false);
        isScrollActiveRef.current = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let rafId: number | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) { showError(parsed.error); return; }
              if (parsed.text) {
                fullText += parsed.text;
                if (rafId === null) {
                  rafId = requestAnimationFrame(() => {
                    rafId = null;
                    startTransition(() => updateAssistant({ content: fullText }));
                  });
                }
              }
            } catch { /* skip malformed chunk */ }
          }
        }
        updateAssistant({ content: fullText });

        persistConversation(
          withAssistant.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
          modelId,
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        showError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        isScrollActiveRef.current = false;
        setIsThinking(false);
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, modelId, category, persistConversation, attachments],
  );

  const navigateVersion = useCallback((msgId: string, dir: -1 | 1) => {
    setMsgVersions(prev => {
      const entry = prev.get(msgId);
      if (!entry) return prev;
      const newIdx = Math.max(0, Math.min(entry.versions.length - 1, entry.idx + dir));
      if (newIdx === entry.idx) return prev;
      setMessages(msgs => msgs.map(m =>
        m.id === msgId ? { ...m, content: entry.versions[newIdx] } : m
      ));
      return new Map(prev).set(msgId, { ...entry, idx: newIdx });
    });
  }, []);

  const regenerateMessage = useCallback(async (msgId: string) => {
    if (isStreaming) return;

    const msgIdx = messages.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;
    const targetMsg = messages[msgIdx];
    if (targetMsg.role !== 'assistant') return;

    // Context = everything before this assistant message
    const base = messages.slice(0, msgIdx);
    if (!base.length || base[base.length - 1].role !== 'user') return;

    // Auto-scroll only when regenerating the bottommost message
    if (msgIdx === messages.length - 1) autoScrollRef.current = true;

    // Save original values so we can restore on abort
    const origContent = targetMsg.content;
    const origMediaUrl = targetMsg.mediaUrl;
    const origMediaType = targetMsg.mediaType;

    // Build full version list; if first regeneration, seed with original content
    const existingEntry = msgVersions.get(msgId);
    const allVersions = existingEntry?.versions ?? [targetMsg.content];

    // Clear message and stamp new modelId for regeneration
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: '', modelId, mediaUrl: undefined, mediaFrames: undefined } : m));
    setIsThinking(true);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    const update = (u: Partial<Message>) =>
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...u } : m));

    const isImageRegen = origMediaType === 'image' || (getModelInfo(category, modelId)?.isImageGen ?? false);
    const isAudioRegen = origMediaType === 'audio';
    const isAbcRegen = origMediaType === 'abc';
    const isVideoRegen = origMediaType === 'video' || (getModelInfo(category, modelId)?.isVideoGen ?? false);

    if (isAudioRegen || isAbcRegen) {
      const userPrompt = base[base.length - 1].content;
      const isTTS = (getModelInfo(category, modelId)?.isTTS ?? false);
      const endpoint = isTTS ? '/api/generate/speech' : '/api/generate/audio';
      const body = isTTS ? { text: userPrompt, voice: modelId } : { prompt: userPrompt, model: modelId };
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });
        const data = await res.json() as { url?: string; notation?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        const label = userPrompt.slice(0, 60) + (userPrompt.length > 60 ? '…' : '');
        const newContent = isTTS ? `🗣️ *"${label}"*` : `🎵 *"${label}"*`;
        const newMediaUrl = data.url ?? data.notation;
        const newMediaType = isTTS ? 'audio' : (data.notation ? 'abc' : 'audio');
        const newVersions = [...allVersions, newContent];
        update({ content: newContent, mediaUrl: newMediaUrl, mediaType: newMediaType as Message['mediaType'] });
        setMsgVersions(prev => new Map(prev).set(msgId, { versions: newVersions, idx: newVersions.length - 1 }));
        persistConversation(
          messages.map(m => m.id === msgId ? { ...m, content: newContent, mediaUrl: newMediaUrl, mediaType: newMediaType as Message['mediaType'] } : m),
          modelId,
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          update({ content: origContent, mediaUrl: origMediaUrl, mediaType: origMediaType });
        } else {
          update({ content: `⚠️ ${err instanceof Error ? err.message : 'Audio generation failed'}` });
        }
      } finally {
        setIsThinking(false);
        setIsStreaming(false);
      }
      return;
    }

    if (isVideoRegen) {
      const userPrompt = base[base.length - 1].content;
      try {
        const res = await fetch('/api/generate/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userPrompt, model: modelId }),
          signal: abortRef.current.signal,
        });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        const label = userPrompt.slice(0, 60) + (userPrompt.length > 60 ? '…' : '');
        const newContent = `🎬 *"${label}"*`;
        const newVersions = [...allVersions, newContent];
        update({ content: newContent, mediaUrl: data.url, mediaFrames: undefined, mediaType: 'video' });
        setMsgVersions(prev => new Map(prev).set(msgId, { versions: newVersions, idx: newVersions.length - 1 }));
        persistConversation(
          messages.map(m => m.id === msgId ? { ...m, content: newContent, mediaUrl: data.url, mediaFrames: undefined, mediaType: 'video' as const } : m),
          modelId,
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          update({ content: origContent, mediaUrl: origMediaUrl, mediaType: origMediaType });
        } else {
          update({ content: `⚠️ ${err instanceof Error ? err.message : 'Video generation failed'}` });
        }
      } finally {
        setIsThinking(false);
        setIsStreaming(false);
      }
      return;
    }

    if (isImageRegen) {
      // ── Image regeneration ────────────────────────────────────────────
      const userPrompt = base[base.length - 1].content;
      try {
        const res = await fetch('/api/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userPrompt,
            model: getModelInfo(category, modelId)?.isImageGen ? modelId : undefined,
          }),
          signal: abortRef.current.signal,
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        const newContent = `Here's your image for: *${userPrompt}*`;
        update({ content: newContent, mediaUrl: data.url, mediaType: 'image' });
        const newVersions = [...allVersions, newContent];
        setMsgVersions(prev => new Map(prev).set(msgId, { versions: newVersions, idx: newVersions.length - 1 }));
        persistConversation(
          messages.map(m => m.id === msgId ? { ...m, content: newContent, mediaUrl: data.url, mediaType: 'image' as const } : m),
          modelId,
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          update({ content: origContent, mediaUrl: origMediaUrl, mediaType: origMediaType });
        } else {
          update({ content: `⚠️ ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
      } finally {
        setIsThinking(false);
        setIsStreaming(false);
      }
      return;
    }

    // ── Text / chat regeneration ──────────────────────────────────────
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId, category,
          messages: base.map(m => ({ role: m.role, content: m.content })),
          botSlug,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`);
      setIsThinking(false);
      isScrollActiveRef.current = true;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', full = '';
      let rafId: number | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') break;
          try {
            const p = JSON.parse(d);
            if (p.error) { update({ content: `⚠️ ${p.error}` }); return; }
            if (p.text) {
              full += p.text;
              if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                  rafId = null;
                  startTransition(() => update({ content: full }));
                });
              }
            }
          } catch { /* skip */ }
        }
      }
      update({ content: full });
      const newVersions = [...allVersions, full];
      setMsgVersions(prev => new Map(prev).set(msgId, { versions: newVersions, idx: newVersions.length - 1 }));
      persistConversation(
        messages.map(m => m.id === msgId ? { ...m, content: full } : m),
        modelId,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      update({ content: `⚠️ ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      isScrollActiveRef.current = false;
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [messages, isStreaming, modelId, category, persistConversation, msgVersions]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const TEXT_TYPES = ['text/', 'application/json', 'application/xml'];
    const isTextFile = (f: File) =>
      TEXT_TYPES.some(t => f.type.startsWith(t)) ||
      /\.(txt|md|csv|json|xml|yaml|yml|ts|tsx|js|jsx|py|java|cpp|c|html|css|sh)$/i.test(f.name);

    const newAtts: Attachment[] = await Promise.all(files.map(file =>
      new Promise<Attachment>(resolve => {
        const reader = new FileReader();
        const id = crypto.randomUUID();
        if (isTextFile(file)) {
          reader.readAsText(file);
          reader.onload = () => resolve({
            id, name: file.name,
            mimeType: file.type || 'text/plain',
            data: reader.result as string,
            isText: true,
          });
        } else {
          reader.readAsDataURL(file);
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve({
              id, name: file.name,
              mimeType: file.type,
              data: base64,
              preview: file.type.startsWith('image/') ? dataUrl : undefined,
            });
          };
        }
        reader.onerror = () => resolve({ id, name: file.name, mimeType: file.type });
      })
    ));
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    const TEXT_TYPES = ['text/', 'application/json', 'application/xml'];
    const isTextFile = (f: File) =>
      TEXT_TYPES.some(t => f.type.startsWith(t)) ||
      /\.(txt|md|csv|json|xml|yaml|yml|ts|tsx|js|jsx|py|java|cpp|c|html|css|sh)$/i.test(f.name);

    const newAtts: Attachment[] = await Promise.all(files.map(file =>
      new Promise<Attachment>(resolve => {
        const id = crypto.randomUUID();
        const fr = new FileReader();
        if (isTextFile(file)) {
          fr.readAsText(file);
          fr.onload = () => resolve({ id, name: file.name, mimeType: file.type || 'text/plain', data: fr.result as string, isText: true });
        } else {
          fr.readAsDataURL(file);
          fr.onload = () => {
            const dataUrl = fr.result as string;
            resolve({ id, name: file.name, mimeType: file.type, data: dataUrl.split(',')[1], preview: file.type.startsWith('image/') ? dataUrl : undefined });
          };
        }
        fr.onerror = () => resolve({ id, name: file.name, mimeType: file.type });
      })
    ));
    setAttachments(prev => [...prev, ...newAtts]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const isEmpty = messages.length === 0;
  const textareaBorderColor = textareaFocused ? theme.textareaBorderFocus : 'transparent';

  return (
    <div className="flex flex-col h-full relative" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && (
        <div className="absolute inset-0 z-50 border-2 border-dashed rounded-lg pointer-events-none flex items-center justify-center"
          style={{ background: `${theme.primaryColor}18`, borderColor: `${theme.primaryColor}80` }}>
          <div className="flex flex-col items-center gap-2" style={{ color: theme.dotColor }}>
            <Paperclip size={32} />
            <span className="text-lg font-medium">Drop file to upload</span>
          </div>
        </div>
      )}

      {showDocs && <DocumentPanel onClose={() => setShowDocs(false)} onDocsChange={setDocCount} />}

      {botHeader && (
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
          style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}>
          {botHeader.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={botHeader.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
              style={{ background: theme.imageActiveBg }}>
              🤖
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ui-text-1)' }}>{botHeader.name}</p>
            {botHeader.description && (
              <p className="text-xs truncate" style={{ color: 'var(--ui-text-3)' }}>{botHeader.description}</p>
            )}
          </div>
        </div>
      )}

      <div ref={scrollAreaRef} onScroll={handleScrollArea} className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <EmptyState catInfo={catInfo} theme={theme} onSend={sendMessage} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                modelId={modelId}
                theme={theme}
                onRegenerate={
                  msg.role === 'assistant' && !isStreaming
                    ? () => regenerateMessage(msg.id)
                    : undefined
                }
                versionEntry={msg.role === 'assistant' ? msgVersions.get(msg.id) : undefined}
                onNavigateVersion={(dir) => navigateVersion(msg.id, dir)}
                onFeedback={msg.role === 'assistant' ? handleFeedback : undefined}
                currentRating={feedbackRatings.get(msg.id)}
                onVideoLoaded={
                  msg.id === videoLoadingId
                    ? () => { setIsStreaming(false); }
                    : undefined
                }
              />
            ))}
            {isThinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--ui-bg-card)' }}>
                  <ModelLogo modelId={modelId} size={20} />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  {theme.isRainbow ? (
                    <>
                      <span className="w-2 h-2 rounded-full animate-bounce rainbow-bg" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce rainbow-bg" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce rainbow-bg" style={{ animationDelay: '300ms' }} />
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: theme.dotColor, animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: theme.dotColor, animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: theme.dotColor, animationDelay: '300ms' }} />
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {category === 'document' ? (
              /* Document type pills */
              <>
                {[
                  { icon: '📄', label: 'Document',     prompt: 'Write a Word document about ' },
                  { icon: '📊', label: 'Spreadsheet',  prompt: 'Create a spreadsheet for ' },
                  { icon: '📑', label: 'Presentation', prompt: 'Create a PowerPoint presentation about ' },
                  { icon: '📋', label: 'PDF',          prompt: 'Write a PDF document about ' },
                  { icon: '📝', label: 'Text',         prompt: 'Write a text document about ' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { setInput(item.prompt); requestAnimationFrame(() => { textareaRef.current?.focus(); autoResize(); }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </>
            ) : category === 'study' ? (
              /* Study type pills */
              <>
                {[
                  { icon: '📝', label: 'Exam',       prompt: 'Create an interactive exam with 5 multiple-choice questions about ' },
                  { icon: '🃏', label: 'Flashcards', prompt: 'Create a flashcard deck to help me study ' },
                  { icon: '🗺️', label: 'Mind Map',   prompt: 'Draw a mind map diagram for ' },
                  { icon: '📊', label: 'Flowchart',  prompt: 'Create a flowchart diagram showing ' },
                  { icon: '🔗', label: 'ER Diagram', prompt: 'Create an ER diagram for ' },
                  { icon: '🔄', label: 'Sequence',   prompt: 'Create a sequence diagram for ' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { setInput(item.prompt); requestAnimationFrame(() => { textareaRef.current?.focus(); autoResize(); }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </>
            ) : (
              /* AI model picker + image mode for all other categories */
              <>
                {/* Model picker */}
                <div className="relative" ref={modelPickerRef}>
                  <button
                    onClick={() => setShowModelPicker((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                  >
                    <ModelLogo modelId={modelId} size={16} />
                    <span className="max-w-[120px] truncate">{catInfo?.models.find(m => m.id === modelId)?.name ?? modelId}</span>
                    <ChevronDown size={13} className={`transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                  </button>
                  {showModelPicker && (
                    <div className="absolute bottom-full mb-2 left-0 rounded-xl border shadow-xl overflow-hidden min-w-56 z-20"
                      style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}>
                      <div className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ui-border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-3)' }}>
                          {catInfo?.label} Models
                        </p>
                      </div>
                      {(catInfo?.models ?? []).map((m: AIModel) => (
                        <button key={m.id}
                          onClick={() => { setModelId(m.id); setShowModelPicker(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                          style={{ color: modelId === m.id ? 'var(--ui-text-1)' : 'var(--ui-text-2)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <ModelLogo modelId={m.id} size={18} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{m.name}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--ui-text-3)' }}>{m.description}</p>
                          </div>
                          {modelId === m.id && <span className="text-xs shrink-0" style={{ color: theme.primaryColor }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </>
            )}

            {uploadingFile && (
              <div className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--ui-text-3)' }}>
                <Loader2 size={12} className="animate-spin" />Uploading…
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              {attachments.map(att => (
                <div key={att.id} className="relative flex items-center gap-1.5 rounded-xl overflow-hidden border text-xs"
                  style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)', maxWidth: 160 }}>
                  {att.preview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={att.preview} alt={att.name} className="w-10 h-10 object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center shrink-0"
                      style={{ background: 'var(--ui-bg-card-hover)' }}>
                      <FileText size={16} style={{ color: 'var(--ui-text-3)' }} />
                    </div>
                  )}
                  <span className="truncate pr-1 py-1" style={{ color: 'var(--ui-text-2)' }}>{att.name}</span>
                  <button
                    onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="relative flex items-end gap-2 rounded-2xl p-3 transition-colors border"
            style={{ background: 'var(--ui-input-bg)', borderColor: textareaBorderColor }}>
            {/* Attach file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors mb-0.5"
              style={{ color: attachments.length > 0 ? theme.primaryColor : 'var(--ui-text-3)' }}
              title="Attach file"
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Paperclip size={15} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => setTextareaFocused(false)}
              placeholder={isListening ? 'Listening…' : attachments.length > 0 ? `Add a message or just send ${attachments.length} file(s)…` : `Message ${catInfo?.models.find(m => m.id === modelId)?.name ?? catInfo?.label ?? 'AI'}…`}
              rows={1}
              className="flex-1 bg-transparent placeholder-gray-500 resize-none outline-none text-sm leading-relaxed max-h-48 py-1"
              style={{ color: 'var(--ui-text-1)' }}
              disabled={isStreaming}
            />

            {/* Mic */}
            <button
              onClick={toggleMic}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors mb-0.5"
              style={{
                color: isListening ? theme.primaryColor : 'var(--ui-text-3)',
                background: isListening ? theme.imageActiveBg : 'transparent',
              }}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              <Mic size={15} />
            </button>

            {isStreaming ? (
              <button
                onClick={stop}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-white mb-0.5 transition-opacity hover:opacity-80 active:scale-95"
                style={{ background: '#EF4444' }}
                title="Stop generating"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() && attachments.length === 0}
                className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-white mb-0.5${theme.isRainbow ? ' rainbow-bg' : ' transition-colors'}`}
                style={theme.isRainbow ? {} : { background: theme.primaryColor }}
                onMouseEnter={(e) => { if (!theme.isRainbow) e.currentTarget.style.background = theme.primaryHover; }}
                onMouseLeave={(e) => { if (!theme.isRainbow) e.currentTarget.style.background = theme.primaryColor; }}
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="text-center text-[11px]" style={{ color: 'var(--ui-text-3)' }}>
            Enter to send · Shift+Enter for new line · Drop files to upload
          </p>
        </div>
      </div>
    </div>
  );
}

// Map provider prefix → actual logo image URL
// Using each provider's own favicon for accurate brand representation
const PROVIDER_LOGO_URL: Record<string, string> = {
  'openai':     'https://openai.com/favicon.ico',
  'anthropic':  'https://www.anthropic.com/favicon.ico',
  'google':     'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
  'deepseek':   'https://deepseek.com/favicon.ico',
  'meta-llama': 'https://www.llama.com/favicon.ico',
  'qwen':       'https://qwenlm.github.io/favicon.png',
  'mistralai':  'https://mistral.ai/favicon.ico',
};

// Fallback colored badges if image fails to load
const PROVIDER_FALLBACK: Record<string, { bg: string; label: string }> = {
  'openai':     { bg: '#10a37f', label: 'OAI' },
  'anthropic':  { bg: '#d97757', label: 'ANT' },
  'google':     { bg: '#4285f4', label: 'GEM' },
  'deepseek':   { bg: '#1677ff', label: 'DS'  },
  'meta-llama': { bg: '#0082fb', label: 'LLM' },
  'qwen':       { bg: '#ff6900', label: 'QWN' },
  'mistralai':  { bg: '#ff7000', label: 'MST' },
};

function ModelLogo({ modelId, size = 16 }: { modelId: string; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const radius = Math.round(size * 0.28);

  const prefix = modelId.includes('/') ? modelId.split('/')[0] : null;
  const logoUrl = prefix ? PROVIDER_LOGO_URL[prefix] : 'https://pollinations.ai/favicon.ico';
  const fallback = prefix ? PROVIDER_FALLBACK[prefix] : null;

  const fallbackStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: size, height: size, borderRadius: radius, flexShrink: 0, lineHeight: 1,
    fontSize: Math.max(Math.round(size * 0.38), 7), fontWeight: 700,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: fallback?.bg ?? 'linear-gradient(135deg,#ff4785,#a855f7)',
    color: '#fff',
  };

  if (logoUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setImgFailed(true)}
        style={{ borderRadius: radius, flexShrink: 0, objectFit: 'contain', display: 'block' }}
      />
    );
  }

  return (
    <span style={fallbackStyle}>
      {fallback ? fallback.label[0] : '✦'}
    </span>
  );
}

function EmptyState({ catInfo, theme, onSend }: { catInfo: ReturnType<typeof getCategoryInfo>; theme: ProviderTheme; onSend: (s: string) => void }) {
  const suggestions: Record<string, string[]> = {
    text:          ['Explain how quantum computing works', 'Write a professional email template', 'Summarize the latest AI research'],
    image:         ['Generate an image of a futuristic city at sunset', 'Create a portrait of a cyberpunk samurai', 'Draw a calm zen garden at dusk'],
    embeddings:    ['Compare the semantic similarity of these sentences', 'Cluster these topics by meaning', 'Find the most relevant document for my query'],
    audio:         ['Transcribe this audio description', 'Explain audio compression formats', 'How does noise cancellation work?'],
    video:         ['Generate a video of ocean waves at sunset', 'Create an animated clip of a cyberpunk city', 'Make a timelapse video of a blooming flower'],
    rerank:        ['Rank these documents by relevance to my query', 'Which result is most useful for my search?', 'Sort these answers by quality'],
    speech:        ['Convert this text to speech script', 'Write a podcast intro script', 'Create a voiceover for a product demo'],
    transcription: ['Transcribe this meeting notes', 'Convert spoken words to text format', 'Create a subtitle script'],
    document:      ['Write a Word document about climate change', 'Create a spreadsheet for budget tracking', 'Write a PDF report on AI trends'],
    study:         ['Create an interactive exam about photosynthesis', 'Make flashcards for Spanish vocabulary', 'Draw a mind map for machine learning'],
  };
  const catSuggestions = suggestions[catInfo?.id ?? 'text'] ?? suggestions.text;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto px-4">
      <div className="text-5xl mb-4">{catInfo?.emoji ?? '🤖'}</div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ui-text-1)' }}>{catInfo?.label ?? 'AI'}</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--ui-text-3)' }}>Choose a model above and start chatting</p>
      <div className="grid grid-cols-1 gap-2 w-full">
        {catSuggestions.map((s) => (
          <button key={s} onClick={() => onSend(s)}
            className="text-left px-4 py-3 rounded-xl text-sm transition-colors border"
            style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)', color: 'var(--ui-text-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
          >{s}</button>
        ))}
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ message, modelId, theme, onRegenerate, versionEntry, onNavigateVersion, onFeedback, currentRating, onVideoLoaded }: {
  message: Message;
  modelId: string;
  theme: ProviderTheme;
  onRegenerate?: () => void;
  versionEntry?: { versions: string[]; idx: number };
  onNavigateVersion?: (dir: -1 | 1) => void;
  onFeedback?: (messageId: string, rating: number) => void;
  currentRating?: number;
  onVideoLoaded?: () => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-1" style={{ maxWidth: '80%' }}>
          {/* Attachment thumbnails */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {message.attachments.map(att =>
                att.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={att.id} src={att.preview} alt={att.name}
                    className="rounded-xl max-h-48 max-w-[260px] object-cover border"
                    style={{ borderColor: theme.userBubbleBorder }} />
                ) : (
                  <div key={att.id} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border"
                    style={{ background: theme.userBubbleBg, borderColor: theme.userBubbleBorder, color: 'var(--ui-text-2)' }}>
                    <FileText size={12} />
                    <span>{att.name}</span>
                  </div>
                )
              )}
            </div>
          )}
          {message.content && (
            <div className="border rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed w-full"
              style={{ background: theme.userBubbleBg, borderColor: theme.userBubbleBorder, color: 'var(--ui-text-1)' }}>
              {message.content}
            </div>
          )}
          <UserCopyButton content={message.content} theme={theme} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'var(--ui-bg-card)' }}>
        <ModelLogo modelId={message.modelId ?? modelId} size={20} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {message.content && (
          <div className="prose prose-sm max-w-none leading-relaxed" style={{ color: 'var(--ui-prose)' }}>
            <MarkdownContent content={message.content} theme={theme} />
          </div>
        )}
        {message.mediaType === 'image' && message.mediaUrl && (
          <GeneratedImage url={message.mediaUrl} theme={theme} />
        )}
        {message.mediaType === 'audio' && message.mediaUrl && (
          <AudioPlayer url={message.mediaUrl} theme={theme} />
        )}
        {message.mediaType === 'abc' && message.mediaUrl && (
          <ABCPlayer notation={message.mediaUrl} theme={theme} />
        )}
        {message.mediaType === 'video' && message.mediaUrl && (
          <VideoPlayer url={message.mediaUrl} theme={theme} />
        )}
        {message.mediaType === 'video' && !message.mediaUrl && message.mediaFrames && message.mediaFrames.length > 0 && (
          <StoryboardPlayer frames={message.mediaFrames} theme={theme} onFirstLoaded={onVideoLoaded} />
        )}
        <MessageActions
          content={message.content}
          theme={theme}
          onRegenerate={onRegenerate}
          versionEntry={versionEntry}
          onNavigateVersion={onNavigateVersion}
          onFeedback={onFeedback ? (rating) => onFeedback(message.id, rating) : undefined}
          currentRating={currentRating}
        />
      </div>
    </div>
  );
});

function UserCopyButton({ content, theme }: { content: string; theme: ProviderTheme }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
      style={{ color: copied ? theme.primaryColor : 'var(--ui-text-3)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function MessageActions({ content, theme, onRegenerate, versionEntry, onNavigateVersion, onFeedback, currentRating }: {
  content: string;
  theme: ProviderTheme;
  onRegenerate?: () => void;
  versionEntry?: { versions: string[]; idx: number };
  onNavigateVersion?: (dir: -1 | 1) => void;
  onFeedback?: (rating: number) => void;
  currentRating?: number;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis?.getVoices() ?? [];
      if (v.length > 0) setVoices(v);
    };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  const handleCopy = async () => {
    const plainText = content.replace(/```[\s\S]*?```/g, '[code]').replace(/[#*`_~]/g, '');
    await copyToClipboard(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const plain = content
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .trim();

    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.rate = 0.92;   // slightly relaxed — sounds more natural, less robotic

    // Detect language; for undetected Latin scripts fall back to browser language
    const scriptLang = detectScriptLang(plain);
    const targetLang = scriptLang || navigator.language || 'en-US';
    utterance.lang = targetLang;

    // Explicitly pick the best available voice so the browser never silently
    // falls back to a default English voice when a better match exists.
    const best = getBestVoice(targetLang, voices);
    if (best) utterance.voice = best;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const hasAnything = !!content || !!onRegenerate || (versionEntry && versionEntry.versions.length > 1);
  if (!hasAnything) return null;

  return (
    <div className="flex items-center gap-1 pt-1">
      {content && (
        <button onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
          style={{ color: copied ? theme.primaryColor : 'var(--ui-text-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      )}
      {versionEntry && versionEntry.versions.length > 1 && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onNavigateVersion?.(-1)}
            disabled={versionEntry.idx === 0}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-colors disabled:opacity-30"
            style={{ color: 'var(--ui-text-3)' }}
            onMouseEnter={(e) => { if (versionEntry.idx > 0) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Previous version"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs px-0.5 tabular-nums" style={{ color: 'var(--ui-text-3)' }}>
            {versionEntry.idx + 1}/{versionEntry.versions.length}
          </span>
          <button
            onClick={() => onNavigateVersion?.(1)}
            disabled={versionEntry.idx === versionEntry.versions.length - 1}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-colors disabled:opacity-30"
            style={{ color: 'var(--ui-text-3)' }}
            onMouseEnter={(e) => { if (versionEntry.idx < versionEntry.versions.length - 1) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Next version"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
      {onRegenerate && (
        <button onClick={onRegenerate}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
          style={{ color: 'var(--ui-text-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Regenerate response"
        >
          <RotateCcw size={12} />
          <span>Redo</span>
        </button>
      )}
      {content && (
        <button onClick={handleSpeak}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
          style={{ color: speaking ? theme.primaryColor : 'var(--ui-text-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
          <span>{speaking ? 'Stop' : 'Speak'}</span>
        </button>
      )}
      {onFeedback && content && (
        <>
          <button
            onClick={() => onFeedback(currentRating === 5 ? 0 : 5)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-colors"
            style={{ color: currentRating === 5 ? '#22C55E' : 'var(--ui-text-3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Good response"
          >
            <ThumbsUp size={12} fill={currentRating === 5 ? '#22C55E' : 'none'} />
          </button>
          <button
            onClick={() => onFeedback(currentRating === 1 ? 0 : 1)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-colors"
            style={{ color: currentRating === 1 ? '#EF4444' : 'var(--ui-text-3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Bad response"
          >
            <ThumbsDown size={12} fill={currentRating === 1 ? '#EF4444' : 'none'} />
          </button>
        </>
      )}
    </div>
  );
}

function CodeCopyButton({ content, theme }: { content: string; theme: ProviderTheme }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
      style={{ color: copied ? theme.primaryColor : '#9ca3af' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

const MarkdownContent = memo(function MarkdownContent({ content, theme }: { content: string; theme: ProviderTheme }) {
  return (
    <ReactMarkdown
      components={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code({ className, children, ...props }: any) {
          const lang = className?.replace('language-', '') ?? '';
          const raw = String(children).trimEnd();

          if (lang === 'exam') return <ExamBlock raw={raw} theme={theme} />;
          if (lang === 'flashcards') return <FlashcardBlock raw={raw} theme={theme} />;
          if (lang === 'mermaid') return <MermaidBlock code={raw} />;

          if (['document', 'spreadsheet', 'slides', 'pdf'].includes(lang)) {
            return <FileBlock lang={lang as 'document' | 'spreadsheet' | 'slides' | 'pdf'} content={raw} theme={theme} />;
          }

          if (className) {
            return (
              <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between px-4 py-1.5" style={{ background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[11px] font-mono" style={{ color: '#9ca3af' }}>{lang || 'code'}</span>
                  <CodeCopyButton content={raw} theme={theme} />
                </div>
                <SyntaxHighlighter
                  language={lang || 'text'}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={vscDarkPlus as any}
                  customStyle={{ margin: 0, borderRadius: 0, padding: '16px', fontSize: '13px', background: '#1e1e2e' }}
                  PreTag="div"
                >
                  {raw}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code className="rounded px-1.5 py-0.5 text-xs font-mono"
              style={{ background: 'var(--ui-code-bg)', color: theme.codeColor }} {...props}>
              {children}
            </code>
          );
        },
        strong({ children }) { return <strong style={{ color: 'var(--ui-text-1)', fontWeight: 700 }}>{children}</strong>; },
        p({ children }) { return <p className="mb-3 last:mb-0">{children}</p>; },
        ul({ children }) { return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>; },
        ol({ children }) { return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>; },
        h1({ children }) { return <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--ui-text-1)' }}>{children}</h1>; },
        h2({ children }) { return <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--ui-text-1)' }}>{children}</h2>; },
        h3({ children }) { return <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>{children}</h3>; },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 pl-3 italic my-2"
              style={{ borderColor: theme.blockquoteBorder, color: 'var(--ui-text-3)' }}>
              {children}
            </blockquote>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

const FILE_META = {
  document:    { icon: '📄', label: 'Word Document (.docx)' },
  spreadsheet: { icon: '📊', label: 'Spreadsheet (.xlsx)' },
  slides:      { icon: '📑', label: 'Presentation (.pptx)' },
  pdf:         { icon: '📋', label: 'PDF Document (.pdf)' },
} as const;

function FileBlock({ lang, content, theme }: {
  lang: 'document' | 'spreadsheet' | 'slides' | 'pdf';
  content: string;
  theme: ProviderTheme;
}) {
  const [downloading, setDownloading] = useState<null | 'plain' | 'design'>(null);
  const meta = FILE_META[lang];

  const download = async (style: 'plain' | 'design' = 'plain') => {
    setDownloading(style);
    try {
      if (lang === 'document') await downloadDocument(content);
      else if (lang === 'spreadsheet') await downloadSpreadsheet(content);
      else if (lang === 'slides') {
        if (style === 'design') await downloadSlidesDesign(content);
        else await downloadSlides(content);
      }
      else await downloadPDF(content);
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)' }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ui-text-2)' }}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        {lang === 'slides' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => download('plain')}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-opacity disabled:opacity-50"
              style={{ background: 'var(--ui-bg-card-hover)', color: 'var(--ui-text-2)' }}
            >
              {downloading === 'plain' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Plain
            </button>
            <button
              onClick={() => download('design')}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-opacity disabled:opacity-50"
              style={{ background: theme.downloadBtnBg, color: theme.downloadBtnColor }}
            >
              {downloading === 'design' ? <Loader2 size={12} className="animate-spin" /> : <span>✦</span>}
              {downloading === 'design' ? 'Preparing…' : 'Design'}
            </button>
          </div>
        ) : (
          <button onClick={() => download()} disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-opacity disabled:opacity-50"
            style={{ background: theme.downloadBtnBg, color: theme.downloadBtnColor }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {downloading ? 'Preparing…' : 'Download'}
          </button>
        )}
      </div>
      <pre className="p-4 overflow-auto text-xs h-48" style={{ color: 'var(--ui-text-3)' }}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

function ABCPlayer({ notation, theme }: { notation: string; theme: ProviderTheme }) {
  const renderId = useId();
  const audioRef = useRef<{ stop?: () => void } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('abcjs').then((abcjs) => {
      if (cancelled) return;
      try {
        abcjs.renderAbc(`abc-notation-${renderId}`, notation, { responsive: 'resize' });
        setReady(true);
      } catch {
        setError('Could not render notation');
      }
    });
    return () => { cancelled = true; audioRef.current?.stop?.(); };
  }, [notation, renderId]);

  const toggle = async () => {
    const abcjs = await import('abcjs');
    if (!abcjs.synth.supportsAudio()) { setError('Audio not supported in this browser'); return; }
    if (playing) {
      audioRef.current?.stop?.();
      setPlaying(false);
      return;
    }
    try {
      const visualObj = abcjs.renderAbc(`abc-notation-${renderId}`, notation)[0];
      const synth = new abcjs.synth.CreateSynth();
      await synth.init({ visualObj });
      await synth.prime();
      synth.start();
      setPlaying(true);
      audioRef.current = { stop: () => { synth.stop(); setPlaying(false); } };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Playback failed');
    }
  };

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-card)' }}>
      <div id={`abc-notation-${renderId}`} className="px-3 pt-2 overflow-x-auto" style={{ color: 'var(--ui-text-1)', maxHeight: '200px' }} />
      {error && <p className="px-3 text-xs text-red-500">{error}</p>}
      {ready && !error && (
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={toggle}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{ background: theme.primaryColor, color: '#fff' }}>
            {playing ? '⏹ Stop' : '▶ Play'}
          </button>
          <span className="text-xs" style={{ color: 'var(--ui-text-3)' }}>Sheet music · ABC notation</span>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({ url, theme }: { url: string; theme: ProviderTheme }) {
  const ext = url.includes('audio/mp3') ? 'speech.mp3' : 'audio.flac';
  return (
    <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-card)' }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls className="w-full" style={{ height: '40px', display: 'block' }}>
        <source src={url} />
      </audio>
      <div className="flex justify-end px-3 py-1">
        <a href={url} download={ext} className="text-xs hover:underline" style={{ color: theme.primaryColor }}>
          ↓ Download
        </a>
      </div>
    </div>
  );
}

function VideoPlayer({ url, theme }: { url: string; theme: ProviderTheme }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)', background: '#000', maxWidth: 560 }}>
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-10" style={{ color: '#aaa' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading video…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-2 py-8 px-4" style={{ color: '#f87171' }}>
          <span className="text-sm">Video failed to load.</span>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs underline" style={{ color: theme.primaryColor }}>
            Open video directly ↗
          </a>
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={url}
        controls
        playsInline
        className={`w-full ${status !== 'ready' ? 'hidden' : ''}`}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
        onCanPlay={() => setStatus('ready')}
        onError={() => setStatus('error')}
      />
      {status === 'ready' && (
        <div className="flex justify-end px-3 py-1.5" style={{ background: 'var(--ui-bg-card)' }}>
          <a href={url} download="video.mp4" className="text-xs hover:underline" style={{ color: theme.primaryColor }}>
            ↓ Download MP4
          </a>
        </div>
      )}
    </div>
  );
}

function StoryboardPlayer({ frames, theme, onFirstLoaded }: { frames: string[]; theme: ProviderTheme; onFirstLoaded?: () => void }) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loaded, setLoaded] = useState<boolean[]>(() => new Array(frames.length).fill(false));
  const calledFirstLoaded = useRef(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setCurrent((p) => (p + 1) % frames.length), 2800);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const markLoaded = (i: number) => {
    setLoaded((prev) => { const next = [...prev]; next[i] = true; return next; });
    if (!calledFirstLoaded.current) {
      calledFirstLoaded.current = true;
      onFirstLoaded?.();
    }
  };

  const allReady = loaded.every(Boolean);

  return (
    <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-card)', maxWidth: 560 }}>
      {/* Frame viewer */}
      <div className="relative" style={{ aspectRatio: '16/9', background: '#000' }}>
        {frames.map((url, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={i}
            src={url}
            alt={`Frame ${i + 1}`}
            referrerPolicy="no-referrer"
            onLoad={() => markLoaded(i)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: i === current ? 1 : 0 }}
          />
        ))}
        {!allReady && (
          <div className="absolute inset-0 flex items-center justify-center gap-2" style={{ color: '#fff', background: 'rgba(0,0,0,0.6)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Generating frames…</span>
          </div>
        )}
        {/* Frame dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {frames.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{ background: i === current ? '#fff' : 'rgba(255,255,255,0.4)', transform: i === current ? 'scale(1.3)' : 'scale(1)' }} />
          ))}
        </div>
      </div>
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{ background: theme.primaryColor, color: '#fff' }}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => setCurrent((p) => (p - 1 + frames.length) % frames.length)}
            className="px-2 py-1 rounded-lg text-xs transition-colors"
            style={{ background: 'var(--ui-bg-card-hover)', color: 'var(--ui-text-2)' }}
          >‹</button>
          <button
            onClick={() => setCurrent((p) => (p + 1) % frames.length)}
            className="px-2 py-1 rounded-lg text-xs transition-colors"
            style={{ background: 'var(--ui-bg-card-hover)', color: 'var(--ui-text-2)' }}
          >›</button>
          <span className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
            {current + 1} / {frames.length}
          </span>
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--ui-text-3)' }}>AI Storyboard</span>
      </div>
    </div>
  );
}

function GeneratedImage({ url, theme }: { url: string; theme: ProviderTheme }) {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  return (
    <div className="mt-2">
      {status === 'loading' && (
        <div className="w-64 h-48 rounded-2xl border flex items-center justify-center"
          style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)' }}>
          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--ui-text-3)' }}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-xs">Generating…</span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="text-xs text-red-400">
          Image failed to load.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Open URL directly</a>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Generated image" referrerPolicy="no-referrer"
        className={`rounded-2xl max-w-md w-full border shadow-xl ${status !== 'done' ? 'hidden' : ''}`}
        style={{ borderColor: 'var(--ui-border)' }}
        onLoad={() => setStatus('done')} onError={() => setStatus('error')}
      />
      {status === 'done' && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-2 text-xs transition-opacity hover:opacity-70"
          style={{ color: theme.primaryColor }}>
          Open full size ↗
        </a>
      )}
    </div>
  );
}

async function downloadDocument(content: string, filename = 'document') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const paragraphs = content.split('\n').map((line) => {
    if (line.startsWith('# ')) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 });
    if (line.startsWith('## ')) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 });
    if (line.startsWith('### ')) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 });
    if (line.startsWith('- ') || line.startsWith('* ')) return new Paragraph({ text: line.slice(2), bullet: { level: 0 } });
    return new Paragraph({ children: [new TextRun(line)] });
  });
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${filename}.docx`);
}

async function downloadSpreadsheet(content: string, filename = 'spreadsheet') {
  const XLSX = await import('xlsx');
  const rows = content.trim().split('\n').map((row) =>
    row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  );
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  triggerDownload(new Blob([buf], { type: 'application/octet-stream' }), `${filename}.xlsx`);
}

async function downloadSlides(content: string, filename = 'presentation') {
  const pptxgenModule = await import('pptxgenjs');
  const PptxGen = pptxgenModule.default;
  const pptx = new PptxGen();
  const slides = content.split(/^---$/m).filter((s) => s.trim());
  for (const slideContent of slides) {
    const slide = pptx.addSlide();
    const lines = slideContent.trim().split('\n').filter((l) => l.trim());
    let titleAdded = false;
    const bodyLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('# ') && !titleAdded) {
        slide.addText(line.slice(2), { x: 0.5, y: 0.5, w: 9, h: 1.2, fontSize: 32, bold: true, color: '363636' });
        titleAdded = true;
      } else if (line.trim()) {
        bodyLines.push(line.startsWith('- ') ? line.slice(2) : line);
      }
    }
    if (bodyLines.length > 0) {
      slide.addText(bodyLines.join('\n'), { x: 0.5, y: 1.9, w: 9, h: 4.5, fontSize: 18, valign: 'top', color: '666666' });
    }
  }
  await pptx.writeFile({ fileName: `${filename}.pptx` });
}

async function downloadSlidesDesign(content: string, filename = 'presentation') {
  const pptxgenModule = await import('pptxgenjs');
  const PptxGen = pptxgenModule.default;
  const pptx = new PptxGen();
  pptx.layout = 'LAYOUT_WIDE';

  // HSL → hex helper
  const hsl = (h: number, s: number, l: number): string => {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  };

  const all = content.split(/^---$/m).filter(s => s.trim());
  const parsed = all.map(sc => {
    const lines = sc.trim().split('\n').filter(l => l.trim());
    const titleLine = lines.find(l => /^#{1,2}\s/.test(l));
    const title = titleLine ? titleLine.replace(/^#{1,2}\s/, '').trim() : '';
    const body = lines.filter(l => !/^#{1,2}\s/.test(l)).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    return { title, body };
  });

  const topic = parsed[0]?.title || filename;

  // Hash raw content → unique hue (colour) + layout style per presentation
  const rawHash = content.slice(0, 300).split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const hue      = Math.abs(rawHash) % 360;
  const styleIdx = (Math.abs(rawHash) >> 6) % 4; // 4 totally different layouts

  const T = {
    bg:    hsl(hue, 28,  7),
    panel: hsl(hue, 28, 12),
    acc:   hsl(hue, 80, 58),
    a2:    hsl((hue + 40) % 360, 74, 64),
    text:  'F8FAFC',
    sub:   hsl(hue, 22, 62),
    dim:   hsl(hue, 22, 17),
  };

  const coverImg = await (async (): Promise<{ data: string; mime: string } | null> => {
    try {
      const res = await fetch(`/api/cover-image?topic=${encodeURIComponent(topic)}`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.data ? { data: j.data, mime: j.mime ?? 'image/jpeg' } : null;
    } catch { return null; }
  })();

  const img = coverImg ? `data:${coverImg.mime};base64,${coverImg.data}` : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bullets = (slide: any, body: string[], x: number, y: number, w: number, h: number, fs = 18) => {
    if (!body.length) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = body.flatMap((ln, i) => [
      { text: '▪  ', options: { fontSize: 8, color: T.acc, fontFace: 'Calibri' } },
      { text: ln + (i < body.length - 1 ? '\n' : ''), options: { fontSize: fs, color: T.text, fontFace: 'Calibri' } },
    ]);
    slide.addText(items, { x, y, w, h, valign: 'top', paraSpaceAfter: 13 });
  };

  for (let idx = 0; idx < all.length; idx++) {
    const { title, body } = parsed[idx];
    const slide = pptx.addSlide();
    slide.background = { color: T.bg };

    if (idx === 0) {
      /* ══════════════════════════════════════════════════════════════
         COVER — 4 distinct layouts
      ══════════════════════════════════════════════════════════════ */

      if (styleIdx === 0) {
        // Layout A — Editorial: image bleeds left, text panel floats centre-left
        if (img) slide.addImage({ data: img, x: 0, y: 0, w: 13.33, h: 7.5, transparency: 30 });
        slide.addShape('rect', { x: 0, y: 0, w: 9.2, h: 7.5, fill: { color: T.bg, transparency: 18 }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('ellipse', { x: 8.6, y: -2, w: 7, h: 7, fill: { color: T.acc, transparency: 91 }, line: { color: T.acc, width: 2, transparency: 80 } });
        slide.addShape('ellipse', { x: 11.2, y: 5.5, w: 2.8, h: 2.8, fill: { color: T.a2, transparency: 84 }, line: { width: 0 } });
        slide.addText(title || filename, { x: 0.65, y: 1.3, w: 8.2, h: 2.8, fontSize: 54, bold: true, color: T.text, fontFace: 'Calibri', align: 'left', valign: 'middle' });
        slide.addShape('rect', { x: 0.65, y: 4.3, w: 4.8, h: 0.09, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('rect', { x: 5.6, y: 4.3, w: 2.2, h: 0.09, fill: { color: T.a2 }, line: { width: 0 } });
        if (body.length) slide.addText(body.join('  ·  '), { x: 0.65, y: 4.55, w: 8.2, h: 1.4, fontSize: 19, color: T.sub, fontFace: 'Calibri' });
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 7.26, w: 4.2, h: 0.24, fill: { color: T.acc, transparency: 48 }, line: { width: 0 } });

      } else if (styleIdx === 1) {
        // Layout B — Centered card: image full-bleed, frosted card floats centre
        if (img) slide.addImage({ data: img, x: 0, y: 0, w: 13.33, h: 7.5, transparency: 18 });
        slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: T.bg, transparency: 48 }, line: { width: 0 } });
        slide.addShape('rect', { x: 1.8, y: 1.0, w: 9.73, h: 5.4, fill: { color: T.panel, transparency: 15 }, line: { color: T.acc, width: 2 } });
        slide.addShape('rect', { x: 1.8, y: 1.0, w: 9.73, h: 0.2, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('rect', { x: 1.8, y: 1.0, w: 4.2, h: 0.2, fill: { color: T.a2 }, line: { width: 0 } });
        slide.addText(title || filename, { x: 2.2, y: 1.5, w: 8.9, h: 2.6, fontSize: 50, bold: true, color: T.text, fontFace: 'Calibri', align: 'center', valign: 'middle' });
        slide.addShape('rect', { x: 4.4, y: 4.2, w: 4.5, h: 0.08, fill: { color: T.acc }, line: { width: 0 } });
        if (body.length) slide.addText(body.join('  ·  '), { x: 2.2, y: 4.45, w: 8.9, h: 1.3, fontSize: 17, color: T.sub, fontFace: 'Calibri', align: 'center' });
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });

      } else if (styleIdx === 2) {
        // Layout C — Bold split: solid accent left panel, image right
        slide.addShape('rect', { x: 0, y: 0, w: 5.4, h: 7.5, fill: { color: T.acc }, line: { width: 0 } });
        if (img) slide.addImage({ data: img, x: 5.4, y: 0, w: 7.93, h: 7.5, transparency: 18 });
        slide.addShape('rect', { x: 5.4, y: 0, w: 7.93, h: 7.5, fill: { color: T.bg, transparency: 38 }, line: { width: 0 } });
        slide.addShape('rect', { x: 5.2, y: 0, w: 0.4, h: 7.5, fill: { color: T.a2, transparency: 25 }, line: { width: 0 } });
        slide.addShape('ellipse', { x: 0.3, y: 0.3, w: 4.5, h: 4.5, fill: { color: 'FFFFFF', transparency: 90 }, line: { color: 'FFFFFF', width: 1.5, transparency: 78 } });
        slide.addShape('ellipse', { x: 3.2, y: 5.6, w: 2.5, h: 2.5, fill: { color: 'FFFFFF', transparency: 85 }, line: { width: 0 } });
        slide.addText(title || filename, { x: 0.35, y: 1.4, w: 4.7, h: 3.0, fontSize: 42, bold: true, color: 'FFFFFF', fontFace: 'Calibri', align: 'left', valign: 'middle' });
        slide.addShape('rect', { x: 0.35, y: 4.65, w: 3.8, h: 0.09, fill: { color: 'FFFFFF', transparency: 40 }, line: { width: 0 } });
        if (body.length) slide.addText(body.join('\n'), { x: 0.35, y: 4.9, w: 4.7, h: 1.8, fontSize: 15, color: 'FFFFFF', fontFace: 'Calibri' });
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });

      } else {
        // Layout D — Top banner: image strip at top, large title below
        if (img) slide.addImage({ data: img, x: 0, y: 0, w: 13.33, h: 3.3, transparency: 18 });
        slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 3.3, fill: { color: T.acc, transparency: 58 }, line: { width: 0 } });
        slide.addShape('ellipse', { x: 10.8, y: -1.2, w: 4.8, h: 4.8, fill: { color: 'FFFFFF', transparency: 93 }, line: { color: 'FFFFFF', width: 1.5, transparency: 85 } });
        slide.addShape('rect', { x: 0, y: 3.28, w: 13.33, h: 0.14, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 3.28, w: 5.5, h: 0.14, fill: { color: T.a2 }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 3.42, w: 13.33, h: 4.08, fill: { color: T.bg }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 3.42, w: 0.28, h: 4.08, fill: { color: T.acc }, line: { width: 0 } });
        slide.addText(title || filename, { x: 0.55, y: 3.55, w: 12.4, h: 2.4, fontSize: 54, bold: true, color: T.text, fontFace: 'Calibri', align: 'left', valign: 'middle' });
        if (body.length) slide.addText(body.join('  ·  '), { x: 0.55, y: 6.1, w: 12.4, h: 1.0, fontSize: 18, color: T.sub, fontFace: 'Calibri' });
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 7.26, w: 4.5, h: 0.24, fill: { color: T.acc, transparency: 50 }, line: { width: 0 } });
      }

    } else {
      /* ══════════════════════════════════════════════════════════════
         CONTENT — 4 distinct layouts (matching cover style)
      ══════════════════════════════════════════════════════════════ */

      if (styleIdx === 0) {
        // Layout A — Right sidebar with decorative panel
        slide.addShape('rect', { x: 8.78, y: 0, w: 4.55, h: 7.5, fill: { color: T.panel }, line: { width: 0 } });
        slide.addShape('ellipse', { x: 9.1, y: 3.8, w: 3.6, h: 3.6, fill: { color: T.acc, transparency: 90 }, line: { color: T.acc, width: 1, transparency: 80 } });
        slide.addShape('rect', { x: 9.5, y: 3.5, w: 3.2, h: 0.09, fill: { color: T.acc, transparency: 28 }, line: { width: 0 } });
        slide.addShape('rect', { x: 9.5, y: 3.78, w: 2.0, h: 0.09, fill: { color: T.a2, transparency: 42 }, line: { width: 0 } });
        slide.addShape('rect', { x: 9.5, y: 4.06, w: 2.7, h: 0.09, fill: { color: T.acc, transparency: 58 }, line: { width: 0 } });
        slide.addShape('rect', { x: 8.75, y: 0, w: 0.03, h: 7.5, fill: { color: T.acc, transparency: 58 }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 0, w: 8.78, h: 0.08, fill: { color: T.acc }, line: { width: 0 } });
        slide.addText(title, { x: 0.55, y: 0.18, w: 8.0, h: 1.0, fontSize: 30, bold: true, color: T.text, fontFace: 'Calibri', valign: 'middle' });
        slide.addShape('rect', { x: 0.55, y: 1.22, w: 7.8, h: 0.05, fill: { color: T.dim }, line: { width: 0 } });
        slide.addShape('rect', { x: 0.55, y: 1.22, w: 2.8, h: 0.05, fill: { color: T.acc }, line: { width: 0 } });
        bullets(slide, body, 0.55, 1.42, 7.9, 5.6);
        slide.addShape('rect', { x: 0, y: 7.26, w: 8.78, h: 0.24, fill: { color: T.dim }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 7.26, w: 2.5, h: 0.24, fill: { color: T.acc, transparency: 62 }, line: { width: 0 } });

      } else if (styleIdx === 1) {
        // Layout B — Full width, no sidebar, wide open feel
        slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 0, w: 5.5, h: 0.12, fill: { color: T.a2 }, line: { width: 0 } });
        slide.addText(title, { x: 0.65, y: 0.22, w: 12.0, h: 1.1, fontSize: 34, bold: true, color: T.text, fontFace: 'Calibri', valign: 'middle' });
        slide.addShape('rect', { x: 0.65, y: 1.42, w: 12.0, h: 0.05, fill: { color: T.dim }, line: { width: 0 } });
        slide.addShape('rect', { x: 0.65, y: 1.42, w: 3.8, h: 0.05, fill: { color: T.acc }, line: { width: 0 } });
        bullets(slide, body, 0.65, 1.62, 11.8, 5.4);
        slide.addShape('ellipse', { x: 11.2, y: 1.2, w: 2.8, h: 2.8, fill: { color: T.acc, transparency: 92 }, line: { color: T.acc, width: 1, transparency: 74 } });
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 7.26, w: 3.2, h: 0.24, fill: { color: T.acc, transparency: 58 }, line: { width: 0 } });

      } else if (styleIdx === 2) {
        // Layout C — Bold left accent strip, editorial look
        slide.addShape('rect', { x: 0, y: 0, w: 0.6, h: 7.5, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('rect', { x: 0.6, y: 0, w: 0.14, h: 7.5, fill: { color: T.a2, transparency: 45 }, line: { width: 0 } });
        slide.addShape('rect', { x: 0.74, y: 0, w: 12.59, h: 0.06, fill: { color: T.dim }, line: { width: 0 } });
        slide.addText(title, { x: 0.95, y: 0.1, w: 12.0, h: 1.1, fontSize: 32, bold: true, color: T.text, fontFace: 'Calibri', valign: 'middle' });
        slide.addShape('rect', { x: 0.95, y: 1.28, w: 11.8, h: 0.05, fill: { color: T.dim }, line: { width: 0 } });
        slide.addShape('rect', { x: 0.95, y: 1.28, w: 4.2, h: 0.05, fill: { color: T.acc }, line: { width: 0 } });
        bullets(slide, body, 0.95, 1.48, 12.0, 5.8);
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });

      } else {
        // Layout D — Top title band, content below
        slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.35, fill: { color: T.panel }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.1, fill: { color: T.acc }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 1.25, w: 13.33, h: 0.1, fill: { color: T.dim }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 1.25, w: 5.0, h: 0.1, fill: { color: T.a2, transparency: 38 }, line: { width: 0 } });
        slide.addShape('ellipse', { x: 12.0, y: 0.12, w: 1.1, h: 1.1, fill: { color: T.acc, transparency: 72 }, line: { width: 0 } });
        slide.addText(title, { x: 0.55, y: 0.12, w: 11.2, h: 1.1, fontSize: 30, bold: true, color: T.text, fontFace: 'Calibri', valign: 'middle' });
        bullets(slide, body, 0.55, 1.55, 12.3, 5.5);
        slide.addShape('rect', { x: 0, y: 7.26, w: 13.33, h: 0.24, fill: { color: T.panel }, line: { width: 0 } });
        slide.addShape('rect', { x: 0, y: 7.26, w: 2.8, h: 0.24, fill: { color: T.acc, transparency: 58 }, line: { width: 0 } });
      }
    }
  }

  await pptx.writeFile({ fileName: `${filename}-design.pptx` });
}

async function downloadPDF(content: string, filename = 'document') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const lh = 7;

  for (const line of content.split('\n')) {
    if (y > 275) { doc.addPage(); y = margin; }
    if (line.startsWith('# ')) {
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text(line.slice(2), margin, y); y += lh * 1.8;
    } else if (line.startsWith('## ')) {
      doc.setFontSize(15); doc.setFont('helvetica', 'bold');
      doc.text(line.slice(3), margin, y); y += lh * 1.5;
    } else if (line.startsWith('### ')) {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text(line.slice(4), margin, y); y += lh * 1.3;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(`• ${line.slice(2)}`, maxWidth - 5);
      doc.text(wrapped, margin + 3, y); y += lh * wrapped.length;
    } else if (line.trim() === '') {
      y += lh * 0.5;
    } else {
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      const clean = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
      const wrapped = doc.splitTextToSize(clean, maxWidth);
      doc.text(wrapped, margin, y); y += lh * wrapped.length;
    }
  }
  doc.save(`${filename}.pdf`);
}


function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
