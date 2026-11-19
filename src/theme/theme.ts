import { useSyncExternalStore } from 'react';
import { TextStyle } from 'react-native';
import { prefs } from '../data/prefs';
import { sp } from './scale';

/** Android colour 0xAARRGGBB -> "#RRGGBBAA" */
const argb = (n: number): string => {
  const a = Math.floor(n / 0x1000000) & 0xff;
  const rgb = n & 0xffffff;
  return '#' + rgb.toString(16).padStart(6, '0') + a.toString(16).padStart(2, '0');
};

/** Same colour with a new alpha (0..1), like Color.copy(alpha = …) */
export const alpha = (color: string, a: number): string => {
  const base = color.length >= 7 ? color.slice(0, 7) : color;
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255);
  return base + v.toString(16).padStart(2, '0');
};

/** One colour theme. "accent" and "accent2" are the two highlight colours. */
export interface NovaPalette {
  name: string;
  bg: string;
  bgDeep: string;
  surface: string;
  surfaceHi: string;
  accent: string;
  accent2: string;
  glow1: string;
  glow2: string;
  text: string;
  textDim: string;
  textFaint: string;
  focus: string;
  onFocus: string;
}

const p = (
  name: string, bg: number, bgDeep: number, surface: number, surfaceHi: number,
  accent: number, accent2: number, glow1: number, glow2: number,
  o: Partial<Record<'text' | 'textDim' | 'textFaint' | 'focus' | 'onFocus', number>> = {},
): NovaPalette => ({
  name,
  bg: argb(bg), bgDeep: argb(bgDeep), surface: argb(surface), surfaceHi: argb(surfaceHi),
  accent: argb(accent), accent2: argb(accent2), glow1: argb(glow1), glow2: argb(glow2),
  text: argb(o.text ?? 0xffeef1fa),
  textDim: argb(o.textDim ?? 0xffa9b0c8),
  textFaint: argb(o.textFaint ?? 0xff6e7690),
  focus: argb(o.focus ?? 0xfff4f7ff),
  onFocus: argb(o.onFocus ?? 0xff12152a),
});

/** All themes. The first is the original cyan & violet look; Phoenix Ember (second) is the default. */
export const THEMES: NovaPalette[] = [
  p('Nova', 0xff121522, 0xff0d0f19, 0xff1b2032, 0xff262c44, 0xff6ce5f5, 0xffa58bff, 0x332a3a7a, 0x22533a8a),
  p('Phoenix Ember (default)', 0xff181012, 0xff100a0b, 0xff241719, 0xff332022, 0xffff8a4c, 0xffffc857, 0x337a2a1a, 0x228a4a1a,
    { text: 0xfffaf0ec, textDim: 0xffc8b0a9, textFaint: 0xff8a7470, focus: 0xfffff4ec, onFocus: 0xff2a1210 }),
  p('Midnight Blue', 0xff0c1220, 0xff080c16, 0xff141c30, 0xff1e2842, 0xff5ab0ff, 0xff7c8cff, 0x33204a8a, 0x22303a8a,
    { textDim: 0xffa6b2cc, textFaint: 0xff68748e, focus: 0xffeff5ff, onFocus: 0xff0c1630 }),
  p('Emerald', 0xff0d1815, 0xff09110f, 0xff14231f, 0xff1d302a, 0xff45e2a6, 0xff7fd6ff, 0x331a6a4a, 0x221a5a6a,
    { text: 0xffedf8f3, textDim: 0xffa4c2b7, textFaint: 0xff678a7e, focus: 0xfff0fff8, onFocus: 0xff0c2018 }),
  p('Royal Purple', 0xff150f22, 0xff0e0a18, 0xff20172f, 0xff2c2040, 0xffc495ff, 0xffff82d2, 0x33523a8a, 0x227a2a6a,
    { text: 0xfff3eefa, textDim: 0xffb8aacb, textFaint: 0xff7a6d8e, focus: 0xfff8f2ff, onFocus: 0xff1c1030 }),
  p('Crimson Noir', 0xff130c0e, 0xff0c0809, 0xff1f1417, 0xff2c1c20, 0xffff5470, 0xffff9e7a, 0x337a1a2a, 0x225a1a2a,
    { text: 0xfff9eef0, textDim: 0xffc6a9ae, textFaint: 0xff8a6d72, focus: 0xfffff1f3, onFocus: 0xff2a0c12 }),
  p('Ocean Teal', 0xff0b181c, 0xff071013, 0xff122429, 0xff1a3238, 0xff35d6c8, 0xff5aaeff, 0x331a5a6a, 0x221a3a7a,
    { text: 0xffecf7f8, textDim: 0xffa2c0c4, textFaint: 0xff648388, focus: 0xffeffeff, onFocus: 0xff082024 }),
  p('Sunset Gold', 0xff17130f, 0xff0f0c09, 0xff231d17, 0xff312820, 0xffffb84d, 0xffff7b5c, 0x336a4a1a, 0x227a2a1a,
    { text: 0xfffaf4ec, textDim: 0xffc9b9a4, textFaint: 0xff8a7b68, focus: 0xfffff8ec, onFocus: 0xff261a0c }),
  p('Rose Quartz', 0xff181117, 0xff100b0f, 0xff241a22, 0xff32242f, 0xffff93bc, 0xffc9a2ff, 0x337a2a5a, 0x22523a7a,
    { text: 0xfffaeff5, textDim: 0xffc9aabd, textFaint: 0xff8a6d80, focus: 0xfffff2f8, onFocus: 0xff2a1022 }),
  p('Graphite', 0xff131416, 0xff0c0d0e, 0xff1d1f22, 0xff282b2f, 0xffe6e8ec, 0xff9aa0aa, 0x22ffffff, 0x14ffffff,
    { text: 0xfff2f3f5, textDim: 0xffaeb2b9, textFaint: 0xff70747c, focus: 0xffffffff, onFocus: 0xff111214 }),
  p('Cyber Neon', 0xff0a0b14, 0xff06070d, 0xff12142a, 0xff1b1e3c, 0xff00f0d0, 0xffff3ea5, 0x33006a7a, 0x227a0a5a,
    { focus: 0xffeffffc, onFocus: 0xff060a14 }),
];

/** Fixed colours shared by every theme */
export const Fixed = {
  glass: argb(0x33ffffff),
  stroke: argb(0x1fffffff),
  gold: argb(0xfff5c76c),
  rose: argb(0xffff7a9c),
  green: argb(0xff7be0a6),
  white12: argb(0x1fffffff),
  white10: argb(0x1affffff),
  white8: argb(0x14ffffff),
  white14: argb(0x24ffffff),
  white25: argb(0x40ffffff),
  white15: argb(0x26ffffff),
};

// ---------- Live theme store (changes instantly from Settings) ----------

type Listener = () => void;
const listeners = new Set<Listener>();
let themeIndex = 1;

export const ThemeStore = {
  /** Called once after prefs are loaded */
  init() {
    themeIndex = Math.max(0, Math.min(THEMES.length - 1, prefs.theme));
  },
  get index() {
    return themeIndex;
  },
  get current(): NovaPalette {
    return THEMES[themeIndex];
  },
  set(i: number) {
    themeIndex = Math.max(0, Math.min(THEMES.length - 1, i));
    prefs.theme = themeIndex;
    listeners.forEach(l => l());
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Current colours; components using it re-render when the theme changes. */
export function usePalette(): NovaPalette {
  return useSyncExternalStore(ThemeStore.subscribe, () => ThemeStore.current);
}

/** Two-colour accent gradients (Nova.AccentBrush / AccentBrushH) */
export const accentDiag = (P: NovaPalette) => `linear-gradient(135deg, ${P.accent} 0%, ${P.accent2} 100%)`;
export const accentH = (P: NovaPalette) => `linear-gradient(to right, ${P.accent} 0%, ${P.accent2} 100%)`;

// ---------- Type (same sizes as NovaType) ----------

export const NovaType: Record<'Display' | 'Title' | 'Section' | 'Body' | 'Label' | 'Caption' | 'Button', TextStyle> = {
  Display: { fontWeight: '900', fontSize: sp(52), letterSpacing: sp(-1), lineHeight: sp(56) },
  Title: { fontWeight: '700', fontSize: sp(30), letterSpacing: sp(-0.5) },
  Section: { fontWeight: '600', fontSize: sp(19), letterSpacing: sp(0.2) },
  Body: { fontWeight: '400', fontSize: sp(15), lineHeight: sp(23) },
  Label: { fontWeight: '500', fontSize: sp(13), letterSpacing: sp(0.3) },
  Caption: { fontWeight: '500', fontSize: sp(11), letterSpacing: sp(1.4) },
  Button: { fontWeight: '600', fontSize: sp(15), letterSpacing: sp(0.3) },
};
