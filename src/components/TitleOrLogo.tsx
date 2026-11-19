import React, { useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { api } from '../data/jellyfin';
import { Item, isEpisode } from '../data/models';
import { dp } from '../theme/scale';
import { NovaType, usePalette } from '../theme/theme';

/** The title's logo picture (left-aligned, kept inside the max size), or the title as text. */
export function TitleOrLogo({ item, maxLogoH, maxLogoW, big }: { item: Item; maxLogoH: number; maxLogoW: number; big: boolean }) {
  const P = usePalette();
  const logo = api.logo(item);
  const [failed, setFailed] = useState(!logo);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setFailed(!api.logo(item));
    setSize(null);
  }, [item.id, item]);

  if (!failed && logo) {
    return (
      <Image
        source={{ uri: logo }}
        resizeMode="contain"
        onError={() => setFailed(true)}
        onLoad={e => {
          const src = (e.nativeEvent as any)?.source;
          if (src?.width && src?.height) {
            const s = Math.min(dp(maxLogoW) / src.width, dp(maxLogoH) / src.height);
            setSize({ w: src.width * s, h: src.height * s });
          }
        }}
        style={size ? { width: size.w, height: size.h } : { width: dp(maxLogoW), height: dp(maxLogoH), opacity: 0.001 }}
      />
    );
  }
  return (
    <Text numberOfLines={2} style={[big ? NovaType.Display : NovaType.Title, { color: P.text }]}>
      {isEpisode(item) ? item.seriesName ?? item.name : item.name}
    </Text>
  );
}

