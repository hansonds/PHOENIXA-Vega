import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { prefs } from '../data/prefs';
import { nav } from '../nav/navigator';
import { PLAYER_TEST_ID } from '../player/PlayerScreen';
import { FocusSurface } from '../components/FocusSurface';
import { OptionSheet } from '../components/OptionSheet';
import { requestFocus } from '../components/focus';
import { TopNav } from '../components/TopNav';
import { NovaButton } from '../components/Widgets';
import { dp, sp } from '../theme/scale';
import { Fixed, NovaType, THEMES, ThemeStore, accentDiag, alpha, usePalette } from '../theme/theme';
import { SIDE, UiScale, useCardSize } from '../theme/uiScale';

export const APP_VERSION = '1.0.0';
const BITRATES = [0, 120, 60, 40, 20, 10, 4];

export function SettingsScreen({ onSignOut, active }: { onSignOut: () => void; active: boolean }) {
  const P = usePalette();
  useCardSize();
  const [bitrateIdx, setBitrateIdx] = useState(Math.max(0, BITRATES.indexOf(prefs.maxBitrateMbps)));
  const [autoNext, setAutoNext] = useState(prefs.autoPlayNext);
  const [heroRotate, setHeroRotate] = useState(prefs.heroAutoRotate);
  const [showThemes, setShowThemes] = useState(false);
  const [crash, setCrash] = useState(prefs.lastCrash);
  const themeRowRef = useRef<any>(null);
  const themesWasOpen = useRef(false);

  useEffect(() => {
    if (showThemes) themesWasOpen.current = true;
    else if (themesWasOpen.current) requestFocus(themeRowRef, 80);
  }, [showThemes]);

  return (
    <View style={{ flex: 1 }}>
      <TopNav selected={{ kind: 'Settings' }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: dp(SIDE), paddingBottom: dp(40) }} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: dp(760), rowGap: dp(14) }}>
          <Text style={[NovaType.Title, { color: P.text }]}>Settings</Text>
          <View style={{ height: dp(4) }} />

          <InfoCard title="Signed in as" value={prefs.userName ?? '—'} sub={prefs.server} />

          <SettingRow
            title="Direct play only"
            sub="PHOENIXA always plays the original file. Your server never has to convert anything"
            value="On"
            onPress={() => {}}
          />
          <SettingRow
            title="Streaming quality"
            sub="Lower this if playback buffers on a slow connection"
            value={BITRATES[bitrateIdx] === 0 ? 'Maximum' : `${BITRATES[bitrateIdx]} Mbps`}
            onPress={() => {
              const i = (bitrateIdx + 1) % BITRATES.length;
              setBitrateIdx(i);
              prefs.maxBitrateMbps = BITRATES[i];
            }}
          />
          <SettingRow
            ref={themeRowRef}
            title="Theme"
            sub="Change the colours of the whole app"
            value={ThemeStore.current.name}
            onPress={() => setShowThemes(true)}
          />
          <SettingRow
            title="Card size"
            sub="Make posters and thumbnails smaller or bigger"
            value={UiScale.labels[UiScale.cardSizeIndex]}
            onPress={() => UiScale.set((UiScale.cardSizeIndex + 1) % 3)}
          />
          <SettingRow
            title="Auto-play next episode"
            sub="Start the next episode when one ends"
            value={autoNext ? 'On' : 'Off'}
            onPress={() => {
              setAutoNext(!autoNext);
              prefs.autoPlayNext = !autoNext;
            }}
          />
          <SettingRow
            title="Rotate featured carousel"
            sub="Cycle the home banner automatically"
            value={heroRotate ? 'On' : 'Off'}
            onPress={() => {
              setHeroRotate(!heroRotate);
              prefs.heroAutoRotate = !heroRotate;
            }}
          />
          <SettingRow
            title="Test the player"
            sub="Plays a short sample video (H.264 / AAC) to check that video works on this device"
            value="›"
            onPress={() => nav.push({ kind: 'Player', itemId: PLAYER_TEST_ID, startTicks: 0 })}
          />
          <SettingRow title="About PHOENIXA" sub="Version, credits and phoenicx.org" value="›" onPress={() => nav.push({ kind: 'About' })} />

          <View style={{ height: dp(8) }} />
          <View style={{ flexDirection: 'row' }}>
            <NovaButton text="Sign out" icon="logout" onPress={onSignOut} />
          </View>
          <View style={{ height: dp(10) }} />
          <Text style={[NovaType.Label, { color: P.textFaint }]}>PHOENIXA {APP_VERSION} · made by Hanson · phoenicx.org</Text>

          {crash ? (
            <>
              <View style={{ height: dp(10) }} />
              <Text style={[NovaType.Caption, { color: Fixed.rose }]}>LAST CRASH REPORT</Text>
              <Text style={[NovaType.Label, { color: P.textDim }]}>{crash.split('\n').slice(0, 14).join('\n')}</Text>
              <View style={{ flexDirection: 'row' }}>
                <NovaButton
                  text="Clear crash report"
                  onPress={() => {
                    prefs.lastCrash = null;
                    setCrash(null);
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {showThemes && active ? (
        <OptionSheet
          title="Theme"
          options={THEMES.map((t, i) => ({
            label: t.name,
            detail: i === 1 ? 'Default' : i === 0 ? 'Original cyan & violet look' : '',
            selected: i === ThemeStore.index,
          }))}
          onSelect={i => {
            ThemeStore.set(i);
            setShowThemes(false);
          }}
          onDismiss={() => setShowThemes(false)}
        />
      ) : null}
    </View>
  );
}

function InfoCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  const P = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', padding: dp(20), borderRadius: dp(18),
        backgroundColor: Fixed.white12, borderWidth: dp(1), borderColor: Fixed.stroke,
      }}
    >
      <View style={{ width: dp(48), height: dp(48), borderRadius: dp(24), experimental_backgroundImage: accentDiag(P), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[NovaType.Title, { color: P.onFocus }]}>{value.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ width: dp(16) }} />
      <View>
        <Text style={[NovaType.Caption, { color: P.textFaint }]}>{title.toUpperCase()}</Text>
        <Text style={[NovaType.Section, { color: P.text }]}>{value}</Text>
        <Text style={[NovaType.Label, { color: P.textDim }]}>{sub}</Text>
      </View>
    </View>
  );
}

function SettingRow({ title, sub, value, onPress, ref }: { title: string; sub: string; value: string; onPress: () => void } & { ref?: React.Ref<any> }) {
  const P = usePalette();
  return (
    <FocusSurface ref={ref} onPress={onPress} radius={18} focusedScale={1.02}>
      {focused => (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: dp(22), paddingVertical: dp(16),
            backgroundColor: focused ? alpha(P.accent, 0.2) : Fixed.white10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[NovaType.Section, { color: P.text }]}>{title}</Text>
            <Text style={[NovaType.Label, { color: P.textDim }]}>{sub}</Text>
          </View>
          <Text style={[NovaType.Button, { color: P.accent }]}>{value}</Text>
        </View>
      )}
    </FocusSurface>
  );
}

const LOGO = require('../../assets/image/logo_stacked.png');

/** About PHOENIXA: version and credits */
export function AboutScreen() {
  const P = usePalette();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: dp(80) }}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <Image source={LOGO} style={{ width: dp(230), height: dp(230) }} resizeMode="contain" />
        <View style={{ height: dp(12) }} />
        <Text style={[NovaType.Section, { fontWeight: '400', color: P.textDim }]}>Your cinema, reimagined.</Text>
      </View>
      <View
        style={{
          width: dp(500), borderRadius: dp(28), borderWidth: dp(1), borderColor: Fixed.stroke, padding: dp(36), rowGap: dp(14),
          experimental_backgroundImage: `linear-gradient(to bottom, ${alpha(P.surfaceHi, 0.2)} 0%, ${alpha(P.surface, 0.4)} 100%)`,
        }}
      >
        <Text style={[NovaType.Caption, { color: P.accent }]}>ABOUT</Text>
        <Text style={[NovaType.Title, { color: P.text }]}>PHOENIXA {APP_VERSION}</Text>
        <Text style={[NovaType.Body, { color: P.textDim }]}>A cinematic Jellyfin client for Fire TV with Vega OS.</Text>
        <View>
          <Text style={[NovaType.Caption, { color: P.textFaint }]}>MADE BY</Text>
          <Text style={[NovaType.Section, { color: P.text }]}>Hanson</Text>
        </View>
        <View>
          <Text style={[NovaType.Caption, { color: P.textFaint }]}>WEBSITE</Text>
          <Text style={[NovaType.Section, { color: P.accent }]}>phoenicx.org</Text>
        </View>
        <Text style={[NovaType.Label, { fontSize: sp(12), color: P.textFaint }]}>
          Powered by Jellyfin, the free software media system. PHOENIXA is an independent project and is not affiliated with or
          endorsed by the Jellyfin project or Amazon.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: dp(6) }}>
          <NovaButton text="Back" primary hasTVPreferredFocus onPress={() => nav.back()} />
        </View>
      </View>
    </View>
  );
}
