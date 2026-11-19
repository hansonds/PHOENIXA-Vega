import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TVFocusGuideView } from '@amazon-devices/react-native-kepler';
import { useBack } from '../nav/back';
import { dp, sp } from '../theme/scale';
import { Fixed, NovaType, alpha, usePalette } from '../theme/theme';
import { FocusSurface } from './FocusSurface';
import { Icon } from './Icon';

export interface SheetOption {
  label: string;
  detail: string;
  selected: boolean;
}

/**
 * Right-side picker panel over a dimmed page (OptionSheet on Android). Keeps the remote's
 * highlight inside the panel until you pick something or press Back.
 */
export function OptionSheet({ title, options, onSelect, onDismiss }: {
  title: string;
  options: SheetOption[];
  onSelect: (i: number) => void;
  onDismiss: () => void;
}) {
  const P = usePalette();
  useBack(true, onDismiss);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(P.bgDeep, 0.6), flexDirection: 'row', justifyContent: 'flex-end' }]}>
      <SidePanel title={title} width={440} options={options} onSelect={onSelect} opaque />
    </View>
  );
}

/** Right-side picker (audio, subtitles, speed). Keeps the highlight inside until you pick or press Back. */
export function SidePanel({ title, width, options, onSelect, opaque = false }: {
  title: string;
  width: number;
  options: SheetOption[];
  onSelect: (i: number) => void;
  /** OptionSheet: 0.95 → 0.99; player panels: 0.90 → 0.98 */
  opaque?: boolean;
}) {
  const P = usePalette();
  const first = Math.max(0, options.findIndex(o => o.selected));
  return (
    <TVFocusGuideView
      trapFocusUp
      trapFocusDown
      trapFocusLeft
      trapFocusRight
      style={{
        width: dp(width),
        height: '100%',
        padding: dp(28),
        borderLeftWidth: dp(1),
        borderColor: Fixed.stroke,
        experimental_backgroundImage: `linear-gradient(to right, ${alpha(P.bg, opaque ? 0.95 : 0.9)} 0%, ${alpha(P.bg, opaque ? 0.99 : 0.98)} 100%)`,
      }}
    >
      <Text style={[NovaType.Title, { color: P.text }]}>{title}</Text>
      <View style={{ height: dp(18) }} />
      {options.length === 0 ? <Text style={[NovaType.Body, { color: P.textDim }]}>No tracks available</Text> : null}
      <ScrollView contentContainerStyle={{ rowGap: dp(8), paddingBottom: dp(20) }}>
        {options.map((o, i) => (
          <OptionRow key={i} label={o.label} detail={o.detail} selected={o.selected} preferred={i === first} onPress={() => onSelect(i)} />
        ))}
      </ScrollView>
    </TVFocusGuideView>
  );
}

export function OptionRow({ label, detail, selected, preferred, onPress }: {
  label: string; detail: string; selected: boolean; preferred: boolean; onPress: () => void;
}) {
  const P = usePalette();
  return (
    <FocusSurface onPress={onPress} radius={14} focusedScale={1.02} glow={false} hasTVPreferredFocus={preferred}>
      {focused => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: dp(16),
            paddingVertical: dp(12),
            backgroundColor: focused ? alpha(P.accent, 0.2) : Fixed.white8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[NovaType.Button, { color: P.text }]}>{label}</Text>
            {detail ? <Text numberOfLines={2} style={[NovaType.Label, { fontSize: sp(12), color: P.textDim }]}>{detail}</Text> : null}
          </View>
          {selected ? <Icon name="check" size={24} color={P.accent} /> : null}
        </View>
      )}
    </FocusSurface>
  );
}

