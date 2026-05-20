'use client';

import { useState } from 'react';
import {
  MessageSquare, Image, Music, Video,
  Mic, FileText, File, BookOpen, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Category, categories } from '@/lib/models';
import { getCategoryTheme } from '@/lib/providerThemes';
import { useAccent } from '@/lib/accent';

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  text:          MessageSquare,
  image:         Image,
  audio:         Music,
  video:         Video,
  speech:        Mic,
  transcription: FileText,
  document:      File,
  study:         BookOpen,
};

interface Props {
  active: Category;
  onSelect: (c: Category) => void;
}

export function ProviderRail({ active, onSelect }: Props) {
  const accentHex = useAccent();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="shrink-0 flex flex-col border-r overflow-y-auto transition-all duration-200"
      style={{
        width: expanded ? 160 : 52,
        background: 'var(--ui-bg-rail)',
        borderColor: 'var(--ui-border)',
      }}
    >
      {/* Toggle button */}
      <div className={`flex py-3 px-2 ${expanded ? 'justify-end' : 'justify-center'}`}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--ui-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Category buttons */}
      <div className="flex flex-col px-2 space-y-0.5 pb-3">
        {categories.map((cat) => {
          const theme = getCategoryTheme(cat.color, accentHex);
          const Icon = CATEGORY_ICONS[cat.id];
          const isActive = active === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className="w-full flex items-center rounded-lg text-sm text-left transition-colors"
              style={{
                gap: expanded ? 10 : 0,
                padding: expanded ? '8px 12px' : '8px 0',
                justifyContent: expanded ? 'flex-start' : 'center',
                background: isActive ? 'var(--ui-bg-card-hover)' : 'transparent',
                color: isActive ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
                fontWeight: isActive ? 500 : 400,
                boxShadow: isActive ? `inset 2px 0 0 ${theme.railRing}` : 'none',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              title={cat.label}
            >
              <Icon size={14} style={{ flexShrink: 0 }} />
              {expanded && <span className="truncate">{cat.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
