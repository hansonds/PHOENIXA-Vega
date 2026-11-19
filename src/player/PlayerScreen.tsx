import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { HWEvent, Pressable, useTVEventHandler } from '@amazon-devices/react-native-kepler';
import { KeplerCaptionsView, KeplerVideoSurfaceView, TextTrack, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import { ApiException, ExternalSub, PlaybackSource, api, playback } from '../data/jellyfin';
import { Lang } from '../data/lang';
import { Item, PlaySelection, episodeLabel, isEpisode } from '../data/models';
import { prefs } from '../data/prefs';
import { useBack } from '../nav/back';
import { nav } from '../nav/navigator';
import { FocusSurface } from '../components/FocusSurface';
import { requestFocus } from '../components/focus';
import { Icon, IconName } from '../components/Icon';
import { NetImage } from '../components/NetImage';
import { TitleOrLogo } from '../components/TitleOrLogo';
import { NovaButton, NovaLoader, clockText, formatTime } from '../components/Widgets';
import { SidePanel } from '../components/OptionSheet';
import { dp, sp } from '../theme/scale';
import { Fixed, NovaType, accentH, alpha, usePalette } from '../theme/theme';
import { isDts, isUnplayableAudio } from './deviceProfile';
import { pendingSelection } from './launcher';

/** Settings → "Test the player": a short H.264 / AAC MP4 from Amazon's Vega sample app */
export const PLAYER_TEST_ID = '__player_test__';
const TEST_URL = 'https://edge-vod-media.cdn01.net/encoded/0000169/0169306/video_1880k/A57CBB0FF.mp4';

function testItem(): Item {
  return {
    id: PLAYER_TEST_ID, name: 'Player test (H.264 / AAC)', type: 'Movie', overview: 'A short sample video that every Vega device can play.',
    year: null, communityRating: null, criticRating: null, officialRating: null, runTimeTicks: 0, genres: [], primaryTag: null,
    backdropTag: null, backdropItemId: null, logoTag: null, logoItemId: null, thumbTag: null, thumbItemId: null, seriesId: null,
    seriesName: null, seriesPrimaryTag: null, seasonId: null, indexNumber: null, parentIndexNumber: null, childCount: null,
    playbackPositionTicks: 0, playedPercentage: null, played: false, isFavorite: false, unplayedCount: null, collectionType: null,
    people: [], taglines: [], studios: [], streams: [], premiereDate: null, endDate: null, locations: [], mediaSources: [],
  };
}

function testSource(): PlaybackSource {
  return {
    url: TEST_URL, mediaSourceId: 'test', playSessionId: null, isTranscoding: false, subs: [], embeddedAudio: [], streams: [],
    defaultAudioIndex: null, defaultSubtitleIndex: null, container: 'mp4',
  };
}

/** Asks the server for the first bytes of the file the same way the player does, and says what happened. */
async function probe(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t0 = Date.now();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-65535' }, signal: ctrl.signal });
    const ms = Date.now() - t0;
    let host = '';
    try {
      host = (r.url || url).split('/')[2] ?? '';
    } catch {
      host = '';
    }
    const len = r.headers.get('content-length') ?? '?';
    const type = r.headers.get('content-type') ?? '?';
    return `HTTP ${r.status} in ${(ms / 1000).toFixed(1)} s from ${host} (${type}, ${len} bytes)`;
  } catch (e: any) {
    return e?.name === 'AbortError' ? 'no answer within 20 s (very slow or blocked connection)' : `failed (${e?.message ?? 'network error'})`;
  } finally {
    clearTimeout(timer);
  }
}

interface Current {
  itemId: string;
  startTicks: number;
  sel: PlaySelection | null;
  /** Audio streams already tried and failed (DTS without passthrough) */
  failedAudio: number[];
  /** Automatic retries after a network error */
  retries: number;
  n: number;
}

/**
 * The video player. Plays the original file straight from the server (no transcoding),
 * with the same controls as Android PHOENIXA.
 */
export function PlayerScreen({ itemId, startTicks, active }: { itemId: string; startTicks: number; active: boolean }) {
  const [cur, setCur] = useState<Current>(() => ({ itemId, startTicks, sel: pendingSelection, failedAudio: [], retries: 0, n: 0 }));
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <PlayerSession
        key={cur.n}
        cur={cur}
        active={active}
        onNext={next => setCur(c => ({ itemId: next.id, startTicks: 0, sel: null, failedAudio: [], retries: 0, n: c.n + 1 }))}
        onRestart={(ticks, sel, failedAudio, retries) => setCur(c => ({ itemId: c.itemId, startTicks: ticks, sel, failedAudio, retries, n: c.n + 1 }))}
        onExit={() => nav.back()}
      />
    </View>
  );
}

type Panel = 'none' | 'subs' | 'audio' | 'speed';
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const FIT_LABELS = ['Fit to screen', 'Zoom to fill', 'Stretch'];
const FIT_MODES: Array<'fit' | 'fill' | 'strech'> = ['fit', 'fill', 'strech'];

function PlayerSession({
  cur, active, onNext, onRestart, onExit,
}: {
  cur: Current;
  active: boolean;
  onNext: (next: Item) => void;
  onRestart: (ticks: number, sel: PlaySelection, failedAudio: number[], retries: number) => void;
  onExit: () => void;
}) {
  const P = usePalette();
  const video = useRef<VideoPlayer | null>(null);
  const surfaceHandle = useRef<string | null>(null);
  const captionHandle = useRef<string | null>(null);
  const srcRef = useRef<PlaybackSource | null>(null);
  const subTracks = useRef(new Map<number, TextTrack>());
  const listeners = useRef<Array<[string, (e: any) => void]>>([]);
  const started = useRef(false);
  const disposed = useRef(false);

  const [item, setItem] = useState<Item | null>(null);
  const [src, setSrc] = useState<PlaybackSource | null>(null);
  const [ready, setReady] = useState(false); // metadata loaded: show the video surface
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // ms
  const [duration, setDuration] = useState(0); // ms
  const [overlay, setOverlay] = useState(true);
  const [panel, setPanel] = useState<Panel>('none');
  const [showInfo, setShowInfo] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fit, setFitState] = useState(Math.max(0, Math.min(2, prefs.videoFit)));
  const [toast, setToast] = useState<string | null>(null);
  const [nextEpisode, setNextEpisode] = useState<Item | null>(null);
  const [audioIndex, setAudioIndex] = useState<number | null>(null);
  const [subIndex, setSubIndex] = useState<number>(-1);
  const [seekFlash, setSeekFlash] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null); // ms, while holding ◀ ▶ on the seek bar
  const lastInput = useRef(Date.now());
  const [inputTick, setInputTick] = useState(0);

  const rootRef = useRef<any>(null);
  const playRef = useRef<any>(null);
  const goBackRef = useRef<any>(null);
  const seekRef = useRef<any>(null);
  const seekFocused = useRef(false);

  const audioRef = useRef<number | null>(null);
  const subRef = useRef<number>(-1);
  audioRef.current = audioIndex;
  subRef.current = subIndex;

  // ---------- reporting ----------
  const report = useCallback((kind: 'start' | 'progress' | 'stopped', paused = false) => {
    const s = srcRef.current;
    const v = video.current;
    if (!s || cur.itemId === PLAYER_TEST_ID) return;
    const ticks = (v ? v.currentTime : 0) * 10000000;
    const b = playback.body(cur.itemId, s, ticks, paused, audioRef.current, subRef.current);
    if (kind === 'start') playback.start(b);
    else if (kind === 'progress') playback.progress(b);
    else playback.stopped(b);
  }, [cur.itemId]);

  // ---------- loading ----------
  useEffect(() => {
    disposed.current = false;
    (async () => {
      try {
        // Ask the server for the item and the stream at the same time (faster start)
        const test = cur.itemId === PLAYER_TEST_ID;
        const itemP = test ? Promise.resolve(testItem()) : api.item(cur.itemId);
        const s = test ? testSource() : await playback.info(cur.itemId, cur.startTicks, cur.sel);
        if (disposed.current) return;
        srcRef.current = s;
        setSrc(s);

        const it = await itemP;
        if (disposed.current) return;
        setItem(it);

        // Audio: your choice / remembered language, but never a track this TV can't play
        const audio = s.streams.filter(x => x.type === 'Audio' && !x.isExternal);
        const playable = audio.filter(x => !isUnplayableAudio(x.codec) && !cur.failedAudio.includes(x.index));
        let want = cur.sel?.audioIndex ?? Lang.pickAudio(s.streams, s.defaultAudioIndex);
        const wanted = audio.find(x => x.index === want);
        if (!wanted || !playable.includes(wanted)) {
          const sameLang = wanted ? playable.find(x => Lang.same(x.language, wanted.language)) : undefined;
          const fallback = sameLang ?? playable.find(x => !isDts(x.codec)) ?? playable[0];
          if (!fallback && audio.length > 0) {
            const what = audio.some(x => isUnplayableAudio(x.codec)) ? 'Dolby TrueHD' : 'DTS';
            throw new ApiException(
              `This file only has ${what} audio, which Fire TV with Vega OS can't play.\n` +
                'Add a version of this title with AC3, E-AC3 or AAC audio to play it here.',
            );
          }
          want = fallback ? fallback.index : null;
        }
        setAudioIndex(want);
        const sub = cur.sel?.subtitleIndex ?? Lang.pickSubtitle(s.streams, s.defaultSubtitleIndex);
        setSubIndex(s.subs.some(x => x.index === sub) ? sub : -1);

        // The player
        const v = new VideoPlayer();
        video.current = v;
        await v.initialize();
        if (disposed.current) return;
        const on = (type: string, fn: (e: any) => void) => {
          v.addEventListener(type, fn);
          listeners.current.push([type, fn]);
        };
        on('loadedmetadata', () => setReady(true));
        on('waiting', () => setBuffering(true));
        on('seeking', () => setBuffering(true));
        on('seeked', () => setBuffering(false));
        on('playing', () => {
          setBuffering(false);
          setPlaying(true);
        });
        on('timeupdate', () => setBuffering(false));
        on('play', () => {
          setPlaying(true);
          report('progress', false);
        });
        on('pause', () => {
          setPlaying(false);
          report('progress', true);
        });
        on('ended', () => onEnded());
        on('error', () => onPlayerError());
        v.autoplay = false;
        // Text subtitles, fetched from the server as WebVTT
        s.subs.forEach((x: ExternalSub) => {
          try {
            const t = v.addTextTrack('subtitles', x.title, x.language ?? '', x.url, 'text/vtt');
            subTracks.current.set(x.index, t);
          } catch {
            // skip this subtitle
          }
        });
        v.src = s.url;
        v.pause();
        v.load();
      } catch (e: any) {
        if (!disposed.current) setError(e?.message ?? "Couldn't start playback");
      }
    })();

    return () => {
      disposed.current = true;
      if (started.current) report('stopped');
      const v = video.current;
      if (v) {
        try {
          v.pause();
          listeners.current.forEach(([t, f]) => v.removeEventListener(t, f));
          if (surfaceHandle.current) v.clearSurfaceHandle(surfaceHandle.current);
          if (captionHandle.current) v.clearCaptionViewHandle(captionHandle.current);
          v.deinitializeSync(1500);
        } catch {
          // already gone
        }
      }
      video.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Next episode (for the Next buttons and auto-play)
  useEffect(() => {
    if (!item || !isEpisode(item) || !item.seriesId) return;
    api.episodes(item.seriesId).then(eps => {
      const i = eps.findIndex(e => e.id === item.id);
      if (i >= 0 && !disposed.current) setNextEpisode(eps[i + 1] ?? null);
    }).catch(() => {});
  }, [item]);

  const nextRef = useRef<Item | null>(null);
  nextRef.current = nextEpisode;

  const onEnded = () => {
    const n = nextRef.current;
    if (n && prefs.autoPlayNext) onNext(n);
    else onExit();
  };

  const onPlayerError = () => {
    const s = srcRef.current;
    const v = video.current;
    const a = audioRef.current;
    const stream = s?.streams.find(x => x.index === a);
    // DTS needs a soundbar/receiver that takes DTS: try another audio track of the file once
    if (s && stream && isDts(stream.codec)) {
      const others = s.streams.filter(x => x.type === 'Audio' && !x.isExternal && !isDts(x.codec) && !isUnplayableAudio(x.codec));
      if (others.length) {
        const pos = (v?.currentTime ?? 0) * 10000000;
        const alt = others.find(x => Lang.same(x.language, stream.language)) ?? others[0];
        onRestart(Math.max(pos, cur.startTicks), { mediaSourceId: s.mediaSourceId, audioIndex: alt.index, subtitleIndex: subRef.current }, [
          ...cur.failedAudio, stream.index,
        ], cur.retries);
        return;
      }
    }
    const err: any = (v as any)?.error;
    const native: string = String((v as any)?.mediaControlStateUtil?.mError?.message_ ?? err?.message ?? '');
    const code = err?.code ? ` (code ${err.code})` : '';
    // Details that help find the reason (what the file contains and what the player said)
    const vid = s?.streams.find(x => x.type === 'Video');
    const fileInfo = [
      s?.container ? s.container.toUpperCase() : null,
      vid ? [vid.codec.toUpperCase(), vid.height ? `${vid.height}p` : null, vid.videoRangeType || null].filter(Boolean).join(' ') : null,
      stream ? `${stream.codec.toUpperCase()} ${stream.channels ? stream.channels + 'ch' : ''}`.trim() : null,
    ].filter(Boolean).join(' · ');
    const tail = `${fileInfo ? `\nFile: ${fileInfo}` : ''}${native ? `\nPlayer: ${native.slice(0, 200)}` : ''}`;

    // The download from the server broke (not the decoding): try again from the same spot, twice
    const network = /httpsrc|soup|network|connection|timed out|resolve/i.test(native) || err?.code === 2;
    if (network && s && cur.retries < 2 && cur.itemId !== PLAYER_TEST_ID) {
      const pos = (v?.currentTime ?? 0) * 10000000;
      setBuffering(true);
      setTimeout(() => {
        if (disposed.current) return;
        onRestart(Math.max(pos, cur.startTicks), { mediaSourceId: s.mediaSourceId, audioIndex: audioRef.current, subtitleIndex: subRef.current },
          cur.failedAudio, cur.retries + 1);
      }, 1500);
      return;
    }
    if (network && s) {
      setError(`Couldn't stream this file from your server${code}.\nChecking the connection…${tail}`);
      probe(s.url).then(r => {
        if (!disposed.current) setError(`Couldn't stream this file from your server${code}.\nServer check: ${r}${tail}`);
      });
      return;
    }
    const what = stream && isDts(stream.codec)
      ? 'This TV needs a soundbar or receiver that supports DTS to play this audio.'
      : "The TV couldn't decode this file.";
    setError(`${what}${code}${tail}`);
  };

  // ---------- surface: attach, jump to the resume point, play ----------
  const onSurfaceCreated = (handle: string) => {
    surfaceHandle.current = handle;
    const v = video.current;
    if (!v) return;
    v.setSurfaceHandle(handle);
    if (cur.startTicks > 0) {
      try {
        v.currentTime = cur.startTicks / 10000000;
      } catch {
        // ignore
      }
    }
    v.playbackRate = speed;
    v.play().then(() => {
      if (!started.current) {
        started.current = true;
        report('start');
      }
      applyAudio(audioRef.current);
      applySubs(subRef.current);
    }).catch(() => onPlayerError());
  };

  const onCaptionCreated = (handle: string) => {
    captionHandle.current = handle;
    video.current?.setCaptionViewHandle(handle);
  };

  // ---------- tracks ----------
  const applyAudio = (want: number | null) => {
    const v = video.current;
    const s = srcRef.current;
    if (!v || !s || want === null) return;
    const k = s.embeddedAudio.indexOf(want);
    const list: any = v.audioTracks;
    if (k < 0 || !list || list.length <= k) return;
    try {
      list[k].enabled = true;
      for (let i = 0; i < list.length; i++) if (i !== k) list[i].enabled = false;
    } catch {
      // keep the current track
    }
  };

  const applySubs = (want: number) => {
    const v = video.current;
    if (!v) return;
    const ours = new Set(subTracks.current.values());
    const list: any = v.textTracks;
    try {
      // Subtitles inside the file are shown through our WebVTT copies, so the file's own stay off
      for (let i = 0; i < (list?.length ?? 0); i++) if (!ours.has(list[i])) list[i].mode = 'disabled';
      subTracks.current.forEach((t, idx) => {
        if (idx !== want) t.mode = 'disabled';
      });
      const t = subTracks.current.get(want);
      if (t) t.mode = 'showing';
    } catch {
      // ignore
    }
  };

  // Audio tracks of the file can arrive after playback starts
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => applyAudio(audioRef.current), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ---------- position ticker & progress loop ----------
  useEffect(() => {
    const t = setInterval(() => {
      const v = video.current;
      if (!v) return;
      setPosition(Math.max(0, v.currentTime * 1000));
      const d = v.duration;
      if (d && isFinite(d) && d > 0) setDuration(d * 1000);
      else if (item) setDuration(item.runTimeTicks / 10000);
      setPlaying(!v.paused);
    }, 500);
    const p = setInterval(() => {
      if (started.current && video.current) report('progress', video.current.paused);
    }, 10000);
    return () => {
      clearInterval(t);
      clearInterval(p);
    };
  }, [item, report]);

  // ---------- controls ----------
  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.ended) v.currentTime = 0;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekTo = (ms: number) => {
    const v = video.current;
    if (!v) return;
    const max = duration > 0 ? duration - 1000 : Number.MAX_SAFE_INTEGER;
    const target = Math.max(0, Math.min(ms, max));
    v.currentTime = target / 1000;
    setPosition(target);
  };
  const seekBy = (ms: number) => seekTo((video.current?.currentTime ?? 0) * 1000 + ms);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (video.current) video.current.playbackRate = s;
  };

  const cycleFit = () => {
    const f = (fit + 1) % 3;
    setFitState(f);
    prefs.videoFit = f;
    setToast(FIT_LABELS[f]);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  const playNext = () => {
    if (nextRef.current) onNext(nextRef.current);
  };

  // Hold ◀ ▶ on the seek bar to scrub; the jump happens when you let go
  const scrubCount = useRef(0);
  const scrubLast = useRef(0);
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubPos = useRef<number | null>(null);
  const scrubStep = (dir: number) => {
    const now = Date.now();
    scrubCount.current = now - scrubLast.current < 400 ? scrubCount.current + 1 : 0;
    scrubLast.current = now;
    const step = scrubCount.current > 6 ? 30000 : 10000;
    const base = scrubPos.current ?? (video.current?.currentTime ?? 0) * 1000;
    const max = duration > 0 ? duration - 1000 : base + step;
    const next = Math.max(0, Math.min(max, base + dir * step));
    scrubPos.current = next;
    setScrub(next);
    if (scrubTimer.current) clearTimeout(scrubTimer.current);
    scrubTimer.current = setTimeout(() => {
      if (scrubPos.current !== null) seekTo(scrubPos.current);
      scrubPos.current = null;
      setScrub(null);
    }, 450);
  };

  // ---------- remote ----------
  const stateRef = useRef({ overlay, panel, showInfo, error });
  stateRef.current = { overlay, panel, showInfo, error };

  useTVEventHandler((e: HWEvent) => {
    if (!active) return;
    lastInput.current = Date.now();
    setInputTick(x => x + 1);
    if (e.eventKeyAction !== 0) return;
    const st = stateRef.current;
    if (st.error) return;
    // Media keys work everywhere
    switch (e.eventType) {
      case 'playpause':
      case 'pause':
        togglePlay();
        setOverlay(true);
        return;
      case 'skip_forward':
        seekBy(30000);
        setSeekFlash(x => x + 1);
        return;
      case 'skip_backward':
        seekBy(-10000);
        setSeekFlash(x => x + 1);
        return;
    }
    if (!st.overlay && st.panel === 'none') {
      if (e.eventType === 'left') {
        seekBy(-10000);
        setSeekFlash(x => x + 1);
      } else if (e.eventType === 'right') {
        seekBy(10000);
        setSeekFlash(x => x + 1);
      } else if (e.eventType === 'up' || e.eventType === 'down' || e.eventType === 'menu') {
        setOverlay(true);
      }
      return;
    }
    if (st.overlay && st.panel === 'none' && seekFocused.current) {
      if (e.eventType === 'left') scrubStep(-1);
      else if (e.eventType === 'right') scrubStep(1);
    }
  });

  // Auto-hide the controls while playing
  useEffect(() => {
    if (!overlay || !playing || panel !== 'none' || showInfo || error) return;
    const t = setTimeout(() => setOverlay(false), 5000);
    return () => clearTimeout(t);
  }, [overlay, playing, panel, showInfo, error, inputTick]);

  // Put the highlight where it belongs
  useEffect(() => {
    if (!active) return;
    if (error) requestFocus(goBackRef, 80);
    else if (panel !== 'none') return; // the panel focuses its selected row
    else if (overlay) requestFocus(playRef, 60);
    else requestFocus(rootRef, 60);
  }, [overlay, panel, error, active, ready]);

  useEffect(() => {
    if (error) setOverlay(true);
  }, [error]);

  useBack(active, () => {
    if (panel !== 'none') setPanel('none');
    else if (showInfo) setShowInfo(false);
    else if (overlay && !error) setOverlay(false);
    else onExit();
  });

  // ---------- UI ----------
  const shownPos = scrub ?? position;
  const audioStreams = (src?.streams ?? []).filter(x => x.type === 'Audio' && !x.isExternal && !isUnplayableAudio(x.codec));
  const subStreams = (src?.subs ?? []).map(x => ({ sub: x, stream: src?.streams.find(s => s.index === x.index) }));

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {ready ? (
        <>
          <KeplerVideoSurfaceView
            style={StyleSheet.absoluteFill}
            scalingmode={FIT_MODES[fit]}
            onSurfaceViewCreated={onSurfaceCreated}
            onSurfaceViewDestroyed={(h: string) => video.current?.clearSurfaceHandle(h)}
          />
          <KeplerCaptionsView
            style={StyleSheet.absoluteFill}
            show={subIndex >= 0}
            onCaptionViewCreated={onCaptionCreated}
            onCaptionViewDestroyed={(h: string) => {
              video.current?.clearCaptionViewHandle(h);
              captionHandle.current = null;
            }}
          />
        </>
      ) : null}

      {/* Catches OK when the controls are hidden */}
      <Pressable
        ref={rootRef}
        focusable={!overlay && panel === 'none' && !error}
        style={StyleSheet.absoluteFill}
        onPress={() => {
          togglePlay();
          setOverlay(true);
        }}
      >
        <View />
      </Pressable>

      {buffering && !error ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <View style={{ width: dp(90), height: dp(90) }}>
            <NovaLoader />
          </View>
        </View>
      ) : null}

      {toast ? (
        <View style={{ position: 'absolute', top: dp(40), left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
          <Text style={[NovaType.Button, { color: '#FFFFFF', backgroundColor: alpha(P.bgDeep, 0.75), borderRadius: dp(20), paddingHorizontal: dp(18), paddingVertical: dp(8) }]}>
            {toast}
          </Text>
        </View>
      ) : null}

      {!overlay && seekFlash > 0 ? <SeekToast trigger={seekFlash} position={position} duration={duration} /> : null}

      {overlay && !error ? (
        <Overlay
          item={item}
          showInfo={showInfo}
          playing={playing}
          position={shownPos}
          duration={duration}
          scrubbing={scrub !== null}
          speedActive={speed !== 1}
          fitActive={fit !== 0}
          hasNext={!!nextEpisode}
          playRef={playRef}
          seekRef={seekRef}
          onSeekFocus={f => (seekFocused.current = f)}
          onPanel={setPanel}
          onInfo={() => setShowInfo(x => !x)}
          onFit={cycleFit}
          onNext={playNext}
          onToggle={togglePlay}
          onSeekBy={seekBy}
        />
      ) : null}

      {panel !== 'none' ? (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', justifyContent: 'flex-end' }]}>
          {panel === 'speed' ? (
            <SidePanel
              title="Playback speed"
              width={360}
              options={SPEEDS.map(v => ({ label: v === 1 ? 'Normal (1x)' : `${v}x`, detail: '', selected: v === speed }))}
              onSelect={i => {
                changeSpeed(SPEEDS[i]);
                setPanel('none');
              }}
            />
          ) : panel === 'audio' ? (
            <SidePanel
              title="Audio"
              width={400}
              options={audioStreams.map(a => {
                const [l, d] = Lang.label(a);
                return { label: l, detail: d, selected: a.index === audioIndex };
              })}
              onSelect={i => {
                const a = audioStreams[i];
                setAudioIndex(a.index);
                applyAudio(a.index);
                Lang.rememberAudio(a.language);
                setPanel('none');
              }}
            />
          ) : (
            <SidePanel
              title="Subtitles"
              width={400}
              options={[
                { label: 'Off', detail: '', selected: subIndex < 0 },
                ...subStreams.map(({ sub, stream }) => {
                  const [l, d] = stream ? Lang.label(stream) : [sub.title, ''];
                  return { label: l, detail: d, selected: sub.index === subIndex };
                }),
              ]}
              onSelect={i => {
                if (i === 0) {
                  setSubIndex(-1);
                  applySubs(-1);
                  Lang.rememberSubtitle(null, true);
                } else {
                  const x = subStreams[i - 1];
                  setSubIndex(x.sub.index);
                  applySubs(x.sub.index);
                  Lang.rememberSubtitle(x.stream?.language ?? x.sub.language, false);
                }
                setPanel('none');
              }}
            />
          )}
        </View>
      ) : null}

      {error ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ backgroundColor: alpha(P.bg, 0.9), borderRadius: dp(22), padding: dp(32), alignItems: 'center', maxWidth: dp(640) }}>
            <Text style={[NovaType.Title, { color: P.text }]}>Can't play this</Text>
            <View style={{ height: dp(8) }} />
            <Text style={[NovaType.Body, { color: P.textDim, textAlign: 'center' }]}>{error}</Text>
            <View style={{ height: dp(20) }} />
            <NovaButton ref={goBackRef} text="Go back" primary hasTVPreferredFocus onPress={onExit} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------- overlay ----------

function Overlay(props: {
  item: Item | null;
  showInfo: boolean;
  playing: boolean;
  position: number;
  duration: number;
  scrubbing: boolean;
  speedActive: boolean;
  fitActive: boolean;
  hasNext: boolean;
  playRef: React.RefObject<any>;
  seekRef: React.RefObject<any>;
  onSeekFocus: (f: boolean) => void;
  onPanel: (p: Panel) => void;
  onInfo: () => void;
  onFit: () => void;
  onNext: () => void;
  onToggle: () => void;
  onSeekBy: (ms: number) => void;
}) {
  const P = usePalette();
  const { item, showInfo, position, duration } = props;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [opacity]);

  const bits: string[] = [];
  if (item) {
    if (item.year !== null) bits.push(String(item.year));
    if (item.communityRating !== null) bits.push('★ ' + item.communityRating.toFixed(1));
    const ep = episodeLabel(item);
    if (ep) bits.push(ep);
    if (isEpisode(item)) bits.push(item.name);
  }
  const ep = item ? episodeLabel(item) : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      {/* Scrims */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage:
              `linear-gradient(to bottom, ${alpha(P.bgDeep, 0.8)} 0%, ${alpha(P.bgDeep, 0.2)} 25%, ` +
              `${alpha(P.bgDeep, 0.2)} 55%, ${alpha(P.bgDeep, 0.95)} 100%)`,
          },
        ]}
      />
      {showInfo ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: alpha(P.bgDeep, 0.6) }]} /> : null}

      {/* Top bar icons */}
      <View style={{ position: 'absolute', left: dp(48), top: dp(32), flexDirection: 'row', columnGap: dp(12) }}>
        <RoundIcon icon="closed_caption" onPress={() => props.onPanel('subs')} />
        <RoundIcon icon="surround_sound" onPress={() => props.onPanel('audio')} />
        <RoundIcon icon="speed" active={props.speedActive} onPress={() => props.onPanel('speed')} />
        <RoundIcon icon="aspect_ratio" active={props.fitActive} onPress={props.onFit} />
        {props.hasNext ? <RoundIcon icon="skip_next" onPress={props.onNext} /> : null}
        <RoundIcon icon="info" active={showInfo} onPress={props.onInfo} />
      </View>

      {/* Info: synopsis + cast */}
      {showInfo && item ? (
        <View style={{ position: 'absolute', left: dp(48), right: dp(48), top: dp(104), flexDirection: 'row' }}>
          <View style={{ flex: 1, paddingRight: dp(48) }}>
            <Text style={[NovaType.Caption, { color: P.textFaint }]}>SYNOPSIS</Text>
            <View style={{ height: dp(12) }} />
            <Text numberOfLines={7} style={[NovaType.Body, { fontSize: sp(17), lineHeight: sp(27), color: P.text }]}>{item.overview}</Text>
          </View>
          <View style={{ width: dp(340) }}>
            <Text style={[NovaType.Caption, { color: P.textFaint }]}>CAST & CREW</Text>
            <View style={{ height: dp(10) }} />
            <ScrollView style={{ height: dp(270) }} contentContainerStyle={{ rowGap: dp(12) }}>
              {item.people.slice(0, 20).map((p, i) => (
                <View key={p.id + i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: dp(48), height: dp(48), borderRadius: dp(24), overflow: 'hidden', backgroundColor: P.surfaceHi, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[NovaType.Section, { color: P.textDim }]}>{p.name.slice(0, 1)}</Text>
                    <NetImage uri={api.personImage(p, 120)} style={StyleSheet.absoluteFill} />
                  </View>
                  <View style={{ width: dp(14) }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[NovaType.Label, { fontSize: sp(15), color: P.text }]}>{p.name}</Text>
                    <Text numberOfLines={1} style={[NovaType.Label, { fontSize: sp(12), color: P.textFaint }]}>{p.role || p.type}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* Bottom block */}
      <View style={{ position: 'absolute', left: dp(48), right: dp(48), bottom: dp(28) }}>
        {item ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TitleOrLogo item={item} maxLogoH={52} maxLogoW={260} big={false} />
              {bits.map((b, i) => (
                <React.Fragment key={i}>
                  <Text style={[NovaType.Section, { color: P.textFaint }]}>  •  </Text>
                  <Text numberOfLines={1} style={[NovaType.Section, { color: b === ep ? P.accent : P.text }]}>{b}</Text>
                </React.Fragment>
              ))}
            </View>
            <View style={{ height: dp(18) }} />
          </>
        ) : null}
        <SeekBar
          seekRef={props.seekRef}
          position={position}
          duration={duration}
          scrubbing={props.scrubbing}
          onFocus={props.onSeekFocus}
          onPress={props.onToggle}
        />
        <View style={{ height: dp(8) }} />
        <View style={{ flexDirection: 'row' }}>
          <Text style={[NovaType.Label, { color: P.textDim }]}>{formatTime(position)}</Text>
          <View style={{ flex: 1 }} />
          {duration > 0 ? (
            <Text style={[NovaType.Label, { color: P.textFaint }]}>Ends at {clockText(new Date(Date.now() + (duration - position)))}   ·   </Text>
          ) : null}
          <Text style={[NovaType.Label, { color: P.textDim }]}>-{formatTime(duration - position)}</Text>
        </View>
        <View style={{ height: dp(14) }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', columnGap: dp(28) }}>
          <RoundIcon icon="replay_10" size={52} onPress={() => props.onSeekBy(-10000)} />
          <PlayButton ref={props.playRef} playing={props.playing} onPress={props.onToggle} />
          <RoundIcon icon="forward_10" size={52} onPress={() => props.onSeekBy(10000)} />
          {props.hasNext ? <RoundIcon icon="skip_next" size={52} onPress={props.onNext} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

function SeekBar({ seekRef, position, duration, scrubbing, onFocus, onPress }: {
  seekRef: React.RefObject<any>;
  position: number;
  duration: number;
  scrubbing: boolean;
  onFocus: (f: boolean) => void;
  onPress: () => void;
}) {
  const P = usePalette();
  const [focused, setFocused] = useState(false);
  const [self, setSelf] = useState<number | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => setSelf(seekRef.current ? findNodeHandle(seekRef.current) ?? undefined : undefined), 50);
    return () => clearTimeout(t);
  }, [seekRef]);
  const frac = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const activeBar = focused || scrubbing;
  const h = dp(activeBar ? 8 : 4);
  return (
    <Pressable
      ref={seekRef}
      onFocus={() => {
        setFocused(true);
        onFocus(true);
      }}
      onBlur={() => {
        setFocused(false);
        onFocus(false);
      }}
      onPress={onPress}
      nextFocusLeft={self}
      nextFocusRight={self}
      style={{ height: dp(36), justifyContent: 'center' }}
    >
      <View style={{ height: h, borderRadius: dp(4), backgroundColor: '#FFFFFF33', overflow: 'hidden' }}>
        <View style={{ height: h, width: `${frac * 100}%`, experimental_backgroundImage: accentH(P) }} />
      </View>
      {activeBar ? (
        <View
          style={{
            position: 'absolute',
            left: `${frac * 100}%`,
            marginLeft: dp(-9),
            width: dp(18),
            height: dp(18),
            borderRadius: dp(9),
            backgroundColor: '#FFFFFF',
            borderWidth: dp(3),
            borderColor: P.accent,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function PlayButton({ playing, onPress, ref }: { playing: boolean; onPress: () => void } & { ref?: React.Ref<any> }) {
  const P = usePalette();
  return (
    <FocusSurface ref={ref} onPress={onPress} radius={38} focusedScale={1.1} borderWidth={0}>
      {focused => (
        <View
          style={{
            width: dp(76),
            height: dp(76),
            borderRadius: dp(38),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? '#FFFFFF' : Fixed.white12,
            borderWidth: dp(2),
            borderColor: focused ? 'transparent' : '#FFFFFFCC',
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={38} color={focused ? P.onFocus : '#FFFFFF'} />
        </View>
      )}
    </FocusSurface>
  );
}

function RoundIcon({ icon, size = 46, active = false, onPress }: { icon: IconName; size?: number; active?: boolean; onPress: () => void }) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onPress} radius={size / 2} focusedScale={1.12} borderWidth={0} glow={false}>
      {focused => (
        <View
          style={{
            width: dp(size),
            height: dp(size),
            borderRadius: dp(size / 2),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? '#FFFFFF' : active ? alpha(P.accent, 0.33) : Fixed.white10,
          }}
        >
          <Icon name={icon} size={size * 0.5} color={focused ? P.onFocus : '#FFFFFF'} />
        </View>
      )}
    </FocusSurface>
  );
}

/** Seek feedback when the controls are hidden */
function SeekToast({ trigger, position, duration }: { trigger: number; position: number; duration: number }) {
  const P = usePalette();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!visible) return null;
  const frac = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: dp(48),
        paddingVertical: dp(30),
        experimental_backgroundImage: `linear-gradient(to bottom, transparent 0%, ${alpha(P.bgDeep, 0.8)} 100%)`,
      }}
    >
      <View style={{ height: dp(5), borderRadius: dp(3), backgroundColor: '#FFFFFF33', overflow: 'hidden' }}>
        <View style={{ height: dp(5), width: `${frac * 100}%`, experimental_backgroundImage: accentH(P) }} />
      </View>
      <View style={{ height: dp(8) }} />
      <Text style={[NovaType.Label, { color: P.text }]}>
        {formatTime(position)} / {formatTime(duration)}
      </Text>
    </View>
  );
}

