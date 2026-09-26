import { useEffect, useState } from 'react';

/**
 * Whether the browser currently believes it has a network.
 *
 * `navigator.onLine` only says whether there is *a* connection, not whether the
 * internet is reachable — a captive portal or a dead uplink still reports true.
 * So this is treated as a hint throughout: it is used to decide whether to try
 * syncing and whether a failed request was the network's fault, never as proof
 * that a request will succeed. `isOnline()` in useSyncEngine therefore still
 * has to cope with a "true" that lies.
 */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // A tab restored from bfcache or woken from sleep can have missed the event.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setIsOnline(navigator.onLine !== false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return isOnline;
}

/** Non-reactive read, for callbacks that must not re-subscribe on every change. */
export function browserIsOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
