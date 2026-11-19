/* Turns language codes (tam, hi, eng, en-US…) into real names and remembers your language choices.
   Ported from Android PHOENIXA (data/Lang.kt). */
import { MediaStreamInfo } from './models';
import { prefs } from './prefs';

const names: Record<string, string> = {
  en: 'English', eng: 'English', ta: 'Tamil', tam: 'Tamil', hi: 'Hindi', hin: 'Hindi',
  ml: 'Malayalam', mal: 'Malayalam', te: 'Telugu', tel: 'Telugu', kn: 'Kannada', kan: 'Kannada',
  bn: 'Bengali', ben: 'Bengali', mr: 'Marathi', mar: 'Marathi', gu: 'Gujarati', guj: 'Gujarati',
  pa: 'Punjabi', pan: 'Punjabi', or: 'Odia', ori: 'Odia', as: 'Assamese', asm: 'Assamese',
  ur: 'Urdu', urd: 'Urdu', si: 'Sinhala', sin: 'Sinhala', ne: 'Nepali', nep: 'Nepali',
  sa: 'Sanskrit', san: 'Sanskrit', ja: 'Japanese', jpn: 'Japanese', ko: 'Korean', kor: 'Korean',
  zh: 'Chinese', chi: 'Chinese', zho: 'Chinese', es: 'Spanish', spa: 'Spanish',
  fr: 'French', fre: 'French', fra: 'French', de: 'German', ger: 'German', deu: 'German',
  it: 'Italian', ita: 'Italian', pt: 'Portuguese', por: 'Portuguese', ru: 'Russian', rus: 'Russian',
  ar: 'Arabic', ara: 'Arabic', th: 'Thai', tha: 'Thai', id: 'Indonesian', ind: 'Indonesian',
  ms: 'Malay', may: 'Malay', msa: 'Malay', vi: 'Vietnamese', vie: 'Vietnamese', tr: 'Turkish', tur: 'Turkish',
  pl: 'Polish', pol: 'Polish', nl: 'Dutch', dut: 'Dutch', nld: 'Dutch', sv: 'Swedish', swe: 'Swedish',
  no: 'Norwegian', nor: 'Norwegian', nob: 'Norwegian', da: 'Danish', dan: 'Danish', fi: 'Finnish', fin: 'Finnish',
  el: 'Greek', gre: 'Greek', ell: 'Greek', he: 'Hebrew', heb: 'Hebrew', fa: 'Persian', per: 'Persian', fas: 'Persian',
  uk: 'Ukrainian', ukr: 'Ukrainian', cs: 'Czech', cze: 'Czech', ces: 'Czech', hu: 'Hungarian', hun: 'Hungarian',
  ro: 'Romanian', rum: 'Romanian', ron: 'Romanian', fil: 'Filipino', tl: 'Tagalog', tgl: 'Tagalog',
};

const unknown = new Set(['', 'und', 'unk', 'mul', 'zxx', 'mis', 'null', 'none']);

/** Readable language name, or null when the track has no language tag. */
function name(code: string | null | undefined): string | null {
  const c = code?.trim().toLowerCase();
  if (c === undefined || unknown.has(c)) return null;
  if (names[c]) return names[c];
  const base = c.split('-')[0].split('_')[0];
  if (names[base]) return names[base];
  return c.toUpperCase();
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = name(a);
  return na !== null && na === name(b);
}

function codecName(codec: string): string {
  switch (codec.toLowerCase()) {
    case 'subrip': case 'srt': return 'SRT';
    case 'pgssub': case 'pgs': case 'hdmv_pgs_subtitle': return 'PGS';
    case 'ass': case 'ssa': return 'ASS';
    case 'webvtt': case 'vtt': return 'VTT';
    case 'dvdsub': case 'dvd_subtitle': return 'DVD';
    case 'dvbsub': case 'dvb_subtitle': return 'DVB';
    case 'mov_text': return 'TEXT';
    case 'dca': case 'dts': return 'DTS';
    case 'truehd': return 'TrueHD';
    case 'eac3': return 'E-AC3';
    case 'ac3': return 'AC3';
    default: return codec.toUpperCase();
  }
}

/** Title + detail line for a Jellyfin audio/subtitle stream, e.g. "Tamil" / "AC3 · 5.1 · Default" */
function label(s: MediaStreamInfo): [string, string] {
  const lang = name(s.language);
  const title = s.title?.trim() || null;
  let main: string;
  if (title && lang && !title.toLowerCase().includes(lang.toLowerCase())) main = `${lang} · ${title}`;
  else if (title) main = title;
  else if (lang) main = lang;
  else main = 'Unknown language';
  const detail: string[] = [];
  if (s.codec.trim()) detail.push(codecName(s.codec));
  if (s.type === 'Audio' && s.channels > 0) {
    detail.push(s.channels >= 8 ? '7.1' : s.channels >= 6 ? '5.1' : s.channels === 2 ? 'Stereo' : s.channels === 1 ? 'Mono' : `${s.channels}ch`);
  }
  if (s.isForced) detail.push('Forced');
  if (s.isExternal) detail.push('External file');
  if (s.isDefault) detail.push('Default');
  return [main, detail.join(' · ')];
}

function rememberAudio(language: string | null | undefined) {
  if (name(language) !== null) prefs.audioLang = language ?? null;
}

/** null language with off=true means "subtitles off" */
function rememberSubtitle(language: string | null | undefined, off: boolean) {
  if (off) prefs.subLang = 'off';
  else if (name(language) !== null) prefs.subLang = language ?? null;
}

/** Which audio stream to use: your remembered language if this file has it, else the server default. */
function pickAudio(streams: MediaStreamInfo[], serverDefault: number | null): number | null {
  const audio = streams.filter(s => s.type === 'Audio');
  const want = prefs.audioLang;
  if (want) {
    const m = audio.find(s => same(s.language, want));
    if (m) return m.index;
  }
  return serverDefault ?? audio[0]?.index ?? null;
}

/** Which subtitle stream to use (-1 = off). */
function pickSubtitle(streams: MediaStreamInfo[], serverDefault: number | null): number {
  const subs = streams.filter(s => s.type === 'Subtitle');
  const want = prefs.subLang;
  if (want === null) return serverDefault ?? -1;
  if (want === 'off') return subs.find(s => s.isForced && s.index === serverDefault)?.index ?? -1;
  const match = subs.filter(s => same(s.language, want));
  return (match.find(s => !s.isForced) ?? match[0])?.index ?? serverDefault ?? -1;
}

export const Lang = { name, same, label, rememberAudio, rememberSubtitle, pickAudio, pickSubtitle };
