// Tests for the session lifetime policy.
//
//   npm test
//
// A week-long session is a promise to the student: come back after the weekend
// and your work is still there, but don't expect the app to still know who you
// a month later. Both halves are easy to break by accident — a refactor that
// clears the marker, a clock that runs backwards, a "helpful" migration that
// resets the window on every page load — so the edges are pinned here.
//
// Uses a fake localStorage/sessionStorage rather than the real ones: this is a
// pure-storage policy and must be testable without a browser.

import {
  SESSION_DAYS,
  SESSION_MAX_AGE_MS,
  clearSessionStart,
  consumeSignOutReason,
  describeRemaining,
  ensureSessionStart,
  getRemainingMs,
  getSessionDeadline,
  getSessionStart,
  isSessionExpired,
  markSessionStart,
  peekSignOutReason,
  setSignOutReason,
} from '../src/lib/sessionPolicy.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) { fails++; console.log(`FAIL  ${label} ${extra}`); }
  else console.log(`ok    ${label} ${extra}`);
};

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000; // fixed instant, so nothing depends on real time

function installStorage() {
  const make = () => {
    const map = new Map();
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: k => map.delete(k),
      clear: () => map.clear(),
      _map: map,
    };
  };
  globalThis.window = { localStorage: make(), sessionStorage: make() };
}
installStorage();

const reset = () => {
  globalThis.window.localStorage.clear();
  globalThis.window.sessionStorage.clear();
};

// ── 1. The window is a week ─────────────────────────────────────────────────
check('session is 7 days', SESSION_DAYS === 7, `(${SESSION_DAYS})`);
check('7 days in ms', SESSION_MAX_AGE_MS === 7 * DAY, `(${SESSION_MAX_AGE_MS})`);

// ── 2. Lifecycle ────────────────────────────────────────────────────────────
reset();
check('no session tracked initially', getSessionStart() === null);
check('no deadline without a session', getSessionDeadline() === null);
check('no remaining time without a session', getRemainingMs(T0) === null);
check('not expired without a session', isSessionExpired(T0) === false);

markSessionStart(T0);
check('start recorded', getSessionStart() === T0);
check('deadline is start + 7 days', getSessionDeadline() === T0 + SESSION_MAX_AGE_MS);
check('full window remaining at sign-in', getRemainingMs(T0) === SESSION_MAX_AGE_MS);

// The point of the feature: a student who closes the app on Friday is still
// signed in on Monday.
markSessionStart(T0);
const monday = T0 + 3 * DAY;
check('still signed in 3 days later', isSessionExpired(monday) === false);
check('3 days still counted down', getRemainingMs(monday) === 4 * DAY);

const sixDays = T0 + 6 * DAY;
check('still signed in 6 days later', isSessionExpired(sixDays) === false);
check('1 day left at 6 days', getRemainingMs(sixDays) === DAY);

const sevenDays = T0 + 7 * DAY;
check('expired at exactly 7 days', isSessionExpired(sevenDays) === true, `remaining=${getRemainingMs(sevenDays)}`);
check('remaining never goes negative', getRemainingMs(sevenDays + 5 * DAY) === 0);

clearSessionStart();
check('cleared', getSessionStart() === null);
check('cleared means no deadline', getSessionDeadline() === null);

// ── 3. Surviving a reload ───────────────────────────────────────────────────
// localStorage, not sessionStorage: closing the tab must not end the session,
// or the feature would not work at all.
markSessionStart(T0);
installStorage(); // simulate a fresh page load
globalThis.window.localStorage.setItem('edupractice_session_start', String(T0));
check('survives a page reload', getSessionStart() === T0);
check('still valid after a reload 2 days in', isSessionExpired(T0 + 2 * DAY) === false);

// ── 4. Clock going backwards ────────────────────────────────────────────────
// A user whose device clock is wrong, or a DST/timezone slip, must not be signed
// out early — the window is a maximum, and it is measured forwards only.
markSessionStart(T0);
check('a backwards clock does not expire the session', isSessionExpired(T0 - 10 * DAY) === false);
check('a backwards clock does not extend the deadline', getSessionDeadline() === T0 + SESSION_MAX_AGE_MS);

// ── 5. Pre-existing sessions are adopted, not killed ────────────────────────
// Students already signed in when this policy shipped have no marker. Signing
// them out on their next page load would look like a bug and lose their session.
reset();
check('adopting returns true when there was no marker', ensureSessionStart(T0) === true);
check('adopting records the start', getSessionStart() === T0);
check('adopting again returns false', ensureSessionStart(T0 + DAY) === false);
check('adopting does not move the start', getSessionStart() === T0, `(got ${getSessionStart()})`);
check('adopted session runs the full week from adoption',
  getRemainingMs(T0 + 6 * DAY) === DAY);

// ── 6. Sign-out reason ──────────────────────────────────────────────────────
reset();
check('no reason initially', consumeSignOutReason() === null);
setSignOutReason('expired');
check('reason recorded', consumeSignOutReason() === 'expired');
check('reason is read-once', consumeSignOutReason() === null,
  'a stale message must not greet the student days later');

setSignOutReason('manual');
check('manual reason', consumeSignOutReason() === 'manual');
setSignOutReason('expired');
setSignOutReason('manual');
check('latest reason wins', consumeSignOutReason() === 'manual');

// Peeking must not consume. The auth listener peeks to tell a deliberate
// sign-out from a server-side revoke, and if the peek also cleared the marker
// the sign-in page would find nothing and never explain itself.
setSignOutReason('expired');
check('peek sees the reason', peekSignOutReason() === 'expired');
check('peek does not consume', peekSignOutReason() === 'expired');
check('reason survives a peek', consumeSignOutReason() === 'expired');
check('peek is empty once consumed', peekSignOutReason() === null);

// ── 7. Storage that throws must not break sign-in ───────────────────────────
// Private browsing and enterprise storage policies both make localStorage throw.
// A student in that mode still has to be able to use the app.
reset();
globalThis.window.localStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
  removeItem() { throw new Error('SecurityError'); },
};
let threw = false;
try {
  markSessionStart(T0);
  getSessionStart();
  isSessionExpired(T0 + 99 * DAY);
  clearSessionStart();
} catch {
  threw = true;
}
check('blocked storage degrades instead of throwing', !threw);
check('blocked storage means no deadline', getSessionDeadline() === null);

installStorage();
reset();

// ── 8. Human phrasing ───────────────────────────────────────────────────────
check('describes days', describeRemaining(4 * DAY) === '4 days left', `(${describeRemaining(4 * DAY)})`);
check('singular day', describeRemaining(DAY) === '1 day left', `(${describeRemaining(DAY)})`);
// Must not round up: "1 day left" with five hours remaining hides the moment a
// student most needs to know their session is about to end.
check('describes hours under a day', describeRemaining(5 * 60 * 60 * 1000) === '5 hours left',
  `(${describeRemaining(5 * 60 * 60 * 1000)})`);
check('one hour left is not "1 day left"', describeRemaining(60 * 60 * 1000) === '1 hour left',
  `(${describeRemaining(60 * 60 * 1000)})`);
check('a minute left', describeRemaining(60 * 1000) === '1 hour left', `(${describeRemaining(60 * 1000)})`);
check('expired is not negative', describeRemaining(0) === 'expired');
check('untracked has no phrasing', describeRemaining(null) === null);

// ── 9. Garbage in storage ───────────────────────────────────────────────────
reset();
globalThis.window.localStorage.setItem('edupractice_session_start', 'not-a-number');
check('non-numeric marker ignored', getSessionStart() === null);
check('non-numeric marker means not expired', isSessionExpired(T0) === false);
globalThis.window.localStorage.setItem('edupractice_session_start', '-1');
check('negative marker ignored', getSessionStart() === null);
globalThis.window.localStorage.setItem('edupractice_session_start', '0');
check('zero marker ignored', getSessionStart() === null);

console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
