import React, { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { dp } from '../theme/scale';
import { Fixed, NovaType, alpha, usePalette } from '../theme/theme';
import { SIDE } from '../theme/uiScale';
import { FocusSurface } from './FocusSurface';

/** Page title with filter chips beside it */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string | null; children?: ReactNode }) {
  const P = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: dp(SIDE), paddingBottom: dp(6) }}>
      <View>
        <Text style={[NovaType.Title, { color: P.text }]}>{title}</Text>
        {subtitle ? <Text style={[NovaType.Label, { color: P.textFaint }]}>{subtitle}</Text> : null}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', columnGap: dp(8) }}>{children}</View>
    </View>
  );
}

export function SortChip({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onPress} radius={18} focusedScale={1.05} borderWidth={0} glow={false}>
      {focused => (
        <View
          style={{
            paddingHorizontal: dp(16),
            paddingVertical: dp(8),
            borderRadius: dp(18),
            borderWidth: dp(1),
            borderColor: Fixed.stroke,
            backgroundColor: focused ? P.focus : undefined,
            experimental_backgroundImage: focused
              ? undefined
              : selected
                ? `linear-gradient(to right, ${alpha(P.accent, 0.33)} 0%, ${alpha(P.accent2, 0.33)} 100%)`
                : 'linear-gradient(to right, #FFFFFF1F 0%, #FFFFFF14 100%)',
          }}
        >
          <Text style={[NovaType.Label, { color: focused ? P.onFocus : P.text }]}>{text}</Text>
        </View>
      )}
    </FocusSurface>
  );
}
