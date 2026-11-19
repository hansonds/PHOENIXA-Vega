/*
 * "Search & Add" — talks to the Torvia plugin on the Jellyfin server. The feature is only shown
 * when the server has the plugin and the signed-in user is allowed to use it.
 * (The full Search & Add screens come in a later build; this part decides whether the tab shows.)
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
        tags: Array.isArray(o.tags) ? o.tags.filter((t: unknown) => typeof t === 'string' && t) : [],
        movieTag: o.movieTag ?? '',
        tvTag: o.tvTag ?? '',
        remainingToday: typeof o.remainingToday === 'number' ? o.remainingToday : null,
        dailyLimit: typeof o.dailyLimit === 'number' ? o.dailyLimit : null,
        buttonLabel: (o.buttonLabel && String(o.buttonLabel).trim()) || 'Search & Add',
        ownTorrents: !!o.ownTorrents,
      };
    } catch {
      return null;
    }
  },
};
