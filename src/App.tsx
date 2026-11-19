import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { FocusManager, useHideSplashScreenCallback } from '@amazon-devices/react-native-kepler';
import { api } from './data/jellyfin';
import { loadPrefs, prefs } from './data/prefs';
import { installBackHandler } from './nav/back';
import { Screen, StackEntry, nav, useNav } from './nav/navigator';
import { HomeScreen, homeState } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { PlayerScreen } from './player/PlayerScreen';
import { AboutScreen, SettingsScreen } from './screens/SettingsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { PersonScreen } from './screens/PersonScreen';
import { SearchScreen } from './screens/SearchScreen';
import { TorviaScreen, TorviaTitleScreen } from './screens/TorviaScreen';
import { SCREEN_W } from './theme/scale';
import { ThemeStore, usePalette } from './theme/theme';
import { UiScale } from './theme/uiScale';

export function App() {
  const [ready, setReady] = useState(false);
  const hideSplash = useHideSplashScreenCallback();

  useEffect(() => {
    (async () => {
      await loadPrefs();
      installCrashLog();
      ThemeStore.init();
      UiScale.init();
      nav.init(api.isLoggedIn ? { kind: 'Home' } : { kind: 'Login' });
      setReady(true);
      hideSplash();
    })();
    return installBackHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#181012' }} />;
  return (
    <ThemedBackground>
      <Screens />
    </ThemedBackground>
  );
}

/** Page background with the two soft glows (top-right and bottom-left) */
function ThemedBackground({ children }: { children: React.ReactNode }) {
  const P = usePalette();
  // Android draws these on a 1920 px wide TV
  const px = (v: number) => (v / 1920) * SCREEN_W;
  return (
    <View style={{ flex: 1, backgroundColor: P.bg.slice(0, 7) }}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `radial-gradient(circle ${px(1400)}px at ${px(1600)}px 0px, ${P.glow1} 0%, transparent 100%)` }]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `radial-gradient(circle ${px(1200)}px at 0px ${px(1100)}px, ${P.glow2} 0%, transparent 100%)` }]}
      />
      {children}
    </View>
  );
}

/** Saves the reason for a crash so it can be read in Settings (helps fixing it). */
function installCrashLog() {
  const g: any = globalThis as any;
  const eu = g.ErrorUtils;
  if (!eu?.setGlobalHandler) return;
  const previous = eu.getGlobalHandler?.();
  eu.setGlobalHandler((e: any, isFatal?: boolean) => {
    try {
      const d = new Date();
      const when = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      prefs.lastCrash = `${when}${isFatal ? ' · fatal' : ''}\n${String(e?.message ?? e)}\n${String(e?.stack ?? '').slice(0, 4000)}`;
    } catch {
      // ignore
    }
    previous?.(e, isFatal);
  });
}

function signOut() {
  const tok = prefs.token;
  api.logout(tok);
  prefs.signOut();
  homeState.reset();
  nav.reset({ kind: 'Login' });
}

function renderScreen(s: Screen, active: boolean) {
  switch (s.kind) {
    case 'Login':
      return (
        <LoginScreen
          onLoggedIn={() => {
            homeState.reset();
            nav.reset({ kind: 'Home' });
          }}
        />
      );
    case 'Home':
      return <HomeScreen active={active} />;
    case 'Settings':
      return <SettingsScreen onSignOut={signOut} active={active} />;
    case 'About':
      return <AboutScreen />;
    case 'Lib':
      return <LibraryScreen lib={s.library} />;
    case 'Search':
      return <SearchScreen />;
    case 'Favorites':
      return <FavoritesScreen active={active} />;
    case 'Torvia':
      return <TorviaScreen active={active} />;
    case 'TorviaTitle':
      return <TorviaTitleScreen type={s.type} tmdbId={s.tmdbId} name={s.name} active={active} />;
    case 'Detail':
      return <DetailScreen itemId={s.itemId} active={active} />;
    case 'Person':
      return <PersonScreen personId={s.id} name={s.name} active={active} />;
    case 'Player':
      return <PlayerScreen itemId={s.itemId} startTicks={s.startTicks} active={active} />;
  }
}

/**
 * Every screen in the stack stays mounted, so Home keeps its rows and scroll position when you
 * come back (like Android's HomeState). Only the top screen is shown; it fades in like Android.
 */
function Screens() {
  useNav();
  const stack = nav.stack;
  const top = stack[stack.length - 1];
  return (
    <View style={{ flex: 1 }}>
      {stack.map(e => (
        <ScreenHost key={e.key} entry={e} active={e.key === top.key} />
      ))}
    </View>
  );
}

function ScreenHost({ entry, active }: { entry: StackEntry; active: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const savedFocus = useRef<number | undefined>(undefined);
  const first = useRef(true);
  useEffect(() => {
    if (active) {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      // Coming back to this screen: put the highlight where it was (Home does this itself)
      if (!first.current && entry.screen.kind !== 'Home' && savedFocus.current !== undefined) {
        const tag = savedFocus.current;
        setTimeout(() => {
          try {
            FocusManager.focus(tag);
          } catch {
            // that card is gone
          }
        }, 120);
      }
    } else {
      // Leaving this screen for another one on top: remember the highlighted control
      try {
        savedFocus.current = FocusManager.getFocused();
      } catch {
        savedFocus.current = undefined;
      }
    }
    first.current = false;
  }, [active, opacity, entry.screen.kind]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, display: active ? 'flex' : 'none' }]}>
      {renderScreen(entry.screen, active)}
    </Animated.View>
  );
}
