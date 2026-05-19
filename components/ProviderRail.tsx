'use client';

import { Category, categories } from '@/lib/models';
import { getCategoryTheme } from '@/lib/providerThemes';
import { useAccent } from '@/lib/accent';

interface Props {
  active: Category;
  onSelect: (c: Category) => void;
}

export function ProviderRail({ active, onSelect }: Props) {
  const accentHex = useAccent();
  return (
    <div
      className="w-[52px] flex flex-col items-center pt-3 pb-3 gap-0.5 shrink-0 border-r overflow-y-auto"
      style={{ background: 'var(--ui-bg-rail)', borderColor: 'var(--ui-border)' }}
    >
      {categories.map((cat) => {
        const theme = getCategoryTheme(cat.color, accentHex);
        return (
          <CategoryBtn
            key={cat.id}
            cat={cat}
            active={active === cat.id}
            onClick={() => onSelect(cat.id)}
            activeRing={theme.railRing}
          />
        );
      })}
    </div>
  );
}

function CategoryBtn({
  cat,
  active,
  onClick,
  activeRing,
}: {
  cat: typeof categories[0];
  active: boolean;
  onClick: () => void;
  activeRing: string;
}) {
  return (
    <div className="relative group w-full flex justify-center">
      <button
        onClick={onClick}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-base"
        style={active ? {
          background: 'var(--ui-bg-card-hover)',
          boxShadow: `0 0 0 1.5px ${activeRing}`,
        } : {}}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
        title={cat.label}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{cat.emoji}</span>
      </button>
      {/* Tooltip */}
      <div
        className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg border text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{ background: 'var(--ui-bg-card-hover)', borderColor: 'var(--ui-border)', color: 'var(--ui-text-1)' }}
      >
        {cat.label}
      </div>
    </div>
  );
}
