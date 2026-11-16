import { useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query. Used to render either the mobile card list or
 * the desktop table (never both), halving the DOM for large reports.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
