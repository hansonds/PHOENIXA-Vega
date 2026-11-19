import React from 'react';
import { View } from 'react-native';
import { Screen } from '../nav/navigator';
import { TopNav } from '../components/TopNav';
import { CenterMessage, NovaButton } from '../components/Widgets';
import { nav } from '../nav/navigator';

/** Screens that arrive in the next builds (details, player, libraries, search, …). */
export function ComingSoonScreen({ screen, title }: { screen: Screen; title: string }) {
  const showNav = screen.kind !== 'Detail' && screen.kind !== 'Player' && screen.kind !== 'Person';
  return (
    <View style={{ flex: 1 }}>
      {showNav ? <TopNav selected={screen} /> : null}
      <CenterMessage
        title={title}
        subtitle="This part of PHOENIXA arrives in the next build."
        action={showNav ? undefined : <NovaButton text="Go back" primary hasTVPreferredFocus onPress={() => nav.back()} />}
      />
    </View>
  );
}
