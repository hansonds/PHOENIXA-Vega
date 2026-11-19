import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { api } from '../data/jellyfin';
import { Lang } from '../data/lang';
import {
  Item, PlaySelection, episodeLabel, isCollection, isEpisode, isSeries, progress, runtimeMinutes,
  sourceAudio, sourceDetail, sourceLabel, sourceSubs,
} from '../data/models';
import { nav } from '../nav/navigator';
import { play } from '../player/launcher';
import { effectiveAudio } from '../player/deviceProfile';
import { BackdropLayer } from '../components/Backdrop';
import { FocusSurface } from '../components/FocusSurface';
import { OptionSheet } from '../components/OptionSheet';
import { requestFocus } from '../components/focus';
import { TitleOrLogo } from '../components/TitleOrLogo';
import {
  CardRow, CenterMessage, GlassChip, LandscapeCard, MetaRow, NovaButton, NovaLoader, PersonCard, PosterCard,
  ProgressBar, SectionTitle, clockText, formatRuntime,
} from '../components/Widgets';
import { SCREEN_H, dp, sp } from '../theme/scale';
import { NovaType, alpha, usePalette, Fixed } from '../theme/theme';
import { SIDE, UiScale, useCardSize } from '../theme/uiScale';

type Sheet = 'version' | 'audio' | 'subs' | null;

export function DetailScreen({ itemId, active }: { itemId: string; active: boolean }) {
  const P = usePalette();
  useCardSize();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Item[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Item | null>(null);
  const [episodes, setEpisodes] = useState<Item[]>([]);
  const [similar, setSimilar] = useState<Item[]>([]);
  const [children, setChildren] = useState<Item[]>([]);
  const [nextUp, setNextUp] = useState<Item | null>(null);
  // Version / audio / subtitle choices for movies & episodes
  const [srcIdx, setSrcIdx] = useState(0);
  const [audioSel, setAudioSel] = useState<number | null>(null);
  const [subSel, setSubSel] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const lastSheet = useRef<Sheet>(null);
  const chipRefs = { version: useRef<any>(null), audio: useRef<any>(null), subs: useRef<any>(null) };
  const playRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const selectedSeasonRef = useRef<Item | null>(null);
  selectedSeasonRef.current = selectedSeason;

  const load = useCallback(async () => {
    try {
      const it = await api.item(itemId);
      setItem(it);
      const simP = api.similar(itemId).catch(() => [] as Item[]);
      if (isSeries(it)) {
        const s = await api.seasons(it.id).catch(() => [] as Item[]);
        setSeasons(s);
        const nu = await api.nextUpForSeries(it.id).catch(() => null);
        setNextUp(nu);
        if (!selectedSeasonRef.current) {
          setSelectedSeason(s.find(se => se.id === nu?.seasonId) ?? s.find(se => (se.unplayedCount ?? 0) > 0) ?? s[0] ?? null);
        }
      }
      if (isCollection(it)) setChildren(await api.children(it.id).catch(() => [] as Item[]));
      setSimilar(isCollection(it) ? [] : await simP);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load");
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh progress after returning from the player
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current && item) {
      load();
      requestFocus(playRef, 120);
    }
    wasActive.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!selectedSeason || !item) return;
    api.episodes(item.id, selectedSeason.id).then(setEpisodes).catch(() => setEpisodes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason?.id]);

  // After a picker closes, put the highlight back on its chip
  useEffect(() => {
    if (sheet === null && lastSheet.current) requestFocus(chipRefs[lastSheet.current], 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  if (!item) {
    return error ? <CenterMessage title="Something went wrong" subtitle={error} /> : <NovaLoader />;
  }
  const it = item;
  const headerH = SCREEN_H - dp(96);
  const src = it.mediaSources[srcIdx];
  const isMovieLike = !isSeries(it) && !!src;

  const wantedAudio = src ? audioSel ?? Lang.pickAudio(src.streams, src.defaultAudioIndex) : null;
  const aIdx = src ? effectiveAudio(src.streams, wantedAudio, Lang.same) : null;
  const sIdx = src ? subSel ?? Lang.pickSubtitle(src.streams, src.defaultSubtitleIndex) : -1;

  const onPlay = (fromStart: boolean) => {
    const sel: PlaySelection | null = isMovieLike ? { mediaSourceId: src!.id, audioIndex: aIdx, subtitleIndex: sIdx } : null;
    const target = isCollection(it) ? children.find(c => !c.played) ?? children[0] : nextUp ?? it;
    if (target) play(target, fromStart, isCollection(it) ? null : sel);
  };

  const credits: string[] = [];
  const directors = it.people.filter(p => p.type === 'Director').slice(0, 2).map(p => p.name);
  if (directors.length) credits.push(`Directed by ${directors.join(', ')}`);
  if (it.studios[0]) credits.push(it.studios[0]);
  if (runtimeMinutes(it) > 0 && !isSeries(it)) {
    const remainingMs = (it.runTimeTicks - it.playbackPositionTicks) / 10000;
    credits.push(`Ends at ${clockText(new Date(Date.now() + remainingMs))}`);
  }

  const cast = it.people.filter(p => p.type === 'Actor' || p.type === 'GuestStar');
  const prog = progress(it);
  const epW = Math.trunc(UiScale.landscapeWidth * 1.15);

  const audioStream = src?.streams.find(a => a.index === aIdx) ?? (src ? sourceAudio(src)[0] : undefined);
  const subStream = src?.streams.find(x => x.index === sIdx && x.type === 'Subtitle');
  const audioText = audioStream
    ? (() => {
        const [m, d] = Lang.label(audioStream);
        return d ? `${m} · ${d.split(' · Default')[0]}` : m;
      })()
    : 'Default';

  return (
    <View style={{ flex: 1 }}>
      <BackdropLayer uri={api.backdrop(it) ?? api.landscape(it, 1280)} kenBurns dim={0} />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: dp(80) }} showsVerticalScrollIndicator={false}>
        <View style={{ height: headerH, justifyContent: 'flex-end' }}>
          <View style={{ paddingHorizontal: dp(SIDE), paddingBottom: dp(24), maxWidth: dp(720 + SIDE) }}>
            {isEpisode(it) && it.seriesName ? (
              <>
                <Text style={[NovaType.Caption, { color: P.accent }]}>{it.seriesName.toUpperCase()}</Text>
                <View style={{ height: dp(10) }} />
              </>
            ) : null}
            <TitleOrLogo item={it} maxLogoH={130} maxLogoW={480} big />
            {isEpisode(it) ? (
              <>
                <View style={{ height: dp(8) }} />
                <Text style={[NovaType.Section, { color: P.text }]}>{[episodeLabel(it), it.name].filter(Boolean).join('  ·  ')}</Text>
              </>
            ) : null}
            <View style={{ height: dp(16) }} />
            <MetaRow item={it} showEpisode={false} />
            {it.genres.length ? (
              <View style={{ flexDirection: 'row', columnGap: dp(8), marginTop: dp(12) }}>
                {it.genres.slice(0, 5).map(g => <GlassChip key={g} text={g} />)}
              </View>
            ) : null}
            {it.taglines[0] ? (
              <Text style={[NovaType.Body, { fontSize: sp(16), color: P.text, marginTop: dp(14) }]}>“{it.taglines[0]}”</Text>
            ) : null}
            <Text numberOfLines={4} style={[NovaType.Body, { color: P.textDim, marginTop: dp(12) }]}>{it.overview}</Text>
            {credits.length ? (
              <Text style={[NovaType.Label, { color: P.textFaint, marginTop: dp(12) }]}>{credits.join('   ·   ')}</Text>
            ) : null}

            <View style={{ height: dp(24) }} />
            <ActionRow
              item={it}
              nextUp={nextUp}
              playRef={playRef}
              onFocusRow={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              onPlay={onPlay}
              onChanged={setItem}
            />

            {isMovieLike && src ? (
              <View style={{ flexDirection: 'row', columnGap: dp(12), marginTop: dp(16) }}>
                {it.mediaSources.length > 1 ? (
                  <SelectorChip ref={chipRefs.version} caption="VERSION" value={sourceLabel(src)} onPress={() => openSheet('version')} />
                ) : null}
                {sourceAudio(src).length ? (
                  <SelectorChip ref={chipRefs.audio} caption="AUDIO" value={audioText} onPress={() => openSheet('audio')} />
                ) : null}
                <SelectorChip
                  ref={chipRefs.subs}
                  caption="SUBTITLES"
                  value={subStream ? Lang.label(subStream)[0] : 'Off'}
                  onPress={() => openSheet('subs')}
                />
              </View>
            ) : null}

            {prog > 0 && !it.played && !isSeries(it) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: dp(14) }}>
                <ProgressBar progress={prog} style={{ width: dp(240) }} />
                <View style={{ width: dp(12) }} />
                <Text style={[NovaType.Label, { color: P.textDim }]}>
                  {formatRuntime(Math.floor((it.runTimeTicks - it.playbackPositionTicks) / 600000000))} left
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {isCollection(it) && children.length ? (
          <CardRow
            title={`In this collection · ${children.length}`}
            data={children}
            keyOf={c => c.id}
            style={{ paddingTop: dp(8) }}
            render={c => (
              <PosterCard item={c} onPress={() => nav.push({ kind: 'Detail', itemId: c.id })} width={UiScale.posterWidth} showTitle />
            )}
          />
        ) : null}

        {isSeries(it) && seasons.length ? (
          <View>
            <SectionTitle text="Episodes" style={{ marginLeft: dp(SIDE), marginTop: dp(8) }} />
            <FlatList
              horizontal
              data={seasons}
              keyExtractor={s => s.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingVertical: dp(12) }}
              ItemSeparatorComponent={() => <View style={{ width: dp(10) }} />}
              renderItem={({ item: s }) => (
                <SeasonTab name={s.name} selected={s.id === selectedSeason?.id} onSelect={() => setSelectedSeason(s)} />
              )}
            />
            <FlatList
              horizontal
              data={episodes}
              keyExtractor={e => e.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingVertical: dp(14) }}
              ItemSeparatorComponent={() => <View style={{ width: dp(20) }} />}
              renderItem={({ item: e }) => (
                <View style={{ width: dp(epW) }}>
                  <LandscapeCard
                    item={e}
                    width={epW}
                    subtitle={[e.indexNumber !== null ? `Episode ${e.indexNumber}` : null, runtimeMinutes(e) > 0 ? formatRuntime(runtimeMinutes(e)) : null]
                      .filter(Boolean)
                      .join(' · ')}
                    onPress={() => play(e)}
                  />
                  <View style={{ height: dp(10) }} />
                  <Text numberOfLines={1} style={[NovaType.Label, { color: P.text }]}>{e.name}</Text>
                  <Text numberOfLines={2} style={[NovaType.Label, { fontSize: sp(12), color: P.textFaint }]}>{e.overview}</Text>
                </View>
              )}
            />
          </View>
        ) : null}

        {cast.length ? (
          <CardRow
            title="Cast & Crew"
            data={cast.slice(0, 30)}
            keyOf={p => p.id + p.role}
            gap={16}
            style={{ paddingTop: dp(12) }}
            render={p => <PersonCard person={p} onPress={() => nav.push({ kind: 'Person', id: p.id, name: p.name })} />}
          />
        ) : null}

        {similar.length ? (
          <CardRow
            title="More Like This"
            data={similar}
            keyOf={s => s.id}
            style={{ paddingTop: dp(12) }}
            render={s => <PosterCard item={s} onPress={() => nav.push({ kind: 'Detail', itemId: s.id })} width={UiScale.posterWidth} showTitle />}
          />
        ) : null}
      </ScrollView>

      {sheet && src && active ? renderSheet() : null}
    </View>
  );

  function openSheet(k: Exclude<Sheet, null>) {
    lastSheet.current = k;
    setSheet(k);
  }

  function renderSheet() {
    if (!src) return null;
    if (sheet === 'version') {
      return (
        <OptionSheet
          title="Version"
          options={it.mediaSources.map((m, i) => ({ label: sourceLabel(m), detail: sourceDetail(m), selected: i === srcIdx }))}
          onSelect={i => {
            setSrcIdx(i);
            setAudioSel(null);
            setSubSel(null);
            setSheet(null);
          }}
          onDismiss={() => setSheet(null)}
        />
      );
    }
    if (sheet === 'audio') {
      const list = sourceAudio(src);
      return (
        <OptionSheet
          title="Audio"
          options={list.map(a => {
            const [m, d] = Lang.label(a);
            const bad = ['truehd', 'mlp'].includes(a.codec.toLowerCase());
            return { label: m, detail: bad ? `${d} · Can't play on this TV` : d, selected: a.index === aIdx };
          })}
          onSelect={i => {
            setAudioSel(list[i].index);
            Lang.rememberAudio(list[i].language);
            setSheet(null);
          }}
          onDismiss={() => setSheet(null)}
        />
      );
    }
    const subs = sourceSubs(src);
    return (
      <OptionSheet
        title="Subtitles"
        options={[
          { label: 'Off', detail: '', selected: sIdx === -1 },
          ...subs.map(x => {
            const [m, d] = Lang.label(x);
            const picture = !x.isTextSubtitle && ['pgssub', 'pgs', 'hdmv_pgs_subtitle', 'dvdsub', 'dvd_subtitle', 'dvbsub', 'dvb_subtitle'].includes(x.codec.toLowerCase());
            return { label: m, detail: picture ? `${d} · Can't show on this TV` : d, selected: x.index === sIdx };
          }),
        ]}
        onSelect={i => {
          setSubSel(i === 0 ? -1 : subs[i - 1].index);
          Lang.rememberSubtitle(i === 0 ? null : subs[i - 1].language, i === 0);
          setSheet(null);
        }}
        onDismiss={() => setSheet(null)}
      />
    );
  }
}

const SelectorChip = React.forwardRef<any, { caption: string; value: string; onPress: () => void }>(function SelectorChip(
  { caption, value, onPress },
  ref,
) {
  const P = usePalette();
  return (
    <FocusSurface ref={ref} onPress={onPress} radius={14} focusedScale={1.04} borderWidth={0} glow={false}>
      {focused => (
        <View
          style={{
            minWidth: dp(150),
            maxWidth: dp(300),
            backgroundColor: focused ? P.focus : Fixed.white12,
            borderWidth: dp(1),
            borderColor: focused ? 'transparent' : Fixed.stroke,
            borderRadius: dp(14),
            paddingHorizontal: dp(16),
            paddingVertical: dp(9),
          }}
        >
          <Text style={[NovaType.Caption, { fontSize: sp(10), color: focused ? '#4A5068' : P.textFaint }]}>{caption}</Text>
          <Text numberOfLines={1} style={[NovaType.Label, { fontSize: sp(14), color: focused ? P.onFocus : P.text }]}>{value}  ▾</Text>
        </View>
      )}
    </FocusSurface>
  );
});

function ActionRow({ item, nextUp, playRef, onPlay, onChanged, onFocusRow }: {
  item: Item;
  nextUp: Item | null;
  playRef: React.RefObject<any>;
  onPlay: (fromStart: boolean) => void;
  onChanged: (i: Item) => void;
  onFocusRow: () => void;
}) {
  let label: string;
  if (isSeries(item) && nextUp) label = (nextUp.playbackPositionTicks > 0 ? 'Resume ' : 'Play ') + (episodeLabel(nextUp) ?? '');
  else if (isSeries(item)) label = 'Play';
  else if (item.playbackPositionTicks > 0 && !item.played) label = 'Resume';
  else label = 'Play';
  const canFromStart = !isSeries(item) && item.playbackPositionTicks > 0 && !item.played;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: dp(14) }}>
      <NovaButton ref={playRef} text={label.trim()} icon="play" primary hasTVPreferredFocus onFocused={onFocusRow} onPress={() => onPlay(false)} />
      {canFromStart ? <NovaButton text="From Start" icon="replay" onFocused={onFocusRow} onPress={() => onPlay(true)} /> : null}
      {isEpisode(item) && item.seriesId ? (
        <NovaButton text="Go to Series" icon="tv" onFocused={onFocusRow} onPress={() => nav.push({ kind: 'Detail', itemId: item.seriesId! })} />
      ) : null}
      <NovaButton
        text=""
        icon={item.played ? 'check_circle' : 'check_circle_outline'}
        onFocused={onFocusRow}
        onPress={() => {
          const v = !item.played;
          onChanged({ ...item, played: v, playbackPositionTicks: v ? 0 : item.playbackPositionTicks, playedPercentage: null });
          api.setPlayed(item.id, v).catch(() => {});
        }}
      />
      <NovaButton
        text=""
        icon={item.isFavorite ? 'favorite' : 'favorite_border'}
        onFocused={onFocusRow}
        onPress={() => {
          const v = !item.isFavorite;
          onChanged({ ...item, isFavorite: v });
          api.setFavorite(item.id, v).catch(() => {});
        }}
      />
    </View>
  );
}

/** Season tab: moving the highlight onto it shows that season's episodes */
function SeasonTab({ name, selected, onSelect }: { name: string; selected: boolean; onSelect: () => void }) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onSelect} onFocused={onSelect} radius={20} focusedScale={1.05} borderWidth={0} glow={false}>
      {focused => (
        <View
          style={{
            paddingHorizontal: dp(18),
            paddingVertical: dp(9),
            borderRadius: dp(20),
            borderWidth: dp(1),
            borderColor: selected && !focused ? alpha(P.accent, 0.5) : Fixed.stroke,
            backgroundColor: focused ? P.focus : undefined,
            experimental_backgroundImage: focused
              ? undefined
              : selected
                ? `linear-gradient(to right, ${alpha(P.accent, 0.33)} 0%, ${alpha(P.accent2, 0.33)} 100%)`
                : 'linear-gradient(to right, #FFFFFF1F 0%, #FFFFFF14 100%)',
          }}
        >
          <Text style={[NovaType.Button, { color: focused ? P.onFocus : P.text }]}>{name}</Text>
        </View>
      )}
    </FocusSurface>
  );
}
