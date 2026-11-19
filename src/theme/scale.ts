import { Dimensions } from 'react-native';

/**
 * PHOENIXA on Android TV is laid out on a 960 x 540 dp screen. Vega reports the TV window in
 * its own units, so every size in this app goes through dp(): the same numbers as the Android
 * code, scaled to the real screen. The result looks identical on a 1080p and a 4K TV.
 */
const win = Dimensions.get('window');
export const SCREEN_W = win.width;
export const SCREEN_H = win.height;
const factor = Math.min(win.width / 960, win.height / 540);

export const dp = (v: number): number => Math.round(v * factor * 100) / 100;
/** Text sizes (sp on Android) */
export const sp = dp;
