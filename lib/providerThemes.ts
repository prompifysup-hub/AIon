import { categories } from './models';

function hexToRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

function darkenHex(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const d = (s: string) => Math.max(0, Math.floor(parseInt(s, 16) * 0.82)).toString(16).padStart(2, '0');
  return `#${d(m[1])}${d(m[2])}${d(m[3])}`;
}

export interface ProviderTheme {
  primaryColor: string;
  primaryHover: string;
  chatBgTint: string;
  userBubbleBg: string;
  userBubbleBorder: string;
  dotColor: string;
  textareaBorderFocus: string;
  imageActiveBg: string;
  imageActiveBorder: string;
  imageActiveColor: string;
  docsActiveBg: string;
  docsActiveColor: string;
  railRing: string;
  downloadBtnBg: string;
  downloadBtnColor: string;
  blockquoteBorder: string;
  codeColor: string;
  isRainbow?: boolean;
}

// Legacy provider → color mapping
const LEGACY_COLORS: Record<string, string> = {
  gemini:   '#3B82F6',
  deepseek: '#1D4ED8',
  qwen:     '#9333EA',
};

function getCategoryColor(category: string): string | null {
  const cat = categories.find(c => c.id === category);
  if (cat) return cat.color;
  return LEGACY_COLORS[category] ?? null;
}

function buildTheme(primaryColor: string): ProviderTheme {
  const rgb = hexToRgb(primaryColor);
  if (!rgb) return buildTheme('#3B82F6');
  return {
    primaryColor,
    primaryHover: darkenHex(primaryColor),
    chatBgTint:           `rgba(${rgb},0.08)`,
    userBubbleBg:         `rgba(${rgb},0.18)`,
    userBubbleBorder:     `rgba(${rgb},0.25)`,
    dotColor:              primaryColor,
    textareaBorderFocus:  `rgba(${rgb},0.5)`,
    imageActiveBg:        `rgba(${rgb},0.15)`,
    imageActiveBorder:    `rgba(${rgb},0.3)`,
    imageActiveColor:      primaryColor,
    docsActiveBg:         `rgba(${rgb},0.1)`,
    docsActiveColor:       primaryColor,
    railRing:             `rgba(${rgb},0.5)`,
    downloadBtnBg:        `rgba(${rgb},0.15)`,
    downloadBtnColor:      primaryColor,
    blockquoteBorder:      primaryColor,
    codeColor:             primaryColor,
  };
}

/** Returns the theme for a category (or legacy provider). accentHex overrides all colors. */
export function getProviderTheme(category: string, accentHex?: string | null): ProviderTheme {
  if (!accentHex || !accentHex.startsWith('#')) {
    // Rainbow mode
    return {
      ...buildTheme('#f59e0b'),
      isRainbow: true,
      primaryColor: '#ffffff',
      primaryHover: '#ffffff',
      chatBgTint:        'rgba(255,170,0,0.06)',
      userBubbleBg:      'rgba(180,80,255,0.13)',
      userBubbleBorder:  'rgba(255,100,180,0.25)',
      dotColor:          '#f59e0b',
      textareaBorderFocus: 'rgba(255,100,0,0.35)',
      imageActiveBg:     'rgba(255,120,0,0.12)',
      imageActiveBorder: 'rgba(255,160,60,0.28)',
      imageActiveColor:  '#fbbf24',
      docsActiveBg:      'rgba(0,180,255,0.10)',
      docsActiveColor:   '#38bdf8',
      railRing:          'rgba(255,100,0,0.35)',
      downloadBtnBg:     'rgba(255,120,0,0.12)',
      downloadBtnColor:  '#fbbf24',
      blockquoteBorder:  '#f59e0b',
      codeColor:         '#fbbf24',
    };
  }

  return buildTheme(accentHex);
}

// Keep old export shape for any code that imports providerThemes directly
export const providerThemes = {
  gemini:   buildTheme('#3B82F6'),
  deepseek: buildTheme('#1D4ED8'),
  qwen:     buildTheme('#9333EA'),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCategoryTheme(category: string, accentHex?: string | null): ProviderTheme {
  if (!accentHex || !accentHex.startsWith('#')) {
    const catColor = getCategoryColor(category);
    if (catColor) return buildTheme(catColor);
  }
  return getProviderTheme(category, accentHex);
}
