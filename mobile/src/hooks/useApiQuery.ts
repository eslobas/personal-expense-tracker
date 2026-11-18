import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

interface QueryState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refreshing: boolean;
}

/**
 * Minimal data-fetching hook: fetches whenever the screen gains focus (so lists
 * are fresh after returning from the form) or when `fetcher` changes, ignores
 * stale responses, and exposes pull-to-refresh state.
 */
export function useApiQuery<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
  });
  const requestId = useRef(0);

  const run = useCallback(
    async (mode: 'load' | 'refresh') => {
      const id = ++requestId.current;
      setState((s) => ({
        ...s,
        error: null,
        loading: mode === 'load' && s.data === null,
        refreshing: mode === 'refresh',
      }));
      try {
        const data = await fetcher();
        if (id === requestId.current) {
          setState({ data, error: null, loading: false, refreshing: false });
        }
      } catch (err) {
        if (id === requestId.current) {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err : new Error(String(err)),
            loading: false,
            refreshing: false,
          }));
        }
      }
    },
    [fetcher],
  );

  useFocusEffect(
    useCallback(() => {
      void run('load');
    }, [run]),
  );

  return {
    ...state,
    reload: useCallback(() => run('load'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
  };
}
