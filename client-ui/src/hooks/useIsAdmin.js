// Is the signed-in user allowed into /admin?
//
// This replaces a hardcoded PIN that lived in the client bundle
// (`CORRECT_PIN` in Admin.jsx) and was printed on the admin
// screen. A PIN checked in the browser is not a boundary — it shipped in source,
// anyone could read it from the page, and it granted nothing that mattered.
//
// The real answer now comes from the database. `content_admins` has no INSERT
// policy, so a row can only be added by hand in the SQL editor: a compromised
// session cannot promote itself. The same check is enforced independently by RLS
// on practice_questions, so this hook controls what the UI *shows* rather than
// being the thing that keeps students out.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export function useIsAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState({ isAdmin: false, loading: true });

  useEffect(() => {
    // Not signed in is a settled answer, not a pending one. Leaving this loading
    // would hang the admin page on a signed-out visitor.
    if (authLoading) return;
    if (!user || !supabase) {
      setState({ isAdmin: false, loading: false });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true }));

    supabase
      .from('content_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // The allowlist table may not have been created yet. Say so plainly
          // rather than silently reporting "not an admin", which would look
          // identical to being signed in as a student.
          console.warn('[admin] could not verify admin access:', error.message);
          setState({ isAdmin: false, loading: false, error: 'not-verified' });
          return;
        }
        setState({ isAdmin: Boolean(data), loading: false });
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return state;
}
