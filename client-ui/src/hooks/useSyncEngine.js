import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { flushSync, pendingCount } from '../lib/syncQueue';
import { browserIsOnline } from './useOnlineStatus';

// How often to try again while the app is open. The `online` and `focus` events
// cover the common cases immediately; this is the backstop for a connection
// that comes back without either firing.
const POLL_MS = 60_000;

/**
 * Drains the durable sync queue whenever the network allows it.
 *
 * Mounted once, high in the tree. It does not care what is in the queue — the
 * queue knows its own table and row — so adding a new synced record type means
 * enqueueing it, not teaching this hook about it.
 *
 * Nothing here is allowed to reject: a failed flush is retried by the queue
 * itself, and an exception escaping into a render path would take the app down
 * over a background bookkeeping task.
 */
export default function useSyncEngine(userId) {
  const [pending, setPending] = useState(() => pendingCount());
  const inFlightRef = useRef(false);

  const sync = useCallback(async () => {
    if (!supabase || !userId) return;
    if (inFlightRef.current) return; // never overlap flushes
    if (!browserIsOnline()) return;
    if (pendingCount() === 0) {
      setPending(0);
      return;
    }
    inFlightRef.current = true;
    try {
      await flushSync(
        async item => {
          const { error } = await supabase.from(item.table).insert(item.row);
          if (error) {
            // Logged once per failure by the queue's own retry accounting; this
            // is here so a persistent problem (missing table, RLS) is visible in
            // the console rather than silent.
            console.warn(`Sync: ${item.table} insert failed:`, error.message || error);
            return false;
          }
          return true;
        },
        { isOnline: browserIsOnline }
      );
    } catch (err) {
      console.warn('Sync flush failed:', err);
    } finally {
      inFlightRef.current = false;
      setPending(pendingCount());
    }
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) return undefined;

    // Anything recorded before this session (a reload while offline) is owed a
    // write, so try immediately as well as on the next event.
    sync();

    const interval = setInterval(sync, POLL_MS);
    const onOnline = () => sync();
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', sync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', sync);
    };
  }, [sync, userId]);

  return { pending, sync };
}
