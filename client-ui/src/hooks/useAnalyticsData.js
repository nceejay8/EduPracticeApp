import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { computeAnalytics, listAttempts } from '../data/examBank';
import { mergeExamAttempts } from '../lib/attemptMerge';

function rowToAttempt(row) {
  return {
    // Prefer the local attempt id (stored in exam_id) so result-viewer links
    // still resolve to the localStorage attempt taken on this device.
    id: row.exam_id || row.id,
    title: row.title || 'Exam',
    subtitle: row.subtitle || '',
    subject: row.subject,
    level: row.level,
    percentage: row.percentage ?? 0,
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    durationMin: row.duration_min ?? row.durationMin ?? 0,
    submittedAt: row.submitted_at ?? row.submittedAt,
  };
}

async function fetchAllFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(500);
    if (error) {
      console.warn('Supabase fetch error:', error);
      return null;
    }
    if (!Array.isArray(data)) return null;
    return data.map(rowToAttempt);
  } catch (err) {
    console.warn('Failed to fetch from Supabase:', err);
    return null;
  }
}

export default function useAnalyticsData({ days = null } = {}) {
  const [allAttempts, setAllAttempts] = useState(() => listAttempts());
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('local');
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    // Local first, always available, and the only thing there is while offline.
    const local = listAttempts();
    if (!supabase) {
      setAllAttempts(local);
      setSource('local');
      return;
    }
    setLoading(true);
    const rows = await fetchAllFromSupabase();
    if (rows === null) {
      // Server unreachable. The local list is the whole truth for now.
      setAllAttempts(local);
      setSource('local');
    } else {
      // Merged, not replaced. An attempt completed offline is in the local list
      // but not yet on the server, and replacing would hide it from every
      // analytics view the moment the network came back.
      setAllAttempts(mergeExamAttempts(rows, local));
      // 'merged' means the server genuinely does not have everything yet, which
      // is the state a student should be able to see rather than have hidden.
      const serverIds = new Set(rows.map(r => r.id));
      setSource(local.some(l => !serverIds.has(l.id)) ? 'merged' : 'supabase');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) {
      const timer = setInterval(refresh, 30000);
      return () => clearInterval(timer);
    }

    let subscribed = false;

    const setupRealtimeSubscription = async () => {
      try {
        const channel = supabase.channel('analytics_realtime');
        
        channel.on('postgres_changes', 
          { event: '*', schema: 'public', table: 'exam_attempts' }, 
          () => {
            if (subscribed) {
              refresh();
            }
          }
        );
        
        const subscription = await channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            console.log('Analytics realtime subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            subscribed = false;
            console.warn('Analytics realtime channel error, falling back to polling');
          }
        });
        
        channelRef.current = channel;
      } catch (err) {
        console.warn('Failed to setup realtime subscription:', err);
        subscribed = false;
      }
    };

    setupRealtimeSubscription();
    
    return () => {
      subscribed = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const data = computeAnalytics(allAttempts, { days });

  return { data, loading, refresh, source };
}
