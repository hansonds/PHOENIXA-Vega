import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '../data/jellyfin';
import { Item, Library } from '../data/models';
import { nav } from '../nav/navigator';
import { PageHeader, SortChip } from '../components/PageHeader';
import { PosterGrid } from '../components/PosterGrid';
import { TopNav } from '../components/TopNav';
import { CenterMessage, NovaLoader } from '../components/Widgets';
import { SIDE } from '../theme/uiScale';

const SORTS = [
  { label: 'Recently Added', by: 'DateCreated,SortName', order: 'Descending' },
  { label: 'A – Z', by: 'SortName', order: 'Ascending' },
  { label: 'Top Rated', by: 'CommunityRating,SortName', order: 'Descending' },
  { label: 'Release Year', by: 'ProductionYear,SortName', order: 'Descending' },
  { label: 'Random', by: 'Random', order: 'Ascending' },
];

/** Library grid: Recently Added / A–Z / Top Rated / Release Year / Random; remembers where you were. */
export function LibraryScreen({ lib }: { lib: Library }) {
  const [sortIdx, setSortIdx] = useState(() => nav.libraryPos.get(lib.id)?.[0] ?? 0);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  const totalRef = useRef(-1);
  const gen = useRef(0);

  const loadMore = useCallback(async (reset: boolean) => {
    if (loading.current && !reset) return;
    if (!reset && totalRef.current >= 0 && itemsRef.current.length >= totalRef.current) return;
    loading.current = true;
    const g = gen.current;
    try {
      const s = SORTS[sortIdx];
      const [page, t] = await api.libraryItems(lib, s.by, s.order, reset ? 0 : itemsRef.current.length, 60);
      if (g !== gen.current) return;
      itemsRef.current = reset ? page : [...itemsRef.current, ...page];
      totalRef.current = t;
      setItems(itemsRef.current);
      setTotal(t);
      setError(null);
    } catch (e: any) {
      if (g === gen.current) setError(e?.message ?? "Couldn't load");
    } finally {
      if (g === gen.current) loading.current = false;
    }
  }, [lib, sortIdx]);

  useEffect(() => {
    gen.current++;
    loading.current = false;
    itemsRef.current = [];
    totalRef.current = -1;
    setItems([]);
    setTotal(-1);
    loadMore(true);
  }, [loadMore]);

  return (
    <View style={{ flex: 1 }}>
      <TopNav selected={{ kind: 'Lib', library: lib }} />
      <PageHeader title={lib.name} subtitle={total >= 0 ? `${total} titles` : null}>
        {SORTS.map((s, i) => (
          <SortChip key={s.label} text={s.label} selected={i === sortIdx} onPress={() => setSortIdx(i)} />
        ))}
      </PageHeader>
      {items.length === 0 && error ? (
        <CenterMessage title="Couldn't load library" subtitle={error} />
      ) : items.length === 0 && total < 0 ? (
        <NovaLoader />
      ) : items.length === 0 ? (
        <CenterMessage title="Nothing here yet" />
      ) : (
        <PosterGrid
          items={items}
          padStart={SIDE}
          padEnd={SIDE}
          padTop={18}
          onEndReached={() => loadMore(false)}
          onPress={(item, index) => {
            nav.libraryPos.set(lib.id, [sortIdx, index]);
            nav.push({ kind: 'Detail', itemId: item.id });
          }}
        />
      )}
    </View>
  );
}
