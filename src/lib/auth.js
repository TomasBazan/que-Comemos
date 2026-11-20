import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { listMyGroups } from './api';

const AuthContext = createContext(null);

const activeKey = (uid) => `quecomemos:activeGroup:${uid}`;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [profile, setProfile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupIdState] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [{ data: prof }, gs] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('id', userId).maybeSingle(),
      listMyGroups(),
    ]);
    setProfile(prof ?? null);
    setGroups(gs);
    let stored = null;
    try {
      stored = await AsyncStorage.getItem(activeKey(userId));
    } catch {}
    setActiveGroupIdState((current) => {
      const candidate = current ?? stored;
      return gs.some((g) => g.id === candidate) ? candidate : gs[0]?.id ?? null;
    });
  }, [userId]);

  useEffect(() => {
    if (userId) refresh().catch((e) => console.warn('refresh', e));
    else {
      setProfile(null);
      setGroups([]);
      setActiveGroupIdState(null);
    }
  }, [userId, refresh]);

  const setActiveGroupId = useCallback(
    (id) => {
      setActiveGroupIdState(id);
      if (userId) AsyncStorage.setItem(activeKey(userId), id).catch(() => {});
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      loading: session === undefined,
      session,
      userId,
      profile,
      groups,
      activeGroup: groups.find((g) => g.id === activeGroupId) ?? null,
      setActiveGroupId,
      refresh,
    }),
    [session, userId, profile, groups, activeGroupId, setActiveGroupId, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
