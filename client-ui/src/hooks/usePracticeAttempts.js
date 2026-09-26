import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getPracticeAttempts } from '../utils/analyticsTracker';
import { mergePracticeAttempts, practiceRowToAttempt } from '../lib/attemptMerge';

async function fetchPracticeFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('practice_attempts')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1000);
    if (error) {
      // Expected until the practice_attempts table is migrated. Not fatal: the
      // local list is authoritative for this device either way.
      console.warn('Practice attempts fetch failed:', error.message || error);
      return null;
    }
    if (!Array.isArray(data)) return null;
    return data.map(practiceRowToAttempt);
  } catch (err) {
    console.warn('Practice attempts fetch failed:', err);
    return null;
  }
}

/**
 * Practice attempts from this device *and* every other device, de-duplicated.
 *
 * Returns local data synchronously on the first render so progress is correct
 * on first paint and while offline; the server copy is folded in when it
 * arrives. The previous behaviour read localStorage only, which meant practice
 * progress silently reset on a new device.
 */
export default function usePracticeAttempts() {
  const [attempts, setAttempts] = useState(() => getPracticeAttempts());
  const [source, setSource] = useState('local');
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    const local = getPracticeAttempts();
    if (!supabase) {
      setAttempts(local);
      setSource('local');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const rows = await fetchPracticeFromSupabase();
      if (rows === null) {
        setAttempts(local);
        setSource('local');
      } else {
        setAttempts(mergePracticeAttempts(rows, local));
        const serverIds = new Set(rows.map(r => r.id));
        setSource(local.some(l => !serverIds.has(l.id)) ? 'merged' : 'supabase');
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return { attempts, source, refresh };
}
