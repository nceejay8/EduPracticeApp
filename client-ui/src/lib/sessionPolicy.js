// How long a signed-in session lasts.
//
// The ceiling on a session is set by Supabase (the access token expires after an
// hour but is refreshed silently; the refresh token decides the real limit). We
// cannot read or change that from the browser, so this module enforces our own
// policy *underneath* it: a session is signed out after SESSION_DAYS regardless
// of whether the refresh token would still have been valid.
//
// The point is a predictable answer to "how long until I have to sign in again?"
// rather than "whenever the server feels like it". A student closing the app on
// Friday should find it still signed in on Monday, and should not still be signed
// in three weeks later.
//
// If the refresh token lifetime in the Supabase dashboard is ever configured
// *shorter* than SESSION_DAYS, that becomes the binding limit and users will be
// signed out earlier than this policy intends. The default is 30 days, so a
// 7-day cap sits comfortably inside it.

const STORAGE_KEY = 'edupractice_session_start';
const SIGNOUT_REASON_KEY = 'edupractice_signout_reason';

export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// localStorage throws in private-browsing modes and when storage is disabled by
// policy. A student must still be able to use the app in that case, so every
// access degrades to "no policy" rather than breaking sign-in.
function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — the policy simply cannot be enforced without storage.
  }
}

// When the current session began, as a timestamp.
//
// Deliberately *not* derived from the access token: Supabase silently reissues
// that every hour, so its issue time says nothing about how long the student has
// actually been signed in.
export function getSessionStart() {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function markSessionStart(now = Date.now()) {
  writeStorage(STORAGE_KEY, String(now));
}

export function clearSessionStart() {
  removeStorage(STORAGE_KEY);
}

// When this session must end, or null when no session is being tracked.
export function getSessionDeadline() {
  const start = getSessionStart();
  return start === null ? null : start + SESSION_MAX_AGE_MS;
}

// Milliseconds left, or null when untracked. Never negative: a caller deciding
// whether to show a countdown wants 0, not a negative number that renders as a
// countdown in the past.
export function getRemainingMs(now = Date.now()) {
  const start = getSessionStart();
  if (start === null) return null;
  return Math.max(0, start + SESSION_MAX_AGE_MS - now);
}

export function isSessionExpired(now = Date.now()) {
  const remaining = getRemainingMs(now);
  return remaining !== null && remaining <= 0;
}

// Adopts an existing session that predates this policy, so a student who was
// already signed in when it shipped is not signed out on their next page load.
// Returns true if a start time is now being tracked.
export function ensureSessionStart(now = Date.now()) {
  if (getSessionStart() !== null) return false;
  markSessionStart(now);
  return true;
}

// Why the last session ended, so the sign-in page can explain itself instead of
// dumping someone back on a login form with no context. sessionStorage rather
// than localStorage: it should not outlive the tab.
export const SIGN_OUT_REASONS = {
  expired: 'expired',
  manual: 'manual',
};

export function setSignOutReason(reason) {
  try {
    window.sessionStorage.setItem(SIGNOUT_REASON_KEY, reason);
  } catch {
    // Explanatory only; losing it is not worth breaking a sign-out over.
  }
}

// Read-once: the reason is consumed by whoever asks first, so a stale "your
// session expired" message does not greet the student days later.
export function consumeSignOutReason() {
  try {
    const reason = window.sessionStorage.getItem(SIGNOUT_REASON_KEY);
    window.sessionStorage.removeItem(SIGNOUT_REASON_KEY);
    return reason;
  } catch {
    return null;
  }
}

// Read without consuming. The auth listener needs to know whether a sign-out was
// deliberate while leaving the reason intact, because it is the sign-in page
// that turns the reason into a message — consuming it here would swallow it.
export function peekSignOutReason() {
  try {
    return window.sessionStorage.getItem(SIGNOUT_REASON_KEY);
  } catch {
    return null;
  }
}

// Short, human phrasing for the session chip. Deliberately coarse: "6 days left"
// invites a false sense of precision, and the exact number is not what anyone
// needs to make a decision.
export function describeRemaining(ms) {
  if (ms === null) return null;
  if (ms <= 0) return 'expired';
  // Floor the day count rather than rounding it up. Ceiling would report "1 day
  // left" with five hours remaining, which hides exactly the moment a student
  // most needs to know their session is about to end.
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `${hours} hour${hours === 1 ? '' : 's'} left`;
}
