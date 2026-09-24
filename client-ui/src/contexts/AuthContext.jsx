import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const sessionUpdatedRef = useRef(null); // Will hold resolve function

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

        setSession(supabaseSession);
        setUser(supabaseSession?.user || null);

        const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
          setSession(newSession);
          setUser(newSession?.user || null);
          if (event === 'SIGNED_OUT') setError(null);
          
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
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

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
    
    // Sign out and clear all sensitive data
    const result = await authService.signOut();
    if (result.error) console.error('Sign out error:', result.error);
    
    // Clear auth state
    setUser(null);
    setSession(null);
    
    // Clear any error messages
    setError(null);
    
    return { success: !result.error };
  };

  const clearError = () => setError(null);

  const value = {
    user, session, isLoading, error,
    isAuthenticated: !!user,
    signIn, signUp, verifyOtp, confirmEmail,
    resendVerificationEmail, requestPasswordReset,
    updatePassword, logOut, clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
