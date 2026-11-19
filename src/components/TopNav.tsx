import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { api } from '../data/jellyfin';
import { prefs } from '../data/prefs';
import { Screen, nav, sameScreen, useNav } from '../nav/navigator';
import { dp, sp } from '../theme/scale';
import { Fixed, NovaType, accentDiag, alpha, usePalette } from '../theme/theme';
import { FocusSurface } from './FocusSurface';
import { Icon, IconName } from './Icon';
import { clockText } from './Widgets';

const LOGO = require('../../assets/image/logo_stacked.png');

export function NovaWordmark({ size = 64 }: { size?: number }) {
  // Stacked PHOENIXA logo (phoenix above the name), transparent background
  return <Image source={LOGO} style={{ width: dp(size), height: dp(size) }} resizeMode="contain" />;
}

/**
 * The always-visible top bar: Search, Home, Favorites, Search & Add, every library,
 * Settings, your profile picture and a small clock.
 */
export function TopNav({ selected, onFocusInside }: { selected: Screen; onFocusInside?: () => void }) {
  useNav();
  const P = usePalette();
  // Opened from the top bar: keep the highlight on the selected pill
  const [focusSelected] = useState(() => {
    const v = nav.focusNavOnEnter;
    nav.focusNavOnEnter = false;
    return v;
  });
  const libs = nav.libraries.filter(l => ['movies', 'tvshows', 'boxsets', null, 'homevideos'].includes(l.collectionType));
  const is = (s: Screen) => sameScreen(selected, s);
  const tv = nav.torvia;

  return (
    <View style={{ width: '100%' }}>
      {/* Small clock in the top-right corner, above the bar */}
      <View style={{ position: 'absolute', top: dp(6), right: dp(52) }}>
        <Clock />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: dp(44),
          paddingRight: dp(48),
          paddingTop: dp(18),
          paddingBottom: dp(8),
        }}
      >
        <NovaWordmark />
        <View style={{ width: dp(22) }} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View
            style={{
              borderRadius: dp(26),
              backgroundColor: alpha(P.surface, 0.36),
              borderWidth: dp(1),
              borderColor: Fixed.stroke,
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: dp(5), columnGap: dp(4), alignItems: 'center' }}>
              <NavIcon icon="search" selected={is({ kind: 'Search' })} preferred={focusSelected && is({ kind: 'Search' })}
                onFocused={onFocusInside} onPress={() => !is({ kind: 'Search' }) && nav.tab({ kind: 'Search' })} />
              <NavPill text="Home" selected={is({ kind: 'Home' })} preferred={focusSelected && is({ kind: 'Home' })}
                onFocused={onFocusInside} onPress={() => !is({ kind: 'Home' }) && nav.tab({ kind: 'Home' })} />
              <NavIcon
                icon={is({ kind: 'Favorites' }) ? 'favorite' : 'favorite_border'}
                selected={is({ kind: 'Favorites' })}
                preferred={focusSelected && is({ kind: 'Favorites' })}
                onFocused={onFocusInside}
                onPress={() => !is({ kind: 'Favorites' }) && nav.tab({ kind: 'Favorites' })}
              />
              {tv ? (
                <NavPill text={tv.buttonLabel} selected={is({ kind: 'Torvia' })} preferred={focusSelected && is({ kind: 'Torvia' })}
                  onFocused={onFocusInside} onPress={() => !is({ kind: 'Torvia' }) && nav.tab({ kind: 'Torvia' })} />
              ) : null}
              {libs.map(lib => {
                const s: Screen = { kind: 'Lib', library: lib };
                return (
                  <NavPill key={lib.id} text={lib.name} selected={is(s)} preferred={focusSelected && is(s)}
                    onFocused={onFocusInside} onPress={() => !is(s) && nav.tab(s)} />
                );
              })}
            </ScrollView>
          </View>
        </View>
        <View style={{ width: dp(16) }} />
        <NavIcon icon="settings" selected={is({ kind: 'Settings' })} preferred={focusSelected && is({ kind: 'Settings' })}
          onFocused={onFocusInside} onPress={() => !is({ kind: 'Settings' }) && nav.tab({ kind: 'Settings' })} />
        <View style={{ width: dp(10) }} />
        <Avatar />
      </View>
    </View>
  );
}

function Avatar() {
  const P = usePalette();
  const [imgOk, setImgOk] = useState(true);
  return (
    <View
      style={{
        width: dp(38), height: dp(38), borderRadius: dp(19), overflow: 'hidden',
        experimental_backgroundImage: accentDiag(P), alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={[NovaType.Button, { color: P.onFocus }]}>{(prefs.userName ?? '?').slice(0, 1).toUpperCase()}</Text>
      {imgOk ? (
        <Image
          source={{ uri: api.userImage() }}
          onError={() => setImgOk(false)}
          style={{ position: 'absolute', width: dp(38), height: dp(38) }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

function NavPill({ text, selected, preferred, onPress, onFocused }: {
  text: string; selected: boolean; preferred: boolean; onPress: () => void; onFocused?: () => void;
}) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onPress} radius={22} focusedScale={1.04} borderWidth={0} glow={false}
      hasTVPreferredFocus={preferred} onFocused={onFocused}>
      {focused => (
        <View
          style={{
            height: dp(40),
            paddingHorizontal: dp(16),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? P.focus : undefined,
            experimental_backgroundImage:
              !focused && selected ? `linear-gradient(to right, ${alpha(P.accent, 0.25)} 0%, ${alpha(P.accent2, 0.25)} 100%)` : undefined,
          }}
        >
          <Text numberOfLines={1} style={[NovaType.Button, { color: focused ? P.onFocus : selected ? P.text : P.textDim }]}>{text}</Text>
        </View>
      )}
    </FocusSurface>
  );
}

function NavIcon({ icon, selected, preferred, onPress, onFocused }: {
  icon: IconName; selected: boolean; preferred: boolean; onPress: () => void; onFocused?: () => void;
}) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onPress} radius={20} focusedScale={1.06} borderWidth={0} glow={false}
      hasTVPreferredFocus={preferred} onFocused={onFocused}>
      {focused => (
        <View
          style={{
            width: dp(40),
            height: dp(40),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? P.focus : selected ? alpha(P.accent, 0.25) : undefined,
          }}
        >
          <Icon name={icon} size={22} color={focused ? P.onFocus : P.text} />
        </View>
      )}
    </FocusSurface>
  );
}

export function Clock() {
  const P = usePalette();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <Text numberOfLines={1} style={[NovaType.Label, { fontSize: sp(13), fontWeight: '500', letterSpacing: sp(0.5), color: P.textDim }]}>
      {clockText(now)}
    </Text>
  );
}
