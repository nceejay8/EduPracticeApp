// Tests for the offline sync layer: the durable outbox and the merge rules.
//
//   npm test
//
// These two modules carry the only logic standing between a student and silently
// losing their work, so the edges are pinned here: an attempt taken offline must
// stay visible, must reach the server exactly once, and must not stop the queue
// when one row cannot be written.
//
// Plain Node with a fake localStorage — no browser, no framework, no network.

import {
  clearSync,
  enqueueSync,
  flushSync,
  pendingCount,
  pendingSync,
  resetSyncQueue,
} from '../src/lib/syncQueue.js';
import {
  mergeAttempts,
  mergeExamAttempts,
  mergePracticeAttempts,
  practiceAttemptId,
  practiceAttemptToRow,
  practiceRowToAttempt,
} from '../src/lib/attemptMerge.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) { fails++; console.log(`FAIL  ${label} ${extra}`); }
  else console.log(`ok    ${label} ${extra}`);
};

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;
const iso = (ms) => new Date(ms).toISOString();

// Fake localStorage installed before the modules are used. The modules only
// touch it inside function bodies, so a plain object is enough.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
};
const reset = () => {
  store.clear();
  resetSyncQueue();
};

// ═══ Merge ═══════════════════════════════════════════════════════════════════

// The bug this exists to prevent: an attempt is in localStorage but not yet on
// the server, and the read path used to prefer the server copy — so the attempt
// disappeared from every view the moment the network came back.
reset();
{
  const local = [
    { id: 'a1', title: 'Physics Midterm', percentage: 70, submittedAt: iso(T0) },
    { id: 'a2', title: 'Offline Attempt', percentage: 55, submittedAt: iso(T0 - 2 * DAY) },
  ];
  const remote = [
    { id: 'a1', title: 'Physics Midterm', percentage: 70, submittedAt: iso(T0) },
  ];
  const merged = mergeExamAttempts(remote, local);
  check('offline attempt survives the merge', merged.length === 2, `(got ${merged.length})`);
  check('offline attempt is present', merged.some(a => a.id === 'a2'));
  check('synced attempt is not duplicated', merged.filter(a => a.id === 'a1').length === 1);
  check('merged is newest first', merged[0].id === 'a1', `(got ${merged[0]?.id})`);
}

// Remote wins on a genuine conflict, but local-only fields survive. Practice
// attempts carry syllabus coordinates that only exist locally; dropping them
// would move the attempt out of per-topic progress.
{
  const local = [{ id: 'p1', score: 60, topicId: 'phy-mech-energy', subject: 'physics', timestamp: iso(T0) }];
  const remote = [{ id: 'p1', score: 60, topicName: 'Energy', timestamp: iso(T0) }];
  const merged = mergePracticeAttempts(remote, local);
  check('conflict keeps one record', merged.length === 1);
  check('local syllabus coordinates survive', merged[0].topicId === 'phy-mech-energy');
  check('local subject survives', merged[0].subject === 'physics');
  check('server field is adopted', merged[0].topicName === 'Energy');
}

// An attempt with no id at all must not be silently dropped — losing real work
// is worse than the possibility of a duplicate line.
{
  const merged = mergeAttempts([{ id: 'x', v: 1 }], [{ v: 2 }, null, undefined, 'junk']);
  check('keyless record is kept', merged.some(a => a.v === 2));
  check('junk is discarded', !merged.some(a => a === 'junk'));
  check('null entries discarded', merged.length === 2, `(got ${merged.length})`);
}

// Ordering and the cap. Exercised through mergeAttempts because the typed
// wrappers deliberately do not expose the cap — production relies on the default.
{
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `m${i}`, submittedAt: iso(T0 - i * 1000),
  }));
  const merged = mergeAttempts([], many, { keyOf: a => a.id, timeOf: a => a.submittedAt, limit: 5 });
  check('cap is applied', merged.length === 5, `(got ${merged.length})`);
  check('cap keeps the newest', merged[0].id === 'm0', `(got ${merged[0]?.id})`);
  check('sorted newest first', merged[0].submittedAt > merged[4].submittedAt);
  check('default cap is 500', mergeAttempts([], many, { keyOf: a => a.id }).length === 12);
}

// ═══ Practice attempt ids ════════════════════════════════════════════════════
{
  const a = { timestamp: iso(T0), topicId: 'phy-mech-energy', topicName: 'Energy' };
  check('id derived when absent', practiceAttemptId(a) === `pa_legacy_${iso(T0)}_phy-mech-energy`);
  check('id is stable across calls', practiceAttemptId(a) === practiceAttemptId({ ...a }));
  check('existing id is respected', practiceAttemptId({ ...a, id: 'given' }) === 'given');
  check('falls back to topic name', practiceAttemptId({ timestamp: iso(T0), topicName: 'Waves' }).endsWith('Waves'));
}

// ═══ Row shape round-trips ═══════════════════════════════════════════════════
{
  const attempt = {
    id: 'pa_x', subject: 'physics', topicId: 'phy-mech-energy', chapterId: 'phy-mech',
    topicName: 'Energy', score: 80, duration: 4, timestamp: iso(T0),
  };
  const row = practiceAttemptToRow(attempt, 'user-1');
  check('row carries the client id', row.id === 'pa_x');
  check('row maps score', row.score === 80);
  check('row maps duration', row.duration_min === 4);
  check('row maps recorded_at', row.recorded_at === iso(T0));
  check('row fills a missing score', practiceAttemptToRow({ timestamp: iso(T0) }, 'u').score === 0);
  check('row tolerates a non-numeric score', practiceAttemptToRow({ score: NaN, timestamp: iso(T0) }, 'u').score === 0);

  const back = practiceRowToAttempt(row);
  check('round-trips the topic', back.topicId === 'phy-mech-energy');
  check('round-trips the score', back.score === 80);
  check('round-trips the id', back.id === 'pa_x');
  check('round-trips the chapter', back.chapterId === 'phy-mech');
  check('row with no chapter maps to undefined', practiceRowToAttempt({ id: 'z' }).chapterId === undefined);
}

// ═══ Outbox: enqueue ═════════════════════════════════════════════════════════
reset();
{
  check('queue starts empty', pendingCount() === 0);
  check('enqueue reports success', enqueueSync({ id: 'a1', table: 'exam_attempts', row: { v: 1 } }) === true);
  check('queued item is pending', pendingCount() === 1);
  // Idempotent: a double submit or a re-render must not produce two rows.
  check('re-queueing the same id is a no-op', enqueueSync({ id: 'a1', table: 'exam_attempts', row: { v: 1 } }) === false);
  check('still one item', pendingCount() === 1);
  check('invalid item rejected (no table)', enqueueSync({ id: 'x', row: {} }) === false);
  check('invalid item rejected (no id)', enqueueSync({ table: 't', row: {} }) === false);
  check('queue unchanged after invalid input', pendingCount() === 1);
}

// A corrupt or hand-edited queue must not inject junk into a flush.
{
  globalThis.localStorage.setItem('edupractice_sync_queue', JSON.stringify([
    { id: 'good', table: 'exam_attempts', row: {} },
    { id: 'bad' },
    null,
    'nonsense',
  ]));
  check('corrupt entries filtered on read', pendingSync().length === 1, `(got ${pendingSync().length})`);
  check('the valid entry survives', pendingSync()[0].id === 'good');
}

// ═══ Outbox: flush ═══════════════════════════════════════════════════════════
{
  reset();
  enqueueSync({ id: 'a1', table: 'exam_attempts', row: { v: 1 } });
  enqueueSync({ id: 'a2', table: 'exam_attempts', row: { v: 2 } });
  const sent = [];
  const res = await flushSync(async item => { sent.push(item.id); return true; });
  check('flush synced both', res.synced === 2, JSON.stringify(res));
  check('flush reported no failures', res.failed === 0);
  check('queue drained', pendingCount() === 0);
  check('each item sent once', sent.sort().join(',') === 'a1,a2');
}

// A failure must leave the item queued, not drop the student's work.
{
  reset();
  enqueueSync({ id: 'keep', table: 'practice_attempts', row: {} });
  const res = await flushSync(async () => false);
  check('failed item stays queued', pendingCount() === 1, `(got ${pendingCount()})`);
  check('failure counted', res.failed === 1);
}

// A throwing sender is a failure, not a crash.
{
  reset();
  enqueueSync({ id: 'boom', table: 'exam_attempts', row: {} });
  let threw = false;
  let res;
  try {
    res = await flushSync(async () => { throw new Error('network'); });
  } catch { threw = true; }
  check('a throwing sender does not escape', !threw);
  check('throwing sender counts as failure', res && res.failed === 1);
  check('throwing sender keeps the item', pendingCount() === 1);
}

// One unwritable row must not block the rows behind it — this is the
// missing-table case, and it would otherwise wedge the queue forever.
{
  reset();
  enqueueSync({ id: 'bad', table: 'practice_attempts', row: {} });
  enqueueSync({ id: 'good', table: 'exam_attempts', row: {} });
  const res = await flushSync(async item => item.id === 'good');
  check('a good row behind a bad one still syncs', res.synced === 1, JSON.stringify(res));
  check('the bad row remains for retry', pendingSync().some(i => i.id === 'bad'));
}

// Repeated failures are eventually abandoned so the queue cannot grow forever.
{
  reset();
  enqueueSync({ id: 'stuck', table: 'nope', row: {} });
  let totalDropped = 0;
  for (let i = 0; i < 12; i++) {
    const r = await flushSync(async () => false);
    totalDropped += r.dropped;
  }
  check('a permanently failing row is dropped', pendingCount() === 0, `(got ${pendingCount()})`);
  check('drop is reported', totalDropped === 1, `(got ${totalDropped})`);
}

// Going offline mid-flush stops the attempt rather than hammering a dead link.
{
  reset();
  enqueueSync({ id: 'q1', table: 'exam_attempts', row: {} });
  enqueueSync({ id: 'q2', table: 'exam_attempts', row: {} });
  let calls = 0;
  const res = await flushSync(async () => { calls++; return true; }, { isOnline: () => false });
  check('aborts immediately when offline', calls === 0, `(called ${calls}×)`);
  check('abort is reported', res.aborted === true);
  check('nothing drained while offline', pendingCount() === 2);
}

// ═══ Outbox: removal ═════════════════════════════════════════════════════════
{
  reset();
  enqueueSync({ id: 'a', table: 't', row: {} });
  enqueueSync({ id: 'b', table: 't', row: {} });
  check('clearSync removes one', clearSync('a') === true);
  check('clearing a missing id is a no-op', clearSync('zzz') === false);
  check('the other item remains', pendingSync().some(i => i.id === 'b'));
}

// ═══ The full offline round trip ═════════════════════════════════════════════
// Record offline, stay visible, then reach the server exactly once.
{
  reset();
  const attempt = { id: 'offline-1', title: 'Taken on a train', percentage: 62, submittedAt: iso(T0) };
  enqueueSync({ id: attempt.id, table: 'exam_attempts', row: { exam_id: attempt.id } });
  const local = [attempt];

  // Offline: nothing reaches the server, but the attempt is still shown.
  const offline = await flushSync(async () => true, { isOnline: () => false });
  check('offline: nothing synced', offline.synced === 0);
  check('offline: attempt still visible', mergeExamAttempts([], local).length === 1);

  // Reconnect: it syncs, and merging then agrees there is exactly one.
  let inserts = 0;
  const back = await flushSync(async () => { inserts++; return true; });
  check('reconnect: synced once', inserts === 1 && back.synced === 1);
  const remote = [{ id: 'offline-1', title: 'Taken on a train', percentage: 62, submittedAt: iso(T0) }];
  const merged = mergeExamAttempts(remote, local);
  check('no duplicate after sync', merged.length === 1, `(got ${merged.length})`);
  check('queue empty after sync', pendingCount() === 0);
}

reset();
console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
