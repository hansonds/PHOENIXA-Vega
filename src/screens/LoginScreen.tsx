import React, { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { api } from '../data/jellyfin';
import { prefs } from '../data/prefs';
import { NovaTextField, NovaTextFieldHandle } from '../components/NovaTextField';
import { NovaButton, NovaLoader } from '../components/Widgets';
import { dp, sp } from '../theme/scale';
import { Fixed, NovaType, alpha, usePalette } from '../theme/theme';

const LOGO = require('../../assets/image/logo_stacked.png');

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const P = usePalette();
  const [server, setServer] = useState(prefs.server);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qcCode, setQcCode] = useState<string | null>(null);
  const [qcSecret, setQcSecret] = useState<string | null>(null);
  const serverRef = useRef<NovaTextFieldHandle>(null);
  const userRef = useRef<NovaTextFieldHandle>(null);
  const passRef = useRef<NovaTextFieldHandle>(null);
  const cancelRef = useRef<any>(null);

  // Highlight the server box (without opening the keyboard) so Quick Connect is a few presses away
  useEffect(() => {
    serverRef.current?.focus();
  }, []);
  // After a failed sign-in the buttons briefly disappear (loading), so put the highlight back on the Server box
  useEffect(() => {
    if (error && !busy) serverRef.current?.focus();
  }, [error, busy]);

  // Poll Quick Connect until approved from another device
  useEffect(() => {
    if (!qcSecret) return;
    let stopped = false;
    const base = api.normalizeServer(server);
    (async () => {
      for (let i = 0; i < 150 && !stopped; i++) {
        await new Promise<void>(r => setTimeout(() => r(), 2000));
        if (stopped) return;
        let ok = false;
        try {
          ok = await api.quickConnectCheck(base, qcSecret);
        } catch {
          ok = false;
        }
        if (ok) {
          try {
            await api.quickConnectFinish(base, qcSecret);
            onLoggedIn();
          } catch (e: any) {
            setError(e?.message ?? "Couldn't sign in");
            setQcSecret(null);
            setQcCode(null);
          }
          return;
        }
      }
      if (!stopped) {
        setQcSecret(null);
        setQcCode(null);
        setError('Quick Connect timed out');
      }
    })();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qcSecret]);

  const signIn = async () => {
    if (busy) return;
    if (!server.trim()) {
      setError('Enter your server address first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base = api.normalizeServer(server);
      await api.ping(base);
      await api.login(base, user.trim(), pass);
      onLoggedIn();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  };

  const quickConnect = async () => {
    if (busy) return;
    if (!server.trim()) {
      setError('Enter your server address first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base = api.normalizeServer(server);
      const [secret, code] = await api.quickConnectInitiate(base);
      setQcCode(code);
      setQcSecret(secret);
    } catch (e: any) {
      const m: string = e?.message ?? '';
      setError(e?.code === 401 || m.includes('401') || m.toLowerCase().includes('error') ? 'Quick Connect is disabled on this server' : m);
    } finally {
      setBusy(false);
    }
  };

  const cancelQc = () => {
    setQcCode(null);
    setQcSecret(null);
    serverRef.current?.focus();
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: dp(80) }}>
      {/* Brand side */}
      <View style={{ flex: 1 }}>
        <Image source={LOGO} style={{ width: dp(230), height: dp(230) }} resizeMode="contain" />
        <View style={{ height: dp(24) }} />
        <Text style={[NovaType.Section, { fontWeight: '400', color: P.textDim }]}>Your cinema, reimagined.</Text>
      </View>

      {/* Glass card */}
      <View
        style={{
          width: dp(460),
          borderRadius: dp(28),
          borderWidth: dp(1),
          borderColor: Fixed.stroke,
          padding: dp(36),
          experimental_backgroundImage: `linear-gradient(to bottom, ${alpha(P.surfaceHi, 0.2)} 0%, ${alpha(P.surface, 0.4)} 100%)`,
        }}
      >
        {qcCode ? (
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text style={[NovaType.Caption, { color: P.accent }]}>QUICK CONNECT</Text>
            <View style={{ height: dp(18) }} />
            <Text style={[NovaType.Display, { fontSize: sp(64), lineHeight: sp(72), letterSpacing: sp(8), color: P.text }]}>
              {(qcCode.match(/.{1,3}/g) ?? [qcCode]).join(' ')}
            </Text>
            <View style={{ height: dp(18) }} />
            <Text style={[NovaType.Body, { color: P.textDim }]}>
              On your phone or computer, open Jellyfin → Profile → Quick Connect and enter this code.
            </Text>
            <View style={{ height: dp(24) }} />
            <NovaButton ref={cancelRef} text="Cancel" hasTVPreferredFocus onPress={cancelQc} />
          </View>
        ) : (
          <View style={{ rowGap: dp(18) }}>
            <Text style={[NovaType.Title, { color: P.text }]}>Sign in</Text>
            <NovaTextField
              ref={serverRef}
              value={server}
              onChangeText={setServer}
              label="Server"
              icon="dns"
              keyboardType="url"
              placeholder="your-server.com"
              onSubmit={() => userRef.current?.focus()}
            />
            <NovaTextField ref={userRef} value={user} onChangeText={setUser} label="Username" icon="person"
              onSubmit={() => passRef.current?.focus()} />
            <NovaTextField ref={passRef} value={pass} onChangeText={setPass} label="Password" icon="lock" password
              returnKeyType="done" onSubmit={signIn} />
            {error ? <Text style={[NovaType.Label, { color: Fixed.rose }]}>{error}</Text> : null}
            {busy ? (
              <View style={{ width: '100%', height: dp(48) }}>
                <NovaLoader size={40} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', columnGap: dp(12) }}>
                <NovaButton text="Sign In" icon="login" primary onPress={signIn} />
                <NovaButton text="Quick Connect" icon="qr_code" onPress={quickConnect} />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
