/* Jellyfin server API, ported 1:1 from Android PHOENIXA (data/JellyfinApi.kt). */
import { prefs } from './prefs';
import { Item, Library, Person, parseItem } from './models';

export class ApiException extends Error {
  code: number;
  constructor(message: string, code = 0) {
    super(message);
    this.code = code;
  }
}

const APP_VERSION = '1.0.0';
const DEVICE_NAME = 'Fire TV (Vega)';

const enc = encodeURIComponent;

function authHeader(tok: string | null = prefs.token): string {
  const base = `MediaBrowser Client="PHOENIXA", Device="${DEVICE_NAME}", DeviceId="${prefs.deviceId}", Version="${APP_VERSION}"`;
  return tok ? `${base}, Token="${tok}"` : base;
}

async function request(
  method: string,
  url: string,
  body: unknown,
  tok: string | null,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(tok),
        'X-Emby-Authorization': authHeader(tok),
        Accept: 'application/json',
        ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'GET' ? undefined : body !== undefined ? JSON.stringify(body) : '',
      signal: ctrl.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ApiException("The server didn't answer in time. Please try again.");
    throw new ApiException("Couldn't reach your server. Check the address and your internet connection.");
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get server(): string {
    return prefs.server.replace(/\/+$/, '');
  },
  get userId(): string {
    return prefs.userId ?? '';
  },
  get token(): string {
    return prefs.token ?? '';
  },
  get isLoggedIn(): boolean {
    return !!prefs.token && !!prefs.userId;
  },

  authHeader,

  async call(method: string, path: string, body?: unknown, baseOverride?: string, tokenOverride: string | null = prefs.token): Promise<string> {
    const url = (baseOverride ?? api.server) + path;
    const resp = await request(method, url, body, tokenOverride, 30000);
    const text = await resp.text();
    if (!resp.ok) {
      let msg: string;
      switch (resp.status) {
        case 401: msg = 'Wrong username or password'; break;
        case 404: msg = 'Not found'; break;
        case 502: case 503: case 504:
          msg = `The server is temporarily unavailable (${resp.status}). Please try again later.`; break;
        default: msg = `Server error ${resp.status}`;
      }
      throw new ApiException(msg, resp.status);
    }
    return text;
  },

  /** Raw call for plugin APIs: returns the HTTP status and body instead of throwing on errors */
  async raw(method: string, path: string, body?: unknown): Promise<[number, string]> {
    const resp = await request(method, api.server + path, body, prefs.token, 75000);
    return [resp.status, await resp.text()];
  },

  async getObj(path: string): Promise<any> {
    return JSON.parse(await api.call('GET', path));
  },

  async getItems(path: string): Promise<Item[]> {
    const txt = (await api.call('GET', path)).trim();
    const j = JSON.parse(txt);
    const arr: any[] = Array.isArray(j) ? j : j.Items ?? [];
    return arr.filter(Boolean).map(parseItem);
  },

  // ---------- Auth ----------

  normalizeServer(input: string): string {
    let s = input.trim().replace(/\/+$/, '');
    if (!s.startsWith('http://') && !s.startsWith('https://')) s = `https://${s}`;
    return s;
  },

  async ping(base: string): Promise<string> {
    const o = JSON.parse(await api.call('GET', '/System/Info/Public', undefined, base, null));
    return o.ServerName ?? 'Jellyfin';
  },

  async login(base: string, user: string, pass: string): Promise<void> {
    const o = JSON.parse(await api.call('POST', '/Users/AuthenticateByName', { Username: user, Pw: pass }, base, null));
    saveAuth(base, o);
  },

  /** Returns [secret, code] */
  async quickConnectInitiate(base: string): Promise<[string, string]> {
    const o = JSON.parse(await api.call('POST', '/QuickConnect/Initiate', undefined, base, null));
    return [o.Secret ?? '', o.Code ?? ''];
  },

  async quickConnectCheck(base: string, secret: string): Promise<boolean> {
    const o = JSON.parse(await api.call('GET', `/QuickConnect/Connect?Secret=${enc(secret)}`, undefined, base, null));
    return !!o.Authenticated;
  },

  async quickConnectFinish(base: string, secret: string): Promise<void> {
    const o = JSON.parse(await api.call('POST', '/Users/AuthenticateWithQuickConnect', { Secret: secret }, base, null));
    saveAuth(base, o);
  },

  /** Ends this device's session on the server, so the saved sign-in token stops working. */
  async logout(tok: string | null): Promise<void> {
    if (!tok) return;
    try {
      await api.call('POST', '/Sessions/Logout', undefined, undefined, tok);
    } catch {
      // ignore
    }
  },

  // ---------- Images ----------

  image(itemId: string | null, type: string, tag: string | null, maxWidth: number): string | null {
    if (!itemId) return null;
    const t = tag ? `&tag=${tag}` : '';
    return `${api.server}/Items/${itemId}/Images/${type}?maxWidth=${maxWidth}&quality=90${t}`;
  },

  poster(item: Item, w = 400): string | null {
    if (item.primaryTag && item.type !== 'Episode') return api.image(item.id, 'Primary', item.primaryTag, w);
    if (item.type === 'Episode' && item.seriesPrimaryTag) return api.image(item.seriesId, 'Primary', item.seriesPrimaryTag, w);
    if (item.primaryTag) return api.image(item.id, 'Primary', item.primaryTag, w);
    return null;
  },

  backdrop(item: Item, w = 1920): string | null {
    return item.backdropTag ? api.image(item.backdropItemId ?? item.id, 'Backdrop', item.backdropTag, w) : null;
  },

  /** Landscape still: episode screenshot, else thumb, else backdrop */
  landscape(item: Item, w = 640): string | null {
    if (item.type === 'Episode' && item.primaryTag) return api.image(item.id, 'Primary', item.primaryTag, w);
    if (item.thumbTag) return api.image(item.thumbItemId ?? item.id, 'Thumb', item.thumbTag, w);
    if (item.backdropTag) return api.backdrop(item, w);
    return api.poster(item, w);
  },

  logo(item: Item, w = 800): string | null {
    return item.logoTag ? api.image(item.logoItemId ?? item.id, 'Logo', item.logoTag, w) : null;
  },

  /** Try the photo even when the server didn't send a tag — many people still have one. */
  personImage(p: Person, w = 240): string | null {
    return api.image(p.id, 'Primary', p.imageTag, w);
  },

  userImage(): string {
    return `${api.server}/Users/${api.userId}/Images/Primary?maxWidth=120&quality=90`;
  },

  // ---------- Browse ----------

  async libraries(): Promise<Library[]> {
    const o = await api.getObj(`/Users/${api.userId}/Views`);
    const arr: any[] = o.Items ?? [];
    return arr.filter(Boolean).map(x => ({
      id: x.Id ?? '',
      name: x.Name ?? '',
      collectionType: x.CollectionType ?? null,
      primaryTag: x.ImageTags?.Primary ?? null,
    }));
  },

  async featured(limit = 10): Promise<Item[]> {
    const a = await api.getItems(
      `/Users/${api.userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&SortBy=Random&Limit=${limit}` +
        `&ImageTypes=Backdrop&HasOverview=true&Fields=${FIELDS}${IMG}&IsPlayed=false`,
    );
    if (a.length) return a;
    return api.getItems(
      `/Users/${api.userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&SortBy=Random&Limit=${limit}` +
        `&ImageTypes=Backdrop&Fields=${FIELDS}${IMG}`,
    );
  },

  resume: () => api.getItems(`/Users/${api.userId}/Items/Resume?Limit=20&MediaTypes=Video&Fields=${FIELDS}${IMG}`),

  nextUp: () => api.getItems(`/Shows/NextUp?UserId=${api.userId}&Limit=20&Fields=${FIELDS}${IMG}&EnableResumable=false`),

  async nextUpForSeries(seriesId: string): Promise<Item | null> {
    const l = await api.getItems(`/Shows/NextUp?UserId=${api.userId}&SeriesId=${seriesId}&Limit=1&Fields=${FIELDS}${IMG}&EnableResumable=true`);
    return l[0] ?? null;
  },

  latest: (parentId: string) => api.getItems(`/Users/${api.userId}/Items/Latest?ParentId=${parentId}&Limit=24&Fields=${FIELDS}${IMG}`),

  favorites: (types = 'Movie,Series', limit = 40) =>
    api.getItems(`/Users/${api.userId}/Items?Filters=IsFavorite&IncludeItemTypes=${types}&Recursive=true&SortBy=SortName&Limit=${limit}&Fields=${FIELDS}${IMG}`),

  async item(id: string): Promise<Item> {
    return parseItem(await api.getObj(`/Users/${api.userId}/Items/${id}?Fields=${FIELDS},People,Taglines,Studios,MediaSources`));
  },

  seasons: (seriesId: string) => api.getItems(`/Shows/${seriesId}/Seasons?UserId=${api.userId}&Fields=${FIELDS}${IMG}`),

  episodes: (seriesId: string, seasonId?: string | null) =>
    api.getItems(`/Shows/${seriesId}/Episodes?UserId=${api.userId}&Fields=${FIELDS}${IMG}` + (seasonId ? `&SeasonId=${seasonId}` : '')),

  /** Items inside a collection (BoxSet) or folder */
  children: (parentId: string) =>
    api.getItems(`/Users/${api.userId}/Items?ParentId=${parentId}&SortBy=ProductionYear,PremiereDate,SortName&SortOrder=Ascending&Fields=${FIELDS}${IMG}`),

  similar: (id: string) => api.getItems(`/Items/${id}/Similar?UserId=${api.userId}&Limit=16&Fields=${FIELDS}${IMG}`),

  async libraryItems(lib: Library, sortBy: string, sortOrder: string, start: number, limit: number): Promise<[Item[], number]> {
    const types =
      lib.collectionType === 'movies' ? '&IncludeItemTypes=Movie'
        : lib.collectionType === 'tvshows' ? '&IncludeItemTypes=Series'
          : lib.collectionType === 'boxsets' ? '&IncludeItemTypes=BoxSet' : '';
    const o = await api.getObj(
      `/Users/${api.userId}/Items?ParentId=${lib.id}&Recursive=true${types}&SortBy=${sortBy}&SortOrder=${sortOrder}` +
        `&StartIndex=${start}&Limit=${limit}&Fields=${FIELDS}${IMG}`,
    );
    const list: Item[] = (o.Items ?? []).filter(Boolean).map(parseItem);
    return [list, o.TotalRecordCount ?? list.length];
  },

  search: (term: string) =>
    api.getItems(`/Users/${api.userId}/Items?SearchTerm=${enc(term)}&Recursive=true&IncludeItemTypes=Movie,Series,Episode&Limit=60&Fields=${FIELDS}${IMG}`),

  async setFavorite(id: string, fav: boolean): Promise<void> {
    await api.call(fav ? 'POST' : 'DELETE', `/Users/${api.userId}/FavoriteItems/${id}`);
  },

  async setPlayed(id: string, played: boolean): Promise<void> {
    await api.call(played ? 'POST' : 'DELETE', `/Users/${api.userId}/PlayedItems/${id}`);
  },
};

const FIELDS = 'Overview,Genres,PrimaryImageAspectRatio,ProductionYear,CommunityRating,OfficialRating,ChildCount,MediaStreams';
const IMG = '&EnableImageTypes=Primary,Backdrop,Logo,Thumb&ImageTypeLimit=1';

function saveAuth(base: string, o: any) {
  prefs.server = base;
  prefs.token = o.AccessToken ?? null;
  prefs.userId = o.User?.Id ?? null;
  prefs.userName = o.User?.Name ?? null;
}
