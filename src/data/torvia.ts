/*
 * "Search & Add" — talks to the Torvia plugin on the Jellyfin server. The feature is only shown
 * when the server has the plugin and the signed-in user is allowed to use it.
 * Ported from Android PHOENIXA (data/Torvia.kt).
 */
import { api } from './jellyfin';

export interface TorviaStatus {
  enabled: boolean;
  isAdmin: boolean;
  tags: string[];
  movieTag: string;
  tvTag: string;
  remainingToday: number | null;
  dailyLimit: number | null;
  buttonLabel: string;
  ownTorrents: boolean;
}

export interface TorviaTitle {
  type: string; // "movie" or "tv"
  tmdbId: number;
  title: string;
  year: number | null;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number | null;
}
export const isTv = (t: TorviaTitle) => t.type === 'tv';

export interface TorviaSeason {
  season: number;
  name: string;
  episodes: number;
  year: number | null;
}

export interface TorviaDetails {
  title: TorviaTitle;
  seasons: TorviaSeason[];
  jellyfinItemId: string | null;
}

export interface TorviaRelease {
  hash: string;
  name: string;
  fileName: string;
  sizeBytes: number;
  size: string;
  seeders: number;
  speed: string;
  quality: string;
  isCam: boolean;
  hdr: string;
  bitDepth: number;
  languages: string[];
  kind: string;
  label: string;
  playsLabel: string;
  packSize: string;
  summary: string;
  source: string;
  codec: string;
  audio: string;
  subtitles: string;
  container: string;
  isSeasonPack: boolean;
}
export const relIsHdr = (r: TorviaRelease) => !!r.hdr.trim() && r.hdr.toUpperCase() !== 'SDR';
export const relIsTenBit = (r: TorviaRelease) => r.bitDepth >= 10;

/** The release filters, worked the same way as the Torvia web page */
export interface ReleaseFilter {
  quality: string;
  kind: string; // all / episode / pack
  tenBit: boolean;
  hdr: boolean;
  hideCam: boolean;
  langs: string[];
  sort: string; // best / smallest / largest / seeders
}

export const defaultFilter = (): ReleaseFilter => ({ quality: 'all', kind: 'all', tenBit: false, hdr: false, hideCam: false, langs: [], sort: 'best' });

export const Filters = {
  qualities: ['4K', '1080p', '720p', '480p'],
  sorts: [['best', 'Best'], ['smallest', 'Small file'], ['largest', 'Large file'], ['seeders', 'Most seeders']] as Array<[string, string]>,

  apply(f: ReleaseFilter, all: TorviaRelease[]): TorviaRelease[] {
    const list = all.filter(
      r =>
        (f.quality === 'all' || r.quality === f.quality) &&
        (!f.tenBit || relIsTenBit(r)) &&
        (!f.hdr || relIsHdr(r)) &&
        (!f.hideCam || !r.isCam) &&
        (f.kind !== 'episode' || !r.isSeasonPack) &&
        (f.kind !== 'pack' || r.isSeasonPack) &&
        (f.langs.length === 0 || r.languages.some(l => f.langs.includes(l))),
    );
    const cam = (r: TorviaRelease) => (r.isCam ? 1 : 0);
    const sorted = [...list];
    switch (f.sort) {
      case 'smallest':
        return sorted.sort((a, b) => cam(a) - cam(b) || (a.sizeBytes > 0 ? a.sizeBytes : Infinity) - (b.sizeBytes > 0 ? b.sizeBytes : Infinity));
      case 'largest':
        return sorted.sort((a, b) => cam(a) - cam(b) || b.sizeBytes - a.sizeBytes);
      case 'seeders':
        return sorted.sort((a, b) => cam(a) - cam(b) || b.seeders - a.seeders);
      default:
        return list; // "best" keeps the server's order
    }
  },

  /** 1080p when there is any, otherwise every quality (and a note saying so) */
  start(all: TorviaRelease[]): [ReleaseFilter, string | null] {
    return all.some(r => r.quality === '1080p')
      ? [{ ...defaultFilter(), quality: '1080p' }, null]
      : [defaultFilter(), 'No 1080p releases, so all qualities are shown.'];
  },

  /** Languages with how many releases have each, most common first */
  languages(all: TorviaRelease[]): Array<[string, number]> {
    const m = new Map<string, number>();
    all.forEach(r => r.languages.forEach(l => m.set(l, (m.get(l) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  },
};

export interface TorviaAdd {
  id: string;
  userName: string;
  whenText: string;
  type: string;
  tmdbId: number;
  title: string;
  year: number | null;
  poster: string | null;
  label: string;
  quality: string;
  size: string;
  tag: string;
  canRemove: boolean;
  jellyfinItemId: string | null;
  /** 0–100 while TorBox is still downloading it, otherwise null */
  downloadPercent: number | null;
}

export interface TorviaUser {
  id: string;
  name: string;
  count: number;
}

export interface TorviaAdds {
  isAdmin: boolean;
  items: TorviaAdd[];
  users: TorviaUser[];
}

/** Result of an add or a remove: shown to the user as is */
export interface TorviaResult {
  ok: boolean;
  message: string;
  remainingToday?: number | null;
}

const s = (o: any, k: string): string => (o?.[k] === null || o?.[k] === undefined ? '' : String(o[k]));
const sn = (o: any, k: string): string | null => (s(o, k).trim() ? s(o, k) : null);
const n = (o: any, k: string): number | null => (typeof o?.[k] === 'number' ? o[k] : null);
const arr = (a: unknown): any[] => (Array.isArray(a) ? a.filter(x => x && typeof x === 'object') : []);
const strs = (a: unknown): string[] => (Array.isArray(a) ? a.map(String).filter(x => x.trim()) : []);
const enc = encodeURIComponent;

function fail(code: number, body: string): never {
  let msg: string | null = null;
  try {
    const o = JSON.parse(body);
    msg = sn(o, 'error') ?? sn(o, 'message');
  } catch {
    // not JSON
  }
  throw new Error(
    msg ??
      (code === 403
        ? "You're not allowed to use Search & Add on this server."
        : code === 404
          ? 'Not found.'
          : code === 502 || code === 503 || code === 504
            ? "The server couldn't reach TorBox right now. Please try again."
            : `Something went wrong (error ${code}).`),
  );
}

async function get(path: string): Promise<any> {
  const [code, body] = await api.raw('GET', path);
  if (code < 200 || code > 299) fail(code, body);
  return JSON.parse(body);
}

function title(o: any): TorviaTitle {
  const y = n(o, 'year');
  const r = n(o, 'rating');
  return {
    type: s(o, 'type'),
    tmdbId: n(o, 'tmdbId') ?? 0,
    title: s(o, 'title'),
    year: y && y > 0 ? y : null,
    overview: s(o, 'overview'),
    poster: sn(o, 'poster'),
    backdrop: sn(o, 'backdrop'),
    rating: r && r > 0 ? r : null,
  };
}

export const torvia = {
  /** null when the plugin isn't installed on this server */
  async status(): Promise<TorviaStatus | null> {
    try {
      const [code, body] = await api.raw('GET', '/TorviaSearch/Status');
      if (code !== 200) return null;
      const o = JSON.parse(body);
      return {
        enabled: !!o.enabled,
        isAdmin: !!o.isAdmin,
        tags: strs(o.tags),
        movieTag: s(o, 'movieTag'),
        tvTag: s(o, 'tvTag'),
        remainingToday: n(o, 'remainingToday'),
        dailyLimit: n(o, 'dailyLimit'),
        buttonLabel: sn(o, 'buttonLabel') ?? 'Search & Add',
        ownTorrents: !!o.ownTorrents,
      };
    } catch {
      return null;
    }
  },

  async search(query: string): Promise<TorviaTitle[]> {
    return arr((await get(`/TorviaSearch/Search?query=${enc(query)}`)).results).map(title);
  },

  async details(type: string, tmdbId: number): Promise<TorviaDetails> {
    const o = await get(`/TorviaSearch/Title/${type}/${tmdbId}`);
    return {
      title: title(o.title ?? {}),
      seasons: arr(o.seasons).map(x => ({ season: n(x, 'season') ?? 0, name: s(x, 'name'), episodes: n(x, 'episodes') ?? 0, year: n(x, 'year') })),
      jellyfinItemId: sn(o, 'jellyfinItemId'),
    };
  },

  /** All cached releases (filters are applied on the device, like the web page does) */
  async releases(type: string, tmdbId: number, season?: number, episode?: number, wholeSeason = false) {
    let q = `/TorviaSearch/Releases?type=${type}&tmdbId=${tmdbId}&quality=all`;
    if (season !== undefined) q += `&season=${season}`;
    if (wholeSeason) q += '&wholeSeason=true';
    else if (episode !== undefined) q += `&episode=${episode}`;
    const o = await get(q);
    const releases: TorviaRelease[] = arr(o.releases).map(x => ({
      hash: s(x, 'hash'), name: s(x, 'name'), fileName: s(x, 'fileName'), sizeBytes: n(x, 'sizeBytes') ?? 0, size: s(x, 'size'),
      seeders: n(x, 'seeders') ?? 0, speed: s(x, 'speed'), quality: s(x, 'quality'), isCam: !!x.isCam, hdr: s(x, 'hdr'),
      bitDepth: n(x, 'bitDepth') ?? 0, languages: strs(x.languages), kind: s(x, 'kind'), label: s(x, 'label'),
      playsLabel: s(x, 'playsLabel'), packSize: s(x, 'packSize'), summary: s(x, 'summary'), source: s(x, 'source'),
      codec: s(x, 'codec'), audio: s(x, 'audio'), subtitles: s(x, 'subtitles'), container: s(x, 'container'),
      isSeasonPack: !!x.isSeasonPack,
    }));
    return { releases, jellyfinItemId: sn(o, 'jellyfinItemId') };
  },

  async add(hash: string, tag: string | null): Promise<TorviaResult> {
    const body: Record<string, unknown> = { hash };
    if (tag && tag.trim()) body.tag = tag;
    const [code, text] = await api.raw('POST', '/TorviaSearch/Add', body);
    let o: any = null;
    try {
      o = JSON.parse(text);
    } catch {
      o = null;
    }
    if (code >= 200 && code <= 299) return { ok: true, message: sn(o, 'message') ?? 'Added.', remainingToday: n(o, 'remainingToday') };
    if (code === 400 && o) return { ok: false, message: sn(o, 'message') ?? sn(o, 'error') ?? "Couldn't add it." };
    fail(code, text);
  },

  /** The Jellyfin item id once Torvia has synced the title, otherwise null */
  async inLibrary(type: string, tmdbId: number): Promise<string | null> {
    try {
      const [code, text] = await api.raw('GET', `/TorviaSearch/InLibrary/${type}/${tmdbId}`);
      if (code !== 200) return null;
      return sn(JSON.parse(text), 'itemId');
    } catch {
      return null;
    }
  },

  async adds(all: boolean, userId?: string | null): Promise<TorviaAdds> {
    let path = '/TorviaSearch/Adds';
    if (all) {
      path += '?all=true';
      if (userId) path += `&user=${enc(userId)}`;
    }
    const o = await get(path);
    return {
      isAdmin: !!o.isAdmin,
      items: arr(o.items).map(x => {
        const y = n(x, 'year');
        const p = n(x, 'downloadPercent');
        return {
          id: s(x, 'id'), userName: s(x, 'userName'), whenText: s(x, 'when'), type: s(x, 'type'), tmdbId: n(x, 'tmdbId') ?? 0,
          title: s(x, 'title'), year: y && y > 0 ? y : null, poster: sn(x, 'poster'), label: s(x, 'label'), quality: s(x, 'quality'),
          size: s(x, 'size'), tag: s(x, 'tag'), canRemove: !!x.canRemove, jellyfinItemId: sn(x, 'jellyfinItemId'),
          downloadPercent: p === null || isNaN(p) ? null : Math.max(0, Math.min(100, Math.trunc(p))),
        };
      }),
      users: arr(o.users).map(u => ({ id: s(u, 'id'), name: s(u, 'name'), count: n(u, 'count') ?? 0 })),
    };
  },

  async remove(id: string): Promise<TorviaResult> {
    const [code, text] = await api.raw('DELETE', `/TorviaSearch/Adds/${enc(id)}`);
    let o: any = null;
    try {
      o = JSON.parse(text);
    } catch {
      o = null;
    }
    if (code >= 200 && code <= 299) return { ok: true, message: sn(o, 'message') ?? 'Removed.' };
    fail(code, text);
  },
};
