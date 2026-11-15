export type ThemeId =
  | 'pastel-blue'
  | 'lavender-aura'
  | 'sakura-rose'
  | 'mint-aurora'
  | 'amber-sunset'
  | 'coral-peach'
  | 'titanium-ice';

export type VisualStyleId =
  | 'liquid-glass'
  | 'oled-minimal'
  | 'cyber-neon'
  | 'frosted-aero'
  | 'brutal-editorial'
  | 'warm-velvet';

export interface AppTheme {
  id: ThemeId;
  name: string;
  description: string;
  swatch: string;
  swatchRing: string;
  accent: string;
  light: string;
  frost: string;
  soft: string;
  deep: string;
  tint: string;
  ink: string;
  rgb: string;
  lightRgb: string;
  deepRgb: string;
}

export interface AppVisualStyle {
  id: VisualStyleId;
  name: string;
  description: string;
  previewBg: string;
  previewBorder: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'pastel-blue',
    name: 'Azul Pastel',
    description: 'Cristal glaciar iOS 27',
    swatch: 'linear-gradient(135deg, #d8f1ff 0%, #93c5fd 52%, #7dd3fc 100%)',
    swatchRing: 'rgba(147, 197, 253, 0.7)',
    accent: '#93c5fd',
    light: '#bae6fd',
    frost: '#e0f2fe',
    soft: '#a5d8ff',
    deep: '#7dd3fc',
    tint: '#d8f1ff',
    ink: '#03152a',
    rgb: '147, 197, 253',
    lightRgb: '186, 230, 253',
    deepRgb: '125, 211, 252',
  },
  {
    id: 'lavender-aura',
    name: 'Lavanda Cósmica',
    description: 'Violeta nebulosa OLED',
    swatch: 'linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 52%, #a78bfa 100%)',
    swatchRing: 'rgba(196, 181, 253, 0.7)',
    accent: '#c4b5fd',
    light: '#ddd6fe',
    frost: '#f5f3ff',
    soft: '#d8b4fe',
    deep: '#a78bfa',
    tint: '#f3e8ff',
    ink: '#170733',
    rgb: '196, 181, 253',
    lightRgb: '221, 214, 254',
    deepRgb: '167, 139, 250',
  },
  {
    id: 'sakura-rose',
    name: 'Rosa Sakura',
    description: 'Cuarzo rosado líquido',
    swatch: 'linear-gradient(135deg, #ffe4f1 0%, #f9a8d4 52%, #f472b6 100%)',
    swatchRing: 'rgba(249, 168, 212, 0.7)',
    accent: '#f9a8d4',
    light: '#fbcfe8',
    frost: '#fdf2f8',
    soft: '#f9a8d4',
    deep: '#f472b6',
    tint: '#ffe4f1',
    ink: '#2d061b',
    rgb: '249, 168, 212',
    lightRgb: '251, 207, 232',
    deepRgb: '244, 114, 182',
  },
  {
    id: 'mint-aurora',
    name: 'Menta Aurora',
    description: 'Boreal esmeralda suave',
    swatch: 'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 52%, #34d399 100%)',
    swatchRing: 'rgba(110, 231, 183, 0.7)',
    accent: '#6ee7b7',
    light: '#a7f3d0',
    frost: '#ecfdf5',
    soft: '#86efac',
    deep: '#34d399',
    tint: '#d1fae5',
    ink: '#022618',
    rgb: '110, 231, 183',
    lightRgb: '167, 243, 208',
    deepRgb: '52, 211, 153',
  },
  {
    id: 'amber-sunset',
    name: 'Ámbar Solar',
    description: 'Oro líquido cálido',
    swatch: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 52%, #f59e0b 100%)',
    swatchRing: 'rgba(252, 211, 77, 0.7)',
    accent: '#fcd34d',
    light: '#fde68a',
    frost: '#fffbeb',
    soft: '#fde047',
    deep: '#f59e0b',
    tint: '#fef3c7',
    ink: '#271502',
    rgb: '252, 211, 77',
    lightRgb: '253, 230, 138',
    deepRgb: '245, 158, 11',
  },
  {
    id: 'coral-peach',
    name: 'Coral Melocotón',
    description: 'Atardecer rubí pastel',
    swatch: 'linear-gradient(135deg, #ffe4e6 0%, #fda4af 52%, #fb7185 100%)',
    swatchRing: 'rgba(253, 164, 175, 0.7)',
    accent: '#fda4af',
    light: '#fecdd3',
    frost: '#fff1f2',
    soft: '#fda4af',
    deep: '#fb7185',
    tint: '#ffe4e6',
    ink: '#2d070f',
    rgb: '253, 164, 175',
    lightRgb: '254, 205, 211',
    deepRgb: '251, 113, 133',
  },
  {
    id: 'titanium-ice',
    name: 'Titanio Cristal',
    description: 'Monocromo Apple Pro',
    swatch: 'linear-gradient(135deg, #ffffff 0%, #e4e4e7 52%, #a1a1aa 100%)',
    swatchRing: 'rgba(228, 228, 231, 0.7)',
    accent: '#d4d4d8',
    light: '#f4f4f5',
    frost: '#ffffff',
    soft: '#e4e4e7',
    deep: '#a1a1aa',
    tint: '#fafafa',
    ink: '#09090b',
    rgb: '212, 212, 216',
    lightRgb: '244, 244, 245',
    deepRgb: '161, 161, 170',
  },
];

export const APP_VISUAL_STYLES: AppVisualStyle[] = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    description: 'Cristal fluido OLED con reflejos',
    previewBg: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(16,24,38,0.85))',
    previewBorder: 'rgba(255,255,255,0.35)',
  },
  {
    id: 'oled-minimal',
    name: 'OLED Puro',
    description: 'Negro absoluto y líneas finas',
    previewBg: '#000000',
    previewBorder: 'rgba(255,255,255,0.22)',
  },
  {
    id: 'cyber-neon',
    name: 'Neón Cyber',
    description: 'Rejilla técnica y bordes glow',
    previewBg: 'linear-gradient(135deg, rgba(12,18,32,0.95), rgba(4,8,16,0.98))',
    previewBorder: 'var(--theme-accent)',
  },
  {
    id: 'frosted-aero',
    name: 'Cristal Polar',
    description: 'Vidrio esmerilado más luminoso',
    previewBg: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(45,60,85,0.65))',
    previewBorder: 'rgba(255,255,255,0.45)',
  },
  {
    id: 'warm-velvet',
    name: 'Obsidiana Mate',
    description: 'Cerámica mate grafito sin brillos',
    previewBg: '#121318',
    previewBorder: 'rgba(255,255,255,0.14)',
  },
  {
    id: 'brutal-editorial',
    name: 'Estudio Técnico',
    description: 'Bordes marcados y contraste seco',
    previewBg: '#090a0d',
    previewBorder: 'rgba(255,255,255,0.6)',
  },
];

export const THEME_STORAGE_KEY = 'formare3d_theme';
export const STYLE_STORAGE_KEY = 'formare3d_visual_style';

export function getThemeById(id: string | null | undefined): AppTheme {
  return APP_THEMES.find((t) => t.id === id) || APP_THEMES[0];
}

export function getVisualStyleById(id: string | null | undefined): AppVisualStyle {
  return APP_VISUAL_STYLES.find((s) => s.id === id) || APP_VISUAL_STYLES[0];
}

export function getStoredThemeId(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && APP_THEMES.some((t) => t.id === saved)) {
      return saved as ThemeId;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'pastel-blue';
}

export function getStoredStyleId(): VisualStyleId {
  try {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY);
    if (saved && APP_VISUAL_STYLES.some((s) => s.id === saved)) {
      return saved as VisualStyleId;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'liquid-glass';
}

export function applyThemeToDocument(themeId: ThemeId): AppTheme {
  const theme = getThemeById(themeId);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-light', theme.light);
  root.style.setProperty('--theme-frost', theme.frost);
  root.style.setProperty('--theme-soft', theme.soft);
  root.style.setProperty('--theme-deep', theme.deep);
  root.style.setProperty('--theme-tint', theme.tint);
  root.style.setProperty('--theme-ink', theme.ink);
  root.style.setProperty('--theme-rgb', theme.rgb);
  root.style.setProperty('--theme-light-rgb', theme.lightRgb);
  root.style.setProperty('--theme-deep-rgb', theme.deepRgb);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch {
    // Ignore storage error
  }

  return theme;
}

export function applyStyleToDocument(styleId: VisualStyleId): AppVisualStyle {
  const style = getVisualStyleById(styleId);
  const root = document.documentElement;
  root.setAttribute('data-style', style.id);

  try {
    localStorage.setItem(STYLE_STORAGE_KEY, style.id);
  } catch {
    // Ignore storage error
  }

  return style;
}
