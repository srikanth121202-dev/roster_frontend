import { useEffect, useState } from 'react';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

// Module-level singleton — the script loads exactly once per page
let globalState: LoadState =
  typeof window !== 'undefined' && (window as { google?: { maps?: unknown } }).google?.maps
    ? 'loaded'
    : 'idle';

const listeners = new Set<(s: LoadState) => void>();

function broadcast(s: LoadState) {
  globalState = s;
  listeners.forEach(fn => fn(s));
}

export function useGoogleMaps(apiKey: string | undefined) {
  const [state, setState] = useState<LoadState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    setState(globalState); // sync on mount
    return () => { listeners.delete(setState); };
  }, []);

  useEffect(() => {
    if (!apiKey || globalState !== 'idle') return;
    broadcast('loading');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.onload  = () => broadcast('loaded');
    script.onerror = () => broadcast('error');
    document.head.appendChild(script);
  }, [apiKey]);

  return {
    isLoaded:  state === 'loaded',
    isLoading: state === 'loading',
    hasError:  state === 'error',
  };
}
