import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { nav } from './navigator';

/**
 * The remote's Back button, handled like Android PHOENIXA: the newest enabled handler wins
 * (a side panel, then the screen's own step back, then leaving the screen). When nothing
 * handles it on the first screen, the app closes.
 */
type Handler = { fn: () => void; enabled: boolean; order: number };
const handlers: Handler[] = [];
let order = 0;

export function installBackHandler(): () => void {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    const active = handlers.filter(h => h.enabled).sort((a, b) => b.order - a.order)[0];
    if (active) {
      active.fn();
      return true;
    }
    return nav.back();
  });
  return () => sub.remove();
}

/** Like Compose's BackHandler(enabled) { … } */
export function useBack(enabled: boolean, fn: () => void) {
  const ref = useRef<Handler | null>(null);
  if (ref.current === null) ref.current = { fn, enabled, order: order++ };
  ref.current.fn = fn;
  ref.current.enabled = enabled;
  useEffect(() => {
    const h = ref.current!;
    handlers.push(h);
    return () => {
      const i = handlers.indexOf(h);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, []);
}
