import { useSyncExternalStore } from 'react';
import { prefs } from '../data/prefs';

/** Card size setting (Small / Medium / Large), changes instantly from Settings. */
const factors = [0.82, 1, 1.18];
const listeners = new Set<() => void>();
let index = 1;

export const UiScale = {
  labels: ['Small', 'Medium', 'Large'],
  init() {
    index = Math.max(0, Math.min(2, prefs.cardSize));
  },
  get cardSizeIndex() {
    return index;
  },
  get factor() {
    return factors[index];
  },
  /** Base sizes at Medium (dp) */
  get posterWidth() {
    return Math.trunc(128 * factors[index]);
  },
  get landscapeWidth() {
    return Math.trunc(232 * factors[index]);
  },
  set(i: number) {
    index = Math.max(0, Math.min(2, i));
    prefs.cardSize = index;
    listeners.forEach(l => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useCardSize(): number {
  return useSyncExternalStore(UiScale.subscribe, () => index);
}

/** Space between the screen edge and the content (TV layout) */
export const SIDE = 56;
