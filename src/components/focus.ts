import { RefObject } from 'react';
import { findNodeHandle } from 'react-native';
import { FocusManager } from '@amazon-devices/react-native-kepler';

/** Moves the remote's highlight to a component (like FocusRequester.requestFocus()). */
export function requestFocus(ref: RefObject<any>, delayMs = 0): void {
  const run = () => {
    const handle = ref.current ? findNodeHandle(ref.current) : null;
    if (handle) {
      try {
        FocusManager.focus(handle);
      } catch {
        // the view isn't on screen any more
      }
    }
  };
  if (delayMs > 0) setTimeout(run, delayMs);
  else run();
}
