import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { prefs } from '../data/prefs';
import { TopNav } from '../components/TopNav';
import { NovaButton } from '../components/Widgets';
import { dp } from '../theme/scale';
import { Fixed, NovaType, accentDiag, usePalette } from '../theme/theme';
import { SIDE } from '../theme/uiScale';

export const APP_VERSION = '1.0.0';

/**
 * Settings. This first build has the account card, Sign out and the About details;
 * the other settings (theme, card size, …) arrive with step 4.
 */
export function SettingsScreen({ onSignOut }: { onSignOut: () => void }) {
  const P = usePalette();
  return (
    <View style={{ flex: 1 }}>
      <TopNav selected={{ kind: 'Settings' }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: dp(SIDE), maxWidth: dp(760 + SIDE * 2), rowGap: dp(14), paddingBottom: dp(40) }}>
        <Text style={[NovaType.Title, { color: P.text }]}>Settings</Text>
        <View style={{ height: dp(4) }} />
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', padding: dp(20), borderRadius: dp(18),
            backgroundColor: Fixed.white12, borderWidth: dp(1), borderColor: Fixed.stroke,
          }}
        >
          <View style={{ width: dp(48), height: dp(48), borderRadius: dp(24), experimental_backgroundImage: accentDiag(P), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[NovaType.Title, { color: P.onFocus }]}>{(prefs.userName ?? '—').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ width: dp(16) }} />
          <View>
            <Text style={[NovaType.Caption, { color: P.textFaint }]}>SIGNED IN AS</Text>
            <Text style={[NovaType.Section, { color: P.text }]}>{prefs.userName ?? '—'}</Text>
            <Text style={[NovaType.Label, { color: P.textDim }]}>{prefs.server}</Text>
          </View>
        </View>
        <View style={{ height: dp(8) }} />
        <View style={{ flexDirection: 'row' }}>
          <NovaButton text="Sign out" icon="logout" onPress={onSignOut} />
        </View>
        <View style={{ height: dp(10) }} />
        <Text style={[NovaType.Label, { color: P.textFaint }]}>PHOENIXA {APP_VERSION} · made by Hanson · phoenicx.org</Text>
      </ScrollView>
    </View>
  );
}
