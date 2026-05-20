'use client';

import {
  MessageSquare, Image, Music, Video,
  Mic, FileText, File, BookOpen,
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
  return (
    <div
      className="w-40 shrink-0 flex flex-col border-r py-3 px-2 space-y-0.5 overflow-y-auto"
      style={{ background: 'var(--ui-bg-rail)', borderColor: 'var(--ui-border)' }}
    >
      {categories.map((cat) => {
        const theme = getCategoryTheme(cat.color, accentHex);
        const Icon = CATEGORY_ICONS[cat.id];
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
            style={{
              background: isActive ? 'var(--ui-bg-card-hover)' : 'transparent',
              color: isActive ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
              fontWeight: isActive ? 500 : 400,
              boxShadow: isActive ? `inset 2px 0 0 ${theme.railRing}` : 'none',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            title={cat.label}
          >
            <Icon size={14} />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
