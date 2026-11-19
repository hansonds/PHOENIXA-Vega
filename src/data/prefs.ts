import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';

/**
 * App settings, same keys and defaults as Android PHOENIXA's Prefs.
 * Loaded once at start (loadPrefs) and then read synchronously; every change is saved right away.
 */
interface Values {
  server: string;
  userId: string | null;
  userName: string | null;
  token: string | null;
  /** Max streaming bitrate in Mbps. 0 = unlimited */
  maxBitrate: number;
  autoPlayNext: boolean;
  heroAutoRotate: boolean;
  /** Only ever direct play (no server transcoding) */
  directOnly: boolean;
  /** Last audio language you picked (e.g. "tam"), used for every title */
  audioLang: string | null;
  /** Last subtitle language you picked, or "off" */
  subLang: string | null;
  /** 0 = Small, 1 = Medium, 2 = Large */
  cardSize: number;
  /** Player picture size: 0 = Fit, 1 = Zoom, 2 = Stretch */
  videoFit: number;
  /** 1 = Phoenix Ember */
  theme: number;
  deviceId: string | null;
  /** Reason for the last crash, shown in Settings (helps fixing it) */
  lastCrash: string | null;
}

const defaults: Values = {
  server: '',
  userId: null,
  userName: null,
  token: null,
  maxBitrate: 0,
  autoPlayNext: true,
  heroAutoRotate: true,
  directOnly: true,
  audioLang: null,
  subLang: null,
  cardSize: 1,
  videoFit: 0,
  theme: 1,
  deviceId: null,
  lastCrash: null,
};

const KEY = 'phoenixa.prefs';
const values: Values = { ...defaults };

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(values)).catch(() => {});
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function loadPrefs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) Object.assign(values, JSON.parse(raw));
  } catch {
    // first run or unreadable: keep defaults
  }
  if (!values.deviceId) {
    values.deviceId = uuid();
    save();
  }
}

class PrefsImpl {
  get server() { return values.server; }
  set server(v: string) { values.server = v; save(); }
  get userId() { return values.userId; }
  set userId(v: string | null) { values.userId = v; save(); }
  get userName() { return values.userName; }
  set userName(v: string | null) { values.userName = v; save(); }
  get token() { return values.token; }
  set token(v: string | null) { values.token = v; save(); }
  get maxBitrateMbps() { return values.maxBitrate; }
  set maxBitrateMbps(v: number) { values.maxBitrate = v; save(); }
  get autoPlayNext() { return values.autoPlayNext; }
  set autoPlayNext(v: boolean) { values.autoPlayNext = v; save(); }
  get heroAutoRotate() { return values.heroAutoRotate; }
  set heroAutoRotate(v: boolean) { values.heroAutoRotate = v; save(); }
  get directPlayOnly() { return values.directOnly; }
  set directPlayOnly(v: boolean) { values.directOnly = v; save(); }
  get audioLang() { return values.audioLang; }
  set audioLang(v: string | null) { values.audioLang = v; save(); }
  get subLang() { return values.subLang; }
  set subLang(v: string | null) { values.subLang = v; save(); }
  get cardSize() { return values.cardSize; }
  set cardSize(v: number) { values.cardSize = v; save(); }
  get videoFit() { return values.videoFit; }
  set videoFit(v: number) { values.videoFit = v; save(); }
  get theme() { return values.theme; }
  set theme(v: number) { values.theme = v; save(); }
  get deviceId(): string { return values.deviceId ?? ''; }
  get lastCrash() { return values.lastCrash; }
  set lastCrash(v: string | null) { values.lastCrash = v; save(); }

  signOut() {
    values.userId = null;
    values.token = null;
    values.userName = null;
    save();
  }
}

export const prefs = new PrefsImpl();
