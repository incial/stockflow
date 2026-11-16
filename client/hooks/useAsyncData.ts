import { DependencyList, Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../services/api';
import { useToast } from '../context/ToastContext';

interface AsyncState<T> {
  data: T;
  /** True only until the first successful load – use for full-page placeholders. */
  initialLoading: boolean;
  /** True whenever a request is in flight (including background refreshes). */
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: Dispatch<SetStateAction<T>>;
}

/**
 * Loads data for a view. Any in-flight request is aborted when deps change or the
 * view unmounts, so stale responses can never overwrite newer state and no work
 * continues for screens that are gone. Previous data stays visible while reloading.
 */
export function useAsyncData<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  initialData: T,
  errorMessage = 'Failed to load data'
): AsyncState<T> {
  const { addToast } = useToast();
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loaderRef.current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setError(null);
        setInitialLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        const message = err instanceof Error && err.message ? err.message : errorMessage;
        setError(message);
        setInitialLoading(false);
        addToast(message, 'error');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, initialLoading, loading, error, reload, setData };
}
