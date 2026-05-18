'use client';

import { useState, useEffect, useRef } from 'react';
import { ProviderTheme } from '@/lib/providerThemes';
import { Shuffle, ChevronLeft, ChevronRight, RotateCcw, Download, Volume2, VolumeX } from 'lucide-react';
import { detectScriptLang, getBestVoice } from '@/lib/tts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExamQuestion {
  id: number;
  text: string;
  options: string[];
  correct: number;
  explanation?: string;
}
interface ExamData {
  title: string;
  questions: ExamQuestion[];
}
interface FlashcardData {
  title: string;
  cards: { front: string; back: string }[];
}

// ── ExamBlock ─────────────────────────────────────────────────────────────────

export function ExamBlock({ raw, theme }: { raw: string; theme: ProviderTheme }) {
  let data: ExamData | null = null;
  try { data = JSON.parse(raw); } catch { /* malformed */ }

  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    data ? Array(data.questions.length).fill(null) : []
  );
  const [submitted, setSubmitted] = useState(false);

  if (!data) return (
    <div className="my-3 rounded-xl px-4 py-3 text-xs border" style={{ borderColor: 'var(--ui-border)', color: '#f87171' }}>
      Could not parse exam data.
    </div>
  );

  const score = answers.filter((a, i) => a === data!.questions[i].correct).length;

  const reset = () => {
    setAnswers(Array(data!.questions.length).fill(null));
    setSubmitted(false);
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b"
        style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: theme.primaryColor }}>
            Interactive Exam
          </p>
          <p className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>{data.title}</p>
        </div>
        {submitted && (
          <span className="text-lg font-bold" style={{ color: score === data.questions.length ? '#22C55E' : theme.primaryColor }}>
            {score}/{data.questions.length}
          </span>
        )}
      </div>

      {/* Questions */}
      <div>
        {data.questions.map((q, qi) => {
          const picked = answers[qi];
          const correct = q.correct;
          return (
            <div key={q.id ?? qi} className="px-4 py-4 border-b last:border-0"
              style={{ borderColor: 'var(--ui-border)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--ui-text-1)' }}>
                <span style={{ color: theme.primaryColor }}>{qi + 1}.&nbsp;</span>{q.text}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected = picked === oi;
                  const isCorrectOpt = submitted && oi === correct;
                  const isWrongPick = submitted && isSelected && oi !== correct;
                  let bg = 'transparent', border = 'var(--ui-border)', color = 'var(--ui-text-2)';
                  if (isCorrectOpt) { bg = 'rgba(34,197,94,0.1)'; border = '#22C55E'; color = '#22C55E'; }
                  else if (isWrongPick) { bg = 'rgba(239,68,68,0.1)'; border = '#EF4444'; color = '#EF4444'; }
                  else if (!submitted && isSelected) { bg = theme.imageActiveBg; border = theme.primaryColor; color = theme.primaryColor; }

                  return (
                    <button key={oi} disabled={submitted}
                      onClick={() => { const n = [...answers]; n[qi] = oi; setAnswers(n); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left border transition-colors"
                      style={{ background: bg, borderColor: border, color }}
                      onMouseEnter={(e) => { if (!submitted && !isSelected) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
                      onMouseLeave={(e) => { if (!submitted && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{ borderColor: border }}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation && (
                <p className="mt-3 text-xs px-3 py-2.5 rounded-xl leading-relaxed"
                  style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-3)' }}>
                  💡 {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center gap-3"
        style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-card)' }}>
        {!submitted ? (
          <button onClick={() => setSubmitted(true)} disabled={answers.includes(null)}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ background: theme.primaryColor }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
            Submit
          </button>
        ) : (
          <>
            <p className="flex-1 text-sm" style={{ color: 'var(--ui-text-2)' }}>
              Score:&nbsp;
              <strong style={{ color: score === data.questions.length ? '#22C55E' : theme.primaryColor }}>
                {score}/{data.questions.length}
              </strong>
              &nbsp;&mdash;&nbsp;{Math.round((score / data.questions.length) * 100)}%
            </p>
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors"
              style={{ background: 'var(--ui-bg-card-hover)', color: 'var(--ui-text-2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ui-text-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ui-text-2)')}>
              <RotateCcw size={12} /> Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── CardSpeaker ───────────────────────────────────────────────────────────────

function CardSpeaker({ text, accentColor }: { text: string; accentColor: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => { const v = window.speechSynthesis?.getVoices() ?? []; if (v.length) setVoices(v); };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // Stop when the card changes (text prop changes)
  useEffect(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, [text]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't flip the card
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const lang = detectScriptLang(text) || navigator.language || 'en-US';
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.92;
    const best = getBestVoice(lang, voices);
    if (best) utt.voice = best;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
    setSpeaking(true);
  };

  return (
    <button
      onClick={toggle}
      title={speaking ? 'Stop' : 'Read aloud'}
      className="flex items-center justify-center w-7 h-7 rounded-full transition-colors mt-2"
      style={{
        color: speaking ? accentColor : 'rgba(156,163,175,0.7)',
        background: speaking ? `${accentColor}18` : 'transparent',
      }}
      onMouseEnter={(e) => { if (!speaking) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { if (!speaking) e.currentTarget.style.background = 'transparent'; }}
    >
      {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
  );
}

// ── FlashcardBlock ────────────────────────────────────────────────────────────

export function FlashcardBlock({ raw, theme }: { raw: string; theme: ProviderTheme }) {
  let data: FlashcardData | null = null;
  try { data = JSON.parse(raw); } catch { /* malformed */ }

  const [cards, setCards] = useState(() => data?.cards ?? []);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  if (!data) return (
    <div className="my-3 rounded-xl px-4 py-3 text-xs border" style={{ borderColor: 'var(--ui-border)', color: '#f87171' }}>
      Could not parse flashcard data.
    </div>
  );

  const total = cards.length;
  const card = cards[index];

  const goTo = (i: number) => { setIndex(Math.max(0, Math.min(total - 1, i))); setFlipped(false); };

  const shuffle = () => {
    setCards(c => [...c].sort(() => Math.random() - 0.5));
    setIndex(0); setFlipped(false); setKnown(new Set());
  };

  const markKnown = () => {
    setKnown(prev => { const n = new Set(prev); n.add(index); return n; });
    if (index < total - 1) goTo(index + 1);
  };

  const showDots = total <= 20;

  return (
    <div className="my-4 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b"
        style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: theme.primaryColor }}>Flashcards</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>{data.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ui-text-3)' }}>{known.size}/{total} known</span>
          <button onClick={shuffle}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            style={{ background: 'var(--ui-bg-card-hover)', color: 'var(--ui-text-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ui-text-1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ui-text-2)')}>
            <Shuffle size={12} /> Shuffle
          </button>
        </div>
      </div>

      {/* Card flip area */}
      <div className="px-4 py-6 flex flex-col items-center gap-3">
        <div className="w-full max-w-md cursor-pointer select-none"
          style={{ perspective: '1200px', height: '190px' }}
          onClick={() => setFlipped(f => !f)}>
          <div style={{
            position: 'relative', width: '100%', height: '100%',
            transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            {/* Front */}
            <div style={{
              position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
              background: theme.userBubbleBg, border: `1px solid ${theme.userBubbleBorder}`,
              borderRadius: 16, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '20px 24px',
            }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.dotColor }}>FRONT</p>
              <p className="text-base font-semibold text-center" style={{ color: 'var(--ui-text-1)' }}>{card.front}</p>
              <CardSpeaker text={card.front} accentColor={theme.primaryColor} />
            </div>
            {/* Back */}
            <div style={{
              position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--ui-bg-card)', border: '1px solid var(--ui-input-border)',
              borderRadius: 16, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '20px 24px',
            }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ui-text-3)' }}>BACK</p>
              <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--ui-prose)' }}>{card.back}</p>
              <CardSpeaker text={card.back} accentColor={theme.primaryColor} />
            </div>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--ui-text-3)' }}>Click to flip • {index + 1} / {total}</p>
      </div>

      {/* Navigation dots */}
      {showDots && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <button onClick={() => goTo(index - 1)} disabled={index === 0}
            className="p-1.5 rounded-lg disabled:opacity-30 transition-colors"
            style={{ background: 'var(--ui-bg-card-hover)' }}>
            <ChevronLeft size={14} style={{ color: 'var(--ui-text-2)' }} />
          </button>
          <div className="flex-1 flex flex-wrap justify-center gap-1.5">
            {cards.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === index ? 22 : 8, height: 8,
                  background: i === index ? theme.primaryColor : known.has(i) ? '#22C55E' : 'var(--ui-border)',
                }} />
            ))}
          </div>
          <button onClick={() => goTo(index + 1)} disabled={index === total - 1}
            className="p-1.5 rounded-lg disabled:opacity-30 transition-colors"
            style={{ background: 'var(--ui-bg-card-hover)' }}>
            <ChevronRight size={14} style={{ color: 'var(--ui-text-2)' }} />
          </button>
        </div>
      )}

      {/* Know / Still learning */}
      <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--ui-border)' }}>
        <button onClick={() => { if (index < total - 1) goTo(index + 1); }}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}>
          Still learning
        </button>
        <button onClick={markKnown}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}>
          Got it ✓
        </button>
      </div>
    </div>
  );
}

// ── MermaidBlock ──────────────────────────────────────────────────────────────

/**
 * Cleans AI-generated Mermaid code before rendering.
 *
 * Handles three categories of common AI mistakes:
 *  1. Unquoted special characters in node labels (flowchart)
 *  2. Incorrect arrow formatting (-> instead of --> in flowchart, => in sequence)
 *  3. Nested code fences accidentally included in the output
 *
 * For erDiagram it additionally uses a line-by-line normaliser to reduce every
 * attribute to the strict "type name [PK|FK|UK]" format.
 */
function sanitizeMermaid(raw: string): string {
  // Strip nested code fences — AI occasionally wraps content in extra fences
  let code = raw
    .replace(/^```(?:mermaid)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();

  // Detect diagram type from first non-blank line
  const firstLine = code.trimStart().split('\n')[0].trim();
  const isFlowchart = /^(graph|flowchart)\b/i.test(firstLine);
  const isSequence  = /^sequenceDiagram\b/i.test(firstLine);
  const isEr        = /^erDiagram\b/i.test(firstLine);

  // ── Global fixes ────────────────────────────────────────────────────────────
  code = code
    // SQL-style type length modifiers  VARCHAR(255) → VARCHAR
    .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\(\d+(?:,\s*\d+)?\)/g, '$1')
    // Strip inline SQL column constraints
    .replace(/\s+(NOT\s+NULL|DEFAULT\s+\S+|CHECK\s*\([^)]*\)|AUTO_INCREMENT|UNSIGNED|ZEROFILL)/gi, '')
    // UNIQUE → UK (erDiagram)
    .replace(/\bUNIQUE\b/g, 'UK');

  // ── flowchart / graph fixes ──────────────────────────────────────────────────
  if (isFlowchart) {
    code = code
      // ==> or => → -->
      .replace(/==>/g, '-->')
      .replace(/(?<![=-])=>(?!>)/g, '-->')
      // Single-dash arrow  A -> B  →  A --> B
      // Guard: the char before - must not be -, and the char after > must not be >
      .replace(/([^-\s])\s*->\s*(?!>)/g, '$1 --> ')
      // Quote flowchart labels that contain characters the parser can't handle
      // unquoted: ( ) & | : ; # < >
      // Only touches [label], not already-quoted ["label"]
      .replace(/([A-Za-z0-9_]+)\[([^\]\n]+)\]/g, (_m, id, label) => {
        const t = label.trim();
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
          return `${id}[${label}]`; // already quoted
        }
        if (/[()&|:;#<>]/.test(t)) {
          return `${id}["${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
        }
        return `${id}[${label}]`;
      });
  }

  // ── sequenceDiagram fixes ────────────────────────────────────────────────────
  if (isSequence) {
    code = code
      // => is not valid — replace with ->>
      .replace(/([A-Za-z0-9_\s"]+)=>>?\s*([A-Za-z0-9_\s"]+):/g, '$1->>$2:')
      // Bare = arrows: A=B: → A->>B:
      .replace(/([A-Za-z0-9_"]+)\s*=\s*([A-Za-z0-9_"]+)\s*:/g, '$1->>$2:');
  }

  // ── erDiagram: line-by-line attribute normaliser ─────────────────────────────
  if (isEr) {
    const lines = code.split('\n');
    let inBlock = false;
    code = lines.map(line => {
      if (!inBlock && /^\s+\w+\s*\{\s*$/.test(line)) { inBlock = true; return line; }
      if (inBlock && /^\s*\}\s*$/.test(line))         { inBlock = false; return line; }
      if (inBlock) {
        const m = line.match(/^(\s+)([A-Za-z_][A-Za-z0-9_]*)[ \t]+([A-Za-z_][A-Za-z0-9_]*)(.*)$/);
        if (m) {
          const [, indent, type, name, rest] = m;
          const key = rest.match(/\b(PK|FK|UK)\b/)?.[1] ?? '';
          return `${indent}${type} ${name}${key ? ` ${key}` : ''}`;
        }
      }
      return line;
    }).join('\n');
  }

  return code;
}

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [debouncedCode, setDebouncedCode] = useState(code);
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2, 9)}`);

  // Debounce streaming chunks — only attempt render when code stops changing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCode(code), 350);
    return () => clearTimeout(t);
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false); setSvg('');
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#7C3AED',
          primaryTextColor: '#e5e7eb',
          primaryBorderColor: '#5B21B6',
          lineColor: '#9CA3AF',
          secondaryColor: '#1E1B4B',
          tertiaryColor: '#0f0f1a',
          background: '#0f0f1a',
          mainBkg: '#1a1a2e',
          nodeBorder: '#5B21B6',
          clusterBkg: '#1E1B4B',
          titleColor: '#e5e7eb',
          edgeLabelBackground: '#1a1a2e',
          attributeBackgroundColorEven: '#1a1a2e',
          attributeBackgroundColorOdd: '#151525',
        },
      });
      mermaid.render(idRef.current, sanitizeMermaid(debouncedCode.trim()))
        .then(({ svg: s }) => {
          if (cancelled) return;
          // Guard: Mermaid may still embed error text in the SVG on some versions
          if (s.includes('Syntax error') || s.includes('mermaid-error-icon') || s.includes('#mermaid-error')) {
            setFailed(true);
          } else {
            setSvg(s);
          }
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    });
    return () => { cancelled = true; };
  }, [debouncedCode]);

  const downloadSVG = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'diagram.svg',
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ui-border)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b"
        style={{ background: 'var(--ui-bg-card)', borderColor: 'var(--ui-border)' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ui-text-3)' }}>
          Diagram
        </span>
        {svg && (
          <button onClick={downloadSVG}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--ui-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card-hover)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}>
            <Download size={11} /> SVG
          </button>
        )}
      </div>
      {failed ? (
        <div style={{ background: '#0f0f1a', minHeight: '80px' }} />
      ) : svg ? (
        <div ref={containerRef} className="p-4 overflow-x-auto flex items-center justify-center"
          style={{ background: '#0f0f1a', minHeight: '120px' }}
          dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="p-6 flex items-center justify-center" style={{ minHeight: '80px' }}>
          <span className="text-xs animate-pulse" style={{ color: 'var(--ui-text-3)' }}>Rendering…</span>
        </div>
      )}
    </div>
  );
}
