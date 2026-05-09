import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { api, getToken, setToken } from '../lib/api';

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  is_guest: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMERGENT_AUTH_URL = 'https://auth.emergentagent.com/';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const refresh = async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api<User>('/auth/me');
      setUser(me);
    } catch {
      await setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setInitialized(true);
    })();
  }, []);

  const processSessionId = async (sessionId: string) => {
    setLoading(true);
    try {
      const data = await api<{ session_token: string; user: User }>('/auth/session', {
        method: 'POST',
        json: { session_id: sessionId },
      });
      await setToken(data.session_token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const extractSessionId = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      const hashIdx = url.indexOf('#');
      if (hashIdx >= 0) {
        const hash = url.substring(hashIdx + 1);
        const params = new URLSearchParams(hash);
        const sid = params.get('session_id');
        if (sid) return sid;
      }
      const u = new URL(url);
      return u.searchParams.get('session_id');
    } catch {
      // try regex fallback
      const m = url.match(/session_id=([^&#]+)/);
      return m ? m[1] : null;
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const redirectUrl =
        Platform.OS === 'web'
          ? (typeof window !== 'undefined' ? window.location.origin + '/' : '/')
          : Linking.createURL('/');

      const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      let resultUrl: string | null = null;
      if (result.type === 'success' && (result as any).url) {
        resultUrl = (result as any).url;
      } else {
        // cold-start fallback
        resultUrl = await Linking.getInitialURL();
      }

      const sid = extractSessionId(resultUrl);
      if (sid) {
        await processSessionId(sid);
      } else {
        throw new Error('Login cancelled or no session_id received');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInAsGuest = async () => {
    setLoading(true);
    try {
      const data = await api<{ session_token: string; user: User }>('/auth/guest', { method: 'POST' });
      await setToken(data.session_token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {}
    await setToken(null);
    setUser(null);
  };

  // Web: catch session_id from window hash (cold start)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    const sid = extractSessionId(window.location.href);
    if (sid && !user) {
      processSessionId(sid).then(() => {
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {}
      }).catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, initialized, signInWithGoogle, signInAsGuest, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
