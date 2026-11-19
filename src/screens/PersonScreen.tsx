import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable, TVFocusGuideView, useTVEventHandler } from '@amazon-devices/react-native-kepler';
import { api } from '../data/jellyfin';
import { Item } from '../data/models';
import { useBack } from '../nav/back';
import { nav } from '../nav/navigator';
import { requestFocus } from '../components/focus';
import { NetImage } from '../components/NetImage';
import { PosterGrid } from '../components/PosterGrid';
import { CenterMessage, GlassChip, NovaButton, NovaLoader, SectionTitle } from '../components/Widgets';
import { SCREEN_W, dp, sp } from '../theme/scale';
import { Fixed, NovaType, alpha, usePalette } from '../theme/theme';

function parseDate(s: string | null): Date | null {
  if (!s || s.length < 10) return null;
  const [y, m, d] = s.substring(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const prettyDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function ageBetween(birth: Date, end: Date): number {
  let age = end.getFullYear() - birth.getFullYear();
  const beforeBirthday = end.getMonth() < birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

/** Actor / director page: photo, birth details, biography and everything they're in on your server. */
export function PersonScreen({ personId, name, active }: { personId: string; name: string; active: boolean }) {
  const P = usePalette();
  const [person, setPerson] = useState<Item | null>(null);
  const [works, setWorks] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBio, setShowBio] = useState(false);
  const readMoreRef = useRef<any>(null);
  const bioWasOpen = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const pP = api.personWithBio(personId, name);
        const w = await api.filmography(personId);
        setWorks(w);
        setPerson(await pP);
      } catch (e: any) {
        setError(e?.message ?? "Couldn't load");
        setWorks([]);
      }
    })();
  }, [personId, name]);

  useEffect(() => {
    if (showBio) bioWasOpen.current = true;
    else if (bioWasOpen.current) requestFocus(readMoreRef, 60);
  }, [showBio]);

  if (works === null) return <NovaLoader />;
  if (error && works.length === 0) return <CenterMessage title={`Couldn't load ${name}`} subtitle={error} />;

  const p = person;
  const birth = parseDate(p?.premiereDate ?? null);
  const death = parseDate(p?.endDate ?? null);
  const bio = p?.overview?.trim() ? p.overview : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed info panel on the left (never scrolls away) + movies grid on the right */}
      <View style={{ flex: 1, flexDirection: 'row', paddingLeft: dp(56), paddingTop: dp(36) }}>
        <View style={{ width: dp(360), paddingRight: dp(28) }}>
          <View
            style={{
              width: dp(170), height: dp(220), borderRadius: dp(20), overflow: 'hidden', backgroundColor: P.surfaceHi,
              borderWidth: dp(1), borderColor: Fixed.stroke, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={[NovaType.Display, { color: P.textDim }]}>{name.slice(0, 1)}</Text>
            <NetImage uri={api.image(personId, 'Primary', p?.primaryTag ?? null, 500)} style={StyleSheet.absoluteFill} />
          </View>
          <View style={{ height: dp(16) }} />
          <Text numberOfLines={2} style={[NovaType.Title, { color: P.text }]}>{p?.name ?? name}</Text>
          <View style={{ height: dp(10) }} />
          {birth ? (
            <View style={{ flexDirection: 'row', columnGap: dp(8), marginBottom: dp(8) }}>
              <GlassChip text={`Born ${prettyDate(birth)}`} />
              {!death ? <GlassChip text={`Age ${ageBetween(birth, new Date())}`} accent={P.accent} /> : null}
            </View>
          ) : null}
          {death ? <GlassChip text={`Died ${prettyDate(death)}`} style={{ alignSelf: 'flex-start', marginBottom: dp(8) }} /> : null}
          {p?.locations[0] ? (
            <Text numberOfLines={2} style={[NovaType.Label, { color: P.textDim, marginBottom: dp(10) }]}>Born in {p.locations[0]}</Text>
          ) : null}
          <Text numberOfLines={6} style={[NovaType.Label, { fontSize: sp(13), lineHeight: sp(19), color: P.textDim }]}>
            {bio ?? 'No biography available.'}
          </Text>
          {bio && bio.length > 260 ? (
            <View style={{ flexDirection: 'row', marginTop: dp(12) }}>
              <NovaButton ref={readMoreRef} text="Read more" icon="menu_book" onPress={() => setShowBio(true)} />
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: dp(56) }}>
            <SectionTitle text="Movies & Shows" />
            <View style={{ flex: 1 }} />
            <GlassChip text={`${works.length} title${works.length === 1 ? '' : 's'} on your server`} accent={P.accent2} />
          </View>
          {works.length === 0 ? (
            <Text style={[NovaType.Body, { color: P.textDim, marginTop: dp(20) }]}>Nothing on your server with this person yet.</Text>
          ) : (
            <PosterGrid
              items={works}
              width={SCREEN_W - dp(56) - dp(360)}
              padStart={4}
              padEnd={56}
              padTop={16}
              preferredIndex={0}
              onPress={it => nav.push({ kind: 'Detail', itemId: it.id })}
            />
          )}
        </View>
      </View>
      {showBio && active ? <BioOverlay name={p?.name ?? name} bio={p?.overview ?? ''} onClose={() => setShowBio(false)} /> : null}
    </View>
  );
}

/** Full biography, scrolled with up/down on the remote; Back or OK closes it. */
function BioOverlay({ name, bio, onClose }: { name: string; bio: string; onClose: () => void }) {
  const P = usePalette();
  const scroll = useRef<ScrollView>(null);
  const y = useRef(0);
  useBack(true, onClose);
  useTVEventHandler(e => {
    if (e.eventKeyAction !== 0) return;
    if (e.eventType === 'down') {
      y.current += dp(130);
      scroll.current?.scrollTo({ y: y.current, animated: true });
    } else if (e.eventType === 'up') {
      y.current = Math.max(0, y.current - dp(130));
      scroll.current?.scrollTo({ y: y.current, animated: true });
    }
  });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(P.bgDeep, 0.9), alignItems: 'center', justifyContent: 'center' }]}>
      <View
        style={{
          width: Math.min(dp(900), SCREEN_W * 0.8), height: '82%', borderRadius: dp(26), backgroundColor: P.surface,
          borderWidth: dp(1), borderColor: Fixed.stroke, padding: dp(36),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[NovaType.Title, { color: P.text, flex: 1 }]}>{name}</Text>
          <Text style={[NovaType.Label, { color: P.textFaint }]}>▲ ▼ scroll   ·   Back to close</Text>
        </View>
        <View style={{ height: dp(18) }} />
        {/* One focus target that keeps the highlight in the panel; OK closes */}
        <TVFocusGuideView trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1 }}>
        <Pressable hasTVPreferredFocus onPress={onClose} style={{ flex: 1 }}>
          <ScrollView
            ref={scroll}
            focusable={false}
            onScroll={e => (y.current = e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={32}
          >
            <Text style={[NovaType.Body, { fontSize: sp(17), lineHeight: sp(28), color: P.text }]}>{bio}</Text>
          </ScrollView>
        </Pressable>
        </TVFocusGuideView>
      </View>
    </View>
  );
}
