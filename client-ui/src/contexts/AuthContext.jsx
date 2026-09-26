import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as authService from '../services/authService';
import useOnlineStatus, { browserIsOnline } from '../hooks/useOnlineStatus';
import {
  SESSION_DAYS,
  clearSessionStart,
  consumeSignOutReason,
  ensureSessionStart,
  getSessionDeadline,
  isSessionExpired,
  markSessionStart,
  peekSignOutReason,
  setSignOutReason,
} from '../lib/sessionPolicy';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // True when we are reasonably sure the server ended the session but could not
  // be asked about it, because the device is offline. Distinct from "signed
  // out": the student keeps their session and their local work.
  const [isOffline, setIsOffline] = useState(false);
  // Absolute instant the session ends, not a countdown. A stored timestamp stays
  // correct between renders, whereas a stored "remaining ms" is stale the moment
  // it is set and would sit at "7 days left" for the whole week.
  const [sessionDeadline, setSessionDeadline] = useState(null);
  const sessionUpdatedRef = useRef(null); // Will hold resolve function

  const isOnline = useOnlineStatus();

  // Signs out of Supabase and clears the policy marker, recording why. Every
  // sign-out path goes through here so the sign-in page can tell the student
  // whether they were timed out or simply chose to leave.
  const endSession = useCallback(async (reason) => {
    // Recorded before the revoke: revoking fires SIGNED_OUT, whose handler looks
    // for this marker to tell an expiry apart from a deliberate sign-out.
    if (reason) setSignOutReason(reason);
    clearSessionStart();
    setSessionDeadline(null);
    setIsOffline(false);
    const result = await authService.signOut();
    if (result.error) console.error('Sign out error:', result.error);
    setUser(null);
    setSession(null);
  }, []);

  // ── The 7-day clock ───────────────────────────────────────────────────────
  // Kept out of the auth-listener effect on purpose: a session that starts in
  // this tab (not at page load) needs a timer too, and depending on the deadline
  // rather than the remaining time means a background token refresh does not
  // churn this effect.
  useEffect(() => {
    if (!user || sessionDeadline === null) return;

    let timer;
    const schedule = () => {
      clearTimeout(timer);
      const remaining = sessionDeadline - Date.now();
      if (remaining <= 0) {
        endSession('expired');
        return;
      }
      // setTimeout cannot be trusted past ~24.8 days; re-check daily instead of
      // scheduling out of range, which would fire immediately and sign the
      // student out early.
      timer = setTimeout(schedule, Math.min(remaining, 24 * 60 * 60 * 1000));
    };

    // A sleeping laptop or a backgrounded tab throttles timers hard, so the
    // deadline is also checked whenever the student comes back.
    const recheck = () => {
      if (sessionDeadline - Date.now() <= 0) endSession('expired');
      else schedule();
    };

    schedule();
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [user, sessionDeadline, endSession]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let unsubscribe;

    const initAuth = async () => {
      try {
        // Session is managed by Supabase (auto-refresh + persistence),
        // so just read the current session and subscribe to changes.
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();

        if (supabaseSession) {
          // A session older than the policy window is ended before it is
          // exposed to the app, so no protected route ever renders for it.
          if (isSessionExpired()) {
            await endSession('expired');
            setIsLoading(false);
            return;
          }
          // Pre-existing sessions get a fresh window rather than being logged
          // out by a policy that did not exist when they started.
          ensureSessionStart();
        }

        setSession(supabaseSession);
        setUser(supabaseSession?.user || null);
        setSessionDeadline(getSessionDeadline());

        const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === 'SIGNED_OUT') {
            // A refresh that cannot reach the server ends the session locally
            // even though it is still perfectly valid. Signing the student out
            // here would throw away a working session because they were on a
            // train, so hold the session open and re-check once there is a
            // network again (see the reconnect effect below).
            if (!browserIsOnline()) {
              setIsOffline(true);
              return;
            }
            // endSession() has already recorded the reason when we initiated it.
            // Peek, do not consume: the sign-in page still needs to read it.
            // With no reason recorded, Supabase ended the session itself — a
            // rejected refresh or a server-side revoke — which from the
            // student's point of view is an expiry, not a choice they made.
            if (!peekSignOutReason()) setSignOutReason('expired');
            clearSessionStart();
            setSessionDeadline(null);
            setIsOffline(false);
            setError(null);
          }
          setSession(newSession);
          setUser(newSession?.user || null);
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            setSessionDeadline(getSessionDeadline());
          }

          // Notify signIn promise that session has been updated
          if (sessionUpdatedRef.current && newSession) {
            sessionUpdatedRef.current();
          }
        });

        unsubscribe = () => data.subscription.unsubscribe();
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [endSession]);

  // ── Re-check a held-open session once the network returns ─────────────────
  // The offline branch above deliberately does not sign anyone out. That is only
  // safe because the verdict is deferred, not skipped: as soon as there is a
  // network we ask the server whether the session is genuinely still good. If it
  // is not, the student is signed out then, which is the correct outcome — they
  // simply were not told about it while they had no way to act on it.
  useEffect(() => {
    if (!isOnline || !isOffline || !supabase) return;
    let cancelled = false;
    const revalidate = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data?.session) {
          // Still good — the refresh failure really was just the network.
          setIsOffline(false);
          return;
        }
        if (!cancelled) await endSession('expired');
      } catch {
        // Network still not usable. Stay offline and try again on the next event.
      }
    };
    revalidate();
    return () => {
      cancelled = true;
    };
  }, [isOnline, isOffline, endSession]);

  const signIn = async (email, password) => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.signInWithEmail(email, password);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
    
    // Create a promise that resolves when session is updated by listener
    const waitForSessionUpdate = new Promise(resolve => {
      sessionUpdatedRef.current = () => {
        sessionUpdatedRef.current = null;
        resolve();
      };
      // Safety timeout to avoid hanging forever
      setTimeout(() => {
        if (sessionUpdatedRef.current) {
          sessionUpdatedRef.current();
        }
      }, 2000);
    });
    
    await waitForSessionUpdate;
    // Start the 7-day window at the moment of a real sign-in, not at page load,
    // so the policy measures the session rather than the tab. The SIGNED_IN event
    // above has already run and found no marker, so the deadline is set here.
    if (result.data?.session) {
      markSessionStart();
      setSessionDeadline(getSessionDeadline());
    }
    return { success: true, user: result.data.user };
  };

  const signUp = async (email, password, userData) => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.signUpWithEmail(email, password, userData);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg, needsVerification: false };
    }
    return { success: true, user: result.data.user, needsVerification: result.data.needsEmailVerification };
  };

  const verifyOtp = async (email, token, type = 'signup') => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.verifyOtp(email, token, type);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true, user: result.data.user };
  };

  const confirmEmail = async (tokenHash, type) => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.confirmEmailToken(tokenHash, type);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true, user: result.data.user };
  };

  const resendVerificationEmail = async (email) => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.resendVerificationEmail(email);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true };
  };

  const requestPasswordReset = async (email) => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.requestPasswordReset(email);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true };
  };

  const updatePassword = async (password) => {
    if (!supabase) return { success: false, error: 'Auth not configured' };
    setError(null);
    const result = await authService.updatePasswordWithToken(password);
    if (result.error) {
      const errorMsg = authService.formatAuthError(result.error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true };
  };

  const logOut = async () => {
    if (!supabase) return { success: true };
    setError(null);

    // Signs out of Supabase, clears the policy marker, and records the reason.
    await endSession('manual');

    return { success: true };
  };

  // Why the previous session ended, so /login can explain itself. Consumed on
  // read so the message does not outlive the page it belongs to.
  const takeSignOutReason = () => consumeSignOutReason();

  const clearError = () => setError(null);

  const value = {
    user, session, isLoading, error,
    isAuthenticated: !!user,
    isOffline,
    sessionDays: SESSION_DAYS,
    sessionDeadline,
    signIn, signUp, verifyOtp, confirmEmail,
    resendVerificationEmail, requestPasswordReset,
    updatePassword, logOut, clearError, takeSignOutReason,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
