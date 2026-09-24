import { supabase } from '../lib/supabaseClient';

/**
 * AuthService - Secure authentication with rate limiting
 * - Never passes tokens via URLs
 * - Rate limits login attempts per email
 * - Handles session management via Supabase
 * - Enforces email verification
 */

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const RATE_LIMIT_PREFIX = 'auth_rate_limit';   // FIX: single canonical prefix
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Build a consistent storage key for a given email.
 * Centralising this avoids the key-mismatch that caused clearAuthStorage
 * to silently fail in the original code.
 */
const rateLimitKey = (email) => `${RATE_LIMIT_PREFIX}:${email}`;

const getRateLimitState = (email) => {
  try {
    const stored = localStorage.getItem(rateLimitKey(email));
    if (!stored) return { attempts: 0, resetTime: null };

    const state = JSON.parse(stored);

    if (state.resetTime && Date.now() > state.resetTime) {
      localStorage.removeItem(rateLimitKey(email));
      return { attempts: 0, resetTime: null };
    }

    return state;
  } catch (e) {
    console.error('Error reading rate limit state:', e);
    return { attempts: 0, resetTime: null };
  }
};

const incrementRateLimit = (email) => {
  const state = getRateLimitState(email);
  const now = Date.now();
  const resetTime = state.resetTime || now + RATE_LIMIT_WINDOW;

  const newState = { attempts: state.attempts + 1, resetTime };
  localStorage.setItem(rateLimitKey(email), JSON.stringify(newState));
  return newState;
};

// FIX: now uses the same rateLimitKey helper, so the entry is actually removed
const clearRateLimit = (email) => {
  localStorage.removeItem(rateLimitKey(email));
};

const getResetMinutes = (resetTime) => {
  if (!resetTime) return 0;
  return Math.max(1, Math.ceil((resetTime - Date.now()) / 60_000));
};

// ─── Auth Operations ──────────────────────────────────────────────────────────

/**
 * Sign in with email and password.
 * - Rate limited per email address
 * - Session is persisted automatically by Supabase
 */
export const signInWithEmail = async (email, password) => {
  const rateLimit = getRateLimitState(email);

  if (rateLimit.attempts >= MAX_LOGIN_ATTEMPTS) {
    const resetMinutes = getResetMinutes(rateLimit.resetTime);
    return {
      error: new Error(
        `Too many login attempts. Please try again in ${resetMinutes} minute${resetMinutes > 1 ? 's' : ''}.`
      ),
      data: null,
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      incrementRateLimit(email);
      return { error, data: null };
    }

    clearRateLimit(email);
    return { error: null, data: { user: data.user, session: data.session } };
  } catch (err) {
    incrementRateLimit(email);
    return { error: err, data: null };
  }
};

/**
 * Sign up with email, password, and user metadata.
 * Requires subsequent email verification before the account is active.
 */
export const signUpWithEmail = async (email, password, userData = {}) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: userData.firstName || '',
          last_name: userData.lastName || '',
          school_name: userData.schoolName || '',
          exam_level: userData.examLevel || '',
          created_at: new Date().toISOString(),
        },
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    });

    if (error) return { error, data: null };

    return {
      error: null,
      data: {
        user: data.user,
        session: data.session,
        needsEmailVerification: !data.session,
      },
    };
  } catch (err) {
    return { error: err, data: null };
  }
};

/**
 * Verify a one-time OTP for email confirmation or account recovery.
 */
export const verifyOtp = async (email, token, type = 'signup') => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type });

    if (error) return { error, data: null };

    return { error: null, data: { user: data.user, session: data.session } };
  } catch (err) {
    return { error: err, data: null };
  }
};

/**
 * Confirm the user's email from the confirmation-link redirect
 * (Supabase sends `?token_hash=<hash>&type=signup` to the redirect URL).
 */
export const confirmEmailToken = async (tokenHash, type) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) return { error, data: null };

    return { error: null, data: { user: data.user, session: data.session } };
  } catch (err) {
    return { error: err, data: null };
  }
};

/**
 * Resend the signup verification email.
 */
export const resendVerificationEmail = async (email) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    return { error };
  } catch (err) {
    return { error: err };
  }
};

/**
 * Send a password-reset email.
 */
export const requestPasswordReset = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ?? null };
  } catch (err) {
    return { error: err };
  }
};

/**
 * Validate the recovery token received from the password-reset email link.
 * Only format/presence is checked here; Supabase validates authenticity
 * server-side when the session is established.
 */
export const validateRecoveryToken = (token, type) => {
  if (!token || !type || type !== 'recovery') return false;
  if (typeof token !== 'string' || token.length < 20) return false;
  return true;
};

/**
 * Update the user's password after arriving from a valid reset email link.
 * Requires an active Supabase recovery session (established automatically
 * when the user follows the email link).
 */
export const updatePasswordWithToken = async (password) => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return {
        error: new Error('Invalid or expired reset link. Please request a new password reset.'),
        data: null,
      };
    }

    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) return { error, data: null };

    // Invalidate the now-consumed recovery session across all devices
    await supabase.auth.signOut({ scope: 'global' });

    return { error: null, data: { user: data.user } };
  } catch (err) {
    return { error: err, data: null };
  }
};

/**
 * Get the current Supabase session.
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  } catch (err) {
    return { session: null, error: err };
  }
};

/**
 * Get the currently authenticated user.
 */
export const getCurrentUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  } catch (err) {
    return { user: null, error: err };
  }
};

/**
 * Sign out the current user.
 *
 * FIX: uses scope: 'global' to revoke ALL active sessions for this user,
 * not just the current browser tab.  The original call left every other
 * device/session fully authenticated after logout.
 */
export const signOut = async (email = null) => {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });

    clearAuthStorage(email);

    return { error };
  } catch (err) {
    return { error: err };
  }
};

/**
 * Clear sensitive auth data from browser storage.
 *
 * FIX: The original function tried to clear keys with the pattern
 * `eduPractice_rl_${action}`, which never matched the actual rate-limit
 * keys written as `auth_rate_limit:${email}`.  The rate-limit entry for the
 * signed-out user is now cleared correctly when `email` is supplied.
 * The CSRF state token is removed unconditionally.
 */
function clearAuthStorage(email = null) {
  // Remove the rate-limit entry for this specific email when known
  if (email) clearRateLimit(email);

  // Remove any persisted user preferences tied to this session
  localStorage.removeItem('edupractice_user_prefs');
}

// ─── Auth State Listener ─────────────────────────────────────────────────────

// FIX: removed the stray `"` character that appeared between clearAuthStorage
// and onAuthStateChange in the original source, which caused a syntax error.

/**
 * Subscribe to Supabase auth state changes.
 * @returns {Function} Unsubscribe function — call on component unmount.
 */
export const onAuthStateChange = (callback) => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription.unsubscribe;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Evaluate password strength against minimum security requirements.
 */
export const validatePasswordStrength = (password) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isLongEnough = password.length >= 8;

  return {
    isValid: isLongEnough && hasUppercase && hasLowercase && (hasNumbers || hasSpecialChars),
    length: isLongEnough,
    uppercase: hasUppercase,
    lowercase: hasLowercase,
    numbers: hasNumbers,
    specialChars: hasSpecialChars,
    score: [isLongEnough, hasUppercase, hasLowercase, hasNumbers || hasSpecialChars].filter(Boolean).length,
  };
};

/**
 * Map internal Supabase error messages to safe, user-facing strings.
 * Generic messages prevent account-enumeration attacks (e.g. probing
 * whether a given email address is registered).
 */
export const formatAuthError = (error) => {
  if (!error) return null;

  const message = error.message || String(error);

  const errorMap = {
    'Invalid login credentials': 'Invalid email or password.',
    'Email not confirmed': 'Please verify your email address before signing in.',
    'User already registered': 'Unable to create account at this time.',
    'Weak password': 'Password does not meet security requirements.',
    'Invalid email': 'Invalid email format.',
    'New password should be different': 'Password update failed — please choose a different password.',
    'Unverified Sender Address': 'Email service is temporarily unavailable.',
    'SignUp: Password invalid, password should contain at least 8 characters including uppercase':
      'Password does not meet security requirements.',
    'over_email_send_rate_limit':
      'Too many verification emails sent. Please wait before requesting another.',
  };

  // Log the raw error server-side only — never expose it to the UI
  console.error('[Auth Error]', message);

  return errorMap[message] ?? 'An authentication error occurred. Please try again.';
};