import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from './supabase';

// Carga datos, recarga al volver a la pantalla y expone reload().
// Mantiene los datos anteriores mientras recarga (no parpadea).
export function useData(loader, deps = []) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, error, loading: data === undefined && !error, reload, refreshing, pullToRefresh };
}

// Escucha cambios en tiempo real de una tabla del grupo y llama onChange.
// No confiamos en el payload (los DELETE no pasan por RLS): solo recargamos.
export function useRealtime(table, groupId, onChange) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`${table}:${groupId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `group_id=eq.${groupId}` }, () =>
        cb.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, groupId]);
}
