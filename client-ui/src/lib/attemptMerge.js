/**
 * Merging attempts held locally with attempts held on the server.
 *
 * The read path used to *replace* the local list with the server list. That is
 * only safe if every local write has definitely reached the server, which is
 * exactly what is untrue while a student is offline. The result was the worst
 * possible failure for a learning app: work that was provably on disk became
 * invisible everywhere the moment the network came back.
 *
 * Merging removes that whole class of bug. The two lists are unioned and
 * de-duplicated, so an attempt is visible the instant it is recorded and stays
 * visible whether or not it has synced yet. The queue in `syncQueue.js` is what
 * eventually gets the server up to date; this module is what keeps the UI honest
 * in the meantime.
 *
 * Pure functions only — no storage, no network, no React — so the merge rules can
 * be tested directly.
 */

/**
 * Union two attempt lists.
 *
 * On a conflict the server row wins, because it is the copy other devices can
 * see and it carries the canonical field values. But the two are *merged* rather
 * than swapped, so local-only fields survive: a practice attempt's syllabus
 * coordinates (`subject`, `topicId`, `chapterId`) exist only locally, and
 * dropping them would silently move the attempt out of per-topic progress.
 */
export function mergeAttempts(remote = [], local = [], options = {}) {
  const {
    keyOf = (a) => a?.id,
    timeOf = (a) => a?.submittedAt || a?.timestamp || '',
    limit = 500,
  } = options;

  const byKey = new Map();
  const keyless = [];
  const put = (attempt) => {
    if (!attempt || typeof attempt !== 'object') return;
    const key = keyOf(attempt);
    if (key === null || key === undefined || key === '') {
      // Nothing to match on, so it cannot be de-duplicated. Keep it rather than
      // dropping real work; a duplicate here is far less harmful than a
      // disappearing attempt.
      keyless.push(attempt);
      return;
    }
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...attempt } : attempt);
  };

  local.forEach(put);
  remote.forEach(put);

  const all = [...byKey.values(), ...keyless];
  all.sort((a, b) => String(timeOf(b)).localeCompare(String(timeOf(a))));
  return all.slice(0, limit);
}

// ── Exam attempts ────────────────────────────────────────────────────────────
// Keyed on the client-generated attempt id, which is stored server-side as
// `exam_id` precisely so the two can be matched.

export function mergeExamAttempts(remote = [], local = []) {
  return mergeAttempts(remote, local, {
    keyOf: (a) => a?.id,
    timeOf: (a) => a?.submittedAt,
  });
}

// ── Practice attempts ────────────────────────────────────────────────────────

export function mergePracticeAttempts(remote = [], local = []) {
  return mergeAttempts(remote, local, {
    keyOf: (a) => a?.id,
    timeOf: (a) => a?.timestamp,
  });
}

/**
 * A stable id for a practice attempt.
 *
 * New attempts get an id at record time. Older ones stored before ids existed
 * derive one from their own contents, so they de-duplicate against their
 * server row after the first sync instead of being counted twice.
 */
export function practiceAttemptId(attempt) {
  if (attempt?.id) return attempt.id;
  const stamp = attempt?.timestamp || '';
  const where = attempt?.topicId || attempt?.topicName || '';
  return `pa_legacy_${stamp}_${where}`;
}

/**
 * The Supabase row for a practice attempt.
 *
 * Kept beside the merge rules so the shape written to the server and the shape
 * read back cannot drift apart. `id` is the queue's idempotency key as well as
 * the merge key, so the same attempt can be queued, retried and de-duplicated
 * without ever producing a second row.
 */
export function practiceAttemptToRow(attempt, userId) {
  return {
    id: practiceAttemptId(attempt),
    user_id: userId,
    subject: attempt.subject ?? null,
    topic_id: attempt.topicId ?? null,
    chapter_id: attempt.chapterId ?? null,
    topic_name: attempt.topicName ?? null,
    score: Number.isFinite(attempt.score) ? attempt.score : 0,
    duration_min: Number.isFinite(attempt.duration) ? attempt.duration : 0,
    recorded_at: attempt.timestamp || new Date().toISOString(),
  };
}

/** Server row back into the shape the local store uses. */
export function practiceRowToAttempt(row) {
  return {
    id: row.id,
    subject: row.subject ?? undefined,
    topicId: row.topic_id ?? undefined,
    chapterId: row.chapter_id ?? undefined,
    topicName: row.topic_name ?? undefined,
    score: row.score ?? 0,
    duration: row.duration_min ?? 0,
    timestamp: row.recorded_at ?? undefined,
  };
}
