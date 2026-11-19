import React, { createRef, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, FlatList, findNodeHandle, Image, ScrollView, Text, View } from 'react-native';
import { HWEvent, useTVEventHandler } from '@amazon-devices/react-native-kepler';
import { api } from '../data/jellyfin';
import { Item, Library, isEpisode, isSeries } from '../data/models';
import { prefs } from '../data/prefs';
import { nav } from '../nav/navigator';
import { useBack } from '../nav/back';
import { play } from '../player/launcher';
import { BackdropLayer } from '../components/Backdrop';
import { requestFocus } from '../components/focus';
import { TitleOrLogo } from '../components/TitleOrLogo';
import { TopNav } from '../components/TopNav';
import {
  CenterMessage, LandscapeCard, MetaRow, NovaButton, NovaLoader, PosterCard, SectionTitle,
} from '../components/Widgets';
import { SCREEN_H, dp } from '../theme/scale';
import { Fixed, NovaType, accentH, usePalette } from '../theme/theme';
import { SIDE, UiScale, useCardSize } from '../theme/uiScale';

interface HomeRow {
  key: string;
  title: string;
  items: Item[];
  landscape: boolean;
  playOnClick: boolean;
}

/** Lives for the whole session so Home keeps its place when you come back (HomeState on Android). */
export const homeState = {
  loaded: false,
  error: null as string | null,
  featured: [] as Item[],
  rows: [] as HomeRow[],
  heroIndex: 0,
  heroMode: true,
  focusedRow: 0,
  lastFocusKey: null as string | null,
  lastRefresh: 0,
  libsCache: [] as Library[],

  reset() {
    this.loaded = false;
    this.error = null;
    this.featured = [];
    this.rows = [];
    this.heroIndex = 0;
    this.heroMode = true;
    this.focusedRow = 0;
    this.lastFocusKey = null;
  },

  async load(full: boolean) {
    const safe = async <T,>(p: Promise<T>, d: T): Promise<T> => {
      try {
        return await p;
      } catch {
        return d;
      }
    };
    try {
      this.error = null;
      const resumeP = safe(api.resume(), [] as Item[]);
      const nextP = safe(api.nextUp(), [] as Item[]);
      if (full || this.featured.length === 0) {
        const featP = safe(api.featured(12), [] as Item[]);
        const libs = await api.libraries();
        this.libsCache = libs;
        const video = libs.filter(l => ['movies', 'tvshows', 'homevideos', null].includes(l.collectionType));
        const latestP = video.map(lib => [lib, safe(api.latest(lib.id), [] as Item[])] as const);
        const favP = safe(api.favorites(), [] as Item[]);

        const list: HomeRow[] = [];
        list.push({ key: 'resume', title: 'Continue Watching', items: await resumeP, landscape: true, playOnClick: true });
        list.push({ key: 'next', title: 'Next Up', items: await nextP, landscape: true, playOnClick: true });
        for (const [lib, p] of latestP) {
          list.push({ key: `latest-${lib.id}`, title: `Recently Added · ${lib.name}`, items: await p, landscape: false, playOnClick: false });
        }
        list.push({ key: 'fav', title: 'My Favorites', items: await favP, landscape: false, playOnClick: false });
        this.featured = await featP;
        this.rows = list.filter(r => r.items.length > 0);
        if (this.heroIndex >= this.featured.length) this.heroIndex = 0;
      } else {
        const r = await resumeP;
        const n = await nextP;
        const updated = [...this.rows];
        const upsert = (key: string, title: string, items: Item[], pos: number) => {
          const i = updated.findIndex(x => x.key === key);
          if (items.length === 0) {
            if (i >= 0) updated.splice(i, 1);
            return;
          }
          const row: HomeRow = { key, title, items, landscape: true, playOnClick: true };
          if (i >= 0) updated[i] = row;
          else updated.splice(Math.min(pos, updated.length), 0, row);
        };
        upsert('resume', 'Continue Watching', r, 0);
        upsert('next', 'Next Up', n, updated[0]?.key === 'resume' ? 1 : 0);
        this.rows = updated;
      }
      this.loaded = true;
      this.lastRefresh = Date.now();
    } catch (e: any) {
      if (!this.loaded) this.error = e?.message ?? "Couldn't reach your server";
    }
  },
};

const HERO_INTERVAL_MS = 10000;

export function HomeScreen({ active }: { active: boolean }) {
  const P = usePalette();
  useCardSize();
  const [, force] = useState(0);
  const rerender = useCallback(() => force(x => x + 1), []);
  const st = homeState;

  const scrollRef = useRef<ScrollView>(null);
  const playRef = useRef<any>(null);
  const favRef = useRef<any>(null);
  const cardRefs = useRef(new Map<string, RefObject<any>>()).current;
  const rowY = useRef(new Map<number, { y: number; h: number }>()).current;
  const scrollY = useRef(0);
  const viewportH = useRef(SCREEN_H);
  const [playHandle, setPlayHandle] = useState<number | undefined>(undefined);
  const [favHandle, setFavHandle] = useState<number | undefined>(undefined);

  // true while focus is on the banner buttons or the top bar
  const [heroArea, setHeroArea] = useState(st.heroMode);
  const focusedBtn = useRef(0);
  const [interactions, setInteractions] = useState(0);
  const slideProgress = useRef(new Animated.Value(0)).current;

  const setHero = (v: boolean) => {
    st.heroMode = v;
    setHeroArea(v);
  };

  const cardRef = (key: string) => {
    let r = cardRefs.get(key);
    if (!r) {
      r = createRef();
      cardRefs.set(key, r);
    }
    return r;
  };

  // ----- loading -----
  useEffect(() => {
    (async () => {
      if (!st.loaded) {
        await st.load(true);
        nav.libraries = st.libsCache;
        rerender();
      }
      // Search & Add: only when the server has the Torvia plugin and this user may use it
      nav.refreshTorvia();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back to Home (from a details page or the player) or to the app: refresh Continue Watching / Next Up
  const refreshIfStale = useCallback(() => {
    if (st.loaded && Date.now() - st.lastRefresh > 4000) {
      st.load(false).then(rerender);
    }
  }, [st, rerender]);
  useEffect(() => {
    if (active) refreshIfStale();
  }, [active, refreshIfStale]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && active) refreshIfStale();
    });
    return () => sub.remove();
  }, [active, refreshIfStale]);

  const featured = st.featured;
  const heroItem: Item | undefined = featured[st.heroIndex];

  const goToHero = useCallback(() => {
    setHero(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    requestFocus(playRef, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeSlide = (delta: number) => {
    if (featured.length < 2) return;
    st.heroIndex = (st.heroIndex + delta + featured.length) % featured.length;
    setInteractions(i => i + 1);
  };

  // Node handles of the banner's edge buttons, for "stay put" left/right and "UP from the first row"
  useEffect(() => {
    const t = setTimeout(() => {
      setPlayHandle(playRef.current ? findNodeHandle(playRef.current) ?? undefined : undefined);
      setFavHandle(favRef.current ? findNodeHandle(favRef.current) ?? undefined : undefined);
    }, 50);
    return () => clearTimeout(t);
  }, [st.loaded, heroItem?.id]);

  // Auto-rotate the banner, only while you're up in the banner area
  useEffect(() => {
    slideProgress.setValue(0);
    if (!active || !heroArea || featured.length < 2 || !prefs.heroAutoRotate) return;
    const anim = Animated.timing(slideProgress, {
      toValue: 1, duration: HERO_INTERVAL_MS, easing: Easing.linear, useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) {
        st.heroIndex = (st.heroIndex + 1) % featured.length;
        rerender();
      }
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.heroIndex, heroArea, featured.length, interactions, active]);

  // ◀ on Play and ▶ on the heart flip the featured title
  useTVEventHandler((e: HWEvent) => {
    if (!active || !heroArea || e.eventKeyAction !== 0) return;
    if (e.eventType === 'left' && focusedBtn.current === 0) changeSlide(-1);
    else if (e.eventType === 'right' && focusedBtn.current === 2) changeSlide(1);
  });

  // Back from the rows goes up to the banner; Back on the banner leaves the app
  useBack(active && !heroArea, goToHero);

  // Restore focus when coming back to Home (the top bar handles it when opened from the top bar)
  const fromNav = useRef(nav.focusNavOnEnter);
  useEffect(() => {
    if (!active || !st.loaded) return;
    if (fromNav.current) {
      fromNav.current = false;
      return;
    }
    const key = st.lastFocusKey;
    if (st.heroMode || !key || !cardRefs.get(key)?.current) {
      setHero(true);
      requestFocus(playRef, 80);
    } else {
      requestFocus(cardRefs.get(key)!, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, st.loaded]);

  // Calm scrolling: only move when the focused row would be off-screen, then just enough to show it
  const keepRowVisible = (rowIndex: number) => {
    const r = rowY.get(rowIndex);
    if (!r) return;
    const top = dp(46);
    const bottom = dp(24);
    if (r.y - scrollY.current < top) {
      scrollRef.current?.scrollTo({ y: Math.max(0, r.y - top), animated: true });
    } else if (r.y + r.h - scrollY.current > viewportH.current - bottom) {
      scrollRef.current?.scrollTo({ y: r.y + r.h - viewportH.current + bottom, animated: true });
    }
  };

  if (!st.loaded) {
    return (
      <View style={{ flex: 1 }}>
        <TopNav selected={{ kind: 'Home' }} />
        {st.error ? (
          <CenterMessage
            title="Can't reach the server"
            subtitle={st.error}
            action={
              <NovaButton
                text="Try again"
                primary
                hasTVPreferredFocus
                onPress={async () => {
                  await st.load(true);
                  nav.libraries = st.libsCache;
                  rerender();
                }}
              />
            }
          />
        ) : (
          <NovaLoader />
        )}
      </View>
    );
  }

  const heroH = Math.max(dp(300), dp(540 - 90 - 128));
  const onPlay = (item: Item) => play(item);

  return (
    <View style={{ flex: 1 }}>
      <BackdropLayer uri={heroItem ? api.backdrop(heroItem) : null} kenBurns={false} dim={heroArea ? 0 : 0.5} />

      <View style={{ flex: 1 }}>
        {/* Top bar stays put, always reachable with UP */}
        <TopNav selected={{ kind: 'Home' }} onFocusInside={() => setHero(true)} />

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: dp(120) }}
          scrollEventThrottle={16}
          onScroll={e => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          onLayout={e => {
            viewportH.current = e.nativeEvent.layout.height;
          }}
        >
          {heroItem ? (
            <View style={{ height: heroH, justifyContent: 'flex-end', paddingHorizontal: dp(SIDE) }}>
              <HeroInfo item={heroItem} />
              <View style={{ height: dp(18) }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: dp(16) }}>
                <View style={{ flexDirection: 'row', columnGap: dp(14) }}>
                  <NovaButton
                    ref={playRef}
                    text={heroItem.playbackPositionTicks > 0 && !heroItem.played ? 'Resume' : 'Play'}
                    icon="play"
                    primary
                    hasTVPreferredFocus={st.heroMode}
                    nextFocusLeft={playHandle}
                    onFocused={() => {
                      focusedBtn.current = 0;
                      setHero(true);
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    onPress={() => onPlay(heroItem)}
                  />
                  <NovaButton
                    text="More Info"
                    icon="info"
                    onFocused={() => {
                      focusedBtn.current = 1;
                      setHero(true);
                    }}
                    onPress={() => nav.push({ kind: 'Detail', itemId: heroItem.id })}
                  />
                  <FavButton
                    ref={favRef}
                    item={heroItem}
                    nextFocusRight={favHandle}
                    onFocused={() => {
                      focusedBtn.current = 2;
                      setHero(true);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }} />
                <SlideIndicator count={featured.length} index={st.heroIndex} progress={slideProgress} />
              </View>
            </View>
          ) : (
            <View style={{ height: dp(24) }} />
          )}

          {st.rows.map((row, rowIndex) => (
            <View
              key={row.key}
              style={{ paddingTop: dp(4) }}
              onLayout={e => rowY.set(rowIndex, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
            >
              <SectionTitle text={row.title} style={{ marginLeft: dp(SIDE) }} />
              <FlatList
                horizontal
                data={row.items}
                keyExtractor={it => it.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingVertical: dp(12) }}
                ItemSeparatorComponent={() => <View style={{ width: dp(row.landscape ? 18 : 16) }} />}
                initialNumToRender={8}
                windowSize={5}
                renderItem={({ item }) => {
                  const key = `${row.key}/${item.id}`;
                  const onFocused = () => {
                    st.lastFocusKey = key;
                    st.focusedRow = rowIndex;
                    if (st.heroMode) setHero(false);
                    keepRowVisible(rowIndex);
                  };
                  const onPress = () => (row.playOnClick ? onPlay(item) : nav.push({ kind: 'Detail', itemId: item.id }));
                  // From the first row, UP always lands cleanly on the banner's Play button
                  const up = rowIndex === 0 ? playHandle : undefined;
                  return row.landscape ? (
                    <LandscapeCard ref={cardRef(key)} item={item} onPress={onPress} onFocused={onFocused}
                      width={UiScale.landscapeWidth} nextFocusUp={up} />
                  ) : (
                    <PosterCard ref={cardRef(key)} item={item} onPress={onPress} onFocused={onFocused}
                      width={UiScale.posterWidth} showTitle nextFocusUp={up} />
                  );
                }}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function FavButton({ item, onFocused, nextFocusRight, ref }: { item: Item; onFocused: () => void; nextFocusRight?: number } & { ref?: React.Ref<any> }) {
  const [fav, setFav] = useState(item.isFavorite);
  useEffect(() => setFav(item.isFavorite), [item.id, item.isFavorite]);
  return (
    <NovaButton
      ref={ref}
      text=""
      icon={fav ? 'favorite' : 'favorite_border'}
      onFocused={onFocused}
      nextFocusRight={nextFocusRight}
      onPress={() => {
        const v = !fav;
        setFav(v);
        item.isFavorite = v;
        api.setFavorite(item.id, v).catch(() => {});
      }}
    />
  );
}

function HeroInfo({ item }: { item: Item }) {
  const P = usePalette();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [item.id, opacity]);
  return (
    <Animated.View style={{ maxWidth: dp(620), opacity }}>
      <Text style={[NovaType.Caption, { color: P.accent }]}>{isSeries(item) ? '✦  FEATURED SERIES' : '✦  FEATURED FILM'}</Text>
      <View style={{ height: dp(10) }} />
      <TitleOrLogo item={item} maxLogoH={96} maxLogoW={420} big />
      <View style={{ height: dp(14) }} />
      <MetaRow item={item} />
      <View style={{ height: dp(10) }} />
      <Text style={[NovaType.Label, { color: P.text }]}>{item.genres.slice(0, 3).join(' • ')}</Text>
      <View style={{ height: dp(8) }} />
      <Text numberOfLines={2} style={[NovaType.Body, { color: P.textDim }]}>{item.overview}</Text>
    </Animated.View>
  );
}

function SlideIndicator({ count, index, progress }: { count: number; index: number; progress: Animated.Value }) {
  const P = usePalette();
  const n = Math.min(count, 12);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: dp(6) }}>
      {Array.from({ length: n }).map((_, i) => {
        const isActive = i === index;
        return (
          <View
            key={i}
            style={{ width: dp(isActive ? 42 : 10), height: dp(4), borderRadius: dp(2), backgroundColor: Fixed.white25, overflow: 'hidden' }}
          >
            {isActive ? (
              <Animated.View
                style={{
                  height: dp(4),
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: [dp(42) * 0.02, dp(42)], extrapolate: 'clamp' }),
                  experimental_backgroundImage: accentH(P),
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
