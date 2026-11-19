import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { dp } from '../theme/scale';

/** Material icons (same set as the Android app), drawn white and tinted to any colour. */
const ICONS = {
  search: require('../../assets/icons/search.png'),
  favorite: require('../../assets/icons/favorite.png'),
  favorite_border: require('../../assets/icons/favorite_border.png'),
  settings: require('../../assets/icons/settings.png'),
  play: require('../../assets/icons/play.png'),
  info: require('../../assets/icons/info.png'),
  dns: require('../../assets/icons/dns.png'),
  person: require('../../assets/icons/person.png'),
  lock: require('../../assets/icons/lock.png'),
  login: require('../../assets/icons/login.png'),
  qr_code: require('../../assets/icons/qr_code.png'),
  star: require('../../assets/icons/star.png'),
  check_circle: require('../../assets/icons/check_circle.png'),
  check_circle_outline: require('../../assets/icons/check_circle_outline.png'),
  replay: require('../../assets/icons/replay.png'),
  tv: require('../../assets/icons/tv.png'),
  logout: require('../../assets/icons/logout.png'),
  check: require('../../assets/icons/check.png'),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, color, style }: { name: IconName; size: number; color: string; style?: StyleProp<ImageStyle> }) {
  return <Image source={ICONS[name]} style={[{ width: dp(size), height: dp(size), tintColor: color }, style]} resizeMode="contain" />;
}
