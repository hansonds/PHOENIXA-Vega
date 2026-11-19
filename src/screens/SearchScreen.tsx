import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '../data/jellyfin';
import { Item } from '../data/models';
import { nav } from '../nav/navigator';
import { NovaTextField, NovaTextFieldHandle } from '../components/NovaTextField';
import { PosterGrid } from '../components/PosterGrid';
import { TopNav } from '../components/TopNav';
import { CenterMessage, NovaLoader } from '../components/Widgets';
import { dp } from '../theme/scale';
import { SIDE } from '../theme/uiScale';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const fieldRef = useRef<NovaTextFieldHandle>(null);
  const [fromNav] = useState(() => nav.focusNavOnEnter);

  useEffect(() => {
    if (!fromNav) fieldRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.search(q);
        if (live) setResults(r);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setLoading(false);
      }
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const q = query.trim();
  return (
    <View style={{ flex: 1 }}>
      <TopNav selected={{ kind: 'Search' }} />
      <NovaTextField
        ref={fieldRef}
        value={query}
        onChangeText={setQuery}
        label=""
        placeholder="Search movies, shows, episodes…"
        icon="search"
        returnKeyType="search"
        style={{ marginHorizontal: dp(SIDE), width: dp(620) }}
      />
      {loading && results.length === 0 ? (
        <NovaLoader />
      ) : q.length >= 2 && results.length === 0 && !loading ? (
        <CenterMessage title="No results" subtitle="Try a different title" />
      ) : results.length === 0 ? (
        <CenterMessage title="Find something to watch" subtitle="Start typing a title, actor or genre" />
      ) : (
        <PosterGrid items={results} padStart={SIDE} padEnd={SIDE} padTop={24} onPress={it => nav.push({ kind: 'Detail', itemId: it.id })} />
      )}
    </View>
  );
}
