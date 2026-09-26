import React from 'react';
import { Icon } from '@iconify/react';
import useOnlineStatus from '../hooks/useOnlineStatus';

/**
 * A quiet, persistent statement of two things a student needs to know when the
 * network drops: their work is safe, and only some features are unavailable.
 *
 * Deliberately not a blocking modal. Practice, exams and the syllabus are all
 * local-first and keep working, and interrupting a student mid-question to tell
 * them something that does not affect the task in front of them would be worse
 * than saying nothing. What genuinely stops working is named instead, so nobody
 * is surprised when Maestro does not answer.
 */
export default function OfflineBanner({ pendingSyncCount = 0 }) {
  const isOnline = useOnlineStatus();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-[13px] font-medium border-b border-amber-500/25 bg-amber-500/10 text-amber-200 backdrop-blur"
    >
      <Icon
        icon="solar:cloud-cross-linear"
        width="16" height="16"
        className="shrink-0"
        style={{ strokeWidth: 1.5 }}
      />
      {!isOnline && (
        <span>
          You&rsquo;re offline. Your work is saved on this device and will sync when you reconnect
          {pendingSyncCount > 0 ? ` — ${pendingSyncCount} waiting to sync` : ''}.
        </span>
      )}
      {isOnline && pendingSyncCount > 0 && (
        <span>Syncing {pendingSyncCount} offline {pendingSyncCount === 1 ? 'result' : 'results'}…</span>
      )}
    </div>
  );
}
