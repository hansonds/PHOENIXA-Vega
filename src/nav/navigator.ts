/* Screen stack, ported from Android PHOENIXA (ui/Nav.kt). */
import { useSyncExternalStore } from 'react';
import { Library } from '../data/models';
import { TorviaStatus, torvia } from '../data/torvia';

export type Screen =
  | { kind: 'Login' }
  | { kind: 'Home' }
  | { kind: 'Lib'; library: Library }
  | { kind: 'Search' }
  | { kind: 'Favorites' }
  | { kind: 'Settings' }
  | { kind: 'Detail'; itemId: string }
  | { kind: 'Person'; id: string; name: string }
  | { kind: 'Torvia' }
  | { kind: 'TorviaTitle'; type: string; tmdbId: number; name: string }
  | { kind: 'About' }
  | { kind: 'Player'; itemId: string; startTicks: number };

export interface StackEntry {
  key: number;
  screen: Screen;
}

let nextKey = 1;
const entry = (s: Screen): StackEntry => ({ key: nextKey++, screen: s });

const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach(l => l());
};
let version = 0;

let stack: StackEntry[] = [];
let libraries: Library[] = [];
let torviaStatus: TorviaStatus | null = null;

export function sameScreen(a: Screen, b: Screen): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'Lib' && b.kind === 'Lib') return a.library.id === b.library.id;
  return true;
}

export const nav = {
  init(start: Screen) {
    stack = [entry(start)];
    emit();
  },
  get stack() {
    return stack;
  },
  get current(): Screen {
    return stack[stack.length - 1].screen;
  },
  get libraries() {
    return libraries;
  },
  set libraries(l: Library[]) {
    libraries = l;
    emit();
  },
  /** Search & Add status from the server's Torvia plugin; null = not available (button hidden) */
  get torvia() {
    return torviaStatus;
  },
  /** Re-reads Search & Add status (after sign-in, and to refresh the daily allowance) */
  async refreshTorvia() {
    const s = await torvia.status();
    torviaStatus = s && s.enabled ? s : null;
    emit();
  },

  /** Set when a screen was opened from the top bar, so it keeps focus on the top bar. */
  focusNavOnEnter: false,

  /** Remembers where you were in each library grid: libraryId -> [sortIndex, itemIndex] */
  libraryPos: new Map<string, [number, number]>(),

  push(s: Screen) {
    stack = [...stack, entry(s)];
    emit();
  },

  /** Top-level tabs replace everything above Home. */
  tab(s: Screen) {
    nav.focusNavOnEnter = true;
    const home = stack[0];
    stack = s.kind === 'Home' ? [home] : [home, entry(s)];
    emit();
  },

  reset(s: Screen) {
    stack = [entry(s)];
    emit();
  },

  back(): boolean {
    if (stack.length <= 1) return false;
    stack = stack.slice(0, -1);
    emit();
    return true;
  },

  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Re-renders the caller whenever the stack, libraries or Search & Add status change. */
export function useNav(): number {
  return useSyncExternalStore(nav.subscribe, () => version);
}
