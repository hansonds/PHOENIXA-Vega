import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';
import { Pressable } from '@amazon-devices/react-native-kepler';
import { dp } from '../theme/scale';
import { Fixed, NovaType, alpha, usePalette } from '../theme/theme';
import { requestFocus } from './focus';
import { Icon, IconName } from './Icon';

export interface NovaTextFieldHandle {
  /** Highlight the box (without opening the keyboard) */
  focus(): void;
  /** Open the keyboard straight away */
  edit(): void;
}

/**
 * TV text field: moving the highlight onto it does NOT pop up the keyboard.
 * Press OK on it to start typing; Done/Next or moving away ends editing.
 */
export function NovaTextField({ value, onChangeText, label, placeholder = '', password = false, icon, returnKeyType = 'next', keyboardType = 'default',
    hasTVPreferredFocus, onSubmit, style, ref }: {
  value: string;
  onChangeText: (v: string) => void;
  label: string;
  placeholder?: string;
  password?: boolean;
  icon?: IconName;
  returnKeyType?: 'next' | 'done' | 'search' | 'go';
  keyboardType?: 'default' | 'url';
  hasTVPreferredFocus?: boolean;
  /** Called after Done / Search / Go on the keyboard, or Next */
  onSubmit?: () => void;
  style?: StyleProp<ViewStyle>;
} & { ref?: React.Ref<NovaTextFieldHandle> }) {
  const P = usePalette();
  const displayRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const [editing, setEditing] = useState(false);
  const [displayFocused, setDisplayFocused] = useState(false);
  const [editFocused, setEditFocused] = useState(false);
  const wasEditing = useRef(false);
  const focused = displayFocused || editFocused;

  useImperativeHandle(ref, () => ({
    focus: () => requestFocus(displayRef, 30),
    edit: () => setEditing(true),
  }));

  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    } else if (wasEditing.current) {
      wasEditing.current = false;
      requestFocus(displayRef, 40);
    }
  }, [editing]);

  const boxStyle: ViewStyle = {
    width: '100%',
    height: dp(52),
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: dp(14),
    backgroundColor: focused ? alpha(P.accent, 0.18) : Fixed.white10,
    borderWidth: focused ? dp(2) : dp(1),
    borderColor: focused ? P.accent : Fixed.stroke,
    paddingHorizontal: dp(16),
  };

  const shown = !value ? placeholder : password ? '•'.repeat(Math.min(value.length, 24)) : value;

  return (
    <View style={style}>
      {label ? (
        <>
          <Text style={[NovaType.Caption, { color: focused ? P.accent : P.textFaint }]}>{label.toUpperCase()}</Text>
          <View style={{ height: dp(8) }} />
        </>
      ) : null}
      {!editing ? (
        <Pressable
          ref={displayRef}
          hasTVPreferredFocus={hasTVPreferredFocus}
          onFocus={() => setDisplayFocused(true)}
          onBlur={() => setDisplayFocused(false)}
          onPress={() => setEditing(true)}
        >
          <View style={boxStyle}>
            {icon ? (
              <>
                <Icon name={icon} size={22} color={focused ? P.accent : P.textDim} />
                <View style={{ width: dp(12) }} />
              </>
            ) : null}
            <Text numberOfLines={1} style={[NovaType.Body, { flex: 1, color: value ? P.text : P.textFaint }]}>{shown}</Text>
            {displayFocused ? <Text style={[NovaType.Label, { color: P.textFaint }]}>OK to type</Text> : null}
          </View>
        </Pressable>
      ) : (
        <View>
          <View style={boxStyle}>
            {icon ? (
              <>
                <Icon name={icon} size={22} color={P.accent} />
                <View style={{ width: dp(12) }} />
              </>
            ) : null}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={P.textFaint}
              secureTextEntry={password}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={keyboardType === 'url' ? 'url' : 'default'}
              returnKeyType={returnKeyType}
              selectionColor={P.accent}
              onFocus={() => setEditFocused(true)}
              onBlur={() => {
                setEditFocused(false);
                setEditing(false);
              }}
              onSubmitEditing={() => {
                setEditing(false);
                onSubmit?.();
              }}
              style={[NovaType.Body, { flex: 1, color: P.text, padding: 0 }]}
            />
          </View>
        </View>
      )}
    </View>
  );
}
