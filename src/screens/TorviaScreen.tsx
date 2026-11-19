import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TVFocusGuideView } from '@amazon-devices/react-native-kepler';
import {
  Filters, ReleaseFilter, TorviaAdd, TorviaAdds, TorviaDetails, TorviaRelease, TorviaTitle, defaultFilter, isTv, relIsHdr,
  relIsTenBit, torvia,
} from '../data/torvia';
import { useBack } from '../nav/back';
import { nav, useNav } from '../nav/navigator';
import { FocusSurface } from '../components/FocusSurface';
import { NetImage } from '../components/NetImage';
import { NovaTextField, NovaTextFieldHandle } from '../components/NovaTextField';
import { PageHeader, SortChip } from '../components/PageHeader';
import { TopNav } from '../components/TopNav';
import { CenterMessage, GlassChip, NovaButton, NovaLoader, SectionTitle } from '../components/Widgets';
import { SCREEN_W, dp } from '../theme/scale';
import { Fixed, NovaType, alpha, usePalette } from '../theme/theme';
import { SIDE, UiScale, useCardSize } from '../theme/uiScale';

/** Keeps the last search while you open a title and come back */
const memory = { query: '', lastSearched: '', results: [] as TorviaTitle[], tab: 0 };

/** "8 of 10 left today" (nothing when there is no limit) */
function allowanceText(): string | null {
  const s = nav.torvia;
  if (!s || s.remainingToday === null) return null;
  return s.dailyLimit !== null ? `${s.remainingToday} of ${s.dailyLimit} adds left today` : `${s.remainingToday} adds left today`;
}

// ============================================================================ Search & My adds

export function TorviaScreen({ active }: { active: boolean }) {
  useNav();
  const [tab, setTab] = useState(memory.tab);
  useEffect(() => {
    memory.tab = tab;
  }, [tab]);
  const label = nav.torvia?.buttonLabel ?? 'Search & Add';
  // "Add a link" is for phones and tablets only (typing a magnet link with a TV remote is no fun)
  return (
    <View style={{ flex: 1 }}>
      <TopNav selected={{ kind: 'Torvia' }} />
      <PageHeader title={label} subtitle={allowanceText()}>
        <SortChip text="Search" selected={tab === 0} onPress={() => setTab(0)} />
        <SortChip text="My adds" selected={tab === 1} onPress={() => setTab(1)} />
      </PageHeader>
      <View style={{ height: dp(8) }} />
      {tab === 1 ? <AddsTab active={active} /> : <SearchTab />}
    </View>
  );
}

function SearchTab() {
  const [query, setQuery] = useState(memory.query);
  const [results, setResults] = useState<TorviaTitle[]>(memory.results);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);
  const fieldRef = useRef<NovaTextFieldHandle>(null);
  const [fromNav] = useState(() => nav.focusNavOnEnter);
  useCardSize();

  useEffect(() => {
    if (!fromNav && results.length === 0) fieldRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    memory.query = query;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    if (q === memory.lastSearched && results.length && runs === 0) return;
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await torvia.search(q);
        if (!live) return;
        setResults(r);
        memory.results = r;
        memory.lastSearched = q;
      } catch (e: any) {
        if (live) setError(e?.message ?? "Couldn't search");
      } finally {
        if (live) setLoading(false);
      }
    }, 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, runs]);

  const w = UiScale.posterWidth;
  const avail = SCREEN_W - dp(SIDE) * 2;
  const cols = Math.max(1, Math.floor((avail + dp(20)) / (dp(w) + dp(20))));
  const cell = (avail - (cols - 1) * dp(20)) / cols;
  const q = query.trim();

  return (
    <View style={{ flex: 1 }}>
      <NovaTextField
        ref={fieldRef}
        value={query}
        onChangeText={setQuery}
        label=""
        placeholder="Movie or show name, TMDB or IMDb link…"
        icon="search"
        returnKeyType="search"
        onSubmit={() => setRuns(r => r + 1)}
        style={{ marginHorizontal: dp(SIDE), width: dp(620) }}
      />
      {loading && results.length === 0 ? (
        <NovaLoader />
      ) : error ? (
        <CenterMessage title="Couldn't search" subtitle={error} />
      ) : q.length >= 2 && results.length === 0 && !loading ? (
        <CenterMessage title="Nothing found" subtitle="Try another name, or paste a TMDB or IMDb link" />
      ) : results.length === 0 ? (
        <CenterMessage title="Find a movie or show to add" subtitle="Search by name, or paste a TMDB or IMDb link" />
      ) : (
        <FlatList
          key={`tg-${cols}`}
          data={results}
          numColumns={cols}
          keyExtractor={t => `${t.type}-${t.tmdbId}`}
          contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingTop: dp(24), paddingBottom: dp(60) }}
          columnWrapperStyle={cols > 1 ? { columnGap: dp(20) } : undefined}
          ItemSeparatorComponent={() => <View style={{ height: dp(22) }} />}
          renderItem={({ item: t }) => (
            <View style={{ width: cell }}>
              <TmdbPosterCard
                title={t.title}
                year={t.year}
                poster={t.poster}
                badge={isTv(t) ? 'Series' : 'Movie'}
                onPress={() => nav.push({ kind: 'TorviaTitle', type: t.type, tmdbId: t.tmdbId, name: t.title })}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

function TmdbPosterCard({ title, year, poster, badge, onPress }: {
  title: string; year: number | null; poster: string | null; badge: string | null; onPress: () => void;
}) {
  const P = usePalette();
  const w = UiScale.posterWidth;
  return (
    <View style={{ width: dp(w) }}>
      <FocusSurface onPress={onPress} style={{ width: dp(w), height: dp(w * 1.5) }}>
        {() => (
          <View style={{ flexGrow: 1, backgroundColor: P.surface }}>
            {poster ? (
              <NetImage uri={poster} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: dp(12) }]}>
                <Text style={[NovaType.Section, { color: P.text, textAlign: 'center' }]}>{title}</Text>
              </View>
            )}
            {badge ? (
              <View style={{ position: 'absolute', top: dp(8), left: dp(8), backgroundColor: alpha(P.bgDeep, 0.75), borderRadius: dp(8), paddingHorizontal: dp(8), paddingVertical: dp(2) }}>
                <Text style={[NovaType.Label, { color: P.text }]}>{badge}</Text>
              </View>
            ) : null}
          </View>
        )}
      </FocusSurface>
      <View style={{ height: dp(8) }} />
      <Text numberOfLines={1} style={[NovaType.Label, { color: P.text }]}>{title}</Text>
      <Text numberOfLines={1} style={[NovaType.Label, { color: P.textFaint }]}>{year !== null ? String(year) : ''}</Text>
    </View>
  );
}

function AddsTab({ active }: { active: boolean }) {
  const P = usePalette();
  const isAdmin = nav.torvia?.isAdmin === true;
  const [everyone, setEveryone] = useState(false);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [data, setData] = useState<TorviaAdds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [confirm, setConfirm] = useState<TorviaAdd | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    torvia.adds(everyone, everyone ? userFilter : null)
      .then(d => live && setData(d))
      .catch(e => live && setError(e?.message ?? "Couldn't load"));
    return () => {
      live = false;
    };
  }, [everyone, userFilter, reload]);

  return (
    <View style={{ flex: 1 }}>
      {isAdmin ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: dp(12) }}
          contentContainerStyle={{ paddingHorizontal: dp(SIDE), columnGap: dp(8) }}>
          <SortChip text="Mine" selected={!everyone} onPress={() => (setEveryone(false), setUserFilter(null))} />
          <SortChip text="Everyone" selected={everyone && userFilter === null} onPress={() => (setEveryone(true), setUserFilter(null))} />
          {everyone
            ? data?.users.map(u => (
                <SortChip key={u.id} text={`${u.name} (${u.count})`} selected={userFilter === u.id} onPress={() => setUserFilter(u.id)} />
              ))
            : null}
        </ScrollView>
      ) : null}
      {notice ? <Text style={[NovaType.Body, { color: P.accent, paddingHorizontal: dp(SIDE), paddingVertical: dp(6) }]}>{notice}</Text> : null}
      {error ? (
        <CenterMessage title="Couldn't load your adds" subtitle={error} />
      ) : !data ? (
        <NovaLoader />
      ) : data.items.length === 0 ? (
        <CenterMessage title="Nothing added yet" subtitle="Titles you add from Search appear here" />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={a => a.id}
          contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingTop: dp(6), paddingBottom: dp(60) }}
          ItemSeparatorComponent={() => <View style={{ height: dp(12) }} />}
          renderItem={({ item: a }) => (
            <AddRow
              a={a}
              showUser={everyone}
              onOpen={a.jellyfinItemId ? () => nav.push({ kind: 'Detail', itemId: a.jellyfinItemId! }) : null}
              onRemove={a.canRemove ? () => setConfirm(a) : null}
            />
          )}
        />
      )}
      {confirm && active ? (
        <ConfirmDialog
          title={`Remove ${confirm.title}?`}
          body="This deletes it from TorBox and it leaves Jellyfin. If it was already in TorBox before, or someone else added it too, it stays in TorBox."
          confirmText="Remove"
          onConfirm={async () => {
            const a = confirm;
            setConfirm(null);
            try {
              setNotice((await torvia.remove(a.id)).message);
            } catch (e: any) {
              setNotice(e?.message ?? "Couldn't remove it.");
            }
            setReload(r => r + 1);
            nav.refreshTorvia();
          }}
          onDismiss={() => setConfirm(null)}
        />
      ) : null}
    </View>
  );
}

function AddRow({ a, showUser, onOpen, onRemove }: { a: TorviaAdd; showUser: boolean; onOpen: (() => void) | null; onRemove: (() => void) | null }) {
  const P = usePalette();
  const line = [a.label, a.quality, a.size].filter(x => x.trim()).join(' · ');
  const meta = [
    showUser && a.userName.trim() ? `by ${a.userName}` : null,
    a.whenText.slice(0, 10).trim() || null,
    a.jellyfinItemId ? 'In Jellyfin' : a.downloadPercent !== null ? null : 'Not in Jellyfin yet',
  ].filter(Boolean).join(' · ');
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', padding: dp(12), borderRadius: dp(16),
        backgroundColor: '#FFFFFF12', borderWidth: dp(1), borderColor: Fixed.stroke,
      }}
    >
      <View style={{ width: dp(56), height: dp(84), borderRadius: dp(8), overflow: 'hidden', backgroundColor: P.surface }}>
        {a.poster ? <NetImage uri={a.poster} style={StyleSheet.absoluteFill} /> : null}
      </View>
      <View style={{ width: dp(14) }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[NovaType.Section, { color: P.text }]}>{[a.title, a.year !== null ? `(${a.year})` : null].filter(Boolean).join(' ')}</Text>
        {line ? <Text numberOfLines={2} style={[NovaType.Label, { color: P.textDim }]}>{line}</Text> : null}
        <Text numberOfLines={1} style={[NovaType.Label, { color: P.textFaint }]}>{meta}</Text>
        {a.downloadPercent !== null ? (
          <View style={{ flexDirection: 'row', marginTop: dp(6) }}>
            <GlassChip text={`TorBox is downloading · ${a.downloadPercent}%`} accent={P.accent} />
          </View>
        ) : null}
      </View>
      <View style={{ width: dp(12) }} />
      <View style={{ flexDirection: 'row', columnGap: dp(10) }}>
        {onOpen ? <NovaButton text="Open" icon="play" onPress={onOpen} /> : null}
        {onRemove ? <NovaButton text="Remove" icon="delete" onPress={onRemove} /> : null}
      </View>
    </View>
  );
}

// ============================================================================ One title: releases & add

export function TorviaTitleScreen({ type, tmdbId, name, active }: { type: string; tmdbId: number; name: string; active: boolean }) {
  useNav();
  const P = usePalette();
  const [details, setDetails] = useState<TorviaDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  // TV shows: chosen season and episode (0 = whole season)
  const [season, setSeason] = useState(-1);
  const [episode, setEpisode] = useState(0);
  const [releases, setReleases] = useState<TorviaRelease[] | null>(null);
  const [relError, setRelError] = useState<string | null>(null);
  const [inLibraryId, setInLibraryId] = useState<string | null>(null);
  const [f, setF] = useState<ReleaseFilter>(defaultFilter());
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<TorviaRelease | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    torvia.details(type, tmdbId)
      .then(d => {
        setDetails(d);
        setInLibraryId(d.jellyfinItemId);
        if (isTv(d.title)) setSeason(s => (s < 0 ? d.seasons[0]?.season ?? 1 : s));
      })
      .catch(e => setError(e?.message ?? "Couldn't load"));
  }, [type, tmdbId]);

  useEffect(() => {
    const d = details;
    if (!d) return;
    if (isTv(d.title) && season < 0) return;
    let live = true;
    setReleases(null);
    setRelError(null);
    (isTv(d.title)
      ? torvia.releases(type, tmdbId, season, episode > 0 ? episode : undefined, episode === 0)
      : torvia.releases(type, tmdbId)
    )
      .then(r => {
        if (!live) return;
        setReleases(r.releases);
        if (r.jellyfinItemId) setInLibraryId(r.jellyfinItemId);
        // Default 1080p; if there's none, show every quality (like the web page)
        const [start, n] = Filters.start(r.releases);
        setF(start);
        setNote(n);
      })
      .catch(e => live && setRelError(e?.message ?? "Couldn't load releases"));
    return () => {
      live = false;
    };
  }, [details, season, episode, type, tmdbId]);

  // After adding: check every 10 s (up to 3 min) until Torvia has put it in Jellyfin
  useEffect(() => {
    if (!waiting) return;
    let count = 0;
    const t = setInterval(async () => {
      count++;
      const id = await torvia.inLibrary(type, tmdbId);
      if (id) {
        setInLibraryId(id);
        setWaiting(false);
      } else if (count >= 18) setWaiting(false);
    }, 10000);
    return () => clearInterval(t);
  }, [waiting, type, tmdbId]);

  const all = releases ?? [];
  const shown = Filters.apply(f, all);
  const set = (nf: ReleaseFilter) => {
    setF(nf);
    setNote(null);
  };
  const d = details;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: dp(60) }} showsVerticalScrollIndicator={false}>
        <TopNav selected={{ kind: 'Torvia' }} />
        {!d ? (
          <View style={{ height: dp(380) }}>
            {error ? <CenterMessage title={`Couldn't open ${name}`} subtitle={error} /> : <NovaLoader />}
          </View>
        ) : (
          <>
            <TitleHeader t={d.title} inLibraryId={inLibraryId} waiting={waiting} result={result} />
            {isTv(d.title) && d.seasons.length ? (
              <>
                <ChipRow label="Season">
                  {d.seasons.map(s => (
                    <SortChip key={s.season} text={s.name.trim() || `Season ${s.season}`} selected={s.season === season}
                      onPress={() => (setSeason(s.season), setEpisode(0))} />
                  ))}
                </ChipRow>
                <ChipRow label="Episode">
                  <SortChip text="Whole season" selected={episode === 0} onPress={() => setEpisode(0)} />
                  {Array.from({ length: d.seasons.find(s => s.season === season)?.episodes ?? 0 }).map((_, i) => (
                    <SortChip key={i} text={`E${i + 1}`} selected={episode === i + 1} onPress={() => setEpisode(i + 1)} />
                  ))}
                </ChipRow>
              </>
            ) : null}
            {all.length ? <FilterPanel all={all} f={f} note={note} set={set} /> : null}
            <View style={{ height: dp(10) }} />
            <SectionTitle text={releases === null ? 'Releases' : `Releases · ${shown.length} of ${all.length}`} style={{ marginHorizontal: dp(SIDE) }} />
            <View style={{ height: dp(10) }} />
            {relError ? (
              <Text style={[NovaType.Body, { color: Fixed.rose, paddingHorizontal: dp(SIDE) }]}>{relError}</Text>
            ) : releases === null ? (
              <View style={{ alignItems: 'center', padding: dp(24) }}>
                <View style={{ width: dp(70), height: dp(70) }}>
                  <NovaLoader />
                </View>
                <Text style={[NovaType.Label, { color: P.textDim }]}>Looking for cached releases… this can take a few seconds</Text>
              </View>
            ) : all.length === 0 ? (
              <Text style={[NovaType.Body, { color: P.textDim, paddingHorizontal: dp(SIDE) }]}>
                {isTv(d.title) && episode === 0
                  ? 'No whole-season packs cached on TorBox right now. Pick an episode above to see single episodes.'
                  : 'No cached releases found on TorBox for this.'}
              </Text>
            ) : shown.length === 0 ? (
              <Text style={[NovaType.Body, { color: P.textDim, paddingHorizontal: dp(SIDE) }]}>No releases match these filters.</Text>
            ) : (
              shown.map((r, i) => (
                <ReleaseRow key={r.hash + r.fileName + i} r={r} best={f.sort === 'best' && !r.isCam && i === 0} onPress={() => setPicked(r)} />
              ))
            )}
          </>
        )}
      </ScrollView>

      {picked && active ? (
        <AddDialog
          release={picked}
          tags={nav.torvia?.tags ?? []}
          defaultTag={type === 'tv' ? nav.torvia?.tvTag ?? '' : nav.torvia?.movieTag ?? ''}
          allowance={allowanceText()}
          busy={adding}
          onAdd={async tag => {
            setAdding(true);
            let res;
            try {
              res = await torvia.add(picked.hash, tag);
            } catch (e: any) {
              res = { ok: false, message: e?.message ?? "Couldn't add it." };
            }
            setAdding(false);
            setPicked(null);
            setResult(res.message);
            if (res.ok) {
              nav.refreshTorvia();
              if (!inLibraryId) setWaiting(true);
            }
          }}
          onDismiss={() => !adding && setPicked(null)}
        />
      ) : null}
    </View>
  );
}

function TitleHeader({ t, inLibraryId, waiting, result }: { t: TorviaTitle; inLibraryId: string | null; waiting: boolean; result: string | null }) {
  const P = usePalette();
  const meta = [isTv(t) ? 'Series' : 'Movie', t.year !== null ? String(t.year) : null, t.rating !== null ? '★ ' + t.rating.toFixed(1) : null]
    .filter(Boolean).join(' · ');
  return (
    <>
      <View>
        {t.backdrop ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: dp(260) }}>
            <NetImage uri={t.backdrop} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `linear-gradient(to bottom, ${alpha(P.bg, 0.3)} 0%, ${P.bg.slice(0, 7)} 100%)` }]} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', paddingHorizontal: dp(SIDE), paddingTop: dp(t.backdrop ? 90 : 10) }}>
          <View style={{ width: dp(130), height: dp(195), borderRadius: dp(12), overflow: 'hidden', backgroundColor: P.surface }}>
            {t.poster ? <NetImage uri={t.poster} style={StyleSheet.absoluteFill} /> : null}
          </View>
          <View style={{ width: dp(18) }} />
          <View style={{ flex: 1, paddingTop: dp(t.backdrop ? 40 : 0) }}>
            <Text numberOfLines={2} style={[NovaType.Title, { color: P.text }]}>{t.title}</Text>
            <Text style={[NovaType.Label, { color: P.textDim }]}>{meta}</Text>
            <View style={{ height: dp(8) }} />
            {t.overview.trim() ? <Text numberOfLines={3} style={[NovaType.Body, { color: P.textDim }]}>{t.overview}</Text> : null}
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: dp(SIDE), paddingVertical: dp(12) }}>
        {result ? <Text style={[NovaType.Body, { color: P.accent, marginBottom: dp(8) }]}>{result}</Text> : null}
        {inLibraryId ? (
          <View style={{ flexDirection: 'row' }}>
            <NovaButton text="Open in library" icon="play" primary onPress={() => nav.push({ kind: 'Detail', itemId: inLibraryId })} />
          </View>
        ) : waiting ? (
          <Text style={[NovaType.Label, { color: P.textDim }]}>Waiting for it to appear in Jellyfin…</Text>
        ) : null}
      </View>
    </>
  );
}

/** The same filter box as the Torvia web page: Quality, Type, Video, Language, Sort and Reset */
function FilterPanel({ all, f, note, set }: { all: TorviaRelease[]; f: ReleaseFilter; note: string | null; set: (f: ReleaseFilter) => void }) {
  const P = usePalette();
  const eps = all.filter(r => !r.isSeasonPack && r.kind.trim()).length;
  const packs = all.filter(r => r.isSeasonPack).length;
  const nTen = all.filter(relIsTenBit).length;
  const nHdr = all.filter(relIsHdr).length;
  const anyCam = all.some(r => r.isCam);
  const langs = Filters.languages(all);
  return (
    <View
      style={{
        marginHorizontal: dp(SIDE), marginVertical: dp(6), paddingVertical: dp(8), borderRadius: dp(14),
        backgroundColor: '#FFFFFF0F', borderWidth: dp(1), borderColor: Fixed.stroke,
      }}
    >
      <FilterLine label="Quality">
        <FilterChip text="All" count={all.length} selected={f.quality === 'all'} onPress={() => set({ ...f, quality: 'all' })} />
        {Filters.qualities.filter(q => all.some(r => r.quality === q)).map(q => (
          <FilterChip key={q} text={q} count={all.filter(r => r.quality === q).length} selected={f.quality === q} onPress={() => set({ ...f, quality: q })} />
        ))}
      </FilterLine>
      {eps > 0 && packs > 0 ? (
        <FilterLine label="Type">
          <FilterChip text="All" count={all.length} selected={f.kind === 'all'} onPress={() => set({ ...f, kind: 'all' })} />
          <FilterChip text="This episode only" count={eps} selected={f.kind === 'episode'} onPress={() => set({ ...f, kind: 'episode' })} />
          <FilterChip text="Packs" count={packs} selected={f.kind === 'pack'} onPress={() => set({ ...f, kind: 'pack' })} />
        </FilterLine>
      ) : null}
      {nTen > 0 || nHdr > 0 || anyCam ? (
        <FilterLine label="Video">
          {nTen > 0 ? <FilterChip text="10-bit" count={nTen} selected={f.tenBit} onPress={() => set({ ...f, tenBit: !f.tenBit })} /> : null}
          {nHdr > 0 ? <FilterChip text="HDR / DV" count={nHdr} selected={f.hdr} onPress={() => set({ ...f, hdr: !f.hdr })} /> : null}
          {anyCam ? <FilterChip text="Hide CAM/TS" selected={f.hideCam} onPress={() => set({ ...f, hideCam: !f.hideCam })} /> : null}
        </FilterLine>
      ) : null}
      {langs.length ? (
        <FilterLine label="Language">
          {langs.map(([l, c]) => (
            <FilterChip key={l} text={l} count={c} selected={f.langs.includes(l)}
              onPress={() => set({ ...f, langs: f.langs.includes(l) ? f.langs.filter(x => x !== l) : [...f.langs, l] })} />
          ))}
        </FilterLine>
      ) : null}
      <FilterLine label="Sort">
        {Filters.sorts.map(([k, label]) => (
          <FilterChip key={k} text={label} selected={f.sort === k} onPress={() => set({ ...f, sort: k })} />
        ))}
        <View style={{ width: dp(10) }} />
        <FilterChip text="Reset" selected={false} outlined onPress={() => set(defaultFilter())} />
      </FilterLine>
      {note ? <Text style={[NovaType.Caption, { color: P.textFaint, paddingHorizontal: dp(14), paddingVertical: dp(4) }]}>{note}</Text> : null}
    </View>
  );
}

function FilterLine({ label, children }: { label: string; children: ReactNode }) {
  const P = usePalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: dp(14), paddingVertical: dp(4), columnGap: dp(8), alignItems: 'center' }}>
      <Text style={[NovaType.Label, { color: P.textDim, width: dp(110) }]}>{label}</Text>
      {children}
    </ScrollView>
  );
}

/** A filter pill with a small count after the name, like "1080p 4" on the web page */
function FilterChip({ text, count, selected, outlined = false, onPress }: {
  text: string; count?: number; selected: boolean; outlined?: boolean; onPress: () => void;
}) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onPress} radius={18} focusedScale={1.05} borderWidth={0} glow={false}>
      {focused => {
        const main = focused ? P.onFocus : selected ? P.accent : P.text;
        return (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: dp(14), paddingVertical: dp(7), borderRadius: dp(18),
              borderWidth: dp(1), borderColor: selected && !focused ? P.accent : Fixed.stroke,
              backgroundColor: focused ? P.focus : selected ? alpha(P.accent, 0.22) : outlined ? 'transparent' : Fixed.white8,
            }}
          >
            <Text numberOfLines={1} style={[NovaType.Label, { fontWeight: '600', color: main }]}>{text}</Text>
            {count !== undefined ? (
              <Text style={[NovaType.Caption, { marginLeft: dp(6), color: focused ? alpha(P.onFocus, 0.7) : P.textFaint }]}>{count}</Text>
            ) : null}
          </View>
        );
      }}
    </FocusSurface>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  const P = usePalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingVertical: dp(5), columnGap: dp(8), alignItems: 'center' }}>
      <Text style={[NovaType.Caption, { color: P.textFaint, width: dp(78) }]}>{label.toUpperCase()}</Text>
      {children}
    </ScrollView>
  );
}

function ReleaseRow({ r, best, onPress }: { r: TorviaRelease; best: boolean; onPress: () => void }) {
  const P = usePalette();
  const chips = [r.codec, r.hdr, r.bitDepth > 0 ? `${r.bitDepth}-bit` : '', r.audio, r.languages.join(' / '), r.subtitles, r.container].filter(x => x.trim());
  return (
    <FocusSurface onPress={onPress} style={{ marginHorizontal: dp(SIDE), marginVertical: dp(5) }} radius={16} focusedScale={1.01}>
      {focused => (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: dp(14), backgroundColor: focused ? P.surfaceHi : '#FFFFFF12' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: dp(6), rowGap: dp(6) }}>
              {best ? <GlassChip text="Best" accent={P.accent} /> : null}
              {r.label.trim() ? <GlassChip text={r.label} /> : null}
              {r.isCam ? <GlassChip text="⚠ CAM/TS" accent={Fixed.rose} /> : r.source.trim() ? <GlassChip text={r.source} /> : null}
              {r.quality.trim() && r.quality !== '?' ? <GlassChip text={r.quality} accent={P.accent} /> : null}
              {chips.map((c, i) => <GlassChip key={i} text={c} />)}
            </View>
            <View style={{ height: dp(6) }} />
            <Text numberOfLines={2} style={[NovaType.Label, { color: P.text }]}>{r.name}</Text>
            {!r.source.trim() && !r.codec.trim() ? <Text numberOfLines={2} style={[NovaType.Label, { color: P.textDim }]}>{r.summary}</Text> : null}
            {r.playsLabel.trim() ? (
              <Text numberOfLines={1} style={[NovaType.Label, { color: P.textFaint }]}>
                Plays {r.playsLabel}{r.fileName.trim() ? ` · ${r.fileName}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ width: dp(12) }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[NovaType.Section, { fontWeight: '700', color: P.text }]}>
              {r.isSeasonPack && r.playsLabel.trim() ? `Episode ${r.size}` : r.size}
            </Text>
            {r.packSize.trim() ? <Text style={[NovaType.Label, { color: P.textFaint }]}>pack {r.packSize}</Text> : null}
            <Text style={[NovaType.Label, { color: P.textDim }]}>{[r.speed, `${r.seeders} seeds`].filter(x => x.trim()).join(' · ')}</Text>
          </View>
        </View>
      )}
    </FocusSurface>
  );
}

function AddDialog({ release, tags, defaultTag, allowance, busy, onAdd, onDismiss }: {
  release: TorviaRelease;
  tags: string[];
  defaultTag: string;
  allowance: string | null;
  busy: boolean;
  onAdd: (tag: string | null) => void;
  onDismiss: () => void;
}) {
  const P = usePalette();
  const [tag, setTag] = useState(defaultTag.trim() || tags[0] || '');
  return (
    <DialogFrame onDismiss={onDismiss}>
      <Text style={[NovaType.Title, { color: P.text }]}>Add this release?</Text>
      <View style={{ height: dp(10) }} />
      <Text numberOfLines={3} style={[NovaType.Body, { color: P.text }]}>{release.name}</Text>
      <Text style={[NovaType.Label, { color: P.textDim }]}>{release.summary}</Text>
      {allowance ? <Text style={[NovaType.Label, { color: P.accent, marginTop: dp(8) }]}>{allowance}</Text> : null}
      {tags.length > 1 ? (
        <>
          <Text style={[NovaType.Caption, { color: P.textFaint, marginTop: dp(14), marginBottom: dp(6) }]}>ADD TO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ columnGap: dp(8) }}>
            {tags.map(t => <SortChip key={t} text={t} selected={t === tag} onPress={() => setTag(t)} />)}
          </ScrollView>
        </>
      ) : null}
      <View style={{ height: dp(20) }} />
      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: dp(48), height: dp(48) }}>
            <NovaLoader size={36} />
          </View>
          <View style={{ width: dp(10) }} />
          <Text style={[NovaType.Label, { color: P.textDim }]}>Adding to TorBox… this can take up to half a minute</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', columnGap: dp(12) }}>
          <NovaButton text="Add" icon="add" primary hasTVPreferredFocus onPress={() => onAdd(tag.trim() || null)} />
          <NovaButton text="Cancel" onPress={onDismiss} />
        </View>
      )}
    </DialogFrame>
  );
}

function ConfirmDialog({ title, body, confirmText, onConfirm, onDismiss }: {
  title: string; body: string; confirmText: string; onConfirm: () => void; onDismiss: () => void;
}) {
  const P = usePalette();
  return (
    <DialogFrame onDismiss={onDismiss}>
      <Text style={[NovaType.Title, { color: P.text }]}>{title}</Text>
      <View style={{ height: dp(10) }} />
      <Text style={[NovaType.Body, { color: P.textDim }]}>{body}</Text>
      <View style={{ height: dp(20) }} />
      <View style={{ flexDirection: 'row', columnGap: dp(12) }}>
        <NovaButton text="Cancel" hasTVPreferredFocus onPress={onDismiss} />
        <NovaButton text={confirmText} icon="delete" primary onPress={onConfirm} />
      </View>
    </DialogFrame>
  );
}

/** A centred panel over a dimmed screen; Back closes it and the highlight stays inside */
function DialogFrame({ onDismiss, children }: { onDismiss: () => void; children: ReactNode }) {
  const P = usePalette();
  useBack(true, onDismiss);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(P.bgDeep, 0.78), alignItems: 'center', justifyContent: 'center' }]}>
      <TVFocusGuideView
        trapFocusUp
        trapFocusDown
        trapFocusLeft
        trapFocusRight
        style={{
          width: dp(620), padding: dp(24), borderRadius: dp(24), backgroundColor: P.surface, borderWidth: dp(1), borderColor: Fixed.stroke,
        }}
      >
        {children}
      </TVFocusGuideView>
    </View>
  );
}

