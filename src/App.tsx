import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useHideSplashScreenCallback } from '@amazon-devices/react-native-kepler';
import { api } from './data/jellyfin';
import { loadPrefs, prefs } from './data/prefs';
import { installBackHandler } from './nav/back';
import { Screen, StackEntry, nav, useNav } from './nav/navigator';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { HomeScreen, homeState } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SCREEN_W } from './theme/scale';
import { ThemeStore, usePalette } from './theme/theme';
import { UiScale } from './theme/uiScale';

export function App() {
  const [ready, setReady] = useState(false);
  const hideSplash = useHideSplashScreenCallback();

  useEffect(() => {
    (async () => {
      await loadPrefs();
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
      return <SettingsScreen onSignOut={signOut} />;
    case 'Lib':
      return <ComingSoonScreen screen={s} title={s.library.name} />;
    case 'Search':
      return <ComingSoonScreen screen={s} title="Search" />;
    case 'Favorites':
      return <ComingSoonScreen screen={s} title="Favorites" />;
    case 'Torvia':
      return <ComingSoonScreen screen={s} title="Search & Add" />;
    case 'Detail':
      return <ComingSoonScreen screen={s} title="Details" />;
    case 'Person':
      return <ComingSoonScreen screen={s} title={s.name} />;
    case 'Player':
      return <ComingSoonScreen screen={s} title="Player" />;
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
  useEffect(() => {
    if (active) {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }
  }, [active, opacity]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, display: active ? 'flex' : 'none' }]}>
      {renderScreen(entry.screen, active)}
    </Animated.View>
  );
}
