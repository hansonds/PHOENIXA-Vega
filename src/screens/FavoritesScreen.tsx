import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '../data/jellyfin';
import { Item } from '../data/models';
import { nav } from '../nav/navigator';
import { PageHeader, SortChip } from '../components/PageHeader';
import { PosterGrid } from '../components/PosterGrid';
import { TopNav } from '../components/TopNav';
import { CenterMessage, NovaLoader } from '../components/Widgets';
import { SIDE } from '../theme/uiScale';

const FILTERS: Array<[string, string]> = [
  ['All', 'Movie,Series,Episode'],
  ['Movies', 'Movie'],
  ['Shows', 'Series'],
  ['Episodes', 'Episode'],
];

export function FavoritesScreen({ active }: { active: boolean }) {
  const [filter, setFilter] = useState(0);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setItems(null);
    api.favorites(FILTERS[filter][1], 300)
      .then(l => live && (setItems(l), setError(null)))
      .catch(e => live && (setError(e?.message ?? "Couldn't load"), setItems([])));
    return () => {
      live = false;
    };
  }, [filter, reload]);

  // Coming back from a details page where the heart was changed
  const [wasActive, setWasActive] = useState(active);
  useEffect(() => {
    if (active && !wasActive) setReload(r => r + 1);
    setWasActive(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <View style={{ flex: 1 }}>
      <TopNav selected={{ kind: 'Favorites' }} />
      <PageHeader title="Favorites" subtitle={items ? `${items.length} titles` : null}>
        {FILTERS.map((f, i) => (
          <SortChip key={f[0]} text={f[0]} selected={i === filter} onPress={() => setFilter(i)} />
        ))}
      </PageHeader>
      {items === null ? (
        <NovaLoader />
      ) : error ? (
        <CenterMessage title="Couldn't load favorites" subtitle={error} />
      ) : items.length === 0 ? (
        <CenterMessage title="No favorites yet" subtitle="Press ♥ on any movie or show to save it here" />
      ) : (
        <PosterGrid items={items} padStart={SIDE} padEnd={SIDE} padTop={18} onPress={it => nav.push({ kind: 'Detail', itemId: it.id })} />
      )}
    </View>
  );
}
