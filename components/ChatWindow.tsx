'use client';

import { useState, useRef, useEffect, useCallback, startTransition, memo, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Message, Attachment } from '@/types';
import { Model, models, getModel, Provider } from '@/lib/models';
import { Conversation, saveConversation } from '@/lib/history';
import { getProviderTheme, ProviderTheme } from '@/lib/providerThemes';
import { useAccent } from '@/lib/accent';
import {
  Send, StopCircle, BookOpen, Loader2, Image as ImageIcon,
  ChevronDown, Paperclip, Download, Mic,
  Copy, Check, Volume2, VolumeX, GraduationCap, RotateCcw, X, FileText,
} from 'lucide-react';
import { ExamBlock, FlashcardBlock, MermaidBlock } from './StudyBlocks';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { DocumentPanel } from './DocumentPanel';
import { detectScriptLang, getBestVoice } from '@/lib/tts';

interface Props {
  conversation: Conversation | null;
  provider: Provider;
  onConversationUpdate: (conv: Conversation) => void;
}

export function ChatWindow({ conversation, provider, onConversationUpdate }: Props) {
  const { data: session } = useSession();
  const userId = session?.user?.email ?? '';
  const accentHex = useAccent();
  const theme = useMemo(() => getProviderTheme(provider, accentHex), [provider, accentHex]);

  const [messages, setMessages] = useState<Message[]>(conversation?.messages ?? []);
  const [modelId, setModelId] = useState<'fast' | 'balanced' | 'pro'>(conversation?.modelId ?? 'fast');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showStudy, setShowStudy] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const convIdRef = useRef<string>(conversation?.id ?? crypto.randomUUID());
  const convCreatedAtRef = useRef<string>(conversation?.createdAt ?? new Date().toISOString());
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const studyPickerRef = useRef<HTMLDivElement>(null);
  const docPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const isScrollActiveRef = useRef(false);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const model = getModel(modelId);

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages);
      setModelId(conversation.modelId);
      convIdRef.current = conversation.id;
      convCreatedAtRef.current = conversation.createdAt;
    } else {
      setMessages([]);
      setModelId('fast');
      convIdRef.current = crypto.randomUUID();
      convCreatedAtRef.current = new Date().toISOString();
    }
    setInput('');
    setIsStreaming(false);
    setIsThinking(false);
    setImageMode(false);
    setAttachments([]);
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
      if (studyPickerRef.current && !studyPickerRef.current.contains(e.target as Node)) {
        setShowStudy(false);
      }
      if (docPickerRef.current && !docPickerRef.current.contains(e.target as Node)) {
        setShowDocPicker(false);
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
    (msgs: Message[], mid: 'fast' | 'balanced' | 'pro') => {
      const title = msgs.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'New conversation';
      const now = new Date().toISOString();
      const conv: Conversation = {
        id: convIdRef.current,
        title,
        modelId: mid,
        provider,
        messages: msgs,
        createdAt: convCreatedAtRef.current,
        updatedAt: now,
      };
      saveConversation(conv, userId);
      window.dispatchEvent(new Event('aion:history'));
      onConversationUpdate(conv);
    },
    [onConversationUpdate, provider, userId],
  );

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
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
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
      const isImageRequest = (imageMode || (IMAGE_VERB_RE.test(trimmed) && IMAGE_NOUN_RE.test(trimmed))) && !hasTextAttachment;

      if (isImageRequest) {
        try {
          const res = await fetch('/api/generate/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: content.trim(),
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

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId,
            provider,
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            attachments: pendingAttachments,
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
    [messages, isStreaming, modelId, provider, imageMode, persistConversation, attachments],
  );

  const regenerate = useCallback(async () => {
    if (isStreaming) return;
    autoScrollRef.current = true;
    const base = messages[messages.length - 1]?.role === 'assistant'
      ? messages.slice(0, -1)
      : messages;
    if (!base.length || base[base.length - 1].role !== 'user') return;

    const assistantId = crypto.randomUUID();
    const withAssistant: Message[] = [
      ...base,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
    ];
    setMessages(withAssistant);
    setIsThinking(true);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    const update = (u: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...u } : m)));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId, provider,
          messages: base.map((m) => ({ role: m.role, content: m.content })),
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
      persistConversation(
        withAssistant.map((m) => (m.id === assistantId ? { ...m, content: full } : m)),
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
  }, [messages, isStreaming, modelId, provider, persistConversation]);

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

      <div ref={scrollAreaRef} onScroll={handleScrollArea} className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <EmptyState model={model} theme={theme} onSend={sendMessage} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                modelIcon={model.icon}
                theme={theme}
                onRegenerate={
                  msg.role === 'assistant' && i === messages.length - 1 && !isStreaming
                    ? regenerate
                    : undefined
                }
              />
            ))}
            {isThinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'var(--ui-bg-card)' }}>
                  {model.icon}
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
            {/* Model picker */}
            <div className="relative" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
              >
                <span>{model.icon}</span>
                <span>{model.name}</span>
                <ChevronDown size={13} className={`transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full mb-2 left-0 rounded-xl border shadow-xl overflow-hidden min-w-48 z-20"
                  style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}>
                  {models.map((m) => (
                    <button key={m.id}
                      onClick={() => { setModelId(m.id); setShowModelPicker(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                      style={{ color: modelId === m.id ? 'var(--ui-text-1)' : 'var(--ui-text-2)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span>{m.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>{m.description}</p>
                      </div>
                      {modelId === m.id && <span className="text-xs" style={{ color: theme.primaryColor }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Image mode */}
            <button
              onClick={() => setImageMode((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={imageMode ? {
                background: theme.imageActiveBg, color: theme.imageActiveColor,
                border: `1px solid ${theme.imageActiveBorder}`,
              } : { background: 'var(--ui-bg-card)', color: 'var(--ui-text-3)', border: '1px solid transparent' }}
              onMouseEnter={(e) => { if (!imageMode) e.currentTarget.style.background = 'var(--ui-bg-card-hover)'; }}
              onMouseLeave={(e) => { if (!imageMode) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
            >
              <ImageIcon size={13} />
              <span>Image</span>
            </button>

            {/* Docs / file generation picker */}
            <div className="relative" ref={docPickerRef}>
              <button
                onClick={() => setShowDocPicker((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={showDocPicker ? {
                  background: theme.imageActiveBg, color: theme.imageActiveColor,
                  border: `1px solid ${theme.imageActiveBorder}`,
                } : { background: 'var(--ui-bg-card)', color: 'var(--ui-text-3)', border: '1px solid transparent' }}
                onMouseEnter={(e) => { if (!showDocPicker) e.currentTarget.style.background = 'var(--ui-bg-card-hover)'; }}
                onMouseLeave={(e) => { if (!showDocPicker) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
              >
                <BookOpen size={13} />
                <span>Docs</span>
                <ChevronDown size={11} className={`transition-transform ${showDocPicker ? 'rotate-180' : ''}`} />
              </button>
              {showDocPicker && (
                <div className="absolute bottom-full mb-2 left-0 rounded-xl border shadow-xl overflow-hidden min-w-52 z-20"
                  style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}>
                  {[
                    { icon: '📄', label: 'Document', desc: 'Word-style .docx file',       prompt: 'Write a Word document about ' },
                    { icon: '📊', label: 'Spreadsheet', desc: 'Excel-style .xlsx file',    prompt: 'Create a spreadsheet for ' },
                    { icon: '📑', label: 'Presentation', desc: 'PowerPoint-style .pptx file', prompt: 'Create a PowerPoint presentation about ' },
                    { icon: '📋', label: 'PDF', desc: 'PDF document',                       prompt: 'Write a PDF document about ' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setInput(item.prompt);
                        setShowDocPicker(false);
                        requestAnimationFrame(() => { textareaRef.current?.focus(); autoResize(); });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                      style={{ color: 'var(--ui-text-2)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-base">{item.icon}</span>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--ui-text-1)' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>{item.desc}</p>
                      </div>
                    </button>
                  ))}
                  <div className="border-t mx-2" style={{ borderColor: 'var(--ui-border)' }} />
                  <button
                    onClick={() => { setShowDocs(true); setShowDocPicker(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                    style={{ color: 'var(--ui-text-2)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="text-base">⬆️</span>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--ui-text-1)' }}>
                        Upload to context{docCount > 0 ? ` (${docCount})` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>Add files for AI to reference</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Study mode */}
            <div className="relative" ref={studyPickerRef}>
              <button
                onClick={() => setShowStudy((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={showStudy ? {
                  background: theme.imageActiveBg, color: theme.imageActiveColor,
                  border: `1px solid ${theme.imageActiveBorder}`,
                } : { background: 'var(--ui-bg-card)', color: 'var(--ui-text-3)', border: '1px solid transparent' }}
                onMouseEnter={(e) => { if (!showStudy) e.currentTarget.style.background = 'var(--ui-bg-card-hover)'; }}
                onMouseLeave={(e) => { if (!showStudy) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
              >
                <GraduationCap size={13} />
                <span>Study</span>
                <ChevronDown size={11} className={`transition-transform ${showStudy ? 'rotate-180' : ''}`} />
              </button>
              {showStudy && (
                <div className="absolute bottom-full mb-2 left-0 rounded-xl border shadow-xl overflow-hidden min-w-48 z-20"
                  style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}>
                  {[
                    { icon: '📝', label: 'Exam', desc: 'Interactive quiz with answers', prompt: 'Create an interactive exam with 5 multiple-choice questions about ' },
                    { icon: '🃏', label: 'Flashcards', desc: 'Flip cards to practice', prompt: 'Create a flashcard deck to help me study ' },
                    { icon: '🗺️', label: 'Mind Map', desc: 'Visual concept diagram', prompt: 'Draw a mind map diagram for ' },
                    { icon: '📊', label: 'Flowchart', desc: 'Process / logic diagram', prompt: 'Create a flowchart diagram showing ' },
                    { icon: '🔗', label: 'ER Diagram', desc: 'Entity-relationship diagram', prompt: 'Create an ER diagram for ' },
                    { icon: '🔄', label: 'Sequence', desc: 'Sequence / interaction diagram', prompt: 'Create a sequence diagram for ' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setInput(item.prompt);
                        setShowStudy(false);
                        requestAnimationFrame(() => {
                          textareaRef.current?.focus();
                          autoResize();
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                      style={{ color: 'var(--ui-text-2)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-base">{item.icon}</span>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--ui-text-1)' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>{item.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
              placeholder={imageMode ? 'Describe the image you want…' : isListening ? 'Listening…' : attachments.length > 0 ? `Add a message or just send ${attachments.length} file(s)…` : `Message ${model.name}…`}
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
              <button onClick={stop}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors mb-0.5">
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

function EmptyState({ model, theme, onSend }: { model: Model; theme: ProviderTheme; onSend: (s: string) => void }) {
  const suggestions = [
    'Explain how quantum computing works',
    'Write a professional email template',
    'Create a budget tracking spreadsheet',
    'Generate an image of a futuristic city at sunset',
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto px-4">
      <div className="text-5xl mb-4">{model.icon}</div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ui-text-1)' }}>{model.name}</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--ui-text-3)' }}>{model.description}</p>
      <div className="grid grid-cols-1 gap-2 w-full">
        {suggestions.map((s) => (
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

const MessageBubble = memo(function MessageBubble({ message, modelIcon, theme, onRegenerate }: {
  message: Message;
  modelIcon: string;
  theme: ProviderTheme;
  onRegenerate?: () => void;
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
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
        style={{ background: 'var(--ui-bg-card)' }}>
        {modelIcon}
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
        {message.content && (
          <MessageActions content={message.content} theme={theme} onRegenerate={onRegenerate} />
        )}
      </div>
    </div>
  );
});

function UserCopyButton({ content, theme }: { content: string; theme: ProviderTheme }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(content);
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

function MessageActions({ content, theme, onRegenerate }: {
  content: string;
  theme: ProviderTheme;
  onRegenerate?: () => void;
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
    await navigator.clipboard.writeText(plainText);
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

  return (
    <div className="flex items-center gap-1 pt-1">
      <button onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
        style={{ color: copied ? theme.primaryColor : 'var(--ui-text-3)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
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
      <button onClick={handleSpeak}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
        style={{ color: speaking ? theme.primaryColor : 'var(--ui-text-3)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
        <span>{speaking ? 'Stop' : 'Speak'}</span>
      </button>
    </div>
  );
}

function CodeCopyButton({ content, theme }: { content: string; theme: ProviderTheme }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(content);
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
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5"

  // ── Single cohesive dark theme ────────────────────────────────────
  const T = {
    bg:     '0D1117', // near-black base
    panel:  '161B22', // slightly lighter panel
    accent: '6366F1', // indigo primary
    a2:     'A855F7', // purple secondary
    text:   'F0F6FC', // near-white text
    sub:    '8B949E', // muted gray
    dim:    '21262D', // subtle border/divider
  };

  // Pollinations flux-schnell: AI-generated image that matches the topic exactly.
  // Deterministic seed = same topic always produces the same image on re-download.
  const stockUrl = (topic: string, w: number, h: number) => {
    const cleaned = topic.replace(/[^\w\s]/g, ' ').trim() || filename;
    const prompt = encodeURIComponent(
      `${cleaned.slice(0, 100)}, professional photography, high quality, sharp focus`
    );
    const seed = cleaned.split('').reduce((s, c) => (s * 31 + c.charCodeAt(0)) & 0x7fffffff, 7);
    return `https://image.pollinations.ai/prompt/${prompt}?width=${w}&height=${h}&model=flux-schnell&seed=${seed}&nologo=true&nofeed=true`;
  };

  // Fetch image through server proxy to avoid CORS, with client-side timeout
  const fetchImg = async (url: string): Promise<{ data: string; mime: string } | null> => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ? { data: json.data, mime: json.mime ?? 'image/jpeg' } : null;
    } catch {
      return null;
    }
  };

  const all = content.split(/^---$/m).filter(s => s.trim());
  const total = all.length;

  // Parse all slide titles up-front
  const parsed = all.map(sc => {
    const lines = sc.trim().split('\n').filter(l => l.trim());
    const titleLine = lines.find(l => /^#{1,2}\s/.test(l));
    const title = titleLine ? titleLine.replace(/^#{1,2}\s/, '').trim() : '';
    const body = lines.filter(l => !/^#{1,2}\s/.test(l)).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    return { title, body };
  });

  // Fetch exactly 2 images in parallel — Pollinations rate-limits many simultaneous
  // requests from the same IP, so we use one cover + one content image (reused on
  // all content slides). Both are AI-generated from the presentation topic.
  const topic = parsed[0]?.title || filename;
  const [coverImgData, sharedContentImg] = await Promise.all([
    fetchImg(stockUrl(topic, 1280, 720)),
    fetchImg(stockUrl(topic, 600, 600)),
  ]);

  for (let idx = 0; idx < all.length; idx++) {
    const { title, body } = parsed[idx];
    const slide = pptx.addSlide();
    slide.background = { color: T.bg };

    if (idx === 0) {
      // ════════════════════════════════════════════════════════════
      //  COVER  — full-bleed photo + dark overlay + left text panel
      // ════════════════════════════════════════════════════════════

      // Background photo — topic-aware, fetched server-side to avoid CORS
      if (coverImgData) {
        slide.addImage({
          data: `data:${coverImgData.mime};base64,${coverImgData.data}`,
          x: 0, y: 0, w: 13.33, h: 7.5, transparency: 60,
        });
      }

      // Dark vignette — left two-thirds, for text legibility
      slide.addShape('rect', {
        x: 0, y: 0, w: 9.5, h: 7.5,
        fill: { color: T.bg, transparency: 15 }, line: { width: 0 },
      });

      // Left accent bar
      slide.addShape('rect', {
        x: 0, y: 0, w: 0.22, h: 7.5,
        fill: { color: T.accent }, line: { width: 0 },
      });

      // Large decorative ring — top-right, very subtle
      slide.addShape('ellipse', {
        x: 8.8, y: -1.8, w: 6.5, h: 6.5,
        fill: { color: T.accent, transparency: 92 },
        line: { color: T.accent, width: 1.5, transparency: 78 },
      });
      // Smaller filled circle — bottom-right corner
      slide.addShape('ellipse', {
        x: 11.2, y: 5.6, w: 2.4, h: 2.4,
        fill: { color: T.a2, transparency: 86 }, line: { width: 0 },
      });

      // Title
      slide.addText(title || filename, {
        x: 0.65, y: 1.4, w: 8.4, h: 2.6,
        fontSize: 52, bold: true, color: T.text,
        fontFace: 'Calibri', align: 'left', valign: 'middle',
      });

      // Dual accent divider line (indigo + purple segments)
      slide.addShape('rect', {
        x: 0.65, y: 4.2, w: 4.5, h: 0.07,
        fill: { color: T.accent }, line: { width: 0 },
      });
      slide.addShape('rect', {
        x: 5.25, y: 4.2, w: 1.8, h: 0.07,
        fill: { color: T.a2 }, line: { width: 0 },
      });

      // Subtitle / body preview
      if (body.length > 0) {
        slide.addText(body.join('  ·  '), {
          x: 0.65, y: 4.45, w: 8.2, h: 1.4,
          fontSize: 20, color: T.sub, fontFace: 'Calibri', align: 'left',
        });
      }

      // Footer bar
      slide.addShape('rect', {
        x: 0, y: 7.26, w: 13.33, h: 0.24,
        fill: { color: T.panel }, line: { width: 0 },
      });
      slide.addShape('rect', {
        x: 0, y: 7.26, w: 3.8, h: 0.24,
        fill: { color: T.accent, transparency: 55 }, line: { width: 0 },
      });

    } else {
      // ════════════════════════════════════════════════════════════
      //  CONTENT  — left text (65%) + right sidebar image (35%)
      // ════════════════════════════════════════════════════════════

      // Right sidebar panel background
      slide.addShape('rect', {
        x: 8.78, y: 0, w: 4.55, h: 7.5,
        fill: { color: T.panel }, line: { width: 0 },
      });

      // Sidebar photo — topic-matched, shared across content slides
      if (sharedContentImg) {
        slide.addImage({
          data: `data:${sharedContentImg.mime};base64,${sharedContentImg.data}`,
          x: 8.78, y: 0, w: 4.55, h: 3.4, transparency: 8,
        });
      }

      // Fade strip between photo and lower panel
      slide.addShape('rect', {
        x: 8.78, y: 2.6, w: 4.55, h: 0.8,
        fill: { color: T.panel, transparency: 35 }, line: { width: 0 },
      });

      // Decorative ring in lower sidebar
      slide.addShape('ellipse', {
        x: 9.3, y: 4.4, w: 3.2, h: 3.2,
        fill: { color: T.accent, transparency: 91 },
        line: { color: T.accent, width: 1, transparency: 82 },
      });

      // Decorative accent bars where the slide number used to be
      slide.addShape('rect', {
        x: 9.55, y: 3.72, w: 3.0, h: 0.08,
        fill: { color: T.accent, transparency: 30 }, line: { width: 0 },
      });
      slide.addShape('rect', {
        x: 9.55, y: 3.96, w: 1.8, h: 0.08,
        fill: { color: T.a2, transparency: 45 }, line: { width: 0 },
      });
      slide.addShape('rect', {
        x: 9.55, y: 4.2, w: 2.4, h: 0.08,
        fill: { color: T.accent, transparency: 60 }, line: { width: 0 },
      });

      // Thin vertical divider between content and sidebar
      slide.addShape('rect', {
        x: 8.75, y: 0, w: 0.03, h: 7.5,
        fill: { color: T.accent, transparency: 60 }, line: { width: 0 },
      });

      // Top accent bar (content side only)
      slide.addShape('rect', {
        x: 0, y: 0, w: 8.78, h: 0.07,
        fill: { color: T.accent }, line: { width: 0 },
      });

      // Title
      slide.addText(title, {
        x: 0.55, y: 0.16, w: 8.0, h: 1.0,
        fontSize: 30, bold: true, color: T.text,
        fontFace: 'Calibri', valign: 'middle',
      });

      // Title underline (two-tone)
      slide.addShape('rect', {
        x: 0.55, y: 1.18, w: 7.8, h: 0.05,
        fill: { color: T.dim }, line: { width: 0 },
      });
      slide.addShape('rect', {
        x: 0.55, y: 1.18, w: 2.6, h: 0.05,
        fill: { color: T.accent }, line: { width: 0 },
      });

      // Bullet points
      if (body.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textItems: any[] = body.flatMap((line, i) => [
          { text: '●  ', options: { fontSize: 9, color: T.accent, fontFace: 'Calibri' } },
          {
            text: line + (i < body.length - 1 ? '\n' : ''),
            options: { fontSize: 19, color: T.text, fontFace: 'Calibri' },
          },
        ]);
        slide.addText(textItems, {
          x: 0.55, y: 1.38, w: 8.0, h: 5.8,
          valign: 'top', paraSpaceAfter: 12,
        });
      }

      // Footer bar (content side)
      slide.addShape('rect', {
        x: 0, y: 7.26, w: 8.78, h: 0.24,
        fill: { color: T.dim }, line: { width: 0 },
      });
      slide.addShape('rect', {
        x: 0, y: 7.26, w: 2.2, h: 0.24,
        fill: { color: T.accent, transparency: 65 }, line: { width: 0 },
      });
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
