import { api } from '../data/jellyfin';
import { Item, PlaySelection } from '../data/models';
import { nav } from '../nav/navigator';

/** Last selection chosen on a details page, handed to the player (Android passes it in the Intent). */
export let pendingSelection: PlaySelection | null = null;

/** Plays a movie/episode directly; for a series or season it finds the next episode to watch. */
export async function play(item: Item, fromStart = false, sel: PlaySelection | null = null, onError?: (msg: string) => void) {
  try {
    let target: Item | null;
    if (item.type === 'Series') {
      target = await api.nextUpForSeries(item.id);
      if (!target) {
        const eps = await api.episodes(item.id);
        target = eps.find(e => !e.played) ?? eps[0] ?? null;
      }
    } else if (item.type === 'Season') {
      const eps = await api.episodes(item.seriesId ?? '', item.id);
      target = eps.find(e => !e.played) ?? eps[0] ?? null;
    } else {
      target = item;
    }
    if (!target) {
      onError?.('Nothing to play');
      return;
    }
    pendingSelection = target.id === item.id ? sel : null;
    nav.push({ kind: 'Player', itemId: target.id, startTicks: fromStart || target.played ? 0 : target.playbackPositionTicks });
  } catch (e: any) {
    onError?.(e?.message ?? 'Playback failed');
  }
}
