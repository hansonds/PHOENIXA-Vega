import React, { ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import { Item } from '../data/models';
import { SCREEN_W, dp } from '../theme/scale';
import { UiScale, useCardSize } from '../theme/uiScale';
import { PosterCard } from './Widgets';

/**
 * Grid of posters (LazyVerticalGrid with GridCells.Adaptive on Android): as many columns as fit
 * the width, posters left-aligned in their cells.
 */
export function PosterGrid({
  items, width, padStart, padEnd, padTop = 24, padBottom = 60, hGap = 20, vGap = 22, header, onPress, onEndReached,
  firstRef, onFocusIndex, preferredIndex,
}: {
  items: Item[];
  /** Width of the area the grid sits in (default: the whole screen) */
  width?: number;
  padStart: number;
  padEnd: number;
  padTop?: number;
  padBottom?: number;
  hGap?: number;
  vGap?: number;
  header?: ReactElement | null;
  onPress: (item: Item, index: number) => void;
  onEndReached?: () => void;
  firstRef?: React.RefObject<any>;
  onFocusIndex?: (i: number) => void;
  preferredIndex?: number;
}) {
  useCardSize();
  const w = UiScale.posterWidth;
  const avail = (width ?? SCREEN_W) - dp(padStart) - dp(padEnd);
  const cols = Math.max(1, Math.floor((avail + dp(hGap)) / (dp(w) + dp(hGap))));
  const cell = (avail - (cols - 1) * dp(hGap)) / cols;
  return (
    <FlatList
      key={`grid-${cols}`}
      data={items}
      numColumns={cols}
      keyExtractor={it => it.id}
      ListHeaderComponent={header ?? null}
      contentContainerStyle={{ paddingLeft: dp(padStart), paddingRight: dp(padEnd), paddingTop: dp(padTop), paddingBottom: dp(padBottom) }}
      columnWrapperStyle={cols > 1 ? { columnGap: dp(hGap) } : undefined}
      ItemSeparatorComponent={() => <View style={{ height: dp(vGap) }} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      initialNumToRender={cols * 3}
      windowSize={7}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <View style={{ width: cell }}>
          <PosterCard
            ref={index === 0 ? firstRef : undefined}
            item={item}
            width={w}
            showTitle
            hasTVPreferredFocus={preferredIndex === index}
            onFocused={() => onFocusIndex?.(index)}
            onPress={() => onPress(item, index)}
          />
        </View>
      )}
    />
  );
}
